"""Pydantic schemas for Crop data."""

from typing import List, Optional
from pydantic import BaseModel, Field


class CropBase(BaseModel):
    name_en: str = Field(..., description="Crop English name")
    name_kn: str = Field(..., description="Crop Kannada name")
    category: str = Field(..., description="Commodity category")
    shelf_life_ambient_days: int = Field(..., ge=1, description="Standard shelf life in ambient temperature (days)")
    shelf_life_cold_days: int = Field(..., ge=1, description="Standard shelf life in cold storage (days)")
    daily_decay_rate_ambient: float = Field(..., ge=0.0, le=1.0, description="Daily loss rate in ambient storage")
    daily_decay_rate_cold: float = Field(..., ge=0.0, le=1.0, description="Daily loss rate in cold storage")
    standard_unit: str = Field("Quintal (100 kg)", description="Standard agricultural trading unit")
    base_price_inr: float = Field(..., ge=0.0, description="Baseline modal price in INR per quintal")


class CropResponse(CropBase):
    crop_id: str = Field(..., description="Unique crop identifier")
    is_demo: bool = Field(True, description="Indicates demonstration dataset")
    data_source: str = Field("synthetic", description="Origin of the data")


class CropListResponse(BaseModel):
    total: int = Field(..., description="Total number of crops returned")
    crops: List[CropResponse] = Field(..., description="List of crops")
    is_demo: bool = Field(True, description="Indicates demonstration dataset")
    data_source: str = Field("synthetic", description="Origin of the data")
