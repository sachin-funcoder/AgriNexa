"""Deterministic unit tests for Task 8: Multilingual AI Voice Chatbot (Kannada + English)."""

import pytest
import uuid
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_chatbot_greeting_english_and_kannada():
    session_id = f"test_sess_{uuid.uuid4().hex[:8]}"

    # English greeting
    res_en = client.post("/api/v1/chatbot/message", json={
        "message": "Hello AgriNexa!",
        "conversation_id": session_id,
        "language": "auto"
    })
    assert res_en.status_code == 200
    data_en = res_en.json()
    assert data_en["detected_language"] == "en"
    assert data_en["intent"] == "GREETING"
    assert "AgriNexa AI" in data_en["response"]
    assert len(data_en["action_chips"]) > 0
    assert "Synthetic" in data_en["response"] or data_en["is_demo"] is True

    # Kannada greeting
    res_kn = client.post("/api/v1/chatbot/message", json={
        "message": "ನಮಸ್ಕಾರ",
        "conversation_id": session_id,
        "language": "auto"
    })
    assert res_kn.status_code == 200
    data_kn = res_kn.json()
    assert data_kn["detected_language"] == "kn"
    assert data_kn["intent"] == "GREETING"
    assert "AgriNexa AI" in data_kn["response"]
    assert "ನಮಸ್ಕಾರ" in data_kn["response"]


def test_crop_price_query_english():
    session_id = f"test_sess_{uuid.uuid4().hex[:8]}"
    res = client.post("/api/v1/chatbot/message", json={
        "message": "What is today's tomato price in Kolar?",
        "conversation_id": session_id
    })
    assert res.status_code == 200
    data = res.json()
    assert data["intent"] == "CROP_PRICE"
    assert data["detected_language"] == "en"
    assert "Kolar" in data["response"]
    assert "Tomato" in data["response"]
    assert "₹" in data["response"]
    assert "per quintal" in data["response"]
    assert "Synthetic" in data["response"] or data["is_demo"] is True


def test_crop_price_query_kannada():
    session_id = f"test_sess_{uuid.uuid4().hex[:8]}"
    res = client.post("/api/v1/chatbot/message", json={
        "message": "ಕೋಲಾರ ಮಾರುಕಟ್ಟೆಯಲ್ಲಿ ಟೊಮೇಟೊ ಬೆಲೆ ಎಷ್ಟು?",
        "conversation_id": session_id
    })
    assert res.status_code == 200
    data = res.json()
    assert data["intent"] == "CROP_PRICE"
    assert data["detected_language"] == "kn"
    assert "ಕೋಲಾರ" in data["response"]
    assert "ಟೊಮೇಟೊ" in data["response"]
    assert "₹" in data["response"]
    assert "ಕ್ವಿಂಟಾಲ್" in data["response"]


def test_missing_crop_follow_up():
    session_id = f"test_sess_{uuid.uuid4().hex[:8]}"
    res = client.post("/api/v1/chatbot/message", json={
        "message": "What is today's price?",
        "conversation_id": session_id,
        "language": "en"
    })
    assert res.status_code == 200
    data = res.json()
    assert data["intent"] == "CROP_PRICE"
    # Prompt asks which crop
    assert "Which crop" in data["response"]
    assert len(data["action_chips"]) >= 3


def test_follow_up_context_memory():
    session_id = f"test_sess_{uuid.uuid4().hex[:8]}"

    # Turn 1: Ask about Tomato in Kolar
    res1 = client.post("/api/v1/chatbot/message", json={
        "message": "What is the price of tomato in Kolar?",
        "conversation_id": session_id
    })
    assert res1.status_code == 200
    assert "Tomato" in res1.json()["response"]

    # Turn 2: Follow-up specifying only mandi
    res2 = client.post("/api/v1/chatbot/message", json={
        "message": "What about Bengaluru?",
        "conversation_id": session_id
    })
    assert res2.status_code == 200
    data2 = res2.json()
    # It should retain Tomato as the crop and answer for Bengaluru!
    assert "Tomato" in data2["response"]
    assert "Bengaluru" in data2["response"] or "Yeshwanthpur" in data2["response"]


def test_mandi_comparison_intent():
    session_id = f"test_sess_{uuid.uuid4().hex[:8]}"
    res = client.post("/api/v1/chatbot/message", json={
        "message": "Compare onion prices in Bengaluru and Kolar",
        "conversation_id": session_id
    })
    assert res.status_code == 200
    data = res.json()
    assert data["intent"] == "MANDI_COMPARISON"
    assert "Kolar" in data["response"]
    assert "Bengaluru" in data["response"]
    assert "Onion" in data["response"]


def test_price_forecast_intent():
    session_id = f"test_sess_{uuid.uuid4().hex[:8]}"
    res = client.post("/api/v1/chatbot/message", json={
        "message": "What is the expected tomato price next week?",
        "conversation_id": session_id
    })
    assert res.status_code == 200
    data = res.json()
    assert data["intent"] == "PRICE_FORECAST"
    assert "7-Day" in data["response"] or "Projected" in data["response"] or "Target" in data["response"]


def test_harvest_split_intent():
    session_id = f"test_sess_{uuid.uuid4().hex[:8]}"
    res = client.post("/api/v1/chatbot/message", json={
        "message": "I have 100 quintals of potato. How should I sell it?",
        "conversation_id": session_id
    })
    assert res.status_code == 200
    data = res.json()
    assert data["intent"] == "HARVEST_OPTIMIZATION"
    assert "100" in data["response"]
    assert "Potato" in data["response"]


def test_subscription_and_protection_intent():
    session_id = f"test_sess_{uuid.uuid4().hex[:8]}"
    res = client.post("/api/v1/chatbot/message", json={
        "message": "Explain AI prediction protection and plans",
        "conversation_id": session_id
    })
    assert res.status_code == 200
    data = res.json()
    assert data["intent"] in ["PROTECTION_INFORMATION", "SUBSCRIPTION_INFORMATION"]
    assert "35%" in data["response"]
    assert "demonstration" in data["response"].lower() or "demo" in data["response"].lower()


def test_chat_history_and_clear():
    session_id = f"test_sess_{uuid.uuid4().hex[:8]}"

    # Post 2 messages
    client.post("/api/v1/chatbot/message", json={"message": "Hello", "conversation_id": session_id})
    client.post("/api/v1/chatbot/message", json={"message": "Tomato price", "conversation_id": session_id})

    # Retrieve history
    hist = client.get(f"/api/v1/chatbot/history?conversation_id={session_id}")
    assert hist.status_code == 200
    h_data = hist.json()
    assert h_data["total_messages"] >= 4  # 2 user + 2 assistant

    # Clear history
    del_res = client.delete(f"/api/v1/chatbot/history?conversation_id={session_id}")
    assert del_res.status_code == 200

    # Verify cleared
    hist_cleared = client.get(f"/api/v1/chatbot/history?conversation_id={session_id}")
    assert hist_cleared.json()["total_messages"] == 0


def test_speech_to_text_interface():
    res = client.post("/api/v1/chatbot/speech-to-text", json={
        "language": "kn-IN"
    })
    assert res.status_code == 200
    data = res.json()
    assert data["detected_language"] == "kn-IN"
    assert "text" in data

