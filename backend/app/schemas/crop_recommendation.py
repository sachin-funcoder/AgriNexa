"""Pydantic schemas for Smart Crop Recommendation Engine (Task 9)."""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from app.schemas.soil import LandProfileCreateRequest, LandProfileResponse


class CropSuitabilityScores(BaseModel):
    overall_suitability_score: float = Field(..., ge=0, le=100, description="Overall weighted suitability (0-100)")
    soil_score: float = Field(..., ge=0, le=100, description="Soil compatibility score")
    climate_score: float = Field(..., ge=0, le=100, description="Temperature & rainfall match score")
    water_score: float = Field(..., ge=0, le=100, description="Water source and availability match score")
    season_score: float = Field(..., ge=0, le=100, description="Sowing window and seasonal match score")
    confidence_score: float = Field(..., ge=0, le=100, description="Confidence based on completeness of soil & land inputs")


class CropCalendarStage(BaseModel):
    stage_name_en: str
    stage_name_kn: str
    duration_days: int
    approximate_dates: str
    key_tasks_en: str
    key_tasks_kn: str


class CropCalendarTimeline(BaseModel):
    crop_id: str
    crop_name_en: str
    crop_name_kn: str
    sowing_window: str
    estimated_harvest_window: str
    stages: List[CropCalendarStage] = []


class RiskAssessment(BaseModel):
    risk_type: str
    risk_level: str  # "Low", "Medium", "High"
    reason_en: str
    reason_kn: str
    mitigation_en: str
    mitigation_kn: str


class CropRecommendationItem(BaseModel):
    rank: int
    crop_id: str
    crop_name_en: str
    crop_name_kn: str
    category: str
    suitability_tier: str  # "Best Match", "Strong Match", "Moderate Match", "Conditional"
    scores: CropSuitabilityScores
    estimated_duration_days: str
    water_requirement_category: str
    sowing_period: str
    why_recommended_en: List[str]
    why_recommended_kn: List[str]
    identified_risks_en: List[str]
    identified_risks_kn: List[str]
    detailed_risks: List[RiskAssessment] = []
    soil_amendment_advice: Optional[str] = None
    current_mandi_modal_price: Optional[float] = None
    calendar: Optional[CropCalendarTimeline] = None


class CropRecommendationRequest(BaseModel):
    land_profile_id: Optional[str] = Field(None, description="Existing saved Land Profile ID")
    inline_profile: Optional[LandProfileCreateRequest] = Field(None, description="Ad-hoc inline land profile")
    season: Optional[str] = Field("Kharif", description="'Kharif', 'Rabi', 'Summer'")


class CropRecommendationResponse(BaseModel):
    recommendation_id: str
    land_profile_id: str
    district: str
    season: str
    recommendations: List[CropRecommendationItem]
    top_recommendation: CropRecommendationItem
    water_advisory_summary_en: str
    water_advisory_summary_kn: str
    scoring_weights_version: str = "v1.2-agronomic-demo"
    dataset_version: str = "UAS-Bangalore-Karnataka-v2024"
    data_source: str = "synthetic_agronomic_engine"
    is_demo: bool = True
    generated_at: str

