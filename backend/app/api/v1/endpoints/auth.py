"""Farmer authentication and profile API endpoints."""

from typing import Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from app.schemas.auth import (
    UserSignupRequest,
    UserLoginRequest,
    UserUpdateRequest,
    UserResponse,
    TokenResponse,
    ForgotPasswordRequest
)
from app.services.auth_service import AuthService
from app.core.security import get_current_user

router = APIRouter(prefix="/auth", tags=["Farmer Authentication"])


@router.post("/signup", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def signup(req: UserSignupRequest):
    """
    Registers a new farmer with mobile number, hashed password, and default preferences.
    Returns JWT access token and user profile.
    """
    return AuthService.signup(req)


@router.post("/login", response_model=TokenResponse)
async def login(req: UserLoginRequest):
    """
    Authenticates a farmer or admin via mobile/email and password.
    Returns JWT access token.
    """
    return AuthService.login(req)


@router.get("/me", response_model=UserResponse)
async def get_current_user_profile(current_user: Dict[str, Any] = Depends(get_current_user)):
    """
    Fetches the authenticated farmer's profile, including active subscription tier.
    """
    return AuthService.serialize_user(current_user)


@router.put("/profile", response_model=UserResponse)
async def update_profile(
    req: UserUpdateRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Updates the authenticated farmer's editable profile fields.
    """
    return AuthService.update_profile(current_user["id"], req)


@router.post("/logout")
async def logout(current_user: Dict[str, Any] = Depends(get_current_user)):
    """
    Simulates logout by acknowledging token invalidation on client side.
    """
    return {
        "success": True,
        "message": "Logged out successfully. Clear token from storage."
    }


@router.post("/forgot-password")
async def forgot_password(req: ForgotPasswordRequest):
    """
    Simulates forgot password flow for demo mode.
    Returns instructions and demo reset instructions.
    """
    return {
        "success": True,
        "message": f"Demo password reset instructions sent to {req.identifier}.",
        "demo_note": "In demo mode, you can log in with demo farmer: Mobile 9876543210, Password Farmer@123"
    }

