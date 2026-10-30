"""Mandi price and arrival query endpoints."""

from typing import Optional
from fastapi import APIRouter, Query, Path, Depends
from app.services.mandi_service import MandiService
from app.schemas.price import ForecastResponse, PriceQueryResponse

router = APIRouter(prefix="/prices", tags=["Prices"])


def get_mandi_service() -> MandiService:
    return MandiService()


@router.get("", response_model=PriceQueryResponse)
async def query_prices(
    crop: Optional[str] = Query(None, description="Optional crop name or ID (e.g., 'Tomato', 'crop_onion')"),
    mandi_id: Optional[str] = Query(None, description="Optional mandi ID filter (e.g., 'mandi_kolar')"),
    start_date: Optional[str] = Query(None, description="Filter records starting from YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="Filter records up to YYYY-MM-DD"),
    limit: int = Query(365, ge=1, le=1000, description="Maximum number of historical records to return"),
    service: MandiService = Depends(get_mandi_service)
):
    """
    General price exploration endpoint.
    Filters across all or specific crops, mandis, and dates.
    Returns simulated price records, arrivals, and aggregated statistical metrics.
    All data clearly indicates data_source='synthetic' and is_demo=True.
    """
    return service.get_prices(
        crop_name_or_id=crop,
        mandi_id=mandi_id,
        start_date=start_date,
        end_date=end_date,
        limit=limit
    )


@router.get("/{crop_name}", response_model=PriceQueryResponse)
async def get_crop_prices(
    crop_name: str = Path(..., description="Crop identifier or name (e.g. 'tomato', 'onion', 'potato', 'maize', 'chilli', 'ragi')"),
    mandi_id: Optional[str] = Query(None, description="Optional mandi filter (e.g., 'mandi_bengaluru')"),
    start_date: Optional[str] = Query(None, description="Filter records starting from YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="Filter records up to YYYY-MM-DD"),
    limit: int = Query(365, ge=1, le=1000, description="Maximum number of records to return"),
    service: MandiService = Depends(get_mandi_service)
):
    """
    Dedicated single-commodity time-series endpoint.
    Retrieves historical price movements and arrival signals specifically for the requested crop.
    Accepts both standard names (e.g., 'Tomato') and identifiers (e.g., 'crop_tomato').
    Returns 404 if the commodity is not recognized.
    """
    return service.get_prices(
        crop_name_or_id=crop_name,
        mandi_id=mandi_id,
        start_date=start_date,
        end_date=end_date,
        limit=limit
    )


@router.get("/{crop_name}/forecast", response_model=ForecastResponse)
async def get_crop_price_forecast(
    crop_name: str = Path(..., description="Crop identifier or name (e.g. 'tomato', 'crop_onion')"),
    mandi_id: Optional[str] = Query(None, description="Optional mandi for benchmark (default: primary benchmark)"),
    historical_days: int = Query(90, ge=14, le=365, description="Days of historical data to model the trend on"),
    forecast_days: int = Query(14, ge=7, le=30, description="Number of days to forecast forward"),
    service: MandiService = Depends(get_mandi_service)
):
    """
    AI Price Forecast: 3-Scenario Projection with Anomaly Detection.

    Uses linear regression on the most recent historical_days of daily modal prices
    to compute a trend line (slope). Projects forward forecast_days with:
    - Normal scenario: trend extrapolation
    - Optimistic scenario: +1.5σ volatility envelope
    - Pessimistic scenario: -0.8σ volatility envelope

    Also returns up to 20 recent detected price anomalies (Z-score > 2.2 deviation)
    across all monitored mandis for this crop.
    """
    return service.get_price_forecast(
        crop_name_or_id=crop_name,
        mandi_id=mandi_id,
        historical_days=historical_days,
        forecast_days=forecast_days
    )
