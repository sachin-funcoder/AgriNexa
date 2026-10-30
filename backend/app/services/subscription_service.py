"""Subscription service managing plan definitions, mock checkout, and lifecycle."""

import uuid
import logging
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional
from fastapi import HTTPException, status

from app.db.database import get_connection
from app.schemas.subscription import (
    PlanDefinition,
    SubscriptionResponse,
    CheckoutRequest,
    CheckoutResponse
)

logger = logging.getLogger("agrinexa.subscriptions")

# Configurable tier definitions
PLANS: Dict[str, PlanDefinition] = {
    "FREE": PlanDefinition(
        id="FREE",
        name="Kisan Basic (ಉಚಿತ)",
        tier="FREE",
        price_inr=0.0,
        billing_cycle="forever",
        badge="Default",
        description="Standard access to APMC mandi market rates, dashboard summaries, and community forums.",
        features=[
            "Live APMC Mandi Market Prices (Karnataka)",
            "Visual Dashboard and Arrivals summary",
            "Community Discussion Forum & Farmer Feed",
            "Mandi Grievance Submission & Tracking",
            "Standard English & Kannada Interface"
        ],
        max_optimizer_runs_per_month=3,
        has_prediction_protection=False,
        protection_coverage_percent=0.0,
        is_popular=False
    ),
    "PRO": PlanDefinition(
        id="PRO",
        name="Kisan Pro (ಪ್ರೊ)",
        tier="PRO",
        price_inr=199.0,
        billing_cycle="monthly",
        badge="Value",
        description="Advanced analytical tools including 14-day price forecasts, profit calculators, and mandi comparison.",
        features=[
            "Everything in Basic Plan",
            "Historical Price Trends & Volatility Analytics",
            "14-Day Machine Learning Price Projections",
            "Smart Mandi Comparison with Transport Cost Estimator",
            "Farmer Profit & Net-Realization Calculator",
            "Harvest Split Optimizer (up to 25 runs/month)"
        ],
        max_optimizer_runs_per_month=25,
        has_prediction_protection=False,
        protection_coverage_percent=0.0,
        is_popular=True
    ),
    "PROTECTION": PlanDefinition(
        id="PROTECTION",
        name="Kisan Raksha + Pro (ರಕ್ಷಾ)",
        tier="PROTECTION",
        price_inr=499.0,
        billing_cycle="monthly",
        badge="Best Protection",
        description="Full platform access plus proposed AI Prediction Protection with 35% verified eligible loss compensation.",
        features=[
            "Everything in Kisan Pro",
            "AI Prediction Protection Eligibility (35% Verified Loss Benefit)",
            "Unlimited Smart Harvest Split Optimizer Runs",
            "Priority APMC Market Alert SMS & Notifications",
            "Dedicated Mandi Grievance Escalation Support",
            "Full Audit Trail & Evidence Verification Console"
        ],
        max_optimizer_runs_per_month=9999,
        has_prediction_protection=True,
        protection_coverage_percent=35.0,
        is_popular=False
    )
}


class SubscriptionService:
    """Subscription business logic and payment lifecycle."""

    @staticmethod
    def get_all_plans() -> List[PlanDefinition]:
        """Returns catalog of subscription plans."""
        return list(PLANS.values())

    @staticmethod
    def get_plan(plan_id: str) -> PlanDefinition:
        """Finds plan by ID or raises 404."""
        plan = PLANS.get(plan_id.upper())
        if not plan:
            raise HTTPException(status_code=404, detail=f"Plan '{plan_id}' not found.")
        return plan

    @classmethod
    def get_current_subscription(cls, user_id: str) -> SubscriptionResponse:
        """Retrieves active subscription for user, or generates default FREE tier."""
        conn = get_connection()
        row = conn.execute("""
            SELECT * FROM subscriptions 
            WHERE user_id = ? AND status = 'active'
            ORDER BY created_at DESC LIMIT 1
        """, (user_id,)).fetchone()
        conn.close()

        if row:
            return SubscriptionResponse(
                id=row["id"],
                user_id=row["user_id"],
                plan_id=row["plan_id"],
                plan_name=row["plan_name"],
                billing_cycle=row["billing_cycle"],
                amount_paid=row["amount_paid"],
                start_date=row["start_date"],
                end_date=row["end_date"],
                status=row["status"],
                is_demo=bool(row["is_demo"]),
                created_at=row["created_at"]
            )

        # Fallback default FREE
        now_iso = datetime.now(timezone.utc).isoformat()
        end_iso = (datetime.now(timezone.utc) + timedelta(days=365)).isoformat()
        return SubscriptionResponse(
            id=f"sub_default_{user_id[:8]}",
            user_id=user_id,
            plan_id="FREE",
            plan_name="Kisan Basic (Free Tier)",
            billing_cycle="annual",
            amount_paid=0.0,
            start_date=now_iso,
            end_date=end_iso,
            status="active",
            is_demo=True,
            created_at=now_iso
        )

    @classmethod
    def get_user_history(cls, user_id: str) -> List[SubscriptionResponse]:
        """Returns all subscription records for this user."""
        conn = get_connection()
        rows = conn.execute("""
            SELECT * FROM subscriptions 
            WHERE user_id = ?
            ORDER BY created_at DESC
        """, (user_id,)).fetchall()
        conn.close()

        results = []
        for r in rows:
            results.append(SubscriptionResponse(
                id=r["id"],
                user_id=r["user_id"],
                plan_id=r["plan_id"],
                plan_name=r["plan_name"],
                billing_cycle=r["billing_cycle"],
                amount_paid=r["amount_paid"],
                start_date=r["start_date"],
                end_date=r["end_date"],
                status=r["status"],
                is_demo=bool(r["is_demo"]),
                created_at=r["created_at"]
            ))
        return results

    @classmethod
    def checkout(cls, user_id: str, req: CheckoutRequest) -> CheckoutResponse:
        """
        Simulates payment checkout for demo subscriptions.
        Marks previous active subscriptions as cancelled/superseded and activates new plan.
        """
        plan = cls.get_plan(req.plan_id)
        conn = get_connection()
        cursor = conn.cursor()

        now = datetime.now(timezone.utc)
        now_iso = now.isoformat()
        duration_days = 365 if req.billing_cycle == "annual" else 30
        end_iso = (now + timedelta(days=duration_days)).isoformat()

        # Archive previous active subscriptions
        cursor.execute("""
            UPDATE subscriptions 
            SET status = 'superseded' 
            WHERE user_id = ? AND status = 'active'
        """, (user_id,))

        sub_id = f"sub_{uuid.uuid4().hex[:12]}"
        txn_id = f"TXN_DEMO_{uuid.uuid4().hex[:10].upper()}"

        cursor.execute("""
            INSERT INTO subscriptions (
                id, user_id, plan_id, plan_name, billing_cycle, amount_paid,
                start_date, end_date, status, is_demo, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            sub_id,
            user_id,
            plan.id,
            plan.name,
            req.billing_cycle,
            plan.price_inr,
            now_iso,
            end_iso,
            "active",
            1,
            now_iso
        ))

        conn.commit()
        conn.close()

        sub_response = SubscriptionResponse(
            id=sub_id,
            user_id=user_id,
            plan_id=plan.id,
            plan_name=plan.name,
            billing_cycle=req.billing_cycle,
            amount_paid=plan.price_inr,
            start_date=now_iso,
            end_date=end_iso,
            status="active",
            is_demo=True,
            created_at=now_iso
        )

        return CheckoutResponse(
            success=True,
            subscription=sub_response,
            message=f"Successfully subscribed to {plan.name} (Simulated Demo Payment).",
            transaction_id=txn_id,
            is_demo=True
        )

    @classmethod
    def cancel_subscription(cls, user_id: str) -> SubscriptionResponse:
        """Cancels active paid subscription, reverting user to Free tier."""
        conn = get_connection()
        cursor = conn.cursor()

        cursor.execute("""
            UPDATE subscriptions 
            SET status = 'cancelled' 
            WHERE user_id = ? AND status = 'active' AND plan_id != 'FREE'
        """, (user_id,))

        # Re-add Free plan
        now_iso = datetime.now(timezone.utc).isoformat()
        end_iso = (datetime.now(timezone.utc) + timedelta(days=365)).isoformat()
        sub_id = f"sub_free_{uuid.uuid4().hex[:10]}"

        cursor.execute("""
            INSERT INTO subscriptions (
                id, user_id, plan_id, plan_name, billing_cycle, amount_paid,
                start_date, end_date, status, is_demo, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            sub_id,
            user_id,
            "FREE",
            "Kisan Basic (Free Tier)",
            "annual",
            0.0,
            now_iso,
            end_iso,
            "active",
            1,
            now_iso
        ))

        conn.commit()
        conn.close()

        return cls.get_current_subscription(user_id)

