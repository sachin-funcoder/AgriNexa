"""Centralized router registering all API v1 endpoint modules."""

from fastapi import APIRouter
from app.api.v1.endpoints import (
    dashboard,
    health,
    mandis,
    prices,
    optimizer,
    community,
    auth,
    subscriptions,
    protection,
    chatbot,
    climate,
    crop_advisor
)

api_router = APIRouter()

# Register core endpoints
api_router.include_router(health.router)
api_router.include_router(mandis.router)
api_router.include_router(prices.router)
api_router.include_router(dashboard.router)
api_router.include_router(optimizer.router)
api_router.include_router(community.router)

# Register Task 7 modules
api_router.include_router(auth.router)
api_router.include_router(subscriptions.router)
api_router.include_router(protection.router)

# Register Task 8 AI Chatbot module
api_router.include_router(chatbot.router)

# Register Task 9 Climate & Crop Recommendation modules
api_router.include_router(climate.router)
api_router.include_router(crop_advisor.router)

