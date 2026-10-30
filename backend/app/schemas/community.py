"""Pydantic schemas for Farmer Community & Transparency Module."""

from typing import List, Optional
from enum import Enum
from pydantic import BaseModel, Field, field_validator


class PostCategory(str, Enum):
    MARKET_PRICE = "Market Price"
    MANDI_EXPERIENCE = "Mandi Experience"
    WEIGHING_ISSUE = "Weighing Issue"
    PAYMENT_DELAY = "Payment Delay"
    TRANSPORT = "Transport"
    STORAGE = "Storage"
    GENERAL_DISCUSSION = "General Discussion"


class ReportCategory(str, Enum):
    UNDERPAYMENT = "Suspected underpayment"
    INCORRECT_WEIGHING = "Incorrect weighing"
    PAYMENT_DELAY = "Payment delay"
    UNEXPECTED_DEDUCTIONS = "Unexpected deductions"
    QUALITY_DISPUTE = "Quality dispute"
    OTHER = "Other"


class ReportStatus(str, Enum):
    SUBMITTED = "Submitted"
    UNDER_REVIEW = "Under Review"
    INFO_NEEDED = "Additional Information Needed"
    RESOLVED = "Resolved"
    CLOSED = "Closed"


# --- Comment Schemas ---

class CommentCreate(BaseModel):
    content: str = Field(..., min_length=2, max_length=500, description="Comment text")
    author_name: Optional[str] = Field("Ramesh Patel (Demo Farmer)", description="Author display name")
    author_id: Optional[str] = Field("farmer_demo_user", description="Author identity ID")

    @field_validator("content")
    @classmethod
    def validate_content(cls, v: str) -> str:
        trimmed = v.strip()
        if not trimmed:
            raise ValueError("Comment cannot be empty or contain only whitespace.")
        return trimmed


class CommentResponse(BaseModel):
    comment_id: str
    post_id: str
    content: str
    author_name: str
    author_id: str
    created_at: str
    is_demo: bool = True


# --- Post Schemas ---

class PostCreate(BaseModel):
    title: str = Field(..., min_length=3, max_length=150, description="Post headline")
    content: str = Field(..., min_length=10, max_length=2000, description="Post body text")
    category: PostCategory = Field(..., description="Post topic category")
    crop_id: Optional[str] = Field(None, description="Related crop ID, e.g. crop_tomato")
    mandi_id: Optional[str] = Field(None, description="Related APMC mandi ID, e.g. mandi_kolar")
    author_name: Optional[str] = Field("Ramesh Patel (Demo Farmer)", description="Farmer display name")
    author_id: Optional[str] = Field("farmer_demo_user", description="Farmer ID")

    @field_validator("title", "content")
    @classmethod
    def trim_whitespace(cls, v: str) -> str:
        trimmed = v.strip()
        if not trimmed:
            raise ValueError("Field cannot be empty or contain only whitespace.")
        return trimmed


class PostResponse(BaseModel):
    post_id: str
    title: str
    content: str
    category: PostCategory
    author_name: str
    author_id: str
    crop_id: Optional[str] = None
    crop_name: Optional[str] = None
    mandi_id: Optional[str] = None
    mandi_name: Optional[str] = None
    district: Optional[str] = None
    created_at: str
    helpful_count: int = Field(0, ge=0)
    comments_count: int = Field(0, ge=0)
    comments: List[CommentResponse] = []
    status: str = Field("active", description="'active' or 'hidden'")
    is_demo: bool = True
    data_source: str = "synthetic"


class PostListResponse(BaseModel):
    total: int
    posts: List[PostResponse]
    is_demo: bool = True
    data_source: str = "synthetic"


# --- Report Schemas ---

class ReportCreate(BaseModel):
    issue_category: ReportCategory = Field(..., description="Category of the suspected issue")
    mandi_id: str = Field(..., description="Mandi where incident occurred")
    incident_date: str = Field(..., description="Date of occurrence (YYYY-MM-DD)")
    description: str = Field(..., min_length=15, max_length=2000, description="Neutral description of incident")
    crop_id: Optional[str] = Field(None, description="Crop involved if applicable")
    approximate_amount: Optional[float] = Field(None, ge=0.0, description="Approximate INR amount involved")
    farmer_name: Optional[str] = Field("Ramesh Patel (Demo Farmer)", description="Reporting farmer display name")
    farmer_id: Optional[str] = Field("farmer_demo_user", description="Reporting farmer ID")

    @field_validator("description")
    @classmethod
    def validate_desc(cls, v: str) -> str:
        trimmed = v.strip()
        if len(trimmed) < 15:
            raise ValueError("Description must contain at least 15 characters of detailed context.")
        return trimmed


class ReportResponse(BaseModel):
    report_id: str
    issue_category: ReportCategory
    farmer_id: str
    farmer_name: str
    mandi_id: str
    mandi_name: str
    district: Optional[str] = None
    crop_id: Optional[str] = None
    crop_name: Optional[str] = None
    incident_date: str
    description: str
    approximate_amount: Optional[float] = None
    status: ReportStatus = ReportStatus.SUBMITTED
    status_notes: Optional[str] = None
    created_at: str
    updated_at: str
    is_demo: bool = True
    data_source: str = "synthetic"


class ReportListResponse(BaseModel):
    total: int
    reports: List[ReportResponse]
    is_demo: bool = True
    data_source: str = "synthetic"


# --- Moderation Schemas ---

class PostModerationUpdate(BaseModel):
    status: str = Field(..., description="'active' or 'hidden'")

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        if v not in ["active", "hidden"]:
            raise ValueError("Status must be either 'active' or 'hidden'.")
        return v


class ReportModerationUpdate(BaseModel):
    status: ReportStatus = Field(..., description="Updated report lifecycle status")
    status_notes: Optional[str] = Field(None, max_length=500, description="Moderator rationale or feedback")


class ModerationQueueResponse(BaseModel):
    pending_reports_count: int
    hidden_posts_count: int
    total_posts: int
    total_reports: int
    reports: List[ReportResponse]
    posts: List[PostResponse]
    is_demo: bool = True

