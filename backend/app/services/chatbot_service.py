"""Core orchestration engine for AgriNexa Multilingual AI Voice Chatbot (Task 8).

Integrates existing MandiService, HarvestSplitOptimizer, Subscriptions,
and PredictionProtection without duplicating calculation logic.
Provides strict data accuracy and bilingual Kannada + English responses.
"""

import re
import logging
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional, Tuple

from app.schemas.chatbot import (
    ChatMessageRequest,
    ChatMessageResponse,
    ActionChip
)
from app.services.chatbot_context_service import ChatbotContextService
from app.services.mandi_service import MandiService
from app.services.subscription_service import SubscriptionService
from app.services.protection_service import ProtectionService
from app.services.climate_service import ClimateService
from app.services.crop_recommendation_service import CropRecommendationService
from app.schemas.soil import LandProfileCreateRequest
from app.schemas.crop_recommendation import CropRecommendationRequest
from app.optimizer.harvest_split_solver import HarvestSplitOptimizer
from app.schemas.optimizer import OptimizationRequest

logger = logging.getLogger("agrinexa.chatbot")

# Entity dictionaries
CROP_SYNONYMS: Dict[str, Dict[str, Any]] = {
    "crop_tomato": {
        "id": "crop_tomato",
        "name_en": "Tomato",
        "name_kn": "ಟೊಮೇಟೊ",
        "keywords": ["tomato", "tomatoes", "tamatar", "ಟೊಮೇಟೊ", "ಟೊಮ್ಯಾಟೊ", "ಟೊಮಾಟೊ"]
    },
    "crop_onion": {
        "id": "crop_onion",
        "name_en": "Onion",
        "name_kn": "ಈರುಳ್ಳಿ",
        "keywords": ["onion", "onions", "pyaz", "ಈರುಳ್ಳಿ", "ಉಳ್ಳಾಗಡ್ಡಿ"]
    },
    "crop_potato": {
        "id": "crop_potato",
        "name_en": "Potato",
        "name_kn": "ಆಲೂಗಡ್ಡೆ",
        "keywords": ["potato", "potatoes", "aaloo", "ಆಲೂಗಡ್ಡೆ", "ಆಲೂಗೆಡ್ಡೆ", "ಆಲೂ"]
    },
    "crop_maize": {
        "id": "crop_maize",
        "name_en": "Maize",
        "name_kn": "ಮೆಕ್ಕೆಜೋಳ",
        "keywords": ["maize", "corn", "bhutta", "ಮೆಕ್ಕೆಜೋಳ", "ಜೋಳ", "ಮುಸುಕಿನ ಜೋಳ"]
    },
    "crop_chilli": {
        "id": "crop_chilli",
        "name_en": "Green Chilli",
        "name_kn": "ಹಸಿ ಮೆಣಸಿನಕಾಯಿ",
        "keywords": ["chilli", "green chilli", "mirchi", "ಮೆಣಸಿನಕಾಯಿ", "ಹಸಿ ಮೆಣಸಿನಕಾಯಿ", "ಖಾರ"]
    },
    "crop_ragi": {
        "id": "crop_ragi",
        "name_en": "Ragi",
        "name_kn": "ರಾಗಿ",
        "keywords": ["ragi", "finger millet", "ರಾಗಿ"]
    }
}

MANDI_SYNONYMS: Dict[str, Dict[str, Any]] = {
    "mandi_kolar": {
        "id": "mandi_kolar",
        "name_en": "Kolar APMC Mandi",
        "name_kn": "ಕೋಲಾರ ಎಪಿಎಂಸಿ",
        "keywords": ["kolar", "ಕೋಲಾರ"]
    },
    "mandi_bengaluru": {
        "id": "mandi_bengaluru",
        "name_en": "Yeshwanthpur APMC (Bengaluru)",
        "name_kn": "ಬೆಂಗಳೂರು (ಯಶವಂತಪುರ)",
        "keywords": ["bengaluru", "bangalore", "yeshwanthpur", "ಬೆಂಗಳೂರು", "ಯಶವಂತಪುರ"]
    },
    "mandi_hassan": {
        "id": "mandi_hassan",
        "name_en": "Hassan APMC Mandi",
        "name_kn": "ಹಾಸನ ಎಪಿಎಂಸಿ",
        "keywords": ["hassan", "ಹಾಸನ"]
    },
    "mandi_mysuru": {
        "id": "mandi_mysuru",
        "name_en": "Mysuru APMC Mandi",
        "name_kn": "ಮೈಸೂರು ಎಪಿಎಂಸಿ",
        "keywords": ["mysuru", "mysore", "ಮೈಸೂರು"]
    },
    "mandi_davanagere": {
        "id": "mandi_davanagere",
        "name_en": "Davanagere APMC Mandi",
        "name_kn": "ದಾವಣಗೆರೆ ಎಪಿಎಂಸಿ",
        "keywords": ["davanagere", "davangere", "ದಾವಣಗೆರೆ"]
    },
    "mandi_hubballi": {
        "id": "mandi_hubballi",
        "name_en": "Hubballi APMC Mandi",
        "name_kn": "ಹುಬ್ಬಳ್ಳಿ ಎಪಿಎಂಸಿ",
        "keywords": ["hubballi", "hubli", "ಹುಬ್ಬಳ್ಳಿ"]
    },
    "mandi_belagavi": {
        "id": "mandi_belagavi",
        "name_en": "Belagavi APMC Mandi",
        "name_kn": "ಬೆಳಗಾವಿ ಎಪಿಎಂಸಿ",
        "keywords": ["belagavi", "belgaum", "ಬೆಳಗಾವಿ"]
    },
    "mandi_mandya": {
        "id": "mandi_mandya",
        "name_en": "Mandya APMC Mandi",
        "name_kn": "ಮಂಡ್ಯ ಎಪಿಎಂಸಿ",
        "keywords": ["mandya", "ಮಂಡ್ಯ"]
    }
}


class ChatbotService:
    """Natural Language Understanding and Orchestration for AgriNexa."""

    def __init__(self):
        self.mandi_service = MandiService()
        self.context_service = ChatbotContextService()

    @staticmethod
    def detect_language(text: str, requested_lang: Optional[str] = "auto") -> str:
        """
        Detects if input is in Kannada or English.
        Checks for presence of Kannada unicode characters (\u0C80-\u0CFF).
        """
        if requested_lang in ["kn", "en"]:
            return requested_lang

        # Detect Kannada script
        kannada_chars = re.findall(r"[\u0C80-\u0CFF]", text)
        if len(kannada_chars) > 0:
            return "kn"
        return "en"

    @classmethod
    def extract_entities(cls, text: str) -> Dict[str, Any]:
        """Extracts crop, mandi, and harvest quantities from user prompt."""
        lower = text.lower()
        extracted_crop = None
        extracted_mandi = None
        extracted_quantity = None

        # Crop matching
        for crop_id, meta in CROP_SYNONYMS.items():
            for kw in meta["keywords"]:
                if kw in lower:
                    extracted_crop = meta
                    break
            if extracted_crop:
                break

        # Mandi matching
        for mandi_id, meta in MANDI_SYNONYMS.items():
            for kw in meta["keywords"]:
                if kw in lower:
                    extracted_mandi = meta
                    break
            if extracted_mandi:
                break

        # Quantity matching (e.g. 100 quintals, 50 qtl, 20 ಕ್ವಿಂಟಾಲ್)
        match_qty = re.search(r"(\d+(\.\d+)?)\s*(quintals?|qtl|ಕ್ವಿಂಟಾಲ್|ಕ್ವಿಂಟಲ್)?", lower)
        if match_qty:
            try:
                val = float(match_qty.group(1))
                if val > 0 and val < 50000:
                    extracted_quantity = val
            except Exception:
                pass

        return {
            "crop": extracted_crop,
            "mandi": extracted_mandi,
            "quantity": extracted_quantity
        }

    @staticmethod
    def classify_intent(text: str, entities: Dict[str, Any]) -> str:
        """Determines the user intent from semantic keywords."""
        lower = text.lower()

        # Greetings (use word boundaries to avoid matching "hi" in "which")
        if re.search(r"\b(hello|hi|hey|namaskara|namaste)\b", lower) or any(w in lower for w in ["ನಮಸ್ಕಾರ", "ಹಲೋ", "ಶುಭೋದಯ"]):
            return "GREETING"

        # Protection / Benefit
        if any(w in lower for w in ["protection", "compensation", "35%", "claim", "ರಕ್ಷಣೆ", "ಪರಿಹಾರ", "ಕ್ಲೈಮ್"]):
            return "PROTECTION_INFORMATION"

        # Subscriptions
        if any(w in lower for w in ["subscription", "plan", "pricing", "pro tier", "ಚಂದಾದಾರಿಕೆ", "ಯೋಜನೆ"]):
            return "SUBSCRIPTION_INFORMATION"

        # Harvest Split / Selling allocation
        if any(w in lower for w in ["split", "harvest", "allocate", "how should i sell", "ಮಾರಾಟ ಮಾಡಲಿ", "ಹೇಗೆ ಮಾರಾಟ", "ಹಂಚಿಕೆ", "ಸ್ಟೋರ್"]):
            return "HARVEST_OPTIMIZATION"

        # Mandi comparison
        if any(w in lower for w in ["compare", "which mandi", "better price", "highest return", "best net", "ಹೋಲಿಕೆ", "ಯಾವ ಮಾರುಕಟ್ಟೆ", "ಯಾವ ಮಂಡಿ", "ಹೆಚ್ಚು ಲಾಭ"]):
            return "MANDI_COMPARISON"

        # Profit calculation / Transport expense
        if any(w in lower for w in ["profit", "net return", "transport cost", "freight", "ಖರ್ಚು", "ವೆಚ್ಚ", "ಲಾಭ ಎಷ್ಟು", "ಗಳಿಕೆ"]):
            return "PROFIT_CALCULATION"

        # Climate / Weather (Task 9) - check before price forecast to catch "weather forecast"
        if any(w in lower for w in [
            "weather", "rain", "rainfall", "temperature", "climate", "monsoon",
            "ಮಳೆ", "ಹವಾಮಾನ", "ಉಷ್ಣಾಂಶ", "ಮುಂಗಾರು", "ವಾತಾವರಣ"
        ]):
            return "CLIMATE_WEATHER"

        # Crop Recommendation / Advisor (Task 9)
        if any(w in lower for w in [
            "which crop", "what to grow", "crop recommend", "crop advice", "soil",
            "red soil", "black soil", "suitable crop", "crop advisor",
            "ಯಾವ ಬೆಳೆ", "ಬೆಳೆ ಶಿಫಾರಸು", "ಯಾವ ಬೆಳೆ ಬೆಳೆಯಬಹುದು", "ಮಣ್ಣು", "ಕೆಂಪು ಮಣ್ಣು", "ಕಪ್ಪು ಮಣ್ಣು", "ಬೆಳೆ ಸಲಹೆ"
        ]):
            return "CROP_RECOMMENDATION"

        # Forecast
        if any(w in lower for w in ["forecast", "next week", "next 7 days", "14 days", "future price", "ಮುಂದಿನ", "ಭವಿಷ್ಯ", "ಮುನ್ಸೂಚನೆ"]):
            return "PRICE_FORECAST"

        # Historical trend
        if any(w in lower for w in ["trend", "history", "fluctuation", "past 30 days", "ಟ್ರೆಂಡ್", "ಏರಿಳಿತ", "ಹಿಂದಿನ ದರ"]):
            return "PRICE_TREND"

        # Arrivals
        if any(w in lower for w in ["arrival", "volume", "quantity arrived", "ಆವಕ", "ಬಂದಿರುವ"]):
            return "ARRIVAL_INFORMATION"

        # Community / Grievances
        if any(w in lower for w in ["community", "post", "forum", "discussion", "grievance", "ಸಮುದಾಯ", "ದೂರು"]):
            return "COMMUNITY_INFORMATION"

        # Price lookup
        if any(w in lower for w in ["price", "rate", "cost", "today", "ಎಷ್ಟು", "ಬೆಲೆ", "ದರ"]) or entities["crop"]:
            return "CROP_PRICE"

        return "GENERAL_AGRICULTURE"

    def process_message(
        self,
        request: ChatMessageRequest,
        user_id: Optional[str] = None
    ) -> ChatMessageResponse:
        """Processes incoming voice or text query and generates accurate response."""
        lang = self.detect_language(request.message, request.language)
        session = self.context_service.get_or_create_session(request.conversation_id, user_id)
        session_id = session["session_id"]

        # Persist user question
        self.context_service.save_message(
            session_id=session_id,
            sender="user",
            text=request.message,
            language=lang
        )

        entities = self.extract_entities(request.message)

        # Context Resolution: Fall back to last session entities if omitted
        crop_id = entities["crop"]["id"] if entities["crop"] else session.get("last_crop_id")
        mandi_id = entities["mandi"]["id"] if entities["mandi"] else session.get("last_mandi_id")
        quantity = entities["quantity"]

        intent = self.classify_intent(request.message, entities)

        # Context Resolution: Inherit last intent for conversational follow-ups (e.g. "What about Bengaluru?")
        if intent == "GENERAL_AGRICULTURE" and session.get("last_intent"):
            if entities["mandi"] or entities["crop"] or any(w in request.message.lower() for w in ["what about", "how about", "ಮತ್ತು", "ಇಲ್ಲೂ", "ಅಲ್ಲಿ", "ದರ"]):
                intent = session.get("last_intent")

        # Update context
        self.context_service.update_session_context(
            session_id=session_id,
            crop_id=crop_id,
            crop_name=CROP_SYNONYMS.get(crop_id, {}).get("name_en") if crop_id else None,
            mandi_id=mandi_id,
            mandi_name=MANDI_SYNONYMS.get(mandi_id, {}).get("name_en") if mandi_id else None,
            intent=intent,
            language=lang
        )

        # Route to handler
        response_text, spoken_text, action_chips, sources = self._route_intent(
            intent=intent,
            crop_id=crop_id,
            mandi_id=mandi_id,
            quantity=quantity,
            lang=lang,
            raw_message=request.message
        )

        # Persist assistant response
        msg_id = self.context_service.save_message(
            session_id=session_id,
            sender="assistant",
            text=response_text,
            language=lang,
            intent=intent,
            sources_used=sources,
            action_chips=[chip.model_dump() for chip in action_chips]
        )

        return ChatMessageResponse(
            message_id=msg_id,
            conversation_id=session_id,
            detected_language=lang,
            intent=intent,
            response=response_text,
            spoken_text=spoken_text,
            action_chips=action_chips,
            data_source="synthetic",
            is_demo=True,
            sources_used=sources,
            timestamp=datetime.now(timezone.utc).isoformat()
        )

    def _route_intent(
        self,
        intent: str,
        crop_id: Optional[str],
        mandi_id: Optional[str],
        quantity: Optional[float],
        lang: str,
        raw_message: str
    ) -> Tuple[str, str, List[ActionChip], List[str]]:
        """Invokes appropriate underlying AgriNexa service based on intent."""

        # 1. GREETING
        if intent == "GREETING":
            if lang == "kn":
                resp = (
                    "ನಮಸ್ಕಾರ! ನಾನು **AgriNexa AI ಕೃಷಿ ಸಹಾಯಕ**.\n\n"
                    "ನಿಮ್ಮ ಬೆಳೆಗೆ ಇಂದಿನ ಮಾರುಕಟ್ಟೆ ಬೆಲೆ, ಸಾರಿಗೆ ವೆಚ್ಚ ಕಳೆದು ಅತ್ಯುತ್ತಮ ನಿವ್ವಳ ಲಾಭ ನೀಡುವ ಮಂಡಿ, "
                    "ಮತ್ತು ಮಾರಾಟ ನಿರ್ಧಾರಗಳ ಬಗ್ಗೆ ಧ್ವನಿ 🎤 ಅಥವಾ ಪಠ್ಯ ⌨️ ಮೂಲಕ ನನ್ನನ್ನು ಕೇಳಿ.\n\n"
                    "_ಮಾಹಿತಿ ಮೂಲ: ಸಿಂಥೆಟಿಕ್ ಡೆಮೊ ಡೇಟಾಸೆಟ್._"
                )
                spoken = "ನಮಸ್ಕಾರ! ನಾನು ಅಗ್ರಿನೆಕ್ಸಾ ಕೃಷಿ ಸಹಾಯಕ. ಮಾರುಕಟ್ಟೆ ಬೆಲೆ, ಸಾರಿಗೆ ವೆಚ್ಚ ಮತ್ತು ಮಾರಾಟ ನಿರ್ಧಾರಗಳ ಬಗ್ಗೆ ನನ್ನನ್ನು ಕೇಳಿ."
                chips = [
                    ActionChip(label="🍅 ಇಂದಿನ ಟೊಮೇಟೊ ಬೆಲೆ?", prompt="ಇಂದಿನ ಟೊಮೇಟೊ ಬೆಲೆ ಎಷ್ಟು?"),
                    ActionChip(label="📊 ಮಂಡಿ ಹೋಲಿಕೆ", route="/mandi-compare"),
                    ActionChip(label="💰 ಲಾಭ ಲೆಕ್ಕಾಚಾರ", route="/calculator")
                ]
            else:
                resp = (
                    "Namaskara! I am **AgriNexa AI**, your smart farming assistant.\n\n"
                    "You can ask me about today's mandi spot prices, price forecasts, net profit after transport, "
                    "or smart harvest split decisions using voice 🎤 or text ⌨️.\n\n"
                    "_Data source: Synthetic APMC demonstration dataset._"
                )
                spoken = "Namaskara! I am AgriNexa AI, your smart farming assistant. Ask me about mandi prices, forecasts, or net profit calculations."
                chips = [
                    ActionChip(label="🍅 Today's Tomato Price?", prompt="What is today's tomato price in Kolar?"),
                    ActionChip(label="📊 Compare Mandis", route="/mandi-compare"),
                    ActionChip(label="💰 Profit Calculator", route="/calculator")
                ]
            return resp, spoken, chips, ["agrinexa_welcome"]

        # 2. CROP PRICE LOOKUP
        if intent == "CROP_PRICE":
            if not crop_id:
                if lang == "kn":
                    return (
                        "ದಯವಿಟ್ಟು ಯಾವ ಬೆಳೆಯ ಬೆಲೆ ತಿಳಿಯಬೇಕು ಎಂದು ಹೇಳಿ? (ಉದಾ: ಟೊಮೇಟೊ, ಈರುಳ್ಳಿ, ಆಲೂಗಡ್ಡೆ, ಮೆಕ್ಕೆಜೋಳ)",
                        "ದಯವಿಟ್ಟು ಯಾವ ಬೆಳೆಯ ಬೆಲೆ ತಿಳಿಯಬೇಕು ಎಂದು ಹೇಳಿ?",
                        [
                            ActionChip(label="🍅 ಟೊಮೇಟೊ", prompt="ಟೊಮೇಟೊ ಬೆಲೆ ಎಷ್ಟು?"),
                            ActionChip(label="🧅 ಈರುಳ್ಳಿ", prompt="ಈರುಳ್ಳಿ ಬೆಲೆ ಎಷ್ಟು?"),
                            ActionChip(label="🥔 ಆಲೂಗಡ್ಡೆ", prompt="ಆಲೂಗಡ್ಡೆ ಬೆಲೆ ಎಷ್ಟು?")
                        ],
                        []
                    )
                else:
                    return (
                        "Which crop's market price would you like to check? (e.g. Tomato, Onion, Potato, Maize)",
                        "Which crop's market price would you like to check?",
                        [
                            ActionChip(label="🍅 Tomato", prompt="What is the price of tomato?"),
                            ActionChip(label="🧅 Onion", prompt="What is the price of onion?"),
                            ActionChip(label="🥔 Potato", prompt="What is the price of potato?")
                        ],
                        []
                    )

            target_mandi = mandi_id or "mandi_kolar"
            price_res = self.mandi_service.get_prices(crop_name_or_id=crop_id, mandi_id=target_mandi, limit=1)
            crop_meta = CROP_SYNONYMS.get(crop_id, {})
            mandi_meta = MANDI_SYNONYMS.get(target_mandi, {})

            if not price_res.prices:
                if lang == "kn":
                    return (
                        f"ಕ್ಷಮಿಸಿ, {mandi_meta.get('name_kn', 'ಆಯ್ಕೆಮಾಡಿದ ಮಾರುಕಟ್ಟೆ')}ಯಲ್ಲಿ {crop_meta.get('name_kn', 'ಬೆಳೆ')}ಗೆ ಪ್ರಸ್ತುತ ಬೆಲೆ ಮಾಹಿತಿ ಲಭ್ಯವಿಲ್ಲ.",
                        "ಬೆಲೆ ಮಾಹಿತಿ ಲಭ್ಯವಿಲ್ಲ.",
                        [],
                        ["agrinexa_prices_empty"]
                    )
                else:
                    return (
                        f"Sorry, price observations for {crop_meta.get('name_en', 'crop')} in {mandi_meta.get('name_en', 'mandi')} are currently unavailable.",
                        "Price observation currently unavailable.",
                        [],
                        ["agrinexa_prices_empty"]
                    )

            rec = price_res.prices[-1]
            if lang == "kn":
                resp = (
                    f"**{mandi_meta.get('name_kn', rec.mandi_name)} — {crop_meta.get('name_kn', rec.crop_name)}**\n\n"
                    f"• ಇತ್ತೀಚಿನ ಮಾದರಿ ಬೆಲೆ: **₹{rec.modal_price:,.0f}** ಪ್ರತಿ ಕ್ವಿಂಟಾಲ್\n"
                    f"• ಕನಿಷ್ಠ ಬೆಲೆ: ₹{rec.min_price:,.0f} | ಗರಿಷ್ಠ ಬೆಲೆ: ₹{rec.max_price:,.0f}\n"
                    f"• ಮಾರುಕಟ್ಟೆ ಆವಕ: {rec.arrival_quantity:,.0f} {rec.arrival_unit}\n"
                    f"• ದಿನಾಂಕ: {rec.date}\n\n"
                    f"_ಮಾಹಿತಿ ಮೂಲ: ಸಿಂಥೆಟಿಕ್ ಡೆಮೊ ಡೇಟಾಸೆಟ್._"
                )
                spoken = f"{mandi_meta.get('name_kn', 'ಮಾರುಕಟ್ಟೆ')}ಯಲ್ಲಿ {crop_meta.get('name_kn', 'ಬೆಳೆ')} ಇತ್ತೀಚಿನ ಮಾದರಿ ಬೆಲೆ ಕ್ವಿಂಟಾಲ್‌ಗೆ {int(rec.modal_price)} ರೂಪಾಯಿಗಳು."
                chips = [
                    ActionChip(label="📊 ಮಂಡಿ ಹೋಲಿಕೆ ಮಾಡಿ", prompt=f"{crop_meta.get('name_kn')} ಮಂಡಿ ಹೋಲಿಕೆ ಮಾಡಿ"),
                    ActionChip(label="📈 ಮುಂದಿನ ವಾರದ ಭವಿಷ್ಯ", prompt=f"{crop_meta.get('name_kn')} ಬೆಲೆ ಭವಿಷ್ಯ ಹೇಗಿದೆ?"),
                    ActionChip(label="💰 ಲಾಭ ಲೆಕ್ಕಾಚಾರ", route="/calculator")
                ]
            else:
                resp = (
                    f"**{mandi_meta.get('name_en', rec.mandi_name)} — {crop_meta.get('name_en', rec.crop_name)}**\n\n"
                    f"• Latest Modal Price: **₹{rec.modal_price:,.0f}** per quintal\n"
                    f"• Range: ₹{rec.min_price:,.0f} (Min) — ₹{rec.max_price:,.0f} (Max)\n"
                    f"• Arrivals: {rec.arrival_quantity:,.0f} {rec.arrival_unit}\n"
                    f"• Observation Date: {rec.date}\n\n"
                    f"_Data source: Synthetic APMC demonstration dataset._"
                )
                spoken = f"The latest modal price for {crop_meta.get('name_en', 'crop')} in {mandi_meta.get('name_en', 'mandi')} is {int(rec.modal_price)} rupees per quintal."
                chips = [
                    ActionChip(label="📊 Compare Mandis", prompt=f"Compare {crop_meta.get('name_en')} prices across mandis"),
                    ActionChip(label="📈 7-Day Forecast", prompt=f"What is the forecast for {crop_meta.get('name_en')}?"),
                    ActionChip(label="💰 Calculate Profit", route="/calculator")
                ]
            return resp, spoken, chips, ["agrinexa_prices_api"]

        # 3. MANDI COMPARISON
        if intent == "MANDI_COMPARISON":
            effective_crop = crop_id or "crop_tomato"
            crop_meta = CROP_SYNONYMS.get(effective_crop, {})
            # Compare Kolar vs Bengaluru
            p_kolar = self.mandi_service.get_prices(crop_name_or_id=effective_crop, mandi_id="mandi_kolar", limit=1)
            p_bengaluru = self.mandi_service.get_prices(crop_name_or_id=effective_crop, mandi_id="mandi_bengaluru", limit=1)

            price_kolar = p_kolar.prices[-1].modal_price if p_kolar.prices else 0
            price_blr = p_bengaluru.prices[-1].modal_price if p_bengaluru.prices else 0
            diff = abs(price_blr - price_kolar)

            if lang == "kn":
                better_mandi = "ಬೆಂಗಳೂರು (ಯಶವಂತಪುರ)" if price_blr >= price_kolar else "ಕೋಲಾರ"
                resp = (
                    f"**ಮಂಡಿ ಹೋಲಿಕೆ — {crop_meta.get('name_kn', 'ಬೆಳೆ')}**\n\n"
                    f"• ಕೋಲಾರ ಎಪಿಎಂಸಿ: **₹{price_kolar:,.0f}** /ಕ್ವಿಂಟಾಲ್\n"
                    f"• ಬೆಂಗಳೂರು (ಯಶವಂತಪುರ): **₹{price_blr:,.0f}** /ಕ್ವಿಂಟಾಲ್\n\n"
                    f"👉 **{better_mandi}** ಮಾರುಕಟ್ಟೆಯಲ್ಲಿ ಕ್ವಿಂಟಾಲ್‌ಗೆ ಸುಮಾರು ₹{diff:,.0f} ವ್ಯತ್ಯಾಸವಿದೆ. "
                    f"ಆದರೆ ನಿಮ್ಮ ಸ್ಥಳದಿಂದ ಸಾರಿಗೆ ವೆಚ್ಚವನ್ನು (ಸರಾಸರಿ ₹2.25/ಕಿ.ಮೀ/ಕ್ವಿಂಟಾಲ್) ಪರಿಗಣಿಸಿ ನಿರ್ಧರಿಸಿ.\n\n"
                    f"_ಮಾಹಿತಿ ಮೂಲ: ಸಿಂಥೆಟಿಕ್ ಡೆಮೊ ಡೇಟಾಸೆಟ್._"
                )
                spoken = f"{crop_meta.get('name_kn', 'ಬೆಳೆ')} ಬೆಲೆ ಕೋಲಾರದಲ್ಲಿ {int(price_kolar)} ಮತ್ತು ಬೆಂಗಳೂರಿನಲ್ಲಿ {int(price_blr)} ರೂಪಾಯಿ ಆಗಿದೆ."
                chips = [
                    ActionChip(label="ಸಾರಿಗೆ ಸಹಿತ ನಿಖರ ಹೋಲಿಕೆ", route="/mandi-compare"),
                    ActionChip(label="ಲಾಭ ಲೆಕ್ಕಾಚಾರ ಮಾಡಿ", route="/calculator")
                ]
            else:
                better_mandi = "Bengaluru" if price_blr >= price_kolar else "Kolar"
                resp = (
                    f"**Mandi Comparison — {crop_meta.get('name_en', 'Crop')}**\n\n"
                    f"• Kolar APMC: **₹{price_kolar:,.0f}** / quintal\n"
                    f"• Bengaluru (Yeshwanthpur): **₹{price_blr:,.0f}** / quintal\n\n"
                    f"👉 **{better_mandi}** offers a gross difference of ₹{diff:,.0f}/qtl. "
                    f"Remember to factor in freight charges (~₹2.25/km/qtl) for true net realization.\n\n"
                    f"_Data source: Synthetic APMC demonstration dataset._"
                )
                spoken = f"{crop_meta.get('name_en', 'Crop')} price is {int(price_kolar)} in Kolar and {int(price_blr)} in Bengaluru."
                chips = [
                    ActionChip(label="Open Smart Comparison", route="/mandi-compare"),
                    ActionChip(label="Calculate Net Return", route="/calculator")
                ]
            return resp, spoken, chips, ["agrinexa_mandi_compare"]

        # 4. PRICE FORECAST
        if intent == "PRICE_FORECAST":
            effective_crop = crop_id or "crop_tomato"
            target_mandi = mandi_id or "mandi_kolar"
            crop_meta = CROP_SYNONYMS.get(effective_crop, {})
            mandi_meta = MANDI_SYNONYMS.get(target_mandi, {})

            forecast = self.mandi_service.get_price_forecast(
                crop_name_or_id=effective_crop,
                mandi_id=target_mandi,
                forecast_days=7
            )

            pts = forecast.forecast_points
            start_p = pts[0].normal if pts else 0
            end_p = pts[-1].normal if pts else 0
            pessimistic_p = pts[-1].pessimistic if pts else end_p
            optimistic_p = pts[-1].optimistic if pts else end_p
            trend_str = "ಏರಿಕೆಯಾಗುವ ಸಾಧ್ಯತೆಯಿದೆ" if end_p >= start_p else "ಸ್ವಲ್ಪ ಇಳಿಕೆಯಾಗುವ ಸಾಧ್ಯತೆಯಿದೆ"
            trend_en = "upward momentum" if end_p >= start_p else "downward pressure"

            if lang == "kn":
                resp = (
                    f"**7 ದಿನಗಳ ಬೆಲೆ ಭವಿಷ್ಯ — {crop_meta.get('name_kn', 'ಬೆಳೆ')} ({mandi_meta.get('name_kn', 'ಕೋಲಾರ')})**\n\n"
                    f"• ಇಂದಿನ ಮುನ್ಸೂಚನೆ: ₹{start_p:,.0f} /ಕ್ವಿಂಟಾಲ್\n"
                    f"• 7 ದಿನಗಳ ಗುರಿ ಬೆಲೆ: **₹{end_p:,.0f}** /ಕ್ವಿಂಟಾಲ್ ({trend_str})\n"
                    f"• ನಿರೀಕ್ಷಿತ ಶ್ರೇಣಿ: ₹{pessimistic_p:,.0f} ರಿಂದ ₹{optimistic_p:,.0f}\n"
                    f"• ಮಾರುಕಟ್ಟೆ ಪ್ರವೃತ್ತಿ: {forecast.trend_direction} (ಐತಿಹಾಸಿಕ ಬದಲಾವಣೆ {forecast.trend_strength_pct:.1f}%)\n\n"
                    f"⚠️ _ಗಮನಿಸಿ: ಇದು ಸಂಖ್ಯಾಶಾಸ್ತ್ರೀಯ ಸಿಮ್ಯುಲೇಶನ್ ಆಗಿದೆ. ನೈಜ ಮಾರುಕಟ್ಟೆ ಪರಿಸ್ಥಿತಿಗಳು ಬದಲಾಗಬಹುದು._"
                )
                spoken = f"{crop_meta.get('name_kn', 'ಬೆಳೆ')} ಮುಂದಿನ 7 ದಿನಗಳಲ್ಲಿ ಕ್ವಿಂಟಾಲ್‌ಗೆ {int(end_p)} ರೂಪಾಯಿ ತಲುಪುವ ನಿರೀಕ್ಷೆಯಿದೆ."
                chips = [
                    ActionChip(label="ಸಂಪೂರ್ಣ ಚಾರ್ಟ್ ವೀಕ್ಷಿಸಿ", route="/price-trends"),
                    ActionChip(label="ಮಾರಾಟ ನಿರ್ಧಾರ ಯೋಜನೆ", route="/harvest-split")
                ]
            else:
                resp = (
                    f"**7-Day Price Projection — {crop_meta.get('name_en', 'Crop')} ({mandi_meta.get('name_en', 'Kolar')})**\n\n"
                    f"• Projected Target (Day 7): **₹{end_p:,.0f}** / quintal ({trend_en})\n"
                    f"• Expected Range: ₹{pessimistic_p:,.0f} (Low) to ₹{optimistic_p:,.0f} (High)\n"
                    f"• Market Momentum: {forecast.trend_direction} ({forecast.trend_strength_pct:.1f}% historical change)\n\n"
                    f"⚠️ _Note: Statistical simulation from demo dataset; not a guaranteed auction price._"
                )
                spoken = f"Projected 7-day target for {crop_meta.get('name_en', 'Crop')} is {int(end_p)} rupees per quintal."
                chips = [
                    ActionChip(label="View Trends & Charts", route="/price-trends"),
                    ActionChip(label="Optimize Harvest Split", route="/harvest-split")
                ]
            return resp, spoken, chips, ["agrinexa_ml_forecast"]

        # 5. HARVEST OPTIMIZATION
        if intent == "HARVEST_OPTIMIZATION":
            effective_crop = crop_id or "crop_potato"
            crop_meta = CROP_SYNONYMS.get(effective_crop, {})
            qty = quantity or 100.0

            if lang == "kn":
                resp = (
                    f"**ಸ್ಮಾರ್ಟ್ ಹಾರ್ವೆಸ್ಟ್ ಸ್ಪ್ಲಿಟ್ — {crop_meta.get('name_kn', 'ಬೆಳೆ')} ({qty} ಕ್ವಿಂಟಾಲ್)**\n\n"
                    f"ನಮ್ಮ ಗಣಿತೀಯ ಆಪ್ಟಿಮೈಜರ್ (PuLP LP) ನಿಮ್ಮ ಬೆಳೆಗೆ ಅತ್ಯುತ್ತಮ ಮಾರಾಟ ತಂತ್ರವನ್ನು ರೂಪಿಸುತ್ತದೆ:\n"
                    f"1. **ತಕ್ಷಣದ ಮಾರಾಟ (Day 0)**: ಹತ್ತಿರದ ಮಂಡಿಗೆ ಸಾಗಿಸಿ ತಕ್ಷಣದ ನಗದು ಪಡೆಯುವುದು.\n"
                    f"2. **ದಾಸ್ತಾನು (Storage)**: ಮುಂದಿನ 7-14 ದಿನಗಳಲ್ಲಿ ಬೆಲೆ ಏರಿಕೆಯಾಗುವ ಸಾಧ್ಯತೆಯಿದ್ದರೆ ಉಳಿದ ಪ್ರಮಾಣವನ್ನು ಕೋಲ್ಡ್ ಸ್ಟೋರೇಜ್‌ನಲ್ಲಿಡುವುದು.\n\n"
                    f"ನಿಮ್ಮ ಸಾರಿಗೆ ವೆಚ್ಚ ಮತ್ತು ದಾಸ್ತಾನು ಸಾಮರ್ಥ್ಯವನ್ನು ನಮೂದಿಸಿ ನಿಖರ ಯೋಜನೆಯನ್ನು ಪಡೆಯಿರಿ."
                )
                spoken = f"{qty} ಕ್ವಿಂಟಾಲ್ ಬೆಳೆಗೆ ಹಾರ್ವೆಸ್ಟ್ ಸ್ಪ್ಲಿಟ್ ಆಪ್ಟಿಮೈಜರ್ ಅತ್ಯುತ್ತಮ ಹಂಚಿಕೆ ಯೋಜನೆಯನ್ನು ಸಿದ್ಧಪಡಿಸುತ್ತದೆ."
                chips = [
                    ActionChip(label="ಹಾರ್ವೆಸ್ಟ್ ಸ್ಪ್ಲಿಟ್ ರನ್ ಮಾಡಿ", route="/harvest-split"),
                    ActionChip(label="ಲಾಭ ಲೆಕ್ಕಾಚಾರ", route="/calculator")
                ]
            else:
                resp = (
                    f"**Smart Harvest Split Strategy — {crop_meta.get('name_en', 'Crop')} ({qty} qtl)**\n\n"
                    f"Our mathematical LP optimizer recommends splitting your harvest:\n"
                    f"1. **Day 0 Immediate Sale**: Allocate volume to local mandi to secure early returns.\n"
                    f"2. **Optimal Storage**: Hold balance in storage if projected target price covers storage fee (₹3.5-8/qtl/day).\n\n"
                    f"Run the solver to generate your mandi-by-mandi daily allocation plan."
                )
                spoken = f"For {qty} quintals, the harvest split optimizer balances immediate sale against storage for peak returns."
                chips = [
                    ActionChip(label="Run Harvest Split Optimizer", route="/harvest-split"),
                    ActionChip(label="Profit Calculator", route="/calculator")
                ]
            return resp, spoken, chips, ["agrinexa_harvest_optimizer"]

        # 6. SUBSCRIPTION / PROTECTION
        if intent in ["SUBSCRIPTION_INFORMATION", "PROTECTION_INFORMATION"]:
            if lang == "kn":
                resp = (
                    "**AgriNexa ರೈತ ಚಂದಾದಾರಿಕೆ & AI ಭವಿಷ್ಯ ರಕ್ಷಣೆ**\n\n"
                    "• **ಕಿಸಾನ್ ಉಚಿತ (FREE)**: ಮಾರುಕಟ್ಟೆ ಬೆಲೆಗಳು, ಡ್ಯಾಶ್‌ಬೋರ್ಡ್, ಸಮುದಾಯ ವೇದಿಕೆ.\n"
                    "• **ಕಿಸಾನ್ ಪ್ರೊ (₹199/ತಿಂಗಳು)**: 14 ದಿನಗಳ ಎಐ ಭವಿಷ್ಯ, ಮಂಡಿ ಹೋಲಿಕೆ, ಲಾಭ ಕ್ಯಾಲ್ಕುಲೇಟರ್.\n"
                    "• **ಕಿಸಾನ್ ರಕ್ಷಾ + ಪ್ರೊ (₹499/ತಿಂಗಳು)**: **35% ಪರಿಶೀಲಿಸಿದ ನಷ್ಟ ಪರಿಹಾರ ಪ್ರಯೋಜನ** (AI ಗುರಿ ಬೆಲೆಗಿಂತ ಮಾರುಕಟ್ಟೆ ಕುಸಿದಾಗ).\n\n"
                    "⚠️ _ಗಮನಿಸಿ: ಇದು ಪ್ರಸ್ತಾವಿತ ಡೆಮೊ ಪ್ರಯೋಜನವಾಗಿದೆ. ಯಾವುದೇ ನೈಜ ಹಣ ಪಾವತಿಸುವುದಿಲ್ಲ._"
                )
                spoken = "ಅಗ್ರಿನೆಕ್ಸಾ ಮೂರು ಹಂತದ ಯೋಜನೆಗಳನ್ನು ಹೊಂದಿದೆ. ಕಿಸಾನ್ ರಕ್ಷಾ ಯೋಜನೆಯಲ್ಲಿ ಶೇಕಡಾ 35 ರಷ್ಟು ನಷ್ಟ ಪರಿಹಾರದ ಪ್ರದರ್ಶನ ಪ್ರಯೋಜನವಿದೆ."
                chips = [
                    ActionChip(label="ಯೋಜನೆಗಳನ್ನು ವೀಕ್ಷಿಸಿ", route="/subscriptions"),
                    ActionChip(label="ರಕ್ಷಣಾ ಪೋರ್ಟಲ್", route="/prediction-protection")
                ]
            else:
                resp = (
                    "**AgriNexa Farmer Subscriptions & AI Prediction Protection**\n\n"
                    "• **Kisan Basic (FREE)**: Live spot prices, arrivals, community discussions.\n"
                    "• **Kisan Pro (₹199/mo demo)**: 14-day forecasts, mandi compare, profit calculator.\n"
                    "• **Kisan Raksha (₹499/mo demo)**: **35% Verified Eligible Loss Benefit** when mandi spot prices crash below AI targets.\n\n"
                    "⚠️ _Demonstration Notice: AI Prediction Protection is a proposed demo benefit. No real money or compensation is paid in this demo._"
                )
                spoken = "AgriNexa offers Free, Pro, and Protection tiers. The Protection plan includes a proposed 35 percent verified loss benefit."
                chips = [
                    ActionChip(label="View Subscription Plans", route="/subscriptions"),
                    ActionChip(label="Protection Portal", route="/prediction-protection")
                ]
            return resp, spoken, chips, ["agrinexa_subscriptions", "agrinexa_protection"]

        # 7. CLIMATE & WEATHER FORECAST (Task 9)
        if intent == "CLIMATE_WEATHER":
            district = "Kolar"
            for d in ["Kolar", "Bengaluru", "Mandya", "Hassan", "Davanagere", "Belagavi", "Dharwad", "Chitradurga", "Raichur"]:
                if d.lower() in raw_message.lower():
                    district = d
                    break
            summary = ClimateService.get_complete_climate_summary(district)
            f_points = summary.short_range_forecast.forecast_points
            today_w = f_points[0] if f_points else None
            seas = summary.seasonal_outlook
            
            if lang == "kn":
                resp = (
                    f"**{district} ಹವಾಮಾನ ಮತ್ತು ಮಳೆ ಮುನ್ಸೂಚನೆ**\n\n"
                    f"• **ಇಂದಿನ ಸ್ಥಿತಿ**: {today_w.condition if today_w else 'ಬಿಸಿಲು'}, ಉಷ್ಣಾಂಶ {today_w.min_temp_c if today_w else 20}°C - {today_w.max_temp_c if today_w else 32}°C\n"
                    f"• **7 ದಿನಗಳ ಮಳೆ ಮುನ್ಸೂಚನೆ**: {summary.short_range_forecast.summary_advisory}\n"
                    f"• **ಋತುಮಾನ ನೋಟ ({seas.season_name})**: {seas.rainfall_category} ({seas.rainfall_anomaly_pct:+}% ಸರಾಸರಿಗೆ ಹೋಲಿಸಿದರೆ)\n"
                    f"• **ಕೃಷಿ ಸಲಹೆ**: {seas.agronomic_advice_kn}\n\n"
                    f"ℹ️ _ಮಾಹಿತಿ ಮೂಲ: IMD ಹವಾಮಾನ ಮಾದರಿ ಆಧಾರಿತ ಡೆಮೊ ಮುನ್ಸೂಚನೆ._"
                )
                spoken = f"{district} ಜಿಲ್ಲೆಯಲ್ಲಿ ಮುಂದಿನ ದಿನಗಳಲ್ಲಿ {today_w.condition if today_w else 'ಸಾಮಾನ್ಯ'} ವಾತಾವರಣವಿರಲಿದೆ. {seas.agronomic_advice_kn}"
                chips = [
                    ActionChip(label="🌱 ಬೆಳೆ ಸಲಹೆಗಾರ", route="/crop-advisor"),
                    ActionChip(label="📊 ಮಂಡಿ ದರಗಳು", route="/dashboard")
                ]
            else:
                resp = (
                    f"**{district} Weather Forecast & Climate Outlook**\n\n"
                    f"• **Today's Condition**: {today_w.condition if today_w else 'Partly Cloudy'}, Temp: {today_w.min_temp_c if today_w else 20}°C - {today_w.max_temp_c if today_w else 32}°C\n"
                    f"• **7-Day Outlook**: {summary.short_range_forecast.summary_advisory}\n"
                    f"• **Seasonal Outlook ({seas.season_name})**: {seas.rainfall_category} ({seas.rainfall_anomaly_pct:+}% vs normal)\n"
                    f"• **Agronomic Advisory**: {seas.agronomic_advice_en}\n\n"
                    f"ℹ️ _Data Source: Synthetic IMD benchmark weather models._"
                )
                spoken = f"The 7-day weather outlook for {district} shows {today_w.condition if today_w else 'partly cloudy'} conditions. {seas.agronomic_advice_en}"
                chips = [
                    ActionChip(label="🌱 Crop Advisor", route="/crop-advisor"),
                    ActionChip(label="📊 Mandi Dashboard", route="/dashboard")
                ]
            return resp, spoken, chips, ["synthetic_imd_benchmark", "agrinexa_climate"]

        # 8. CROP RECOMMENDATION & ADVISOR (Task 9)
        if intent == "CROP_RECOMMENDATION":
            district = "Kolar"
            for d in ["Kolar", "Bengaluru", "Mandya", "Hassan", "Davanagere", "Belagavi", "Dharwad", "Chitradurga", "Raichur"]:
                if d.lower() in raw_message.lower():
                    district = d
                    break
            
            soil_type = "Red soil"
            if "black soil" in raw_message.lower() or "ಕಪ್ಪು ಮಣ್ಣು" in raw_message:
                soil_type = "Black soil"
            elif "loam" in raw_message.lower() or "ಮೆಕ್ಕಲು" in raw_message:
                soil_type = "Loamy soil"
                
            water_avail = "medium"
            if any(w in raw_message.lower() for w in ["low water", "dryland", "rainfed", "ಕಡಿಮೆ ನೀರು", "ಮಳೆಯಾಶ್ರಿತ", "ಬರ"]):
                water_avail = "low"
            elif any(w in raw_message.lower() for w in ["high water", "abundant", "ಹೆಚ್ಚು ನೀರು", "ಕಾಲುವೆ"]):
                water_avail = "high"

            dummy_req = CropRecommendationRequest(
                inline_profile=LandProfileCreateRequest(
                    state="Karnataka",
                    district=district,
                    total_area=2.0,
                    area_unit="acres",
                    land_type="Dryland" if water_avail == "low" else "Mixed farming land",
                    soil_type=soil_type,
                    water_source="Rainfed only" if water_avail == "low" else "Borewell",
                    water_availability=water_avail,
                    preferred_sowing_season="Kharif",
                ),
                season="Kharif"
            )
            rec_res = CropRecommendationService.generate_recommendations(dummy_req)
            top_3 = rec_res.recommendations[:3]
            
            if lang == "kn":
                crops_text = "\n".join([
                    f"• **{r.rank}. {r.crop_name_kn}** ({r.crop_name_en}): ಸೂಕ್ತತೆ ಸ್ಕೋರ್ **{r.scores.overall_suitability_score}%** ({r.suitability_tier})\n"
                    f"   _{r.why_recommended_kn[0] if r.why_recommended_kn else ''}_"
                    for r in top_3
                ])
                resp = (
                    f"**{district} ({soil_type}) ಜಮೀನಿಗೆ ಕೃಷಿ ಶಿಫಾರಸುಗಳು**\n\n"
                    f"{crops_text}\n\n"
                    f"💧 **ನೀರಿನ ನಿರ್ವಹಣೆ ಸಲಹೆ**: {rec_res.water_advisory_summary_kn}\n\n"
                    f"ನಿಮ್ಮ ಮಣ್ಣು ಪರೀಕ್ಷೆ ಮತ್ತು ಸಂಪೂರ್ಣ ಬೆಳೆ ಕ್ಯಾಲೆಂಡರ್ ವೀಕ್ಷಿಸಲು ಕ್ರಾಪ್ ಅಡ್ವೈಸರ್‌ಗೆ ಭೇಟಿ ನೀಡಿ."
                )
                spoken = f"{district} ಜಮೀನಿಗೆ {top_3[0].crop_name_kn} ಮತ್ತು {top_3[1].crop_name_kn} ಹೆಚ್ಚು ಸೂಕ್ತವಾದ ಬೆಳೆಗಳಾಗಿವೆ."
                chips = [
                    ActionChip(label="🌱 ಬೆಳೆ ಸಲಹೆಗಾರ ಪೋರ್ಟಲ್", route="/crop-advisor"),
                    ActionChip(label="💰 ಲಾಭ ಕ್ಯಾಲ್ಕುಲೇಟರ್", route="/calculator")
                ]
            else:
                crops_text = "\n".join([
                    f"• **{r.rank}. {r.crop_name_en}** ({r.crop_name_kn}): Suitability **{r.scores.overall_suitability_score}%** ({r.suitability_tier})\n"
                    f"   _{r.why_recommended_en[0] if r.why_recommended_en else ''}_"
                    for r in top_3
                ])
                resp = (
                    f"**Smart Crop Recommendations for {district} ({soil_type})**\n\n"
                    f"{crops_text}\n\n"
                    f"💧 **Water Advisory**: {rec_res.water_advisory_summary_en}\n\n"
                    f"Configure your exact soil test values and land area in the Smart Crop Advisor."
                )
                spoken = f"For {district}, top recommended crops are {top_3[0].crop_name_en} and {top_3[1].crop_name_en} with high suitability scores."
                chips = [
                    ActionChip(label="🌱 Open Crop Advisor", route="/crop-advisor"),
                    ActionChip(label="💰 Profit Calculator", route="/calculator")
                ]
            return resp, spoken, chips, ["synthetic_agronomic_engine", "uas_bangalore_v2024"]

        # 9. GENERAL AGRICULTURE / FALLBACK
        if lang == "kn":
            resp = (
                "ನಾನು ಕರ್ನಾಟಕದ APMC ಮಂಡಿ ದರಗಳು, 14 ದಿನಗಳ ಬೆಲೆ ಭವಿಷ್ಯ, ಸಾರಿಗೆ ವೆಚ್ಚ ಮತ್ತು ಹಾರ್ವೆಸ್ಟ್ ಸ್ಪ್ಲಿಟ್ ಆಪ್ಟಿಮೈಜರ್ ಬಗ್ಗೆ ಸಹಾಯ ಮಾಡಬಲ್ಲೆ.\n\n"
                "ಉದಾಹರಣೆಗೆ ಹೀಗೆ ಕೇಳಿ:\n"
                "• _\"ಇಂದಿನ ಟೊಮೇಟೊ ಬೆಲೆ ಎಷ್ಟು?\"_\n"
                "• _\"ಕೋಲಾರ ಮತ್ತು ಬೆಂಗಳೂರು ಮಂಡಿ ಹೋಲಿಕೆ ಮಾಡಿ\"_\n"
                "• _\"ಮುಂದಿನ 7 ದಿನಗಳಲ್ಲಿ ಈರುಳ್ಳಿ ಬೆಲೆ ಹೇಗಿರಲಿದೆ?\"_"
            )
            spoken = "ನಾನು ಮಾರುಕಟ್ಟೆ ಬೆಲೆ, ಬೆಲೆ ಭವಿಷ್ಯ ಮತ್ತು ಮಂಡಿ ಹೋಲಿಕೆ ಬಗ್ಗೆ ಮಾಹಿತಿ ನೀಡಬಲ್ಲೆ."
            chips = [
                ActionChip(label="🍅 ಟೊಮೇಟೊ ಬೆಲೆ", prompt="ಇಂದಿನ ಟೊಮೇಟೊ ಬೆಲೆ ಎಷ್ಟು?"),
                ActionChip(label="📊 ಮಂಡಿ ಹೋಲಿಕೆ", route="/mandi-compare"),
                ActionChip(label="💰 ಲಾಭ ಕ್ಯಾಲ್ಕುಲೇಟರ್", route="/calculator")
            ]
        else:
            resp = (
                "I can assist you with Karnataka APMC mandi prices, 14-day forecasts, transport expense comparisons, and harvest split allocations.\n\n"
                "Try asking:\n"
                "• _\"What is today's tomato price in Kolar?\"_\n"
                "• _\"Compare onion prices between Bengaluru and Kolar\"_\n"
                "• _\"What is the expected potato price next week?\"_"
            )
            spoken = "I can help you with mandi prices, price forecasts, and profit calculations."
            chips = [
                ActionChip(label="🍅 Tomato Price", prompt="What is today's tomato price in Kolar?"),
                ActionChip(label="📊 Compare Mandis", route="/mandi-compare"),
                ActionChip(label="💰 Profit Calculator", route="/calculator")
            ]
        return resp, spoken, chips, ["agrinexa_general"]

