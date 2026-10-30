"""Database connection and Supabase client provider."""

import logging
from typing import Optional
from supabase import create_client, Client
from app.core.config import settings

logger = logging.getLogger("agrinexa.db")

_supabase_client: Optional[Client] = None


def get_supabase_client() -> Optional[Client]:
    """
    Returns an initialized Supabase Client if valid credentials exist.
    Returns None if running in local standalone development mode.
    """
    global _supabase_client
    if _supabase_client is not None:
        return _supabase_client
    
    if (
        settings.SUPABASE_URL 
        and "placeholder" not in settings.SUPABASE_URL
        and settings.SUPABASE_KEY 
        and "placeholder" not in settings.SUPABASE_KEY
    ):
        try:
            _supabase_client = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
            logger.info("Connected to remote Supabase instance.")
            return _supabase_client
        except Exception as e:
            logger.warning(f"Could not connect to Supabase: {e}. Falling back to local data layer.")
            return None
    return None


def get_db():
    """FastAPI Dependency for database access."""
    client = get_supabase_client()
    try:
        yield client
    finally:
        pass
