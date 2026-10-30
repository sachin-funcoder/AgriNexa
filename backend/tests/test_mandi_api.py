"""
Integration and Unit Tests for Mandi Data API Foundation.
Tests cover mandis listing, price filtering, date range constraints,
calculations, invalid inputs, edge cases, and synthetic indicators.
"""

import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


# ---------------------------------------------------------------------------
# 1. MANDIS ENDPOINT TESTS
# ---------------------------------------------------------------------------
def test_list_all_mandis():
    """Verify listing all 8 Karnataka mandis with synthetic indicators."""
    response = client.get("/api/v1/mandis")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 8
    assert len(data["mandis"]) == 8
    assert data["is_demo"] is True
    assert data["data_source"] == "synthetic"

    # Verify mandi fields
    mandi = data["mandis"][0]
    assert "mandi_id" in mandi
    assert "name" in mandi
    assert "district" in mandi
    assert "latitude" in mandi
    assert "longitude" in mandi
    assert "facilities" in mandi
    assert mandi["is_demo"] is True


def test_filter_mandis_by_district():
    """Verify filtering mandis by Karnataka district."""
    response = client.get("/api/v1/mandis?district=Kolar")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 1
    assert data["mandis"][0]["district"] == "Kolar"
    assert "Kolar" in data["mandis"][0]["name"]


# ---------------------------------------------------------------------------
# 2. PRICES EXPLORATION & FILTERING TESTS
# ---------------------------------------------------------------------------
def test_query_prices_general():
    """Verify general price query with limit."""
    response = client.get("/api/v1/prices?limit=25")
    assert response.status_code == 200
    data = response.json()
    assert len(data["prices"]) <= 25
    assert data["is_demo"] is True
    assert data["data_source"] == "synthetic"
    assert data["stats"] is not None


def test_crop_price_lookup_by_common_name():
    """Verify crop price lookup by plain common name ('tomato')."""
    response = client.get("/api/v1/prices/tomato?limit=30")
    assert response.status_code == 200
    data = response.json()
    assert data["crop_id"] == "crop_tomato"
    assert data["crop_name"] == "Tomato"
    assert len(data["prices"]) == 30
    assert data["is_demo"] is True
    assert data["data_source"] == "synthetic"


def test_crop_price_lookup_by_crop_id():
    """Verify crop price lookup by explicit crop_id ('crop_onion')."""
    response = client.get("/api/v1/prices/crop_onion?limit=20")
    assert response.status_code == 200
    data = response.json()
    assert data["crop_id"] == "crop_onion"
    assert data["crop_name"] == "Onion"
    assert len(data["prices"]) == 20


def test_price_calculations_and_data_quality():
    """
    Verify core mathematical guarantees:
    - min_price <= modal_price <= max_price
    - non-negative prices and arrivals
    - average modal price calculation
    """
    response = client.get("/api/v1/prices/potato?mandi_id=mandi_hassan&limit=100")
    assert response.status_code == 200
    data = response.json()
    prices = data["prices"]
    assert len(prices) > 0

    stats = data["stats"]
    assert stats["min_price_observed"] <= stats["avg_modal_price"] <= stats["max_price_observed"]

    for p in prices:
        assert p["min_price"] <= p["modal_price"] <= p["max_price"], (
            f"Price order violated: min={p['min_price']}, modal={p['modal_price']}, max={p['max_price']}"
        )
        assert p["min_price"] >= 0
        assert p["arrival_quantity"] >= 0
        assert p["is_demo"] is True
        assert p["data_source"] == "synthetic"


def test_mandi_filtering():
    """Verify filtering price time-series by specific mandi."""
    response = client.get("/api/v1/prices/maize?mandi_id=mandi_davanagere&limit=50")
    assert response.status_code == 200
    data = response.json()
    assert data["mandi_id"] == "mandi_davanagere"
    assert data["mandi_name"] == "Davanagere APMC Yard"
    for p in data["prices"]:
        assert p["mandi_id"] == "mandi_davanagere"


def test_date_range_filtering():
    """Verify date range filtering between start_date and end_date."""
    start_date = "2025-03-01"
    end_date = "2025-03-10"
    response = client.get(f"/api/v1/prices/ragi?start_date={start_date}&end_date={end_date}")
    assert response.status_code == 200
    data = response.json()
    for p in data["prices"]:
        assert start_date <= p["date"] <= end_date


# ---------------------------------------------------------------------------
# 3. EDGE CASES & ERROR HANDLING TESTS
# ---------------------------------------------------------------------------
def test_invalid_crop_handling():
    """Verify 404 error returned for unknown crop with helpful message."""
    response = client.get("/api/v1/prices/dragonfruit")
    assert response.status_code == 404
    err = response.json()
    assert err["error"] is True
    assert "Unknown crop" in err["message"]


def test_invalid_date_order():
    """Verify 400 error when start_date is later than end_date."""
    response = client.get("/api/v1/prices/tomato?start_date=2026-06-01&end_date=2025-01-01")
    assert response.status_code == 400
    err = response.json()
    assert err["error"] is True
    assert "cannot be later than" in err["message"]


def test_missing_data_graceful_handling():
    """
    Verify querying out-of-range dates returns clean empty response
    rather than an unhandled 500 server crash.
    """
    response = client.get("/api/v1/prices/tomato?start_date=2010-01-01&end_date=2010-01-10")
    assert response.status_code == 200
    data = response.json()
    assert data["records_count"] == 0
    assert data["prices"] == []
    assert data["stats"] is None
    assert data["is_demo"] is True


# ---------------------------------------------------------------------------
# 4. DASHBOARD SUMMARY TESTS
# ---------------------------------------------------------------------------
def test_dashboard_summary():
    """Verify dashboard KPI summary for all 6 commodities."""
    response = client.get("/api/v1/dashboard")
    assert response.status_code == 200
    data = response.json()
    assert data["total_mandis_monitored"] == 8
    assert data["total_crops_tracked"] == 6
    assert len(data["commodity_cards"]) == 6
    assert data["is_demo"] is True
    assert data["data_source"] == "synthetic"

    # Verify card structure
    tomato_card = next((c for c in data["commodity_cards"] if c["crop_id"] == "crop_tomato"), None)
    assert tomato_card is not None
    assert tomato_card["today_modal_price"] > 0
    assert tomato_card["trend_direction"] in ["up", "down", "stable"]
    assert "advisory_summary" in tomato_card
    assert tomato_card["primary_mandi_id"] == "mandi_kolar"
