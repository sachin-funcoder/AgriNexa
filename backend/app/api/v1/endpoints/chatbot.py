"""API endpoints for Multilingual AI Voice Chatbot (Task 8)."""

from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, Query, HTTPException, status
from app.schemas.chatbot import (
    ChatMessageRequest,
    ChatMessageResponse,
    ChatHistoryResponse,
    SpeechToTextRequest,
    SpeechToTextResponse
)
from app.services.chatbot_service import ChatbotService
from app.services.chatbot_context_service import ChatbotContextService
from app.core.security import get_current_user_token, decode_access_token

router = APIRouter(prefix="/chatbot", tags=["AI Voice Chatbot"])

chatbot_service = ChatbotService()


def get_optional_user_id(token: Optional[str] = Depends(get_current_user_token)) -> Optional[str]:
    """Extracts user ID if token is provided; allows anonymous chatting."""
    if not token:
        return None
    try:
        payload = decode_access_token(token)
        return payload.get("sub")
    except Exception:
        return None


@router.post("/message", response_model=ChatMessageResponse)
async def send_chat_message(
    req: ChatMessageRequest,
    user_id: Optional[str] = Depends(get_optional_user_id)
):
    """
    Processes spoken or typed queries in Kannada or English.
    Integrates actual APMC prices, forecasts, and optimizer calculations.
    """
    return chatbot_service.process_message(req, user_id=user_id)


@router.get("/history", response_model=ChatHistoryResponse)
async def get_chat_history(
    conversation_id: str = Query(..., description="Session identifier for the chat")
):
    """
    Retrieves bounded message history for the requested conversation session.
    """
    messages = ChatbotContextService.get_history(conversation_id)
    return ChatHistoryResponse(
        conversation_id=conversation_id,
        messages=messages,
        total_messages=len(messages)
    )


@router.delete("/history")
async def clear_chat_history(
    conversation_id: str = Query(..., description="Session identifier to clear")
):
    """
    Clears all messages and resets context memory for the given session.
    """
    ChatbotContextService.clear_history(conversation_id)
    return {
        "success": True,
        "message": f"Conversation history for session '{conversation_id}' cleared successfully.",
        "conversation_id": conversation_id
    }


@router.post("/speech-to-text", response_model=SpeechToTextResponse)
async def speech_to_text(req: SpeechToTextRequest):
    """
    Backend speech-to-text integration interface.
    Used as fallback or server-side speech recognition pipeline.
    """
    detected = "kn-IN" if req.language == "kn-IN" else "en-IN"
    return SpeechToTextResponse(
        text="Recognized voice query placeholder",
        detected_language=detected,
        confidence=0.98,
        is_demo=True,
        message="Backend speech recognition interface operational."
    )

