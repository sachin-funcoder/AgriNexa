"""Pydantic schemas for Farmer Authentication and Profile Management."""

from typing import Optional, List
from pydantic import BaseModel, Field, field_validator
import re


class UserSignupRequest(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=100, description="Farmer's full legal or trade name")
    mobile: str = Field(..., description="10-digit Indian mobile number")
    email: Optional[str] = Field(None, description="Optional email address")
    password: str = Field(..., min_length=6, max_length=100, description="Password")
    confirm_password: str = Field(..., min_length=6, max_length=100, description="Password confirmation")
    preferred_language: str = Field("en", description="'en' or 'kn'")
    district: Optional[str] = Field("Kolar", description="Karnataka APMC District")
    preferred_crops: Optional[List[str]] = Field(default_factory=lambda: ["Tomato", "Onion"], description="List of primary crops")

    @field_validator("email")
    def validate_email(cls, v: Optional[str]) -> Optional[str]:
        if not v:
            return None
        v = v.strip().lower()
        if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", v):
            raise ValueError("Invalid email format.")
        return v

    @field_validator("mobile")
    def validate_mobile(cls, v: str) -> str:
        clean = re.sub(r"\D", "", v)
        if len(clean) == 12 and clean.startswith("91"):
            clean = clean[2:]
        if len(clean) != 10:
            raise ValueError("Mobile number must be a valid 10-digit Indian phone number.")
        return clean

    @field_validator("confirm_password")
    def passwords_match(cls, v: str, info) -> str:
        if "password" in info.data and v != info.data["password"]:
            raise ValueError("Passwords do not match.")
        return v


class UserLoginRequest(BaseModel):
    identifier: str = Field(..., description="Mobile number or email address")
    password: str = Field(..., min_length=1, description="Password")
    remember_me: bool = Field(False, description="Remember login session")


class UserUpdateRequest(BaseModel):
    full_name: Optional[str] = Field(None, min_length=2, max_length=100)
    email: Optional[str] = None
    preferred_language: Optional[str] = Field(None, description="'en' or 'kn'")
    district: Optional[str] = None
    preferred_crops: Optional[List[str]] = None

    @field_validator("email")
    def validate_update_email(cls, v: Optional[str]) -> Optional[str]:
        if not v:
            return None
        v = v.strip().lower()
        if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", v):
            raise ValueError("Invalid email format.")
        return v


class ForgotPasswordRequest(BaseModel):
    identifier: str = Field(..., description="Mobile number or email address to send demo reset token")


class UserResponse(BaseModel):
    id: str
    mobile: str
    email: Optional[str] = None
    full_name: str
    role: str
    preferred_language: str
    district: Optional[str] = None
    preferred_crops: List[str] = []
    created_at: str
    updated_at: str
    active_subscription_plan: Optional[str] = "FREE"


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse
    message: str = "Authentication successful"
