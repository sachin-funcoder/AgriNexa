"""Smart Crop Recommendation & Land Profile Endpoints (Task 9).
Agronomic multi-criteria decision engine for crop suitability, soil testing, and risk advisory.
"""

from typing import Optional, Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException, status
from app.core.security import get_current_user, get_optional_current_user
from app.services.land_profile_service import LandProfileService
from app.services.crop_recommendation_service import CropRecommendationService
from app.schemas.soil import LandProfileCreateRequest, LandProfileResponse
from app.schemas.crop_recommendation import (
    CropRecommendationRequest,
    CropRecommendationResponse,
    CropRecommendationItem,
)

router = APIRouter(prefix="/crop-advisor", tags=["Smart Crop Advisor"])


@router.post("/land-profile", response_model=LandProfileResponse)
async def create_or_update_land_profile(
    profile_req: LandProfileCreateRequest,
    current_user: Optional[Dict[str, Any]] = Depends(get_optional_current_user)
):
    """
    Saves or updates a farmer's land parcel and soil profile.
    If authenticated, links to the farmer's account. Otherwise generates a demo session profile.
    """
    user_id = current_user["id"] if current_user else None
    try:
        return LandProfileService.create_or_update_profile(profile_req, user_id=user_id)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save land profile: {str(e)}"
        )


@router.get("/land-profile/me", response_model=Optional[LandProfileResponse])
async def get_my_land_profile(
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Retrieves the authenticated farmer's saved land and soil profile.
    Returns 404 if no profile has been created yet.
    """
    profile = LandProfileService.get_profile_for_user(current_user["id"])
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No land profile found for this farmer account. Please create one."
        )
    return profile


@router.get("/land-profile/{profile_id}", response_model=LandProfileResponse)
async def get_land_profile_by_id(
    profile_id: str,
    current_user: Optional[Dict[str, Any]] = Depends(get_optional_current_user)
):
    """
    Retrieves a specific land profile. Ensures tenant isolation if owned by another farmer.
    """
    user_id = current_user["id"] if current_user else None
    profile = LandProfileService.get_profile_by_id(profile_id)
    
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Land profile not found."
        )
        
    # If the profile belongs to a registered user and a different registered user is accessing it
    if profile.user_id and user_id and profile.user_id != user_id:
        # Check if admin/reviewer
        role = current_user.get("role", "farmer").lower()
        if role not in ["admin", "reviewer"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: You do not have permission to view this land parcel."
            )
            
    return profile


@router.post("/recommendations", response_model=CropRecommendationResponse)
async def generate_crop_recommendations(
    req: CropRecommendationRequest,
    current_user: Optional[Dict[str, Any]] = Depends(get_optional_current_user)
):
    """
    Runs multi-criteria agronomic decision model.
    Evaluates soil properties, short-range weather, seasonal outlook, water availability,
    and cultivation constraints to generate ranked crop recommendations with full risk explanations.
    """
    user_id = current_user["id"] if current_user else None
    try:
        return CropRecommendationService.generate_recommendations(req, user_id=user_id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Recommendation engine error: {str(e)}"
        )


@router.get("/recommendations/{recommendation_id}", response_model=CropRecommendationResponse)
async def get_recommendation_by_id(
    recommendation_id: str
):
    """
    Retrieves a previously computed crop recommendation report by ID.
    """
    rec = CropRecommendationService.get_recommendation_by_id(recommendation_id)
    if not rec:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Crop recommendation report not found."
        )
    return rec


@router.get("/crops", response_model=List[Dict[str, Any]])
async def list_agronomy_crops():
    """
    Returns the comprehensive agronomic crop catalog with scientific parameters,
    temperature limits, pH ranges, water requirements, and university package of practices citations.
    """
    return CropRecommendationService.get_agronomy_catalog()

