"""Climate Intelligence API Endpoints (Task 9).
Weather forecasts, seasonal climate outlooks, and IMD historical baselines.
"""

from typing import Optional
from fastapi import APIRouter, Query, HTTPException, status
from app.services.climate_service import ClimateService
from app.schemas.climate import (
    WeatherForecastResponse,
    SeasonalClimateOutlook,
    HistoricalClimateProfile,
    CompleteClimateSummary,
)

router = APIRouter(prefix="/climate", tags=["Climate Intelligence"])


@router.get("/forecast", response_model=WeatherForecastResponse)
async def get_weather_forecast(
    district: str = Query("Kolar", description="Karnataka district name"),
    days: int = Query(7, ge=1, le=14, description="Forecast horizon in days")
):
    """
    Returns 7-day short-range daily weather forecast for the specified district.
    Transparently identified as synthetic benchmark data derived from Karnataka IMD models.
    """
    try:
        return ClimateService.get_weather_forecast(district, days=days)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate weather forecast: {str(e)}"
        )


@router.get("/seasonal", response_model=SeasonalClimateOutlook)
async def get_seasonal_outlook(
    district: str = Query("Kolar", description="Karnataka district name"),
    season: str = Query("Kharif", description="'Kharif', 'Rabi', or 'Summer'")
):
    """
    Returns seasonal climate projection including expected seasonal rainfall,
    rainfall anomaly percentage, temperature anomaly, and drought/heatwave risks.
    """
    try:
        return ClimateService.get_seasonal_outlook(district, season=season)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate seasonal outlook: {str(e)}"
        )


@router.get("/historical", response_model=HistoricalClimateProfile)
async def get_historical_climate(
    district: str = Query("Kolar", description="Karnataka district name")
):
    """
    Returns 30-year IMD climatological baseline normals for the district.
    Clearly separates historical climate norms from forecast models.
    """
    try:
        return ClimateService.get_historical_baseline(district)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve historical climate baseline: {str(e)}"
        )


@router.get("/summary", response_model=CompleteClimateSummary)
async def get_climate_summary(
    district: str = Query("Kolar", description="Karnataka district name"),
    season: str = Query("Kharif", description="'Kharif', 'Rabi', or 'Summer'")
):
    """
    Returns complete multi-horizon climate intelligence combining short-range forecast,
    seasonal outlook, and 30-year historical baseline for comprehensive farm planning.
    """
    try:
        return ClimateService.get_complete_climate_summary(district, season=season)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to compile climate summary: {str(e)}"
        )

