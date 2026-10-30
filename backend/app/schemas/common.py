"""Data schemas and Pydantic validation contracts."""

from pydantic import BaseModel
from typing import Optional, Any, Dict


class HealthCheckResponse(BaseModel):
    status: str
    project: str
    environment: str
    version: str
    database_connected: bool


class APIResponse(BaseModel):
    success: bool
    message: str
    data: Optional[Any] = None
