"""Pydantic schemas for Climate Prediction & Weather Intelligence (Task 9)."""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class DailyWeatherPoint(BaseModel):
    date: str = Field(..., description="Date (YYYY-MM-DD)")
    min_temp_c: float = Field(..., description="Minimum temperature in °C")
    max_temp_c: float = Field(..., description="Maximum temperature in °C")
    avg_temp_c: float = Field(..., description="Average daily temperature in °C")
    rainfall_mm: float = Field(..., ge=0, description="Precipitation in mm")
    humidity_pct: float = Field(..., ge=0, le=100, description="Relative humidity percentage")
    wind_speed_kmh: float = Field(..., ge=0, description="Wind speed in km/h")
    condition: str = Field(..., description="'Sunny', 'Partly Cloudy', 'Scattered Showers', 'Heavy Rain'")
    heat_stress_risk: str = Field("Low", description="'Low', 'Moderate', 'High'")
    dry_spell_risk: str = Field("Low", description="'Low', 'Moderate', 'High'")


class WeatherForecastResponse(BaseModel):
    location: str
    district: str
    forecast_horizon_days: int = 7
    forecast_points: List[DailyWeatherPoint]
    summary_advisory: str
    data_source: str = "synthetic_imd_benchmark"
    is_demo: bool = True
    generated_at: str


class SeasonalClimateOutlook(BaseModel):
    location: str
    district: str
    season_name: str  # "Kharif", "Rabi", "Summer"
    outlook_period: str
    rainfall_category: str  # "Normal", "Below Normal (Deficit)", "Above Normal (Surplus)"
    expected_seasonal_rainfall_mm: float
    rainfall_anomaly_pct: float
    temperature_anomaly_c: float
    monsoon_onset_forecast: str
    drought_risk_level: str  # "Low", "Moderate", "Elevated"
    heatwave_risk_level: str  # "Low", "Moderate", "High"
    agronomic_advice_en: str
    agronomic_advice_kn: str
    data_source: str = "synthetic_imd_seasonal_model"
    is_demo: bool = True
    generated_at: str


class HistoricalClimateProfile(BaseModel):
    district: str
    agro_climatic_zone: str
    average_annual_rainfall_mm: float
    kharif_rainfall_mm: float
    rabi_rainfall_mm: float
    summer_rainfall_mm: float
    mean_max_summer_temp_c: float
    mean_min_winter_temp_c: float
    typical_monsoon_onset: str
    drought_vulnerability_index: str  # "Low", "Medium", "High"
    baseline_period: str = "1991-2020 IMD 30-Year Climatological Normals"
    data_source: str = "synthetic_karnataka_climatology"
    is_demo: bool = True


class CompleteClimateSummary(BaseModel):
    district: str
    short_range_forecast: WeatherForecastResponse
    seasonal_outlook: SeasonalClimateOutlook
    historical_baseline: HistoricalClimateProfile
    data_source: str = "synthetic_hybrid_meteo"
    is_demo: bool = True
    generated_at: str

