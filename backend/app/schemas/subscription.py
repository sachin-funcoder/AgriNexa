"""Pydantic schemas for Subscription Management."""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class PlanFeature(BaseModel):
    name: str
    included: bool
    description: Optional[str] = None


class PlanDefinition(BaseModel):
    id: str
    name: str
    tier: str
    price_inr: float
    billing_cycle: str = "monthly"
    badge: Optional[str] = None
    description: str
    features: List[str]
    max_optimizer_runs_per_month: int
    has_prediction_protection: bool
    protection_coverage_percent: float = 0.0
    is_popular: bool = False


class SubscriptionResponse(BaseModel):
    id: str
    user_id: str
    plan_id: str
    plan_name: str
    billing_cycle: str
    amount_paid: float
    start_date: str
    end_date: str
    status: str
    is_demo: bool = True
    created_at: str


class CheckoutRequest(BaseModel):
    plan_id: str = Field(..., description="Target plan ID: 'FREE', 'PRO', or 'PROTECTION'")
    billing_cycle: str = Field("monthly", description="'monthly' or 'annual'")
    payment_method: str = Field("demo_upi", description="Demo payment method")


class CheckoutResponse(BaseModel):
    success: bool
    subscription: SubscriptionResponse
    message: str
    transaction_id: str
    is_demo: bool = True

