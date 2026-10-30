"""AI Prediction Protection and Claims review endpoints."""

from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status

from app.schemas.protection import (
    PredictionRecordResponse,
    ClaimCreateRequest,
    ClaimResponse,
    ClaimReviewRequest,
    ClaimAuditResponse
)
from app.services.protection_service import ProtectionService
from app.core.security import get_current_user, require_reviewer_or_admin

router = APIRouter(tags=["AI Prediction Protection"])


# --- Farmer Endpoints ---

@router.get("/protection/predictions", response_model=List[PredictionRecordResponse])
async def list_available_predictions(current_user: Dict[str, Any] = Depends(get_current_user)):
    """
    Returns platform AI prediction records that farmers can reference for claim filing.
    """
    return ProtectionService.get_predictions()


@router.get("/protection/claims", response_model=List[ClaimResponse])
async def get_my_claims(current_user: Dict[str, Any] = Depends(get_current_user)):
    """
    Retrieves all claims submitted by the authenticated farmer.
    Enforces farmer data isolation.
    """
    return ProtectionService.get_farmer_claims(current_user["id"])


@router.post("/protection/claims", response_model=ClaimResponse, status_code=status.HTTP_201_CREATED)
async def submit_new_claim(
    req: ClaimCreateRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Submits a new claim against an AI price prediction record.
    Automatically applies 35% verified eligible loss calculation.
    """
    return ProtectionService.submit_claim(current_user, req)


@router.get("/protection/claims/{claim_id}", response_model=ClaimResponse)
async def get_claim_details(
    claim_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Retrieves details for a specific claim.
    Regular farmers can only view their own claims.
    """
    return ProtectionService.get_claim(claim_id, current_user)


@router.get("/protection/claims/{claim_id}/audit", response_model=List[ClaimAuditResponse])
async def get_claim_audit_logs(
    claim_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Fetches the lifecycle audit logs and status updates for a claim.
    """
    return ProtectionService.get_claim_audit_trail(claim_id, current_user)


# --- Reviewer / Admin Endpoints ---

@router.get("/admin/protection/claims", response_model=List[ClaimResponse])
async def admin_list_all_claims(current_user: Dict[str, Any] = Depends(require_reviewer_or_admin)):
    """
    Reviewer console: lists all submitted claims across the platform for APMC review.
    """
    return ProtectionService.get_all_claims_admin()


@router.post("/admin/protection/claims/{claim_id}/review", response_model=ClaimResponse)
async def admin_review_claim(
    claim_id: str,
    req: ClaimReviewRequest,
    current_user: Dict[str, Any] = Depends(require_reviewer_or_admin)
):
    """
    Reviewer console: approves, rejects, requests evidence, or processes compensation.
    Enforces that farmers cannot review their own claims.
    """
    return ProtectionService.review_claim(claim_id, current_user, req)

