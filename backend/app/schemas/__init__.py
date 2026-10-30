"""Data schemas and Pydantic validation contracts."""

from app.schemas.common import HealthCheckResponse, APIResponse
from app.schemas.mandi import MandiBase, MandiResponse, MandiListResponse
from app.schemas.crop import CropBase, CropResponse, CropListResponse
from app.schemas.price import PriceRecord, PriceStats, PriceQueryResponse
from app.schemas.dashboard import CropDashboardCard, DashboardSummaryResponse
from app.schemas.optimizer import (
    OptimizationRequest,
    OptimizationResponse,
    MandiAllocationItem,
    BaselineComparison,
    FinancialSummary,
    DailyInventoryRecord,
    OptimizationAssumptions,
)

__all__ = [
    "HealthCheckResponse",
    "APIResponse",
    "MandiBase",
    "MandiResponse",
    "MandiListResponse",
    "CropBase",
    "CropResponse",
    "CropListResponse",
    "PriceRecord",
    "PriceStats",
    "PriceQueryResponse",
    "CropDashboardCard",
    "DashboardSummaryResponse",
    "OptimizationRequest",
    "OptimizationResponse",
    "MandiAllocationItem",
    "BaselineComparison",
    "FinancialSummary",
    "DailyInventoryRecord",
    "OptimizationAssumptions",
    "PostCategory",
    "ReportCategory",
    "ReportStatus",
    "CommentCreate",
    "CommentResponse",
    "PostCreate",
    "PostResponse",
    "PostListResponse",
    "ReportCreate",
    "ReportResponse",
    "ReportListResponse",
    "PostModerationUpdate",
    "ReportModerationUpdate",
    "ModerationQueueResponse",
]

from app.schemas.community import (
    PostCategory,
    ReportCategory,
    ReportStatus,
    CommentCreate,
    CommentResponse,
    PostCreate,
    PostResponse,
    PostListResponse,
    ReportCreate,
    ReportResponse,
    ReportListResponse,
    PostModerationUpdate,
    ReportModerationUpdate,
    ModerationQueueResponse,
)
