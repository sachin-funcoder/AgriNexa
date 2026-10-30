"""Pydantic schemas for Mandi data."""

from typing import List, Optional
from pydantic import BaseModel, Field


class MandiBase(BaseModel):
    name: str = Field(..., description="Name of the APMC market yard")
    district: str = Field(..., description="District in Karnataka")
    state: str = Field("Karnataka", description="State name")
    latitude: float = Field(..., ge=-90.0, le=90.0, description="Geographic latitude")
    longitude: float = Field(..., ge=-180.0, le=180.0, description="Geographic longitude")
    facilities: List[str] = Field(default_factory=list, description="List of available facilities")
    market_fee_percent: float = Field(1.5, ge=0.0, le=10.0, description="APMC market cess percentage")
    handling_charge_per_qtl: float = Field(15.0, ge=0.0, description="Handling charge in INR per quintal")


class MandiResponse(MandiBase):
    mandi_id: str = Field(..., description="Unique alphanumeric identifier for the mandi")
    is_demo: bool = Field(True, description="Indicates whether this record is synthetic demonstration data")
    data_source: str = Field("synthetic", description="Data origin label (always 'synthetic' for demo data)")


class MandiListResponse(BaseModel):
    total: int = Field(..., description="Total number of mandis returned")
    mandis: List[MandiResponse] = Field(..., description="List of mandis")
    is_demo: bool = Field(True, description="Indicates demonstration dataset")
    data_source: str = Field("synthetic", description="Origin of the data")
