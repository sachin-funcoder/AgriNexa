"""Authentication service handling user accounts, authentication, and profile updates."""

import json
import uuid
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Optional, List
from fastapi import HTTPException, status

from app.db.database import get_connection
from app.core.security import hash_password, verify_password, create_access_token
from app.schemas.auth import (
    UserSignupRequest,
    UserLoginRequest,
    UserUpdateRequest,
    UserResponse,
    TokenResponse,
)

logger = logging.getLogger("agrinexa.auth")


class AuthService:
    """Authentication and user management business logic."""

    @staticmethod
    def ensure_seed_data():
        """Ensures default demo accounts and initial subscriptions exist."""
        conn = get_connection()
        cursor = conn.cursor()

        # 1. Demo Farmer
        cursor.execute("SELECT id FROM users WHERE mobile = ?", ("9876543210",))
        demo_farmer = cursor.fetchone()
        farmer_id = "usr_demo_farmer_001"
        if not demo_farmer:
            h, s = hash_password("Farmer@123")
            now_iso = datetime.now(timezone.utc).isoformat()
            cursor.execute("""
                INSERT INTO users (
                    id, mobile, email, full_name, password_hash, salt, role,
                    preferred_language, district, preferred_crops, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                farmer_id,
                "9876543210",
                "farmer@agrinexa.in",
                "Ramesh Gowda (Demo Farmer)",
                h,
                s,
                "farmer",
                "en",
                "Kolar",
                json.dumps(["Tomato", "Onion", "Potato"]),
                now_iso,
                now_iso
            ))

            # Give demo farmer a PROTECTION subscription
            sub_id = "sub_demo_farmer_001"
            end_iso = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
            cursor.execute("""
                INSERT INTO subscriptions (
                    id, user_id, plan_id, plan_name, billing_cycle, amount_paid,
                    start_date, end_date, status, is_demo, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                sub_id,
                farmer_id,
                "PROTECTION",
                "AI Prediction Protection Plan",
                "monthly",
                499.0,
                now_iso,
                end_iso,
                "active",
                1,
                now_iso
            ))

        # 2. Demo Reviewer / Admin
        cursor.execute("SELECT id FROM users WHERE mobile = ?", ("9999999999",))
        demo_admin = cursor.fetchone()
        admin_id = "usr_demo_admin_001"
        if not demo_admin:
            h, s = hash_password("Admin@123")
            now_iso = datetime.now(timezone.utc).isoformat()
            cursor.execute("""
                INSERT INTO users (
                    id, mobile, email, full_name, password_hash, salt, role,
                    preferred_language, district, preferred_crops, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                admin_id,
                "9999999999",
                "admin@agrinexa.in",
                "Dr. Anitha Rao (APMC Reviewer)",
                h,
                s,
                "admin",
                "en",
                "Bengaluru",
                json.dumps(["Tomato", "Capsicum", "Paddy"]),
                now_iso,
                now_iso
            ))

        conn.commit()
        conn.close()

    @staticmethod
    def get_user_subscription_tier(user_id: str) -> str:
        """Finds current active subscription tier for a user."""
        conn = get_connection()
        row = conn.execute("""
            SELECT plan_id FROM subscriptions 
            WHERE user_id = ? AND status = 'active'
            ORDER BY created_at DESC LIMIT 1
        """, (user_id,)).fetchone()
        conn.close()
        if row:
            return row["plan_id"]
        return "FREE"

    @classmethod
    def serialize_user(cls, user_row: Dict[str, Any]) -> UserResponse:
        """Formats db row into UserResponse schema."""
        crops_raw = user_row.get("preferred_crops")
        crops: List[str] = []
        if crops_raw:
            try:
                crops = json.loads(crops_raw)
            except Exception:
                crops = [c.strip() for c in crops_raw.split(",") if c.strip()]
        
        tier = cls.get_user_subscription_tier(user_row["id"])

        return UserResponse(
            id=user_row["id"],
            mobile=user_row["mobile"],
            email=user_row["email"],
            full_name=user_row["full_name"],
            role=user_row["role"],
            preferred_language=user_row["preferred_language"],
            district=user_row.get("district"),
            preferred_crops=crops,
            created_at=user_row["created_at"],
            updated_at=user_row["updated_at"],
            active_subscription_plan=tier
        )

    @classmethod
    def signup(cls, req: UserSignupRequest) -> TokenResponse:
        """Registers a new farmer account."""
        cls.ensure_seed_data()
        conn = get_connection()
        cursor = conn.cursor()

        # Check existing mobile
        cursor.execute("SELECT id FROM users WHERE mobile = ?", (req.mobile,))
        if cursor.fetchone():
            conn.close()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="An account with this mobile number already exists."
            )

        # Check existing email
        if req.email:
            cursor.execute("SELECT id FROM users WHERE email = ?", (req.email,))
            if cursor.fetchone():
                conn.close()
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="An account with this email address already exists."
                )

        user_id = f"usr_{uuid.uuid4().hex[:12]}"
        h, s = hash_password(req.password)
        now_iso = datetime.now(timezone.utc).isoformat()
        crops_json = json.dumps(req.preferred_crops or ["Tomato", "Onion"])

        cursor.execute("""
            INSERT INTO users (
                id, mobile, email, full_name, password_hash, salt, role,
                preferred_language, district, preferred_crops, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            user_id,
            req.mobile,
            req.email,
            req.full_name,
            h,
            s,
            "farmer",
            req.preferred_language,
            req.district or "Kolar",
            crops_json,
            now_iso,
            now_iso
        ))

        # Default FREE subscription
        sub_id = f"sub_{uuid.uuid4().hex[:12]}"
        end_iso = (datetime.now(timezone.utc) + timedelta(days=365)).isoformat()
        cursor.execute("""
            INSERT INTO subscriptions (
                id, user_id, plan_id, plan_name, billing_cycle, amount_paid,
                start_date, end_date, status, is_demo, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            sub_id,
            user_id,
            "FREE",
            "Free Tier",
            "annual",
            0.0,
            now_iso,
            end_iso,
            "active",
            1,
            now_iso
        ))

        conn.commit()
        created_user = cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        conn.close()

        user_res = cls.serialize_user(dict(created_user))
        token = create_access_token({"sub": user_id, "role": "farmer", "name": req.full_name})
        return TokenResponse(
            access_token=token,
            user=user_res,
            message="Farmer registration successful. Welcome to AgriNexa!"
        )

    @classmethod
    def login(cls, req: UserLoginRequest) -> TokenResponse:
        """Authenticates user with mobile or email."""
        cls.ensure_seed_data()
        conn = get_connection()
        cursor = conn.cursor()

        # Clean identifier
        identifier = req.identifier.strip()
        cursor.execute("""
            SELECT * FROM users 
            WHERE mobile = ? OR email = ?
        """, (identifier, identifier.lower()))
        user_row = cursor.fetchone()
        conn.close()

        if not user_row:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid mobile number, email, or password."
            )

        user_dict = dict(user_row)
        if not verify_password(req.password, user_dict["password_hash"], user_dict["salt"]):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid mobile number, email, or password."
            )

        user_res = cls.serialize_user(user_dict)
        delta = timedelta(days=30) if req.remember_me else timedelta(days=7)
        token = create_access_token(
            {"sub": user_dict["id"], "role": user_dict["role"], "name": user_dict["full_name"]},
            expires_delta=delta
        )
        return TokenResponse(
            access_token=token,
            user=user_res,
            message="Login successful."
        )

    @classmethod
    def update_profile(cls, user_id: str, req: UserUpdateRequest) -> UserResponse:
        """Updates editable user profile fields."""
        conn = get_connection()
        cursor = conn.cursor()

        cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
        existing = cursor.fetchone()
        if not existing:
            conn.close()
            raise HTTPException(status_code=404, detail="User account not found.")

        updates = []
        params = []

        if req.full_name is not None:
            updates.append("full_name = ?")
            params.append(req.full_name)
        if req.email is not None:
            # Check unique email
            cursor.execute("SELECT id FROM users WHERE email = ? AND id != ?", (req.email, user_id))
            if cursor.fetchone():
                conn.close()
                raise HTTPException(status_code=409, detail="Email is already in use by another account.")
            updates.append("email = ?")
            params.append(req.email)
        if req.preferred_language is not None:
            updates.append("preferred_language = ?")
            params.append(req.preferred_language)
        if req.district is not None:
            updates.append("district = ?")
            params.append(req.district)
        if req.preferred_crops is not None:
            updates.append("preferred_crops = ?")
            params.append(json.dumps(req.preferred_crops))

        if updates:
            now_iso = datetime.now(timezone.utc).isoformat()
            updates.append("updated_at = ?")
            params.append(now_iso)
            params.append(user_id)
            query = f"UPDATE users SET {', '.join(updates)} WHERE id = ?"
            cursor.execute(query, tuple(params))
            conn.commit()

        updated_user = cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        conn.close()
        return cls.serialize_user(dict(updated_user))

