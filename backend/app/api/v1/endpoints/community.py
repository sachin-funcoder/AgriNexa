"""API endpoints for Farmer Community & Transparency Module."""

from typing import Optional
from fastapi import APIRouter, HTTPException, Query, status

from app.schemas.community import (
    PostCategory,
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
from app.services.community_service import CommunityService

router = APIRouter(prefix="/community", tags=["Community & Transparency"])

# Singleton service instance
_community_service: Optional[CommunityService] = None


def get_community_service() -> CommunityService:
    global _community_service
    if _community_service is None:
        _community_service = CommunityService()
    return _community_service


# =============================================================================
# 1. COMMUNITY POSTS ENDPOINTS
# =============================================================================

@router.get("/posts", response_model=PostListResponse)
def list_posts(
    category: Optional[str] = Query(None, description="Filter by post category"),
    crop_id: Optional[str] = Query(None, description="Filter by crop ID"),
    mandi_id: Optional[str] = Query(None, description="Filter by mandi ID"),
    search: Optional[str] = Query(None, description="Keyword search in title or text"),
    sort_by: str = Query("latest", pattern="^(latest|helpful)$", description="Sort order"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    """
    Retrieves public community posts matching criteria.
    Hidden posts are filtered out of public feed.
    """
    svc = get_community_service()
    posts, total = svc.list_posts(
        category=category,
        crop_id=crop_id,
        mandi_id=mandi_id,
        search=search,
        sort_by=sort_by,
        include_hidden=False,
        limit=limit,
        offset=offset,
    )
    return PostListResponse(total=total, posts=posts, is_demo=True, data_source="synthetic")


@router.post("/posts", response_model=PostResponse, status_code=status.HTTP_201_CREATED)
def create_post(payload: PostCreate):
    """Submits a new farmer community discussion post."""
    svc = get_community_service()
    try:
        return svc.create_post(payload)
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))


@router.get("/posts/{post_id}", response_model=PostResponse)
def get_post(post_id: str):
    """Retrieves full post details including comments."""
    svc = get_community_service()
    post = svc.get_post(post_id)
    if not post:
        raise HTTPException(status_code=404, detail=f"Post '{post_id}' not found.")
    return post


@router.post("/posts/{post_id}/comments", response_model=CommentResponse, status_code=status.HTTP_201_CREATED)
def add_comment(post_id: str, payload: CommentCreate):
    """Appends a new verified comment to an existing community post."""
    svc = get_community_service()
    comment = svc.add_comment(post_id, payload)
    if not comment:
        raise HTTPException(status_code=404, detail=f"Post '{post_id}' not found.")
    return comment


@router.post("/posts/{post_id}/helpful", response_model=PostResponse)
def mark_helpful(post_id: str):
    """Upvotes/increments helpful counter for a community post."""
    svc = get_community_service()
    post = svc.toggle_helpful(post_id)
    if not post:
        raise HTTPException(status_code=404, detail=f"Post '{post_id}' not found.")
    return post


# =============================================================================
# 2. GRIEVANCE REPORTS ENDPOINTS
# =============================================================================

@router.post("/reports", response_model=ReportResponse, status_code=status.HTTP_201_CREATED)
def submit_report(payload: ReportCreate):
    """
    Submits a suspected unfair practice grievance report.
    Reports are held in moderation queue and tracked via reference ID.
    """
    svc = get_community_service()
    try:
        return svc.create_report(payload)
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))


@router.get("/reports", response_model=ReportListResponse)
def list_reports(
    farmer_id: Optional[str] = Query("farmer_demo_user", description="Filter by farmer ID"),
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by report status"),
):
    """
    Lists grievance reports.
    By default returns reports belonging to the current demo farmer identity.
    """
    svc = get_community_service()
    reports = svc.list_reports(farmer_id=farmer_id, status=status_filter)
    return ReportListResponse(total=len(reports), reports=reports, is_demo=True, data_source="synthetic")


@router.get("/reports/{report_id}", response_model=ReportResponse)
def get_report(report_id: str):
    """Retrieves grievance report status and tracking trail by reference ID."""
    svc = get_community_service()
    rep = svc.get_report(report_id)
    if not rep:
        raise HTTPException(status_code=404, detail=f"Report '{report_id}' not found.")
    return rep


# =============================================================================
# 3. DEMO MODERATION WORKFLOWS
# =============================================================================

@router.get("/moderation/queue", response_model=ModerationQueueResponse)
def get_moderation_queue():
    """Returns moderation dashboard queue with all posts and reports."""
    svc = get_community_service()
    return svc.get_moderation_queue()


@router.patch("/moderation/posts/{post_id}", response_model=PostResponse)
def moderate_post(post_id: str, payload: PostModerationUpdate):
    """Toggles post status between 'active' and 'hidden'."""
    svc = get_community_service()
    try:
        post = svc.update_post_status(post_id, payload.status)
        if not post:
            raise HTTPException(status_code=404, detail=f"Post '{post_id}' not found.")
        return post
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))


@router.patch("/moderation/reports/{report_id}", response_model=ReportResponse)
def moderate_report(report_id: str, payload: ReportModerationUpdate):
    """
    Updates report status along the verified complaint lifecycle.
    Validates legal state transitions.
    """
    svc = get_community_service()
    try:
        rep = svc.update_report_status(report_id, payload.status, payload.status_notes)
        if not rep:
            raise HTTPException(status_code=404, detail=f"Report '{report_id}' not found.")
        return rep
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
