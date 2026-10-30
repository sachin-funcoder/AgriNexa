"""Subscription tiers and checkout endpoints."""

from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status

from app.schemas.subscription import (
    PlanDefinition,
    SubscriptionResponse,
    CheckoutRequest,
    CheckoutResponse
)
from app.services.subscription_service import SubscriptionService
from app.core.security import get_current_user

router = APIRouter(prefix="/subscriptions", tags=["Subscription Management"])


@router.get("/plans", response_model=List[PlanDefinition])
async def list_plans():
    """
    Public endpoint listing all available AgriNexa subscription plans and features.
    """
    return SubscriptionService.get_all_plans()


@router.get("/me", response_model=SubscriptionResponse)
async def get_current_user_subscription(current_user: Dict[str, Any] = Depends(get_current_user)):
    """
    Retrieves the active subscription tier and billing status for the current user.
    """
    return SubscriptionService.get_current_subscription(current_user["id"])


@router.post("/checkout", response_model=CheckoutResponse)
async def checkout_subscription(
    req: CheckoutRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Processes simulated demo checkout for chosen subscription tier.
    """
    return SubscriptionService.checkout(current_user["id"], req)


@router.post("/cancel", response_model=SubscriptionResponse)
async def cancel_subscription(current_user: Dict[str, Any] = Depends(get_current_user)):
    """
    Cancels current active paid subscription, reverting user to Free tier.
    """
    return SubscriptionService.cancel_subscription(current_user["id"])


@router.get("/history", response_model=List[SubscriptionResponse])
async def get_subscription_history(current_user: Dict[str, Any] = Depends(get_current_user)):
    """
    Lists past and current subscription transactions for the authenticated user.
    """
    return SubscriptionService.get_user_history(current_user["id"])

