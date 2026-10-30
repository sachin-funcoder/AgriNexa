"""Pydantic schemas for the Farmer Dashboard."""

from typing import List, Optional
from pydantic import BaseModel, Field


class CropDashboardCard(BaseModel):
    crop_id: str = Field(..., description="Crop identifier")
    name_en: str = Field(..., description="Crop English name")
    name_kn: str = Field(..., description="Crop Kannada name")
    category: str = Field(..., description="Crop classification")
    today_modal_price: float = Field(..., description="Latest available modal price (INR/quintal)")
    yesterday_modal_price: float = Field(..., description="Previous day modal price (INR/quintal)")
    price_change_percent: float = Field(..., description="Day-over-day price change percentage")
    trend_direction: str = Field(..., description="'up', 'down', or 'stable'")
    latest_arrival_qtl: float = Field(..., description="Latest arrival volume in quintals")
    arrival_unit: str = Field("quintals", description="Arrival unit")
    primary_mandi_id: str = Field(..., description="Benchmark mandi identifier")
    primary_mandi_name: str = Field(..., description="Benchmark mandi name")
    advisory_summary: str = Field(..., description="Concise rule-based advisory summary for farmer")
    shelf_life_days: int = Field(..., description="Shelf life in ambient storage")


class DashboardSummaryResponse(BaseModel):
    generated_at: str = Field(..., description="ISO timestamp of summary generation")
    date_of_data: str = Field(..., description="Date of the latest market observations")
    total_mandis_monitored: int = Field(..., description="Total count of active mandis")
    total_crops_tracked: int = Field(..., description="Total count of tracked commodities")
    commodity_cards: List[CropDashboardCard] = Field(..., description="Key performance cards for tracked crops")
    is_demo: bool = Field(True, description="Flag indicating synthetic demonstration data")
    data_source: str = Field("synthetic", description="Data source indicator")
