"""Mandi listing and metadata endpoints."""

from typing import Optional
from fastapi import APIRouter, Query, Depends
from app.services.mandi_service import MandiService
from app.schemas.mandi import MandiListResponse

router = APIRouter(prefix="/mandis", tags=["Mandis"])


def get_mandi_service() -> MandiService:
    return MandiService()


@router.get("", response_model=MandiListResponse)
async def list_mandis(
    district: Optional[str] = Query(None, description="Optional filter by Karnataka district (e.g., Kolar, Mysuru)"),
    service: MandiService = Depends(get_mandi_service)
):
    """
    Returns available Karnataka APMC mandis with coordinates, facilities, and market fees.
    All data is marked as synthetic demonstration data.
    """
    mandis = service.get_all_mandis()
    if district:
        mandis = [m for m in mandis if m.district.lower() == district.strip().lower()]

    return MandiListResponse(
        total=len(mandis),
        mandis=mandis,
        is_demo=True,
        data_source="synthetic"
    )
