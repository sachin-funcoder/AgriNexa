"""Deterministic integration and unit tests for Community & Transparency Module."""

import pytest
import shutil
from pathlib import Path
from fastapi.testclient import TestClient
from app.main import app
from app.schemas.community import PostCategory, ReportCategory, ReportStatus, PostCreate, ReportCreate
from app.services.community_service import CommunityService

client = TestClient(app)


# ---------------------------------------------------------------------------
# 1. COMMUNITY POSTS TESTS
# ---------------------------------------------------------------------------

def test_list_community_posts():
    """Verifies listing initial seed posts with pagination and demo tags."""
    response = client.get("/api/v1/community/posts")
    assert response.status_code == 200
    data = response.json()
    assert data["is_demo"] is True
    assert data["data_source"] == "synthetic"
    assert data["total"] >= 6
    assert len(data["posts"]) >= 6

    # Verify post fields
    first = data["posts"][0]
    assert "post_id" in first
    assert "title" in first
    assert "content" in first
    assert "category" in first
    assert "author_name" in first
    assert "helpful_count" in first
    assert "comments" in first
    assert first["status"] == "active"


def test_create_valid_post():
    """Verifies creating a valid new farmer community post."""
    payload = {
        "title": "Fresh Capsicum harvest rate check in Mandya",
        "content": "Harvested 20 quintals of green capsicum. What are the prevailing rates in Mandya APMC yard today?",
        "category": "Market Price",
        "crop_id": "crop_chilli",
        "mandi_id": "mandi_mandya",
        "author_name": "Shivakumar (Demo Farmer)",
        "author_id": "farmer_demo_user"
    }
    response = client.post("/api/v1/community/posts", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["title"] == payload["title"]
    assert data["content"] == payload["content"]
    assert data["crop_name"] == "Green Chilli"
    assert "Mandya" in data["mandi_name"]
    assert data["district"] == "Mandya"
    assert data["status"] == "active"
    assert data["helpful_count"] == 0
    assert data["comments_count"] == 0


def test_reject_invalid_or_empty_post():
    """Verifies rejection of empty strings, whitespace-only content, or missing required fields."""
    # Empty title
    resp1 = client.post("/api/v1/community/posts", json={
        "title": "   ",
        "content": "Valid length description for testing validation.",
        "category": "General Discussion"
    })
    assert resp1.status_code == 422

    # Short content
    resp2 = client.post("/api/v1/community/posts", json={
        "title": "Valid Title Here",
        "content": "short",
        "category": "General Discussion"
    })
    assert resp2.status_code == 422

    # Invalid category
    resp3 = client.post("/api/v1/community/posts", json={
        "title": "Valid Title Here",
        "content": "Valid description length that exceeds 10 characters.",
        "category": "InvalidNonExistentCategory"
    })
    assert resp3.status_code == 422


def test_filter_and_search_posts():
    """Verifies filtering posts by category, crop, mandi, and search term."""
    # Category filter
    res_cat = client.get("/api/v1/community/posts?category=Weighing%20Issue")
    assert res_cat.status_code == 200
    for p in res_cat.json()["posts"]:
        assert p["category"] == "Weighing Issue"

    # Search keyword
    res_search = client.get("/api/v1/community/posts?search=tomato")
    assert res_search.status_code == 200
    assert len(res_search.json()["posts"]) >= 1


def test_add_comment_to_post():
    """Verifies adding a valid comment to an existing post and updating counts."""
    # Get first post
    posts_res = client.get("/api/v1/community/posts")
    post_id = posts_res.json()["posts"][0]["post_id"]
    prev_comments = posts_res.json()["posts"][0]["comments_count"]

    comment_payload = {
        "content": "Very helpful update, thanks for sharing!",
        "author_name": "Ravi (Demo Farmer)",
        "author_id": "farmer_demo_99"
    }
    comm_res = client.post(f"/api/v1/community/posts/{post_id}/comments", json=comment_payload)
    assert comm_res.status_code == 201
    comm_data = comm_res.json()
    assert comm_data["content"] == comment_payload["content"]
    assert comm_data["author_name"] == comment_payload["author_name"]

    # Verify post comments count incremented
    updated_post = client.get(f"/api/v1/community/posts/{post_id}").json()
    assert updated_post["comments_count"] == prev_comments + 1

    # Empty comment rejection
    fail_comm = client.post(f"/api/v1/community/posts/{post_id}/comments", json={"content": "  "})
    assert fail_comm.status_code == 422


def test_helpful_count_behavior():
    """Verifies that clicking helpful increments count and never becomes negative."""
    posts_res = client.get("/api/v1/community/posts")
    post_id = posts_res.json()["posts"][0]["post_id"]
    prev_helpful = posts_res.json()["posts"][0]["helpful_count"]

    res = client.post(f"/api/v1/community/posts/{post_id}/helpful")
    assert res.status_code == 200
    assert res.json()["helpful_count"] == prev_helpful + 1
    assert res.json()["helpful_count"] >= 0


# ---------------------------------------------------------------------------
# 2. GRIEVANCE REPORTS TESTS
# ---------------------------------------------------------------------------

def test_create_and_get_report():
    """Verifies submitting a grievance report and retrieving it by ID."""
    payload = {
        "issue_category": "Incorrect weighing",
        "mandi_id": "mandi_kolar",
        "incident_date": "2026-10-29",
        "description": "Electronic scale in Shed 1 showed inconsistent readings between morning and noon lots.",
        "crop_id": "crop_tomato",
        "approximate_amount": 1500.0,
        "farmer_name": "Ramesh Patel (Demo Farmer)",
        "farmer_id": "farmer_demo_user"
    }
    create_res = client.post("/api/v1/community/reports", json=payload)
    assert create_res.status_code == 201
    rep = create_res.json()
    report_id = rep["report_id"]
    assert rep["issue_category"] == "Incorrect weighing"
    assert rep["status"] == "Submitted"
    assert rep["is_demo"] is True
    assert rep["approximate_amount"] == 1500.0

    # Retrieve by ID
    get_res = client.get(f"/api/v1/community/reports/{report_id}")
    assert get_res.status_code == 200
    assert get_res.json()["report_id"] == report_id


def test_report_not_found():
    """Verifies that non-existent report ID returns 404."""
    response = client.get("/api/v1/community/reports/rep_non_existent_9999")
    assert response.status_code == 404


def test_report_status_transitions():
    """Verifies valid lifecycle status transitions and rejection of illegal transitions."""
    # Create new report (status: Submitted)
    create_res = client.post("/api/v1/community/reports", json={
        "issue_category": "Payment delay",
        "mandi_id": "mandi_bengaluru",
        "incident_date": "2026-10-20",
        "description": "Payment pending beyond APMC mandated 24-hour statutory timeline.",
        "farmer_id": "farmer_demo_user"
    })
    report_id = create_res.json()["report_id"]
    assert create_res.json()["status"] == "Submitted"

    # Illegal transition: Submitted -> Resolved directly (must go through Under Review)
    illegal_res = client.patch(f"/api/v1/community/moderation/reports/{report_id}", json={
        "status": "Resolved",
        "status_notes": "Attempting direct resolution"
    })
    assert illegal_res.status_code == 400

    # Legal transition 1: Submitted -> Under Review
    legal_1 = client.patch(f"/api/v1/community/moderation/reports/{report_id}", json={
        "status": "Under Review",
        "status_notes": "Assigned to vigilance officer"
    })
    assert legal_1.status_code == 200
    assert legal_1.json()["status"] == "Under Review"

    # Legal transition 2: Under Review -> Additional Information Needed
    legal_2 = client.patch(f"/api/v1/community/moderation/reports/{report_id}", json={
        "status": "Additional Information Needed",
        "status_notes": "Please provide copy of weighing slip"
    })
    assert legal_2.status_code == 200
    assert legal_2.json()["status"] == "Additional Information Needed"

    # Legal transition 3: Additional Info Needed -> Resolved
    legal_3 = client.patch(f"/api/v1/community/moderation/reports/{report_id}", json={
        "status": "Resolved",
        "status_notes": "Payment processed via RTGS"
    })
    assert legal_3.status_code == 200
    assert legal_3.json()["status"] == "Resolved"

    # Legal transition 4: Resolved -> Closed
    legal_4 = client.patch(f"/api/v1/community/moderation/reports/{report_id}", json={
        "status": "Closed",
        "status_notes": "Case closed with farmer confirmation"
    })
    assert legal_4.status_code == 200
    assert legal_4.json()["status"] == "Closed"


# ---------------------------------------------------------------------------
# 3. MODERATION & POST HIDING
# ---------------------------------------------------------------------------

def test_hide_post_from_public_feed():
    """Verifies that hidden posts are completely excluded from public feed."""
    # Create test post
    p = client.post("/api/v1/community/posts", json={
        "title": "Post intended for moderation test",
        "content": "This post will be marked as hidden and checked against public feed.",
        "category": "General Discussion"
    }).json()
    post_id = p["post_id"]

    # Verify visible in public feed
    feed_before = [x["post_id"] for x in client.get("/api/v1/community/posts").json()["posts"]]
    assert post_id in feed_before

    # Hide post via moderation PATCH
    hide_res = client.patch(f"/api/v1/community/moderation/posts/{post_id}", json={"status": "hidden"})
    assert hide_res.status_code == 200
    assert hide_res.json()["status"] == "hidden"

    # Verify hidden from public feed
    feed_after = [x["post_id"] for x in client.get("/api/v1/community/posts").json()["posts"]]
    assert post_id not in feed_after

    # Unhide post
    unhide_res = client.patch(f"/api/v1/community/moderation/posts/{post_id}", json={"status": "active"})
    assert unhide_res.status_code == 200
    feed_unhidden = [x["post_id"] for x in client.get("/api/v1/community/posts").json()["posts"]]
    assert post_id in feed_unhidden


def test_moderation_queue_endpoint():
    """Verifies moderation queue returns aggregates and full lists."""
    res = client.get("/api/v1/community/moderation/queue")
    assert res.status_code == 200
    data = res.json()
    assert "pending_reports_count" in data
    assert "hidden_posts_count" in data
    assert "total_posts" in data
    assert "total_reports" in data
    assert data["is_demo"] is True


# ---------------------------------------------------------------------------
# 4. PERSISTENCE VERIFICATION
# ---------------------------------------------------------------------------

def test_community_persistence_across_service_instances(tmp_path):
    """Verifies that data written to JSON store persists when service is recreated."""
    custom_dir = tmp_path / "community_data"
    svc1 = CommunityService(data_dir=custom_dir)

    # Create post in svc1
    post1 = svc1.create_post(
        PostCreate(
            title="Persistent test post",
            content="Testing persistence across restarts and file reloads.",
            category=PostCategory.STORAGE
        )
    )

    # Recreate service pointing to same directory
    svc2 = CommunityService(data_dir=custom_dir)
    posts, total = svc2.list_posts(include_hidden=True)
    post_ids = [p.post_id for p in posts]
    assert post1.post_id in post_ids

    retrieved = svc2.get_post(post1.post_id)
    assert retrieved is not None
    assert retrieved.title == "Persistent test post"
