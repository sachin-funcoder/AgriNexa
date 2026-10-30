"""Pydantic schemas for Mandi Prices, Arrival signals, and AI Forecast scenarios."""

from datetime import date
from typing import List, Optional
from pydantic import BaseModel, Field, model_validator


class PriceRecord(BaseModel):
    date: str = Field(..., description="Date of price observation in YYYY-MM-DD")
    mandi_id: str = Field(..., description="Mandi identifier")
    mandi_name: Optional[str] = Field(None, description="Human-readable mandi name")
    crop_id: str = Field(..., description="Crop identifier")
    crop_name: Optional[str] = Field(None, description="Human-readable crop name")
    min_price: float = Field(..., ge=0.0, description="Minimum auction price in INR/quintal")
    modal_price: float = Field(..., ge=0.0, description="Modal (most common) auction price in INR/quintal")
    max_price: float = Field(..., ge=0.0, description="Maximum auction price in INR/quintal")
    price_unit: str = Field("INR/quintal", description="Unit of currency and weight")
    arrival_quantity: Optional[float] = Field(None, ge=0.0, description="Arrival volume in quintals")
    arrival_unit: str = Field("quintals", description="Arrival measurement unit")
    data_source: str = Field("synthetic", description="Origin of data (synthetic for demo)")
    is_demo: bool = Field(True, description="Flag indicating synthetic demonstration record")

    @model_validator(mode="after")
    def validate_price_bounds(self):
        if self.min_price > self.modal_price:
            raise ValueError(f"min_price ({self.min_price}) cannot exceed modal_price ({self.modal_price})")
        if self.modal_price > self.max_price:
            raise ValueError(f"modal_price ({self.modal_price}) cannot exceed max_price ({self.max_price})")
        return self


class PriceStats(BaseModel):
    min_price_observed: float = Field(..., description="Lowest observed price in the period")
    max_price_observed: float = Field(..., description="Highest observed price in the period")
    avg_modal_price: float = Field(..., description="Average modal price across observations")
    latest_modal_price: Optional[float] = Field(None, description="Most recent modal price")
    total_records: int = Field(..., description="Number of daily records returned")
    avg_daily_arrival: Optional[float] = Field(None, description="Average daily arrival volume in quintals")


class PriceQueryResponse(BaseModel):
    crop_id: Optional[str] = Field(None, description="Filtered crop identifier")
    crop_name: Optional[str] = Field(None, description="Crop common name")
    mandi_id: Optional[str] = Field(None, description="Filtered mandi identifier")
    mandi_name: Optional[str] = Field(None, description="Mandi common name")
    start_date: Optional[str] = Field(None, description="Query start date")
    end_date: Optional[str] = Field(None, description="Query end date")
    records_count: int = Field(..., description="Total records matching criteria")
    stats: Optional[PriceStats] = Field(None, description="Aggregated price and arrival statistics")
    prices: List[PriceRecord] = Field(..., description="List of price records")
    is_demo: bool = Field(True, description="Flag indicating synthetic demonstration data")
    data_source: str = Field("synthetic", description="Data origin (always 'synthetic' for demo)")


class ForecastPoint(BaseModel):
    date: str = Field(..., description="Forecasted date in YYYY-MM-DD")
    optimistic: float = Field(..., description="Upper-bound price scenario (INR/quintal)")
    normal: float = Field(..., description="Expected price scenario (INR/quintal)")
    pessimistic: float = Field(..., description="Lower-bound price scenario (INR/quintal)")


class AnomalyRecord(BaseModel):
    date: str = Field(..., description="Date of detected anomaly")
    modal_price: float = Field(..., description="Price on anomaly date")
    anomaly_type: str = Field(..., description="'spike' or 'crash'")
    deviation_pct: float = Field(..., description="% deviation from 30-day rolling average")
    mandi_id: str = Field(..., description="Mandi where anomaly was detected")
    mandi_name: Optional[str] = Field(None, description="Mandi display name")


class ForecastResponse(BaseModel):
    crop_id: str = Field(..., description="Forecasted crop identifier")
    crop_name: str = Field(..., description="Crop common name")
    mandi_id: str = Field(..., description="Benchmark mandi for forecast")
    mandi_name: str = Field(..., description="Mandi display name")
    historical_days: int = Field(..., description="Number of historical days used for trend modeling")
    forecast_days: int = Field(14, description="Number of days forecast horizon")
    trend_direction: str = Field(..., description="Overall trend: 'up', 'down', or 'stable'")
    trend_strength_pct: float = Field(..., description="% price change over historical window")
    avg_daily_change: float = Field(..., description="Average daily price change (INR/quintal)")
    last_known_price: float = Field(..., description="Last observed modal price")
    forecast_points: List[ForecastPoint] = Field(..., description="14-day scenario forecast")
    anomalies: List[AnomalyRecord] = Field(..., description="Detected price anomaly events")
    model_type: str = Field("linear_regression_scenario", description="Forecasting algorithm used")
    is_demo: bool = Field(True, description="Synthetic demonstration data flag")
    data_source: str = Field("synthetic", description="Data origin")
