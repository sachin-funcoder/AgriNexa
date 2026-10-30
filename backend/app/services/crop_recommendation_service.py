"""Crop Recommendation Service (Task 9).
Agronomic multi-criteria decision engine evaluating crop suitability across soil, climate,
water availability, sowing seasonality, and cultivation risks with bilingual explanations.
"""

import json
import os
import uuid
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional, Tuple
from app.db.database import get_db_connection
from app.services.climate_service import ClimateService
from app.services.soil_suitability_service import SoilSuitabilityService
from app.services.land_profile_service import LandProfileService
from app.services.mandi_service import MandiService
from app.schemas.soil import LandProfileCreateRequest, LandProfileResponse
from app.schemas.crop_recommendation import (
    CropSuitabilityScores,
    CropCalendarStage,
    CropCalendarTimeline,
    RiskAssessment,
    CropRecommendationItem,
    CropRecommendationRequest,
    CropRecommendationResponse,
)

AGRONOMY_DATA_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "crop_agronomy.json")


class CropRecommendationService:
    """Intelligent Agronomic Advisory Engine."""

    _agronomy_catalog: Optional[List[Dict[str, Any]]] = None

    @classmethod
    def get_agronomy_catalog(cls) -> List[Dict[str, Any]]:
        if cls._agronomy_catalog is None:
            if os.path.exists(AGRONOMY_DATA_PATH):
                with open(AGRONOMY_DATA_PATH, "r", encoding="utf-8") as f:
                    cls._agronomy_catalog = json.load(f)
            else:
                cls._agronomy_catalog = []
        return cls._agronomy_catalog

    @classmethod
    def generate_recommendations(
        cls,
        req: CropRecommendationRequest,
        user_id: Optional[str] = None
    ) -> CropRecommendationResponse:
        # 1. Resolve Land Profile
        profile: LandProfileCreateRequest
        land_profile_id: str

        if req.land_profile_id:
            db_profile = LandProfileService.get_profile_by_id(req.land_profile_id, user_id=user_id)
            if not db_profile:
                # If not found under user_id, check globally (demo mode)
                db_profile = LandProfileService.get_profile_by_id(req.land_profile_id)
            if not db_profile:
                raise ValueError(f"Land profile '{req.land_profile_id}' not found.")
            land_profile_id = db_profile.id
            profile = LandProfileCreateRequest(**db_profile.model_dump(exclude={"id", "user_id", "is_demo", "created_at", "updated_at"}))
        elif req.inline_profile:
            # Save ad-hoc profile to DB so it has an ID
            created_profile = LandProfileService.create_or_update_profile(req.inline_profile, user_id=user_id)
            land_profile_id = created_profile.id
            profile = req.inline_profile
        else:
            raise ValueError("Either land_profile_id or inline_profile must be provided.")

        district = profile.district.strip().title()
        season = (req.season or profile.preferred_sowing_season or "Kharif").strip().capitalize()
        if season not in ["Kharif", "Rabi", "Summer"]:
            season = "Kharif"

        # 2. Get climate intelligence
        climate_summary = ClimateService.get_complete_climate_summary(district, season=season)
        baseline = climate_summary.historical_baseline
        seasonal = climate_summary.seasonal_outlook
        forecast = climate_summary.short_range_forecast

        # 3. Mandi Service for live modal prices
        mandi_service = MandiService()
        all_mandis_prices = mandi_service.get_prices().prices

        catalog = cls.get_agronomy_catalog()
        scored_crops: List[CropRecommendationItem] = []

        for crop in catalog:
            item = cls._evaluate_single_crop(
                crop=crop,
                profile=profile,
                season=season,
                baseline=baseline,
                seasonal=seasonal,
                forecast=forecast,
                all_prices=all_mandis_prices
            )
            scored_crops.append(item)

        # 4. Rank by overall suitability score descending
        scored_crops.sort(key=lambda x: x.scores.overall_suitability_score, reverse=True)

        # Assign ranks
        for idx, item in enumerate(scored_crops):
            item.rank = idx + 1

        top_rec = scored_crops[0] if scored_crops else None

        # Formulate general water advisory
        water_avail = profile.water_availability.lower()
        if water_avail == "low":
            adv_en = f"District {district} during {season}: Low water availability detected. Drought-resilient millets and pulses prioritized; avoid high water-demand crops without drip."
            adv_kn = f"{district} ಜಿಲ್ಲೆಯಲ್ಲಿ {season} ಹಂಗಾಮಿಗೆ: ನೀರಿನ ಲಭ್ಯತೆ ಕಡಿಮೆ ಇರುವುದರಿಂದ ರಾಗಿ ಮತ್ತು ಬೇಳೆಕಾಳುಗಳಂತಹ ಕಡಿಮೆ ನೀರಿನ ಬೆಳೆಗಳಿಗೆ ಆದ್ಯತೆ ನೀಡಿ."
        elif water_avail == "high":
            adv_en = f"District {district} during {season}: Ample water availability allows intensive vegetable and cereal cultivation with scheduled drainage."
            adv_kn = f"{district} ಜಿಲ್ಲೆಯಲ್ಲಿ {season} ಹಂಗಾಮಿಗೆ: ಹೇರಳ ನೀರಿನ ಲಭ್ಯತೆ ಇರುವುದರಿಂದ ತರಕಾರಿ ಹಾಗೂ ಭತ್ತ/ಮೆಕ್ಕೆಜೋಳ ಬೆಳೆಗಳಿಗೆ ಸೂಕ್ತ ಕಾಲಾವಕಾಶವಿದೆ."
        else:
            adv_en = f"District {district} during {season}: Moderate water availability supports standard rotation of pulses, cereals and hardy vegetables."
            adv_kn = f"{district} ಜಿಲ್ಲೆಯಲ್ಲಿ {season} ಹಂಗಾಮಿಗೆ: ಮಧ್ಯಮ ನೀರಿನ ಲಭ್ಯತೆಯು ದ್ವಿದಳ ಧಾನ್ಯಗಳು, ಸಿರಿಧಾನ್ಯಗಳು ಮತ್ತು ತರಕಾರಿಗಳ ಸಮತೋಲಿತ ಕೃಷಿಗೆ ಪೂರಕವಾಗಿದೆ."

        rec_id = f"rec_{uuid.uuid4().hex[:10]}"
        now_iso = datetime.now().isoformat()

        response = CropRecommendationResponse(
            recommendation_id=rec_id,
            land_profile_id=land_profile_id,
            district=district,
            season=season,
            recommendations=scored_crops,
            top_recommendation=top_rec,
            water_advisory_summary_en=adv_en,
            water_advisory_summary_kn=adv_kn,
            scoring_weights_version="v1.2-agronomic-demo",
            dataset_version="UAS-Bangalore-Karnataka-v2024",
            data_source="synthetic_agronomic_engine",
            is_demo=True,
            generated_at=now_iso,
        )

        # Persist recommendation history in database
        cls._persist_recommendation_history(rec_id, land_profile_id, user_id, district, season, response, climate_summary)

        return response

    @classmethod
    def _evaluate_single_crop(
        cls,
        crop: Dict[str, Any],
        profile: LandProfileCreateRequest,
        season: str,
        baseline: Any,
        seasonal: Any,
        forecast: Any,
        all_prices: List[Any]
    ) -> CropRecommendationItem:
        # A. Soil Score (25%)
        soil_score, soil_conf, soil_reasons_en, soil_reasons_kn, amendment = (
            SoilSuitabilityService.evaluate_soil_compatibility(profile, crop)
        )

        # B. Climate & Temperature Match (25%)
        # Compare crop min/max temp with seasonal & forecast temps
        min_temp = crop.get("min_temp_c", 15.0)
        max_temp = crop.get("max_temp_c", 35.0)
        opt_min_temp = crop.get("optimal_min_temp_c", 20.0)
        opt_max_temp = crop.get("optimal_max_temp_c", 30.0)

        # Get average forecast temp
        avg_forecast_max = sum(p.max_temp_c for p in forecast.forecast_points) / len(forecast.forecast_points)
        avg_forecast_min = sum(p.min_temp_c for p in forecast.forecast_points) / len(forecast.forecast_points)

        climate_score = 80.0
        climate_reasons_en = []
        climate_reasons_kn = []

        if opt_min_temp <= avg_forecast_min and avg_forecast_max <= opt_max_temp:
            climate_score = 98.0
            climate_reasons_en.append(f"Temperature window ({round(avg_forecast_min, 1)}°C - {round(avg_forecast_max, 1)}°C) matches optimal range.")
            climate_reasons_kn.append(f"ತಾಪಮಾನ ({round(avg_forecast_min, 1)}°C - {round(avg_forecast_max, 1)}°C) ಬೆಳವಣಿಗೆಗೆ ಅತ್ಯಂತ ಸೂಕ್ತವಾಗಿದೆ.")
        elif min_temp <= avg_forecast_min and avg_forecast_max <= max_temp:
            climate_score = 85.0
            climate_reasons_en.append(f"Regional climate is within acceptable thermal tolerance ({min_temp}°C - {max_temp}°C).")
            climate_reasons_kn.append(f"ಪ್ರಾದೇಶಿಕ ಉಷ್ಣಾಂಶವು ಸಹನೀಯ ಮಿತಿಯಲ್ಲಿದೆ ({min_temp}°C - {max_temp}°C).")
        else:
            climate_score = 45.0
            climate_reasons_en.append(f"Thermal stress alert: forecast max {round(avg_forecast_max, 1)}°C exceeds ideal range.")
            climate_reasons_kn.append(f"ತಾಪಮಾನದ ಒತ್ತಡ: ಗರಿಷ್ಠ ತಾಪಮಾನ {round(avg_forecast_max, 1)}°C ಬೆಳೆಗೆ ಸವಾಲಾಗಿರಬಹುದು.")

        # C. Water Availability Match (20%)
        water_req = crop.get("water_requirement_category", "Medium").lower()
        farm_water = profile.water_availability.lower()
        farm_source = profile.water_source.lower()

        water_score = 75.0
        water_reasons_en = []
        water_reasons_kn = []

        if water_req == "low":
            if farm_water in ["low", "medium", "high"]:
                water_score = 96.0
                water_reasons_en.append("Low water requirement fits farm water availability comfortably.")
                water_reasons_kn.append("ಕಡಿಮೆ ನೀರಿನ ಅಗತ್ಯವಿರುವುದರಿಂದ ಜಮೀನಿನ ನೀರಾವರಿಗೆ ಹೊಂದಿಕೆಯಾಗುತ್ತದೆ.")
        elif water_req == "medium":
            if farm_water in ["medium", "high"]:
                water_score = 90.0
                water_reasons_en.append("Medium water demand aligns well with available water sources.")
                water_reasons_kn.append("ಮಧ್ಯಮ ನೀರಿನ ಅಗತ್ಯವು ಲಭ್ಯವಿರುವ ನೀರಾವರಿ ಮೂಲಗಳಿಗೆ ಸರಿಹೊಂದುತ್ತದೆ.")
            else:
                water_score = 50.0
                water_reasons_en.append("Medium water demand poses stress under low water availability.")
                water_reasons_kn.append("ಕಡಿಮೆ ನೀರಿನ ಲಭ್ಯತೆಯಲ್ಲಿ ನೀರಿನ ಕೊರತೆಯಾಗಬಹುದು.")
        else:  # High water requirement (e.g. Paddy, Tomato)
            if farm_water == "high" or any(src in farm_source for src in ["canal", "drip", "borewell"]):
                water_score = 92.0
                water_reasons_en.append("High water demand supported by secure irrigation source.")
                water_reasons_kn.append("ಖಾತರಿಯಾದ ನೀರಾವರಿ ಮೂಲ ಇರುವುದರಿಂದ ಅಧಿಕ ನೀರಿನ ಬೆಳೆ ಸೂಕ್ತವಾಗಿದೆ.")
            else:
                water_score = 35.0
                water_reasons_en.append("High water demand is high-risk under rainfed or low-water conditions.")
                water_reasons_kn.append("ಮಳೆಯಾಶ್ರಿತ ಅಥವಾ ಕಡಿಮೆ ನೀರಿನಲ್ಲಿ ಅಧಿಕ ನೀರಿನ ಬೆಳೆ ಬೆಳೆಯುವುದು ಅಪಾಯಕಾರಿ.")

        # D. Season & Sowing Window Match (15%)
        growing_seasons = crop.get("growing_seasons", [])
        season_score = 95.0 if season in growing_seasons else 30.0

        if season in growing_seasons:
            sowing_window = crop.get("sowing_windows", {}).get(season, f"Standard {season} window")
            season_reasons_en = [f"Recommended for {season} season (Sowing: {sowing_window})."]
            season_reasons_kn = [f"{season} ಹಂಗಾಮಿಗೆ ಸೂಕ್ತ (ಬಿತ್ತನೆ ಸಮಯ: {sowing_window})."]
        else:
            sowing_window = f"Off-season for {season}"
            season_reasons_en = [f"Crop is not typically sown in {season}; unseasonal planting carries high risk."]
            season_reasons_kn = [f"{season} ಹಂಗಾಮಿನಲ್ಲಿ ಈ ಬೆಳೆ ಬಿತ್ತನೆ ಅಪ್ರಸ್ತುತ; ಇಳುವರಿ ಕಡಿಮೆಯಾಗಬಹುದು."]

        # E. Crop Duration & Land Type (10%)
        duration_score = 85.0
        suitable_lands = crop.get("suitable_land_types", [])
        if any(profile.land_type.lower() in l.lower() for l in suitable_lands):
            duration_score = 95.0

        # F. Farmer Preferences (5%)
        pref_score = 75.0
        if profile.preferred_categories and crop.get("category") in profile.preferred_categories:
            pref_score = 100.0

        # Overall Weighted Score
        overall = (
            (soil_score * 0.25) +
            (climate_score * 0.25) +
            (water_score * 0.20) +
            (season_score * 0.15) +
            (duration_score * 0.10) +
            (pref_score * 0.05)
        )
        overall = round(max(5.0, min(99.0, overall)), 1)

        # Confidence calculation
        input_confidence = soil_conf
        if not profile.taluk or not profile.village:
            input_confidence *= 0.95
        if not profile.budget_inr:
            input_confidence *= 0.98
        confidence_score = round(max(35.0, min(98.0, input_confidence)), 1)

        # Suitability Tier
        if overall >= 85.0:
            tier = "Best Match"
        elif overall >= 72.0:
            tier = "Strong Match"
        elif overall >= 55.0:
            tier = "Moderate Match"
        else:
            tier = "Conditional"

        # Why recommended combining factors
        why_en = [crop.get("advantages_en", "Agronomically suitable.")] + soil_reasons_en + climate_reasons_en + water_reasons_en
        why_kn = [crop.get("advantages_kn", "ಕೃಷಿಗೆ ಸೂಕ್ತವಾಗಿದೆ.")] + soil_reasons_kn + climate_reasons_kn + water_reasons_kn

        # Risk assessments
        identified_risks_en = [crop.get("risks_en", "Standard weather and market risks apply.")]
        identified_risks_kn = [crop.get("risks_kn", "ಸಾಮಾನ್ಯ ಹವಾಮಾನ ಮತ್ತು ಮಾರುಕಟ್ಟೆ ಅಪಾಯಗಳು ಅನ್ವಯಿಸುತ್ತವೆ.")]

        detailed_risks: List[RiskAssessment] = []
        if seasonal.drought_risk_level != "Low" and water_req in ["medium", "high"]:
            detailed_risks.append(
                RiskAssessment(
                    risk_type="Drought & Water Stress",
                    risk_level=seasonal.drought_risk_level,
                    reason_en="Seasonal rainfall projection is below normal with dry spell risk.",
                    reason_kn="ಋತುಮಾನದ ಮಳೆ ಕೊರತೆ ಮತ್ತು ಒಣ ಹವೆಯ ಅಪಾಯವಿದೆ.",
                    mitigation_en="Adopt micro-irrigation (drip), field mulching, and anti-transpirant sprays.",
                    mitigation_kn="ಹನಿ ನೀರಾವರಿ, ಮಣ್ಣಿಗೆ ಹೊದಿಕೆ (mulching) ಮತ್ತು ತೇವಾಂಶ ಸಂರಕ್ಷಣಾ ಕ್ರಮಗಳನ್ನು ಅಳವಡಿಸಿ.",
                )
            )

        if forecast.forecast_points and any(p.heat_stress_risk == "High" for p in forecast.forecast_points):
            detailed_risks.append(
                RiskAssessment(
                    risk_type="Heat Stress",
                    risk_level="Moderate",
                    reason_en="Peak temperatures may exceed optimal vegetative growth threshold.",
                    reason_kn="ಗರಿಷ್ಠ ತಾಪಮಾನವು ಸಸ್ಯದ ಬೆಳವಣಿಗೆಯ ಮಿತಿಯನ್ನು ಮೀರಬಹುದು.",
                    mitigation_en="Ensure light evening irrigation; maintain organic canopy cover.",
                    mitigation_kn="ಸಂಜೆ ವೇಳೆ ಲಘು ನೀರಾವರಿ ನೀಡಿ; ಸಾವಯವ ಹೊದಿಕೆ ನಿರ್ವಹಿಸಿ.",
                )
            )

        # Find current mandi modal price if available
        crop_clean = crop.get("name_en", "").split("(")[0].strip()
        matching_prices = [p for p in all_prices if crop_clean.lower() in p.crop_name.lower() or p.crop_name.lower() in crop_clean.lower()]
        current_modal_price = matching_prices[0].modal_price if matching_prices else None

        # Build Crop Calendar
        growth_stages = crop.get("growth_stages", {
            "germination_days": 7,
            "vegetative_days": 40,
            "flowering_days": 35,
            "maturity_days": 25,
        })
        start_date = datetime.now()
        d1 = growth_stages.get("germination_days", 7)
        d2 = growth_stages.get("vegetative_days", 40)
        d3 = growth_stages.get("flowering_days", 35)
        d4 = growth_stages.get("maturity_days", 25)

        calendar = CropCalendarTimeline(
            crop_id=crop.get("crop_id"),
            crop_name_en=crop.get("name_en"),
            crop_name_kn=crop.get("name_kn"),
            sowing_window=sowing_window,
            estimated_harvest_window=f"{(start_date + timedelta(days=d1+d2+d3+d4)).strftime('%B %d, %Y')}",
            stages=[
                CropCalendarStage(
                    stage_name_en="Sowing & Germination",
                    stage_name_kn="ಬಿತ್ತನೆ ಮತ್ತು ಮೊಳಕೆಯೊಡೆಯುವಿಕೆ",
                    duration_days=d1,
                    approximate_dates=f"Day 1 to Day {d1}",
                    key_tasks_en="Seed treatment with bio-fertilizers; shallow sowing with adequate seedbed moisture.",
                    key_tasks_kn="ಜೈವಿಕ ಗೊಬ್ಬರಗಳಿಂದ ಬೀಜೋಪಚಾರ; ಹದವಾದ ತೇವಾಂಶದಲ್ಲಿ ಹಗುರ ಬಿತ್ತನೆ.",
                ),
                CropCalendarStage(
                    stage_name_en="Vegetative Growth & Tillering",
                    stage_name_kn="ಸಸ್ಯ ಬೆಳವಣಿಗೆ ಮತ್ತು ಕವಲೊಡೆಯುವಿಕೆ",
                    duration_days=d2,
                    approximate_dates=f"Day {d1+1} to Day {d1+d2}",
                    key_tasks_en="First weeding at 20-25 days; top-dressing with nitrogen; intercultivation.",
                    key_tasks_kn="20-25 ದಿನಗಳಲ್ಲಿ ಮೊದಲ ಕಳೆ ಕೀಳುವುದು; ಮೇಲುಗೊಬ್ಬರ ಮತ್ತು ಎಡೆಕುಂಟೆ ಹೊಡೆಯುವುದು.",
                ),
                CropCalendarStage(
                    stage_name_en="Flowering & Pod / Grain Formation",
                    stage_name_kn="ಹೂವಾಡುವಿಕೆ ಮತ್ತು ಕಾಯಿ/ಕಾಳು ಕಟ್ಟುವುದು",
                    duration_days=d3,
                    approximate_dates=f"Day {d1+d2+1} to Day {d1+d2+d3}",
                    key_tasks_en="Critical moisture stage; ensure irrigation; monitor for borers and fungal spot.",
                    key_tasks_kn="ನೀರಿನ ನಿರ್ಣಾಯಕ ಹಂತ; ತೇವಾಂಶ ಕಾಪಾಡಿ; ಕೀಟ ಮತ್ತು ರೋಗ ಬಾಧೆಗಳನ್ನು ನಿಯಂತ್ರಿಸಿ.",
                ),
                CropCalendarStage(
                    stage_name_en="Maturity & Harvesting",
                    stage_name_kn="ಪಕ್ವತೆ ಮತ್ತು ಕೊಯ್ಲು",
                    duration_days=d4,
                    approximate_dates=f"Day {d1+d2+d3+1} to Day {d1+d2+d3+d4}",
                    key_tasks_en="Cease irrigation 7-10 days before harvest; harvest on clear sunny day.",
                    key_tasks_kn="ಕೊಯ್ಲಿಗೆ 7-10 ದಿನ ಮೊದಲು ನೀರು ನಿಲ್ಲಿಸಿ; ಬಿಸಿಲಿನ ದಿನದಲ್ಲಿ ಕೊಯ್ಲು ಮಾಡಿ ಒಣಗಿಸಿ.",
                ),
            ]
        )

        return CropRecommendationItem(
            rank=1,
            crop_id=crop.get("crop_id"),
            crop_name_en=crop.get("name_en"),
            crop_name_kn=crop.get("name_kn"),
            category=crop.get("category", "General"),
            suitability_tier=tier,
            scores=CropSuitabilityScores(
                overall_suitability_score=overall,
                soil_score=soil_score,
                climate_score=climate_score,
                water_score=water_score,
                season_score=season_score,
                confidence_score=confidence_score,
            ),
            estimated_duration_days=f"{crop.get('duration_days_min', 90)} - {crop.get('duration_days_max', 120)} days",
            water_requirement_category=crop.get("water_requirement_category", "Medium"),
            sowing_period=sowing_window,
            why_recommended_en=why_en[:4],
            why_recommended_kn=why_kn[:4],
            identified_risks_en=identified_risks_en,
            identified_risks_kn=identified_risks_kn,
            detailed_risks=detailed_risks,
            soil_amendment_advice=amendment,
            current_mandi_modal_price=current_modal_price,
            calendar=calendar,
        )

    @classmethod
    def _persist_recommendation_history(
        cls,
        rec_id: str,
        land_profile_id: str,
        user_id: Optional[str],
        district: str,
        season: str,
        response: CropRecommendationResponse,
        climate: Any
    ):
        try:
            conn = get_db_connection()
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO crop_recommendations_history (
                    id, land_profile_id, user_id, district, season,
                    recommendations_json, climate_summary_json,
                    scoring_weights_version, dataset_version, is_demo, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
                """,
                (
                    rec_id, land_profile_id, user_id, district, season,
                    response.model_dump_json(),
                    climate.model_dump_json(),
                    response.scoring_weights_version,
                    response.dataset_version,
                    response.generated_at
                )
            )
            conn.commit()
            conn.close()
        except Exception as e:
            # Non-blocking persistence
            pass

    @classmethod
    def get_recommendation_by_id(cls, rec_id: str) -> Optional[CropRecommendationResponse]:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT recommendations_json FROM crop_recommendations_history WHERE id = ?", (rec_id,))
        row = cursor.fetchone()
        conn.close()

        if not row:
            return None

        try:
            data = json.loads(row["recommendations_json"])
            return CropRecommendationResponse(**data)
        except Exception:
            return None

