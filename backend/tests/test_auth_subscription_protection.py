"""Deterministic tests for Task 7: Farmer Auth, Subscriptions, and AI Prediction Protection."""

import pytest
import uuid
from fastapi.testclient import TestClient
from app.main import app
from app.core.security import hash_password, verify_password

client = TestClient(app)


def test_password_hashing():
    pw = "SecretFarmerPass@2026"
    h, s = hash_password(pw)
    assert h != pw
    assert len(s) == 32
    assert verify_password(pw, h, s) is True
    assert verify_password("WrongPass", h, s) is False


def test_demo_accounts_exist():
    # Login with demo farmer
    res = client.post("/api/v1/auth/login", json={
        "identifier": "9876543210",
        "password": "Farmer@123"
    })
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert data["user"]["role"] == "farmer"
    assert data["user"]["active_subscription_plan"] in ["PROTECTION", "PRO", "FREE"]

    # Login with demo admin
    res_admin = client.post("/api/v1/auth/login", json={
        "identifier": "admin@agrinexa.in",
        "password": "Admin@123"
    })
    assert res_admin.status_code == 200
    admin_data = res_admin.json()
    assert admin_data["user"]["role"] == "admin"


def test_user_signup_validation_and_duplicate():
    rand_mobile = f"98{str(uuid.uuid4().int)[:8]}"
    rand_email = f"farmer_{uuid.uuid4().hex[:6]}@example.com"

    # Mismatched passwords
    bad_res = client.post("/api/v1/auth/signup", json={
        "full_name": "Suresh Gowda",
        "mobile": rand_mobile,
        "email": rand_email,
        "password": "Password123",
        "confirm_password": "MismatchedPassword",
        "preferred_language": "kn"
    })
    assert bad_res.status_code == 422

    # Valid signup
    signup_res = client.post("/api/v1/auth/signup", json={
        "full_name": "Suresh Gowda",
        "mobile": rand_mobile,
        "email": rand_email,
        "password": "Password123",
        "confirm_password": "Password123",
        "preferred_language": "kn",
        "district": "Mandya",
        "preferred_crops": ["Sugarcane", "Paddy"]
    })
    assert signup_res.status_code == 201
    body = signup_res.json()
    assert "access_token" in body
    assert body["user"]["full_name"] == "Suresh Gowda"
    assert body["user"]["preferred_language"] == "kn"

    # Duplicate mobile registration fails
    dup_res = client.post("/api/v1/auth/signup", json={
        "full_name": "Duplicate Farmer",
        "mobile": rand_mobile,
        "email": f"diff_{uuid.uuid4().hex[:4]}@example.com",
        "password": "Password123",
        "confirm_password": "Password123"
    })
    assert dup_res.status_code == 409


def test_profile_update_and_auth_me():
    # Login as demo farmer
    res = client.post("/api/v1/auth/login", json={
        "identifier": "9876543210",
        "password": "Farmer@123"
    })
    token = res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # GET /auth/me
    me_res = client.get("/api/v1/auth/me", headers=headers)
    assert me_res.status_code == 200
    assert me_res.json()["mobile"] == "9876543210"

    # Update profile
    up_res = client.put("/api/v1/auth/profile", headers=headers, json={
        "preferred_language": "kn",
        "district": "Kolar APMC"
    })
    assert up_res.status_code == 200
    assert up_res.json()["preferred_language"] == "kn"
    assert up_res.json()["district"] == "Kolar APMC"


def test_subscription_plans_and_mock_checkout():
    # Public plans
    plans_res = client.get("/api/v1/subscriptions/plans")
    assert plans_res.status_code == 200
    plans = plans_res.json()
    assert len(plans) >= 3
    plan_ids = [p["id"] for p in plans]
    assert "FREE" in plan_ids
    assert "PRO" in plan_ids
    assert "PROTECTION" in plan_ids

    # Login
    res = client.post("/api/v1/auth/login", json={
        "identifier": "9876543210",
        "password": "Farmer@123"
    })
    token = res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Checkout PRO plan
    checkout_res = client.post("/api/v1/subscriptions/checkout", headers=headers, json={
        "plan_id": "PRO",
        "billing_cycle": "monthly",
        "payment_method": "demo_upi"
    })
    assert checkout_res.status_code == 200
    data = checkout_res.json()
    assert data["success"] is True
    assert data["subscription"]["plan_id"] == "PRO"
    assert data["is_demo"] is True

    # Check history
    hist_res = client.get("/api/v1/subscriptions/history", headers=headers)
    assert hist_res.status_code == 200
    assert len(hist_res.json()) >= 1

    # Upgrade back to PROTECTION plan
    upgrade_res = client.post("/api/v1/subscriptions/checkout", headers=headers, json={
        "plan_id": "PROTECTION",
        "billing_cycle": "monthly",
        "payment_method": "demo_upi"
    })
    assert upgrade_res.status_code == 200
    assert upgrade_res.json()["subscription"]["plan_id"] == "PROTECTION"


def test_protection_predictions_and_claim_submission():
    # Login as demo farmer
    farmer_login = client.post("/api/v1/auth/login", json={
        "identifier": "9876543210",
        "password": "Farmer@123"
    })
    farmer_token = farmer_login.json()["access_token"]
    farmer_headers = {"Authorization": f"Bearer {farmer_token}"}

    # 1. Fetch available predictions
    preds_res = client.get("/api/v1/protection/predictions", headers=farmer_headers)
    assert preds_res.status_code == 200
    preds = preds_res.json()
    assert len(preds) > 0
    pred = preds[0]

    # 2. Submit claim
    pred_price = pred["predicted_price"]
    actual_price = pred_price - 500.0  # ₹500 adverse difference
    qty = 20.0  # 20 quintals
    gross_loss = 500.0 * 20.0  # ₹10,000
    expected_compensation = gross_loss * 0.35  # ₹3,500 (35%)

    claim_res = client.post("/api/v1/protection/claims", headers=farmer_headers, json={
        "prediction_id": pred["prediction_id"],
        "crop_id": pred["crop_id"],
        "crop_name": pred["crop_name"],
        "mandi_id": pred["mandi_id"],
        "mandi_name": pred["mandi_name"],
        "harvest_quantity_qtl": qty,
        "actual_selling_price": actual_price,
        "date_of_sale": "2026-10-28",
        "evidence_description": "Weighment slip #WG-8812, APMC Gate 1",
        "financial_impact_description": "Unforeseen supply glut depressed market spot prices."
    })
    assert claim_res.status_code == 201
    claim = claim_res.json()
    assert claim["gross_loss"] == gross_loss
    assert claim["verified_eligible_loss"] == gross_loss
    assert claim["compensation_percentage"] == 35.0
    assert claim["proposed_compensation"] == expected_compensation
    assert claim["status"] == "Submitted"
    claim_id = claim["claim_id"]

    # 3. Farmer can view own claim
    own_claim = client.get(f"/api/v1/protection/claims/{claim_id}", headers=farmer_headers)
    assert own_claim.status_code == 200

    # 4. Audit trail
    audit_res = client.get(f"/api/v1/protection/claims/{claim_id}/audit", headers=farmer_headers)
    assert audit_res.status_code == 200
    assert len(audit_res.json()) >= 1


def test_farmer_isolation_and_reviewer_authorization():
    # Create new distinct farmer
    mobile = f"97{str(uuid.uuid4().int)[:8]}"
    client.post("/api/v1/auth/signup", json={
        "full_name": "Farmer Two",
        "mobile": mobile,
        "password": "Password123",
        "confirm_password": "Password123"
    })
    f2_login = client.post("/api/v1/auth/login", json={
        "identifier": mobile,
        "password": "Password123"
    })
    f2_token = f2_login.json()["access_token"]
    f2_headers = {"Authorization": f"Bearer {f2_token}"}

    # Submit claim by Farmer Two
    preds = client.get("/api/v1/protection/predictions", headers=f2_headers).json()
    p = preds[0]
    claim_res = client.post("/api/v1/protection/claims", headers=f2_headers, json={
        "prediction_id": p["prediction_id"],
        "crop_id": p["crop_id"],
        "crop_name": p["crop_name"],
        "mandi_id": p["mandi_id"],
        "mandi_name": p["mandi_name"],
        "harvest_quantity_qtl": 10.0,
        "actual_selling_price": p["predicted_price"] - 200,
        "date_of_sale": "2026-10-29",
        "evidence_description": "Slip 9901",
        "financial_impact_description": "Glut impact"
    })
    claim_id = claim_res.json()["claim_id"]

    # Demo farmer attempts to view Farmer Two's claim -> 403 Forbidden
    f1_login = client.post("/api/v1/auth/login", json={
        "identifier": "9876543210",
        "password": "Farmer@123"
    })
    f1_token = f1_login.json()["access_token"]
    f1_headers = {"Authorization": f"Bearer {f1_token}"}

    iso_res = client.get(f"/api/v1/protection/claims/{claim_id}", headers=f1_headers)
    assert iso_res.status_code == 403

    # Farmer Two attempts to access admin claims console -> 403 Forbidden
    admin_access_res = client.get("/api/v1/admin/protection/claims", headers=f2_headers)
    assert admin_access_res.status_code == 403

    # Admin login
    admin_login = client.post("/api/v1/auth/login", json={
        "identifier": "admin@agrinexa.in",
        "password": "Admin@123"
    })
    admin_token = admin_login.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # Admin CAN access admin console
    admin_list = client.get("/api/v1/admin/protection/claims", headers=admin_headers)
    assert admin_list.status_code == 200

    # Admin reviews claim: APPROVE
    rev_res = client.post(f"/api/v1/admin/protection/claims/{claim_id}/review", headers=admin_headers, json={
        "action": "APPROVE",
        "reviewer_notes": "Weighment slip verified with Mandi Gate 1 logbook."
    })
    assert rev_res.status_code == 200
    assert rev_res.json()["status"] == "Approved"
    assert rev_res.json()["reviewed_by"] == "Dr. Anitha Rao (APMC Reviewer)"


def test_self_review_prevention_and_loss_adjustment():
    # Admin submits a claim for themselves
    admin_login = client.post("/api/v1/auth/login", json={
        "identifier": "admin@agrinexa.in",
        "password": "Admin@123"
    })
    admin_token = admin_login.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    preds = client.get("/api/v1/protection/predictions", headers=admin_headers).json()
    p = preds[0]
    claim_res = client.post("/api/v1/protection/claims", headers=admin_headers, json={
        "prediction_id": p["prediction_id"],
        "crop_id": p["crop_id"],
        "crop_name": p["crop_name"],
        "mandi_id": p["mandi_id"],
        "mandi_name": p["mandi_name"],
        "harvest_quantity_qtl": 10.0,
        "actual_selling_price": p["predicted_price"] - 100,
        "date_of_sale": "2026-10-30",
        "evidence_description": "Slip 101 evidence reference",
        "financial_impact_description": "Glut supply shock"
    })
    admin_claim_id = claim_res.json()["claim_id"]

    # Admin attempts to review their OWN claim -> 403 Forbidden!
    self_rev = client.post(f"/api/v1/admin/protection/claims/{admin_claim_id}/review", headers=admin_headers, json={
        "action": "APPROVE",
        "reviewer_notes": "Approving my own claim."
    })
    assert self_rev.status_code == 403
    assert "Conflict of interest" in self_rev.json()["detail"]
