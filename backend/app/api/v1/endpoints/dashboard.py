"""Farmer dashboard summary endpoints."""

from fastapi import APIRouter, Depends
from app.services.mandi_service import MandiService
from app.schemas.dashboard import DashboardSummaryResponse

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


def get_mandi_service() -> MandiService:
    return MandiService()


@router.get("", response_model=DashboardSummaryResponse)
async def get_dashboard_summary(
    service: MandiService = Depends(get_mandi_service)
):
    """
    Returns aggregated KPI metrics and summary cards for the farmer dashboard.
    Provides latest modal prices, day-over-day percentage change, arrival volumes,
    and rule-based selling advisories across key Karnataka commodities.
    Clearly marked as synthetic demonstration data.
    """
    return service.get_dashboard_summary()
