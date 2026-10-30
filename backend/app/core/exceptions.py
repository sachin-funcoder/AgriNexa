"""Custom exception classes and HTTP handlers for AgriNexa."""

from fastapi import Request
from fastapi.responses import JSONResponse


class AgriNexaException(Exception):
    """Base exception class for domain errors in AgriNexa."""
    def __init__(self, message: str, status_code: int = 400, details: dict = None):
        self.message = message
        self.status_code = status_code
        self.details = details or {}
        super().__init__(self.message)


class InsufficientDataError(AgriNexaException):
    """Raised when not enough historical mandi records exist for modeling."""
    def __init__(self, message: str = "Insufficient historical mandi records for statistical forecasting."):
        super().__init__(message=message, status_code=422)


class OptimizationInfeasibleError(AgriNexaException):
    """Raised when harvest allocation constraints cannot be met by the LP solver."""
    def __init__(self, message: str = "Optimization problem is infeasible with current storage and shelf-life constraints."):
        super().__init__(message=message, status_code=400)


async def agrinexa_exception_handler(request: Request, exc: AgriNexaException):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": True,
            "message": exc.message,
            "details": exc.details
        }
    )
