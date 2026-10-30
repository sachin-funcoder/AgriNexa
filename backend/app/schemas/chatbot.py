"""Pydantic schemas for Multilingual AI Voice Chatbot (Task 8)."""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class ActionChip(BaseModel):
    label: str = Field(..., description="Display label for quick action chip")
    route: Optional[str] = Field(None, description="App navigation route e.g. /mandi-compare")
    prompt: Optional[str] = Field(None, description="Preset question prompt to ask the chatbot")


class ChatMessageRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=1500, description="User question in Kannada or English")
    language: Optional[str] = Field("auto", description="'auto', 'kn', or 'en'")
    conversation_id: Optional[str] = Field(None, description="Session ID for chat memory")


class ChatMessageItem(BaseModel):
    message_id: str
    session_id: str
    sender: str  # 'user' | 'assistant'
    text: str
    language: str
    intent: Optional[str] = None
    sources_used: List[str] = []
    action_chips: List[ActionChip] = []
    created_at: str


class ChatMessageResponse(BaseModel):
    message_id: str
    conversation_id: str
    detected_language: str
    intent: str
    response: str
    spoken_text: str
    action_chips: List[ActionChip] = []
    data_source: str = "synthetic"
    is_demo: bool = True
    sources_used: List[str] = []
    timestamp: str


class ChatHistoryResponse(BaseModel):
    conversation_id: str
    messages: List[ChatMessageItem] = []
    total_messages: int = 0


class SpeechToTextRequest(BaseModel):
    audio_base64: Optional[str] = Field(None, description="Base64 encoded audio snippet")
    language: Optional[str] = Field("auto", description="'auto', 'kn-IN', or 'en-IN'")


class SpeechToTextResponse(BaseModel):
    text: str
    detected_language: str
    confidence: float = 1.0
    is_demo: bool = True
    message: str = "Speech recognition processed."

