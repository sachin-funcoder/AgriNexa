"""Session context and message persistence for AgriNexa Chatbot."""

import json
import uuid
import logging
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from app.db.database import get_connection
from app.schemas.chatbot import ChatMessageItem, ActionChip

logger = logging.getLogger("agrinexa.chatbot.context")


class ChatbotContextService:
    """Manages chat conversation context, persistence, and state tracking."""

    @staticmethod
    def get_or_create_session(session_id: Optional[str] = None, user_id: Optional[str] = None) -> Dict[str, Any]:
        """Fetches existing session from DB or creates a new one."""
        conn = get_connection()
        cursor = conn.cursor()

        if session_id:
            cursor.execute("SELECT * FROM chat_sessions WHERE session_id = ?", (session_id,))
            row = cursor.fetchone()
            if row:
                conn.close()
                return dict(row)

        # Generate new session ID
        new_sid = session_id or f"sess_{uuid.uuid4().hex[:12]}"
        now_iso = datetime.now(timezone.utc).isoformat()
        cursor.execute("""
            INSERT INTO chat_sessions (
                session_id, user_id, language, last_crop_id, last_crop_name,
                last_mandi_id, last_mandi_name, last_intent, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            new_sid,
            user_id,
            "auto",
            None,
            None,
            None,
            None,
            None,
            now_iso,
            now_iso
        ))
        conn.commit()
        created = cursor.execute("SELECT * FROM chat_sessions WHERE session_id = ?", (new_sid,)).fetchone()
        conn.close()
        return dict(created)

    @staticmethod
    def update_session_context(
        session_id: str,
        crop_id: Optional[str] = None,
        crop_name: Optional[str] = None,
        mandi_id: Optional[str] = None,
        mandi_name: Optional[str] = None,
        intent: Optional[str] = None,
        language: Optional[str] = None
    ):
        """Updates the conversation context variables for future turn resolution."""
        conn = get_connection()
        cursor = conn.cursor()

        updates = ["updated_at = ?"]
        params = [datetime.now(timezone.utc).isoformat()]

        if crop_id:
            updates.append("last_crop_id = ?")
            params.append(crop_id)
        if crop_name:
            updates.append("last_crop_name = ?")
            params.append(crop_name)
        if mandi_id:
            updates.append("last_mandi_id = ?")
            params.append(mandi_id)
        if mandi_name:
            updates.append("last_mandi_name = ?")
            params.append(mandi_name)
        if intent:
            updates.append("last_intent = ?")
            params.append(intent)
        if language and language != "auto":
            updates.append("language = ?")
            params.append(language)

        params.append(session_id)
        cursor.execute(f"UPDATE chat_sessions SET {', '.join(updates)} WHERE session_id = ?", tuple(params))
        conn.commit()
        conn.close()

    @staticmethod
    def save_message(
        session_id: str,
        sender: str,
        text: str,
        language: str = "auto",
        intent: Optional[str] = None,
        sources_used: Optional[List[str]] = None,
        action_chips: Optional[List[Dict[str, Any]]] = None
    ) -> str:
        """Persists a single message in the chat history."""
        msg_id = f"msg_{uuid.uuid4().hex[:12]}"
        now_iso = datetime.now(timezone.utc).isoformat()
        sources_json = json.dumps(sources_used or [])
        chips_json = json.dumps(action_chips or [])

        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO chat_messages (
                message_id, session_id, sender, text, language,
                intent, sources_used, action_chips, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            msg_id,
            session_id,
            sender,
            text,
            language,
            intent,
            sources_json,
            chips_json,
            now_iso
        ))
        conn.commit()
        conn.close()
        return msg_id

    @staticmethod
    def get_history(session_id: str, limit: int = 50) -> List[ChatMessageItem]:
        """Retrieves bounded conversation messages for a session."""
        conn = get_connection()
        cursor = conn.cursor()
        rows = cursor.execute("""
            SELECT * FROM chat_messages 
            WHERE session_id = ?
            ORDER BY created_at ASC
            LIMIT ?
        """, (session_id, limit)).fetchall()
        conn.close()

        items = []
        for r in rows:
            sources = []
            chips = []
            if r["sources_used"]:
                try:
                    sources = json.loads(r["sources_used"])
                except Exception:
                    pass
            if r["action_chips"]:
                try:
                    raw_chips = json.loads(r["action_chips"])
                    chips = [ActionChip(**c) for c in raw_chips]
                except Exception:
                    pass

            items.append(ChatMessageItem(
                message_id=r["message_id"],
                session_id=r["session_id"],
                sender=r["sender"],
                text=r["text"],
                language=r["language"],
                intent=r["intent"],
                sources_used=sources,
                action_chips=chips,
                created_at=r["created_at"]
            ))
        return items

    @staticmethod
    def clear_history(session_id: str):
        """Deletes all messages and resets session context for the specified conversation."""
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM chat_messages WHERE session_id = ?", (session_id,))
        cursor.execute("""
            UPDATE chat_sessions SET
                last_crop_id = NULL,
                last_crop_name = NULL,
                last_mandi_id = NULL,
                last_mandi_name = NULL,
                last_intent = NULL,
                updated_at = ?
            WHERE session_id = ?
        """, (datetime.now(timezone.utc).isoformat(), session_id))
        conn.commit()
        conn.close()

