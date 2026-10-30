"""Tests for AI Climate Intelligence & Smart Crop Recommendation Engine (Task 9)."""

import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.services.climate_service import ClimateService
from app.services.soil_suitability_service import SoilSuitabilityService
from app.services.crop_recommendation_service import CropRecommendationService
from app.services.land_profile_service import LandProfileService
from app.services.chatbot_service import ChatbotService
from app.schemas.soil import LandProfileCreateRequest
from app.schemas.crop_recommendation import CropRecommendationRequest
from app.schemas.chatbot import ChatMessageRequest

client = TestClient(app)


def test_climate_service_forecast():
    """Verify 7-day weather forecast generation."""
    forecast = ClimateService.get_weather_forecast("Kolar", days=7)
    assert forecast.district == "Kolar"
    assert forecast.forecast_horizon_days == 7
    assert len(forecast.forecast_points) == 7
    assert forecast.is_demo is True
    for pt in forecast.forecast_points:
        assert pt.min_temp_c < pt.max_temp_c
        assert 0 <= pt.humidity_pct <= 100
        assert pt.rainfall_mm >= 0


def test_climate_service_seasonal():
    """Verify seasonal climate outlook for Kharif/Rabi/Summer."""
    outlook = ClimateService.get_seasonal_outlook("Mandya", season="Kharif")
    assert outlook.district == "Mandya"
    assert outlook.season_name == "Kharif"
    assert outlook.rainfall_category in ["Normal", "Below Normal (Deficit)", "Above Normal (Surplus)"]
    assert outlook.expected_seasonal_rainfall_mm > 0
    assert len(outlook.agronomic_advice_en) > 10
    assert len(outlook.agronomic_advice_kn) > 10


def test_climate_service_historical():
    """Verify 30-year IMD climatological baseline normals."""
    baseline = ClimateService.get_historical_baseline("Hassan")
    assert baseline.district == "Hassan"
    assert "Transition" in baseline.agro_climatic_zone
    assert baseline.average_annual_rainfall_mm > 800
    assert baseline.drought_vulnerability_index in ["Low", "Medium", "High"]


def test_soil_suitability_evaluation():
    """Verify soil compatibility evaluation and confidence penalties."""
    catalog = CropRecommendationService.get_agronomy_catalog()
    ragi = next(c for c in catalog if "ragi" in c["crop_id"])

    # Ideal profile
    ideal_profile = LandProfileCreateRequest(
        district="Kolar",
        total_area=2.5,
        land_type="Dryland",
        soil_type="Red soil",
        soil_ph=6.5,
        water_source="Rainfed only",
        water_availability="low",
    )
    score, conf, reasons_en, _, _ = SoilSuitabilityService.evaluate_soil_compatibility(ideal_profile, ragi)
    assert score > 85.0
    assert conf >= 90.0

    # Unknown soil profile (confidence penalty test)
    untested_profile = LandProfileCreateRequest(
        district="Kolar",
        total_area=2.5,
        land_type="Dryland",
        soil_type="Unknown / Not tested",
        soil_ph=None,
        water_source="Rainfed only",
        water_availability="low",
    )
    score_untested, conf_untested, _, _, amendment = SoilSuitabilityService.evaluate_soil_compatibility(untested_profile, ragi)
    assert conf_untested < 55.0  # Heavy confidence penalty for unmeasured soil & pH


def test_crop_recommendation_ranking_and_calendar():
    """Verify multi-criteria decision engine outputs ranked recommendations and growth calendar."""
    req = CropRecommendationRequest(
        inline_profile=LandProfileCreateRequest(
            district="Kolar",
            total_area=3.0,
            land_type="Dryland",
            soil_type="Red soil",
            soil_ph=6.2,
            water_source="Rainfed only",
            water_availability="low",
            preferred_sowing_season="Kharif",
        ),
        season="Kharif"
    )
    res = CropRecommendationService.generate_recommendations(req)

    assert res.district == "Kolar"
    assert len(res.recommendations) > 5
    # Verify descending sort order by score
    scores = [r.scores.overall_suitability_score for r in res.recommendations]
    assert scores == sorted(scores, reverse=True)

    # Top recommendation should have calendar and reasons
    top = res.top_recommendation
    assert top.rank == 1
    assert top.calendar is not None
    assert len(top.calendar.stages) == 4
    assert len(top.why_recommended_en) > 0
    assert len(top.why_recommended_kn) > 0
    assert top.scores.confidence_score > 70.0


def test_land_profile_service_crud():
    """Verify LandProfile CRUD persistence."""
    profile_req = LandProfileCreateRequest(
        farm_name="Shree Siddharoodha Krishi Farm",
        state="Karnataka",
        district="Dharwad",
        total_area=5.0,
        land_type="Mixed farming land",
        soil_type="Black soil",
        soil_ph=7.2,
        water_source="Borewell",
        water_availability="medium",
        preferred_categories=["Cereal / Grain", "Pulse"],
    )
    created = LandProfileService.create_or_update_profile(profile_req, user_id=None)
    assert created.id.startswith("land_")
    assert created.district == "Dharwad"
    assert created.soil_type == "Black soil"

    fetched = LandProfileService.get_profile_by_id(created.id)
    assert fetched is not None
    assert fetched.farm_name == "Shree Siddharoodha Krishi Farm"


def test_api_climate_endpoints():
    """Verify HTTP API endpoints for Climate Intelligence."""
    res1 = client.get("/api/v1/climate/forecast?district=Bengaluru&days=5")
    assert res1.status_code == 200
    assert len(res1.json()["forecast_points"]) == 5

    res2 = client.get("/api/v1/climate/seasonal?district=Belagavi&season=Rabi")
    assert res2.status_code == 200
    assert res2.json()["season_name"] == "Rabi"

    res3 = client.get("/api/v1/climate/historical?district=Davanagere")
    assert res3.status_code == 200
    assert res3.json()["district"] == "Davanagere"

    res4 = client.get("/api/v1/climate/summary?district=Kolar")
    assert res4.status_code == 200
    assert "short_range_forecast" in res4.json()
    assert "seasonal_outlook" in res4.json()
    assert "historical_baseline" in res4.json()


def test_api_crop_advisor_endpoints():
    """Verify HTTP API endpoints for Crop Advisor."""
    # List crops catalog
    res_crops = client.get("/api/v1/crop-advisor/crops")
    assert res_crops.status_code == 200
    assert len(res_crops.json()) >= 10

    # Save Land Profile
    payload = {
        "farm_name": "Cauvery Basin Parcel",
        "state": "Karnataka",
        "district": "Mandya",
        "total_area": 4.0,
        "area_unit": "acres",
        "land_type": "Irrigated land",
        "soil_type": "Alluvial soil",
        "soil_ph": 6.8,
        "water_source": "Canal irrigation",
        "water_availability": "high",
        "preferred_sowing_season": "Kharif"
    }
    res_save = client.post("/api/v1/crop-advisor/land-profile", json=payload)
    assert res_save.status_code == 200
    land_id = res_save.json()["id"]

    # Generate Recommendations using saved land profile ID
    res_rec = client.post("/api/v1/crop-advisor/recommendations", json={
        "land_profile_id": land_id,
        "season": "Kharif"
    })
    assert res_rec.status_code == 200
    rec_data = res_rec.json()
    assert rec_data["district"] == "Mandya"
    assert len(rec_data["recommendations"]) > 0
    rec_id = rec_data["recommendation_id"]

    # Fetch recommendation by ID
    res_get_rec = client.get(f"/api/v1/crop-advisor/recommendations/{rec_id}")
    assert res_get_rec.status_code == 200
    assert res_get_rec.json()["recommendation_id"] == rec_id


def test_chatbot_climate_and_crop_advisor_intents():
    """Verify chatbot answers climate and crop recommendation queries in Kannada and English."""
    bot = ChatbotService()

    # 1. Weather query (English)
    q1 = ChatMessageRequest(message="What is the weather forecast for Kolar?", language="en")
    r1 = bot.process_message(q1)
    assert r1.intent == "CLIMATE_WEATHER"
    assert "Kolar" in r1.response
    assert any(c.route == "/crop-advisor" for c in r1.action_chips)

    # 2. Weather query (Kannada)
    q2 = ChatMessageRequest(message="ಕೋಲಾರದಲ್ಲಿ ಮಳೆ ಮುನ್ಸೂಚನೆ ಏನು?", language="kn")
    r2 = bot.process_message(q2)
    assert r2.intent == "CLIMATE_WEATHER"
    assert "ಹವಾಮಾನ" in r2.response

    # 3. Crop Recommendation query (English)
    q3 = ChatMessageRequest(message="Which crop is suitable for red soil in Kolar?", language="en")
    r3 = bot.process_message(q3)
    assert r3.intent == "CROP_RECOMMENDATION"
    assert any(c.route == "/crop-advisor" for c in r3.action_chips)

    # 4. Crop Recommendation query (Kannada)
    q4 = ChatMessageRequest(message="ನನ್ನ ಜಮೀನಿಗೆ ಯಾವ ಬೆಳೆ ಸೂಕ್ತ?", language="kn")
    r4 = bot.process_message(q4)
    assert r4.intent == "CROP_RECOMMENDATION"
    assert "ಶಿಫಾರಸುಗಳು" in r4.response

