"""Pydantic schemas for AI Prediction Protection and Claim Management."""

from typing import List, Optional
from pydantic import BaseModel, Field


class PredictionRecordResponse(BaseModel):
    prediction_id: str
    user_id: Optional[str] = None
    crop_id: str
    crop_name: str
    mandi_id: str
    mandi_name: str
    prediction_timestamp: str
    predicted_price: float
    forecast_horizon_days: int
    confidence_min: float
    confidence_max: float
    recommended_action: str
    model_version: str
    is_demo: bool = True
    subscription_tier_at_generation: str
    created_at: str


class ClaimCreateRequest(BaseModel):
    prediction_id: str = Field(..., description="ID of the eligible AI Prediction record")
    crop_id: str = Field(..., description="Crop identifier, e.g. 'tomato'")
    crop_name: str = Field(..., description="Crop name")
    mandi_id: str = Field(..., description="Mandi identifier")
    mandi_name: str = Field(..., description="Mandi name")
    harvest_quantity_qtl: float = Field(..., gt=0, description="Quantity sold in quintals")
    actual_selling_price: float = Field(..., ge=0, description="Real price realized at mandi in ₹/qtl")
    date_of_sale: str = Field(..., description="Date of sale (YYYY-MM-DD)")
    evidence_description: str = Field(..., min_length=5, description="Receipt / mandi slip reference or details")
    financial_impact_description: str = Field(..., min_length=5, description="Brief explanation of the adverse price impact")


class ClaimResponse(BaseModel):
    claim_id: str
    user_id: str
    user_name: str
    user_mobile: str
    prediction_id: str
    crop_id: str
    crop_name: str
    mandi_id: str
    mandi_name: str
    harvest_quantity_qtl: float
    actual_selling_price: float
    predicted_price: float
    gross_price_difference: float
    gross_loss: float
    verified_eligible_loss: float
    excluded_loss: float
    compensation_percentage: float
    proposed_compensation: float
    date_of_sale: str
    evidence_description: str
    financial_impact_description: str
    status: str
    reviewer_notes: Optional[str] = None
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[str] = None
    is_demo: bool = True
    created_at: str
    updated_at: str


class ClaimReviewRequest(BaseModel):
    action: str = Field(..., description="'APPROVE', 'REJECT', 'REQUEST_EVIDENCE', 'PROCESS_COMPENSATION', 'PAY', 'CLOSE'")
    reviewer_notes: str = Field(..., min_length=3, description="Reviewer explanation and audit justification")
    adjusted_excluded_loss: Optional[float] = Field(None, ge=0, description="Optional adjusted excluded loss")


class ClaimAuditResponse(BaseModel):
    log_id: str
    claim_id: str
    actor_id: str
    actor_name: str
    actor_role: str
    previous_status: Optional[str] = None
    new_status: str
    explanation: str
    timestamp: str

