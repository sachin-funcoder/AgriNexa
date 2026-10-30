"""Health check endpoint."""

from fastapi import APIRouter, Depends
from app.core.config import settings
from app.db.session import get_supabase_client
from app.schemas.common import HealthCheckResponse

router = APIRouter()


@router.get("/health", response_model=HealthCheckResponse, tags=["Health"])
async def health_check():
    """
    Returns system status, active version, and database connectivity state.
    """
    supabase = get_supabase_client()
    return HealthCheckResponse(
        status="healthy",
        project=settings.PROJECT_NAME,
        environment=settings.ENVIRONMENT,
        version="1.0.0",
        database_connected=supabase is not None
    )
