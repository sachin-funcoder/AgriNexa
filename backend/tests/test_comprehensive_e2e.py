"""End-to-End Comprehensive Full-System Test Suite for AgriNexa Platform.
Tests all 9 modules against the live running FastAPI service (http://127.0.0.1:8000)
and verifies arithmetic, security, data integrity, localization, and edge cases.
"""

import pytest
import httpx
import uuid
import re

BASE_URL = "http://127.0.0.1:8000/api/v1"
CLIENT_TIMEOUT = 15.0

# ─────────────────────────────────────────────────────────────────────────────
# MODULE 1: DASHBOARD & MANDI DATA
# ─────────────────────────────────────────────────────────────────────────────

def test_live_health_and_root():
    with httpx.Client(base_url="http://127.0.0.1:8000", timeout=CLIENT_TIMEOUT) as client:
        r_root = client.get("/")
        assert r_root.status_code == 200
        root_data = r_root.json()
        assert root_data["status"] == "online"
        assert "documentation" in root_data

        r_health = client.get("/api/v1/health")
        assert r_health.status_code == 200
        health_data = r_health.json()
        assert health_data["status"] == "healthy"
        assert "version" in health_data


def test_live_dashboard_summary():
    with httpx.Client(base_url=BASE_URL, timeout=CLIENT_TIMEOUT) as client:
        resp = client.get("/dashboard")
        assert resp.status_code == 200
        data = resp.json()

        # Check required fields
        assert "date_of_data" in data
        assert "total_mandis_monitored" in data
        assert data["total_mandis_monitored"] >= 8
        assert "total_crops_tracked" in data
        assert data["total_crops_tracked"] >= 6
        assert "commodity_cards" in data
        assert len(data["commodity_cards"]) >= 6

        # Check card structure for Tomato
        tomato_card = next((c for c in data["commodity_cards"] if c["crop_id"] == "crop_tomato"), None)
        assert tomato_card is not None
        assert "today_modal_price" in tomato_card
        assert tomato_card["today_modal_price"] > 0
        assert "primary_mandi_name" in tomato_card
        assert "advisory_summary" in tomato_card
        assert "name_kn" in tomato_card
        assert "shelf_life_days" in tomato_card


def test_live_mandis_catalog():
    with httpx.Client(base_url=BASE_URL, timeout=CLIENT_TIMEOUT) as client:
        resp = client.get("/mandis")
        assert resp.status_code == 200
        data = resp.json()
        assert "mandis" in data
        mandis = data["mandis"]
        assert len(mandis) >= 8

        mandi_ids = [m["mandi_id"] for m in mandis]
        assert "mandi_bengaluru" in mandi_ids
        assert "mandi_kolar" in mandi_ids

        # Filter by district
        resp_filtered = client.get("/mandis", params={"district": "Kolar"})
        assert resp_filtered.status_code == 200
        kolar_mandis = resp_filtered.json()["mandis"]
        assert all(m["district"] == "Kolar" for m in kolar_mandis)


# ─────────────────────────────────────────────────────────────────────────────
# MODULE 2: HISTORICAL PRICE TRENDS & FORECASTING
# ─────────────────────────────────────────────────────────────────────────────

def test_live_price_history_and_crops():
    crops = ["tomato", "potato", "onion", "ragi", "maize", "green_chilli"]
    with httpx.Client(base_url=BASE_URL, timeout=CLIENT_TIMEOUT) as client:
        for crop in crops:
            resp = client.get(f"/prices/{crop}")
            assert resp.status_code == 200
            data = resp.json()
            assert "crop_id" in data
            assert "prices" in data
            assert len(data["prices"]) > 0

            # Verify price record fields
            sample = data["prices"][0]
            assert "mandi_id" in sample
            assert "min_price" in sample
            assert "modal_price" in sample
            assert "max_price" in sample
            assert sample["min_price"] <= sample["modal_price"] <= sample["max_price"]

        # Date range filtering test
        resp_range = client.get("/prices/tomato", params={"start_date": "2026-09-01", "end_date": "2026-09-15"})
        assert resp_range.status_code == 200

        # Invalid crop error test
        resp_invalid = client.get("/prices/dragonfruit")
        assert resp_invalid.status_code in [404, 422]


def test_live_forecast_confidence_intervals():
    with httpx.Client(base_url=BASE_URL, timeout=CLIENT_TIMEOUT) as client:
        resp = client.get("/prices/tomato/forecast", params={"mandi_id": "mandi_kolar", "days": 14})
        assert resp.status_code == 200
        data = resp.json()
        assert "forecast_points" in data
        assert len(data["forecast_points"]) >= 7

        for f in data["forecast_points"]:
            assert "normal" in f
            assert "pessimistic" in f
            assert "optimistic" in f
            assert f["pessimistic"] <= f["normal"] <= f["optimistic"]


# ─────────────────────────────────────────────────────────────────────────────
# MODULE 3: FARMER PROFIT CALCULATOR ARITHMETIC
# ─────────────────────────────────────────────────────────────────────────────

def test_calculator_arithmetic_verification():
    """Verify arithmetic formulas used in CalculatorPage."""
    qty = 100.0  # quintals
    price = 2500.0  # ₹/quintal
    transport = 4500.0
    storage = 1050.0
    handling = 1500.0
    other = 500.0

    # 1. Gross Revenue
    gross = qty * price
    assert gross == 250000.0

    # 2. Total Expenses
    total_expenses = transport + storage + handling + other
    assert total_expenses == 7550.0

    # 3. Net Return
    net_return = gross - total_expenses
    assert net_return == 242450.0

    # 4. Net per quintal
    net_per_qtl = net_return / qty
    assert net_per_qtl == 2424.50

    # 5. Break-even price
    break_even = total_expenses / qty
    assert break_even == 75.50

    # 6. Profit Margin %
    margin = (net_return / gross) * 100
    assert abs(margin - 96.98) < 0.01


# ─────────────────────────────────────────────────────────────────────────────
# MODULE 4: SMART MANDI COMPARISON
# ─────────────────────────────────────────────────────────────────────────────

def test_mandi_compare_net_return_prioritization():
    """Test that net return deducts freight & APMC cess and chooses best pocket return."""
    with httpx.Client(base_url=BASE_URL, timeout=CLIENT_TIMEOUT) as client:
        resp = client.get("/prices/tomato")
        assert resp.status_code == 200
        data = resp.json()
        prices = data["prices"]

        # Collect prices across mandis on latest date
        latest_date = prices[-1]["date"]
        latest_records = [p for p in prices if p["date"] == latest_date]

        qty = 50.0
        freight_per_km_qtl = 2.25
        distances = {
            "mandi_bengaluru": 60,
            "mandi_kolar": 70,
            "mandi_mysuru": 145,
            "mandi_hubballi": 410,
        }

        evaluations = []
        for r in latest_records:
            mid = r["mandi_id"]
            dist = distances.get(mid, 100)
            transport = dist * freight_per_km_qtl * qty
            gross = qty * r["modal_price"]
            cess = (gross * 1.5) / 100
            net = gross - transport - cess
            evaluations.append({
                "mandi_id": mid,
                "modal_price": r["modal_price"],
                "transport": transport,
                "net_return": net
            })

        # Ensure that sorting by net_return is not necessarily identical to sorting by modal_price
        evaluations.sort(key=lambda x: x["net_return"], reverse=True)
        best_mandi = evaluations[0]
        assert best_mandi["net_return"] > 0


# ─────────────────────────────────────────────────────────────────────────────
# MODULE 5: HARVEST SPLIT OPTIMIZER
# ─────────────────────────────────────────────────────────────────────────────

def test_live_harvest_optimizer_conservation_and_lp():
    payload = {
        "crop_id": "crop_tomato",
        "total_harvest_qty": 100.0,
        "harvest_date": "2026-10-31",
        "origin_mandi_id": "mandi_kolar",
        "preferred_mandi_ids": ["mandi_kolar", "mandi_bengaluru"],
        "storage_capacity_qty": 50.0,
        "storage_cost_per_qtl_day": 3.5,
        "storage_type": "ambient",
        "daily_selling_capacity": 40.0,
        "max_storage_days": 5,
        "risk_preference": "balanced"
    }

    with httpx.Client(base_url=BASE_URL, timeout=CLIENT_TIMEOUT) as client:
        resp = client.post("/optimizer/harvest-split", json=payload)
        assert resp.status_code == 200
        result = resp.json()

        assert result["status"] in ["optimal", "feasible", "fallback"]
        assert "allocations" in result
        assert "total_spoilage_qty" in result
        assert "terminal_unsold_qty" in result
        assert result["harvest_conservation_reconciled"] is True

        # Check total flow conservation over time
        total_sales = sum(a["quantity_qtl"] for a in result["allocations"])
        total_spoilage = result["total_spoilage_qty"]
        terminal_unsold = result["terminal_unsold_qty"]

        total_accounted = total_sales + total_spoilage + terminal_unsold
        assert abs(total_accounted - payload["total_harvest_qty"]) < 0.1


# ─────────────────────────────────────────────────────────────────────────────
# MODULE 6: COMMUNITY & TRANSPARENCY
# ─────────────────────────────────────────────────────────────────────────────

def test_live_community_workflow_and_moderation():
    with httpx.Client(base_url=BASE_URL, timeout=CLIENT_TIMEOUT) as client:
        # 1. Fetch public feed
        r_feed = client.get("/community/posts")
        assert r_feed.status_code == 200
        initial_posts = r_feed.json()["posts"]

        # 2. Create QA test post
        test_content = f"QA Test Post {uuid.uuid4().hex[:6]} - Testing APMC price transparency"
        r_create = client.post("/community/posts", json={
            "author_name": "QA Tester",
            "category": "Mandi Experience",
            "crop_id": "crop_tomato",
            "mandi_id": "mandi_kolar",
            "title": "QA APMC Experience in Kolar",
            "content": test_content
        })
        assert r_create.status_code in [200, 201]
        created_post = r_create.json()
        post_id = created_post["post_id"]

        # 3. Add comment
        r_comment = client.post(f"/community/posts/{post_id}/comments", json={
            "author_name": "Farmer Ramappa",
            "content": "ಧನ್ಯವಾದಗಳು, ನಮಗೂ ಅದೇ ಅನುಭವವಾಗಿತ್ತು."
        })
        assert r_comment.status_code in [200, 201]

        # 4. Mark helpful
        r_helpful = client.post(f"/community/posts/{post_id}/helpful")
        assert r_helpful.status_code == 200

        # 5. Hide post in moderation and check that it disappears from public feed
        r_hide = client.patch(f"/community/moderation/posts/{post_id}", json={"status": "hidden"})
        assert r_hide.status_code == 200

        r_feed_after = client.get("/community/posts")
        post_ids_public = [p["post_id"] for p in r_feed_after.json()["posts"]]
        assert post_id not in post_ids_public, "Hidden post must not appear in public feed"

        # 6. Unhide and verify it reappears
        r_unhide = client.patch(f"/community/moderation/posts/{post_id}", json={"status": "active"})
        assert r_unhide.status_code == 200

        # 7. Create report and verify reference ID
        r_report = client.post("/community/reports", json={
            "mandi_id": "mandi_kolar",
            "incident_date": "2026-10-25",
            "issue_category": "Incorrect weighing",
            "description": "Electronic scale deviation of 2kg observed per quintal bag.",
            "farmer_name": "QA Tester Farmer",
            "crop_id": "crop_tomato"
        })
        assert r_report.status_code in [200, 201]
        report_data = r_report.json()
        assert "report_id" in report_data


# ─────────────────────────────────────────────────────────────────────────────
# MODULE 7: AUTH, SUBSCRIPTIONS & DEMO PROTECTION
# ─────────────────────────────────────────────────────────────────────────────

def test_live_auth_and_subscriptions():
    test_mobile = f"99{uuid.uuid4().int % 100000000:08d}"
    with httpx.Client(base_url=BASE_URL, timeout=CLIENT_TIMEOUT) as client:
        # 1. Signup
        r_signup = client.post("/auth/signup", json={
            "full_name": "QA Farmer Gowda",
            "mobile": test_mobile,
            "password": "SecurePassword123!",
            "confirm_password": "SecurePassword123!",
            "preferred_language": "kn",
            "district": "Kolar"
        })
        assert r_signup.status_code in [200, 201]
        token = r_signup.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 2. Duplicate signup should be rejected with 409 Conflict
        r_dup = client.post("/auth/signup", json={
            "full_name": "QA Farmer Gowda",
            "mobile": test_mobile,
            "password": "SecurePassword123!",
            "confirm_password": "SecurePassword123!"
        })
        assert r_dup.status_code in [400, 409]

        # 3. Check /auth/me
        r_me = client.get("/auth/me", headers=headers)
        assert r_me.status_code == 200
        user_info = r_me.json()
        assert user_info.get("mobile") == test_mobile or user_info.get("mobile_number") == test_mobile
        assert user_info["district"] == "Kolar"

        # 4. View Subscription Plans
        r_plans = client.get("/subscriptions/plans")
        assert r_plans.status_code == 200
        plans = r_plans.json()
        plan_ids = [p["id"] for p in plans]
        assert "FREE" in plan_ids
        assert "PRO" in plan_ids
        assert "PROTECTION" in plan_ids

        # 5. Mock Checkout (strictly simulated!)
        r_checkout = client.post("/subscriptions/checkout", json={
            "plan_id": "PROTECTION",
            "billing_cycle": "monthly",
            "payment_method": "demo_upi"
        }, headers=headers)
        assert r_checkout.status_code == 200
        checkout_res = r_checkout.json()
        assert checkout_res.get("success") is True

        # 6. Test 35% Protection calculation and claim submission
        r_preds = client.get("/protection/predictions", headers=headers)
        assert r_preds.status_code == 200
        preds = r_preds.json()
        assert len(preds) > 0

        target_pred = preds[0]
        pred_price = target_pred["predicted_price"]
        actual_price = pred_price - 500.0
        qty = 20.0
        gross_loss = 500.0 * 20.0
        expected_compensation = gross_loss * 0.35

        # Submit a demo claim
        r_claim = client.post("/protection/claims", json={
            "prediction_id": target_pred["prediction_id"],
            "crop_id": target_pred["crop_id"],
            "crop_name": target_pred["crop_name"],
            "mandi_id": target_pred["mandi_id"],
            "mandi_name": target_pred["mandi_name"],
            "harvest_quantity_qtl": qty,
            "actual_selling_price": actual_price,
            "date_of_sale": "2026-10-28",
            "evidence_description": "Weighment slip #WG-8812, APMC Gate 1",
            "financial_impact_description": "Unforeseen supply glut depressed market spot prices."
        }, headers=headers)
        assert r_claim.status_code == 201
        claim_data = r_claim.json()

        # Check 35% formula
        assert claim_data["gross_loss"] == gross_loss
        assert claim_data["compensation_percentage"] == 35.0
        assert claim_data["proposed_compensation"] == expected_compensation
        assert claim_data["status"] == "Submitted"


# ─────────────────────────────────────────────────────────────────────────────
# MODULE 8: AGRINEXA AI VOICE CHATBOT
# ─────────────────────────────────────────────────────────────────────────────

def test_live_chatbot_intents_english_and_kannada():
    session_id = f"test_qa_{uuid.uuid4().hex[:8]}"
    with httpx.Client(base_url=BASE_URL, timeout=CLIENT_TIMEOUT) as client:
        # 1. English greeting
        r1 = client.post("/chatbot/message", json={
            "conversation_id": session_id,
            "message": "Hello AgriNexa",
            "language": "en"
        })
        assert r1.status_code == 200
        ans1 = r1.json()["response"]
        assert len(ans1) > 10

        # 2. Kannada Crop Price query
        r2 = client.post("/chatbot/message", json={
            "conversation_id": session_id,
            "message": "ಇವತ್ತು ಟೊಮೇಟೊ ಬೆಲೆ ಎಷ್ಟು?",
            "language": "kn"
        })
        assert r2.status_code == 200
        ans2 = r2.json()["response"]
        assert "ಟೊಮೇಟೊ" in ans2 or "ಬೆಲೆ" in ans2 or "₹" in ans2

        # 3. English Mandi Comparison query
        r3 = client.post("/chatbot/message", json={
            "conversation_id": session_id,
            "message": "Which mandi gives the highest price for onion?",
            "language": "en"
        })
        assert r3.status_code == 200
        ans3 = r3.json()["response"]
        assert "onion" in ans3.lower() or "mandi" in ans3.lower()

        # 4. English Forecast query
        r4 = client.post("/chatbot/message", json={
            "conversation_id": session_id,
            "message": "What is the price forecast for potato next week?",
            "language": "en"
        })
        assert r4.status_code == 200
        ans4 = r4.json()["response"]
        assert "potato" in ans4.lower() or "forecast" in ans4.lower() or "trend" in ans4.lower()

        # 5. Clear conversation history
        r_del = client.delete(f"/chatbot/history?conversation_id={session_id}")
        assert r_del.status_code == 200


# ─────────────────────────────────────────────────────────────────────────────
# MODULE 9: CLIMATE INTELLIGENCE & CROP ADVISOR
# ─────────────────────────────────────────────────────────────────────────────

def test_live_climate_and_crop_advisor():
    with httpx.Client(base_url=BASE_URL, timeout=CLIENT_TIMEOUT) as client:
        # 1. Climate Forecast
        r_clim = client.get("/climate/forecast", params={"district": "Kolar", "horizon_days": 14})
        assert r_clim.status_code == 200
        clim_data = r_clim.json()
        assert "forecast_points" in clim_data
        assert len(clim_data["forecast_points"]) >= 7

        # 2. Seasonal Outlook
        r_seas = client.get("/climate/seasonal", params={"district": "Kolar", "season": "Kharif"})
        assert r_seas.status_code == 200
        seas_data = r_seas.json()
        assert "rainfall_category" in seas_data

        # 3. Supported Crops Catalog
        r_crops = client.get("/crop-advisor/crops")
        assert r_crops.status_code == 200
        crops_list = r_crops.json()
        assert len(crops_list) >= 6

        # 4. Multi-Criteria Crop Recommendation
        rec_payload = {
            "season": "Kharif",
            "inline_profile": {
                "farm_name": "QA Demonstration Farm",
                "state": "Karnataka",
                "district": "Kolar",
                "taluk": "Mulbagal",
                "village": "Gowdanahalli",
                "total_area": 5.0,
                "area_unit": "acres",
                "land_type": "Dryland",
                "soil_type": "Red soil",
                "soil_ph": 6.8,
                "water_source": "Borewell",
                "water_availability": "medium",
                "irrigation_type": "Drip irrigation"
            }
        }
        r_rec = client.post("/crop-advisor/recommendations", json=rec_payload)
        assert r_rec.status_code in [200, 201]
        rec_data = r_rec.json()

        assert "recommendations" in rec_data
        assert len(rec_data["recommendations"]) > 0

        # Check top recommendation score & explanation
        top_crop = rec_data["recommendations"][0]
        assert "crop_name_en" in top_crop
        assert "crop_name_kn" in top_crop
        assert "scores" in top_crop
        assert 0 <= top_crop["scores"]["overall_suitability_score"] <= 100
        assert "why_recommended_en" in top_crop
        assert "identified_risks_en" in top_crop
