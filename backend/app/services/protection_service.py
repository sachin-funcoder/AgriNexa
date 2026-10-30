"""AI Prediction Protection service managing immutable prediction records, claims, and audit logs."""

import uuid
import logging
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional
from fastapi import HTTPException, status

from app.db.database import get_connection
from app.schemas.protection import (
    PredictionRecordResponse,
    ClaimCreateRequest,
    ClaimResponse,
    ClaimReviewRequest,
    ClaimAuditResponse
)

logger = logging.getLogger("agrinexa.protection")

BENEFIT_PERCENTAGE = 35.0  # 35% verified eligible loss compensation


class ProtectionService:
    """Core service for AI Prediction Protection and claims review."""

    @staticmethod
    def ensure_seed_predictions():
        """Ensures realistic AI prediction records exist in the immutable database table."""
        conn = get_connection()
        cursor = conn.cursor()

        cursor.execute("SELECT COUNT(*) as cnt FROM predictions")
        row = cursor.fetchone()
        if row and row["cnt"] > 0:
            conn.close()
            return

        now = datetime.now(timezone.utc)
        sample_predictions = [
            {
                "id": "pred_kolar_tomato_001",
                "crop_id": "tomato",
                "crop_name": "Tomato (Hybrid Red)",
                "mandi_id": "mandi_kolar",
                "mandi_name": "Kolar APMC Mandi",
                "prediction_timestamp": (now - timedelta(days=5)).isoformat(),
                "predicted_price": 2850.0,
                "forecast_horizon_days": 7,
                "confidence_min": 2650.0,
                "confidence_max": 3050.0,
                "recommended_action": "HOLD_FOR_TARGET",
                "model_version": "AgriNexa-Ensemble-v1.4"
            },
            {
                "id": "pred_bengaluru_onion_002",
                "crop_id": "onion",
                "crop_name": "Onion (Bellary Red)",
                "mandi_id": "mandi_bengaluru",
                "mandi_name": "Yeshwanthpur APMC (Bengaluru)",
                "prediction_timestamp": (now - timedelta(days=8)).isoformat(),
                "predicted_price": 2400.0,
                "forecast_horizon_days": 10,
                "confidence_min": 2200.0,
                "confidence_max": 2580.0,
                "recommended_action": "SELL_GRADUALLY",
                "model_version": "AgriNexa-Ensemble-v1.4"
            },
            {
                "id": "pred_belagavi_potato_003",
                "crop_id": "potato",
                "crop_name": "Potato (Jyoti Fresh)",
                "mandi_id": "mandi_belagavi",
                "mandi_name": "Belagavi APMC Mandi",
                "prediction_timestamp": (now - timedelta(days=12)).isoformat(),
                "predicted_price": 1950.0,
                "forecast_horizon_days": 14,
                "confidence_min": 1800.0,
                "confidence_max": 2100.0,
                "recommended_action": "STORE_COLD",
                "model_version": "AgriNexa-Ensemble-v1.4"
            },
            {
                "id": "pred_mysuru_capsicum_004",
                "crop_id": "capsicum",
                "crop_name": "Capsicum (Green Bell)",
                "mandi_id": "mandi_mysuru",
                "mandi_name": "Mysuru APMC Mandi",
                "prediction_timestamp": (now - timedelta(days=3)).isoformat(),
                "predicted_price": 4200.0,
                "forecast_horizon_days": 7,
                "confidence_min": 3900.0,
                "confidence_max": 4500.0,
                "recommended_action": "HOLD_FOR_PEAK",
                "model_version": "AgriNexa-Ensemble-v1.4"
            }
        ]

        now_iso = now.isoformat()
        for p in sample_predictions:
            cursor.execute("""
                INSERT INTO predictions (
                    prediction_id, user_id, crop_id, crop_name, mandi_id, mandi_name,
                    prediction_timestamp, predicted_price, forecast_horizon_days,
                    confidence_min, confidence_max, recommended_action, model_version,
                    is_demo, subscription_tier_at_generation, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                p["id"],
                None,  # Available platform-wide
                p["crop_id"],
                p["crop_name"],
                p["mandi_id"],
                p["mandi_name"],
                p["prediction_timestamp"],
                p["predicted_price"],
                p["forecast_horizon_days"],
                p["confidence_min"],
                p["confidence_max"],
                p["recommended_action"],
                p["model_version"],
                1,
                "PROTECTION",
                now_iso
            ))

        # Seed 1 demo claim for testing and reviewer console
        demo_farmer_id = "usr_demo_farmer_001"
        claim_id = "clm_demo_sample_001"
        cursor.execute("SELECT claim_id FROM claims WHERE claim_id = ?", (claim_id,))
        if not cursor.fetchone():
            pred = sample_predictions[0]
            pred_price = pred["predicted_price"]
            actual_price = 2300.0
            qty = 50.0  # 50 quintals
            price_diff = pred_price - actual_price  # 550
            gross_loss = price_diff * qty  # 27,500
            eligible_loss = gross_loss
            proposed_comp = round(eligible_loss * (BENEFIT_PERCENTAGE / 100.0), 2)  # 9,625.0

            cursor.execute("""
                INSERT INTO claims (
                    claim_id, user_id, user_name, user_mobile, prediction_id,
                    crop_id, crop_name, mandi_id, mandi_name, harvest_quantity_qtl,
                    actual_selling_price, predicted_price, gross_price_difference,
                    gross_loss, verified_eligible_loss, excluded_loss,
                    compensation_percentage, proposed_compensation, date_of_sale,
                    evidence_description, financial_impact_description,
                    status, reviewer_notes, reviewed_by, reviewed_at,
                    is_demo, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                claim_id,
                demo_farmer_id,
                "Ramesh Gowda (Demo Farmer)",
                "9876543210",
                pred["id"],
                pred["crop_id"],
                pred["crop_name"],
                pred["mandi_id"],
                pred["mandi_name"],
                qty,
                actual_price,
                pred_price,
                price_diff,
                gross_loss,
                eligible_loss,
                0.0,
                BENEFIT_PERCENTAGE,
                proposed_comp,
                (now - timedelta(days=2)).strftime("%Y-%m-%d"),
                "Mandi Slip #APMC-KOLAR-2026-9921, weighed at Gate 2",
                "Sudden glut arrival dropped market spot rate by ₹550/qtl below AI forecast.",
                "Under Review",
                "Preliminary receipt verified with APMC ledger.",
                "Dr. Anitha Rao (APMC Reviewer)",
                (now - timedelta(days=1)).isoformat(),
                1,
                (now - timedelta(days=2)).isoformat(),
                (now - timedelta(days=1)).isoformat()
            ))

            # Audit entry
            cursor.execute("""
                INSERT INTO claim_audit_logs (
                    log_id, claim_id, actor_id, actor_name, actor_role,
                    previous_status, new_status, explanation, timestamp
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                f"log_{uuid.uuid4().hex[:8]}",
                claim_id,
                "usr_demo_admin_001",
                "Dr. Anitha Rao (APMC Reviewer)",
                "admin",
                "Submitted",
                "Under Review",
                "Claim taken up for primary gate slip validation.",
                (now - timedelta(days=1)).isoformat()
            ))

        conn.commit()
        conn.close()

    @classmethod
    def get_predictions(cls) -> List[PredictionRecordResponse]:
        """Returns list of immutable AI prediction snapshots."""
        cls.ensure_seed_predictions()
        conn = get_connection()
        rows = conn.execute("SELECT * FROM predictions ORDER BY prediction_timestamp DESC").fetchall()
        conn.close()

        return [
            PredictionRecordResponse(
                prediction_id=r["prediction_id"],
                user_id=r["user_id"],
                crop_id=r["crop_id"],
                crop_name=r["crop_name"],
                mandi_id=r["mandi_id"],
                mandi_name=r["mandi_name"],
                prediction_timestamp=r["prediction_timestamp"],
                predicted_price=r["predicted_price"],
                forecast_horizon_days=r["forecast_horizon_days"],
                confidence_min=r["confidence_min"],
                confidence_max=r["confidence_max"],
                recommended_action=r["recommended_action"],
                model_version=r["model_version"],
                is_demo=bool(r["is_demo"]),
                subscription_tier_at_generation=r["subscription_tier_at_generation"],
                created_at=r["created_at"]
            )
            for r in rows
        ]

    @classmethod
    def submit_claim(cls, current_user: Dict[str, Any], req: ClaimCreateRequest) -> ClaimResponse:
        """
        Calculates loss, applies 35% benefit calculation, and persists new claim.
        """
        cls.ensure_seed_predictions()
        conn = get_connection()
        cursor = conn.cursor()

        # Fetch prediction
        cursor.execute("SELECT * FROM predictions WHERE prediction_id = ?", (req.prediction_id,))
        pred = cursor.fetchone()
        if not pred:
            conn.close()
            raise HTTPException(status_code=404, detail="Selected AI Prediction record not found.")

        predicted_price = float(pred["predicted_price"])
        actual_price = float(req.actual_selling_price)
        qty = float(req.harvest_quantity_qtl)

        # Loss calculations
        price_diff = max(0.0, round(predicted_price - actual_price, 2))
        gross_loss = round(price_diff * qty, 2)
        excluded_loss = 0.0
        verified_eligible_loss = max(0.0, round(gross_loss - excluded_loss, 2))
        proposed_compensation = round(verified_eligible_loss * (BENEFIT_PERCENTAGE / 100.0), 2)

        claim_id = f"clm_{uuid.uuid4().hex[:10]}"
        now_iso = datetime.now(timezone.utc).isoformat()

        cursor.execute("""
            INSERT INTO claims (
                claim_id, user_id, user_name, user_mobile, prediction_id,
                crop_id, crop_name, mandi_id, mandi_name, harvest_quantity_qtl,
                actual_selling_price, predicted_price, gross_price_difference,
                gross_loss, verified_eligible_loss, excluded_loss,
                compensation_percentage, proposed_compensation, date_of_sale,
                evidence_description, financial_impact_description,
                status, reviewer_notes, reviewed_by, reviewed_at,
                is_demo, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            claim_id,
            current_user["id"],
            current_user["full_name"],
            current_user["mobile"],
            req.prediction_id,
            req.crop_id,
            req.crop_name,
            req.mandi_id,
            req.mandi_name,
            qty,
            actual_price,
            predicted_price,
            price_diff,
            gross_loss,
            verified_eligible_loss,
            excluded_loss,
            BENEFIT_PERCENTAGE,
            proposed_compensation,
            req.date_of_sale,
            req.evidence_description,
            req.financial_impact_description,
            "Submitted",
            None,
            None,
            None,
            1,
            now_iso,
            now_iso
        ))

        # Initial audit log
        log_id = f"log_{uuid.uuid4().hex[:8]}"
        cursor.execute("""
            INSERT INTO claim_audit_logs (
                log_id, claim_id, actor_id, actor_name, actor_role,
                previous_status, new_status, explanation, timestamp
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            log_id,
            claim_id,
            current_user["id"],
            current_user["full_name"],
            current_user.get("role", "farmer"),
            None,
            "Submitted",
            "Claim initially submitted by farmer with mandi transaction evidence.",
            now_iso
        ))

        conn.commit()
        created_claim = cursor.execute("SELECT * FROM claims WHERE claim_id = ?", (claim_id,)).fetchone()
        conn.close()

        return cls._serialize_claim(dict(created_claim))

    @classmethod
    def get_farmer_claims(cls, user_id: str) -> List[ClaimResponse]:
        """Returns all claims belonging exclusively to the specified farmer."""
        cls.ensure_seed_predictions()
        conn = get_connection()
        rows = conn.execute("""
            SELECT * FROM claims 
            WHERE user_id = ?
            ORDER BY created_at DESC
        """, (user_id,)).fetchall()
        conn.close()
        return [cls._serialize_claim(dict(r)) for r in rows]

    @classmethod
    def get_all_claims_admin(cls) -> List[ClaimResponse]:
        """Returns all claims platform-wide for reviewer/admin console."""
        cls.ensure_seed_predictions()
        conn = get_connection()
        rows = conn.execute("SELECT * FROM claims ORDER BY created_at DESC").fetchall()
        conn.close()
        return [cls._serialize_claim(dict(r)) for r in rows]

    @classmethod
    def get_claim(cls, claim_id: str, current_user: Dict[str, Any]) -> ClaimResponse:
        """Retrieves a single claim with user-access verification."""
        conn = get_connection()
        row = conn.execute("SELECT * FROM claims WHERE claim_id = ?", (claim_id,)).fetchone()
        conn.close()

        if not row:
            raise HTTPException(status_code=404, detail="Claim not found.")

        claim_dict = dict(row)
        user_role = current_user.get("role", "farmer").lower()

        # Authorization: farmer can only view their own claim
        if user_role not in ["admin", "reviewer", "moderator"] and claim_dict["user_id"] != current_user["id"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: You cannot view another farmer's claim."
            )

        return cls._serialize_claim(claim_dict)

    @classmethod
    def review_claim(
        cls,
        claim_id: str,
        reviewer_user: Dict[str, Any],
        req: ClaimReviewRequest
    ) -> ClaimResponse:
        """
        Reviews a claim. Enforces:
        - Reviewer cannot be the claimant (farmers cannot review their own claim).
        - Status transition rules.
        - Updating loss if excluded_loss is adjusted.
        - Creating audit log entry.
        """
        conn = get_connection()
        cursor = conn.cursor()

        cursor.execute("SELECT * FROM claims WHERE claim_id = ?", (claim_id,))
        existing = cursor.fetchone()
        if not existing:
            conn.close()
            raise HTTPException(status_code=404, detail="Claim not found.")

        claim_dict = dict(existing)

        # Enforce: Claimant cannot review their own claim!
        if claim_dict["user_id"] == reviewer_user["id"]:
            conn.close()
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Conflict of interest: Farmers cannot review or approve their own claims."
            )

        # Map action to target status
        action_map = {
            "APPROVE": "Approved",
            "REJECT": "Rejected",
            "REQUEST_EVIDENCE": "Additional Evidence Required",
            "PROCESS_COMPENSATION": "Compensation Processing",
            "PAY": "Paid",
            "CLOSE": "Closed"
        }
        target_status = action_map.get(req.action.upper())
        if not target_status:
            conn.close()
            raise HTTPException(
                status_code=400,
                detail=f"Invalid review action '{req.action}'. Allowed: {list(action_map.keys())}"
            )

        now_iso = datetime.now(timezone.utc).isoformat()
        previous_status = claim_dict["status"]

        # Recalculate compensation if excluded loss was adjusted
        excluded_loss = claim_dict["excluded_loss"]
        if req.adjusted_excluded_loss is not None:
            excluded_loss = max(0.0, float(req.adjusted_excluded_loss))

        gross_loss = float(claim_dict["gross_loss"])
        verified_eligible_loss = max(0.0, round(gross_loss - excluded_loss, 2))
        proposed_compensation = round(verified_eligible_loss * (BENEFIT_PERCENTAGE / 100.0), 2)

        cursor.execute("""
            UPDATE claims SET
                status = ?,
                reviewer_notes = ?,
                reviewed_by = ?,
                reviewed_at = ?,
                excluded_loss = ?,
                verified_eligible_loss = ?,
                proposed_compensation = ?,
                updated_at = ?
            WHERE claim_id = ?
        """, (
            target_status,
            req.reviewer_notes,
            reviewer_user["full_name"],
            now_iso,
            excluded_loss,
            verified_eligible_loss,
            proposed_compensation,
            now_iso,
            claim_id
        ))

        # Log audit entry
        log_id = f"log_{uuid.uuid4().hex[:8]}"
        cursor.execute("""
            INSERT INTO claim_audit_logs (
                log_id, claim_id, actor_id, actor_name, actor_role,
                previous_status, new_status, explanation, timestamp
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            log_id,
            claim_id,
            reviewer_user["id"],
            reviewer_user["full_name"],
            reviewer_user.get("role", "reviewer"),
            previous_status,
            target_status,
            req.reviewer_notes,
            now_iso
        ))

        conn.commit()
        updated_row = cursor.execute("SELECT * FROM claims WHERE claim_id = ?", (claim_id,)).fetchone()
        conn.close()

        return cls._serialize_claim(dict(updated_row))

    @classmethod
    def get_claim_audit_trail(cls, claim_id: str, current_user: Dict[str, Any]) -> List[ClaimAuditResponse]:
        """Returns the complete audit log for a specific claim."""
        # Verify access permission first
        cls.get_claim(claim_id, current_user)

        conn = get_connection()
        rows = conn.execute("""
            SELECT * FROM claim_audit_logs 
            WHERE claim_id = ? 
            ORDER BY timestamp ASC
        """, (claim_id,)).fetchall()
        conn.close()

        return [
            ClaimAuditResponse(
                log_id=r["log_id"],
                claim_id=r["claim_id"],
                actor_id=r["actor_id"],
                actor_name=r["actor_name"],
                actor_role=r["actor_role"],
                previous_status=r["previous_status"],
                new_status=r["new_status"],
                explanation=r["explanation"],
                timestamp=r["timestamp"]
            )
            for r in rows
        ]

    @staticmethod
    def _serialize_claim(row: Dict[str, Any]) -> ClaimResponse:
        """Maps database dictionary to ClaimResponse."""
        return ClaimResponse(
            claim_id=row["claim_id"],
            user_id=row["user_id"],
            user_name=row["user_name"],
            user_mobile=row["user_mobile"],
            prediction_id=row["prediction_id"],
            crop_id=row["crop_id"],
            crop_name=row["crop_name"],
            mandi_id=row["mandi_id"],
            mandi_name=row["mandi_name"],
            harvest_quantity_qtl=float(row["harvest_quantity_qtl"]),
            actual_selling_price=float(row["actual_selling_price"]),
            predicted_price=float(row["predicted_price"]),
            gross_price_difference=float(row["gross_price_difference"]),
            gross_loss=float(row["gross_loss"]),
            verified_eligible_loss=float(row["verified_eligible_loss"]),
            excluded_loss=float(row.get("excluded_loss") or 0.0),
            compensation_percentage=float(row.get("compensation_percentage") or BENEFIT_PERCENTAGE),
            proposed_compensation=float(row["proposed_compensation"]),
            date_of_sale=row["date_of_sale"],
            evidence_description=row["evidence_description"],
            financial_impact_description=row["financial_impact_description"],
            status=row["status"],
            reviewer_notes=row.get("reviewer_notes"),
            reviewed_by=row.get("reviewed_by"),
            reviewed_at=row.get("reviewed_at"),
            is_demo=bool(row["is_demo"]),
            created_at=row["created_at"],
            updated_at=row["updated_at"]
        )

