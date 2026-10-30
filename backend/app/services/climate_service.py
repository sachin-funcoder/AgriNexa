"""Climate Intelligence Service (Task 9).
Provides short-range weather forecasts, seasonal climate outlooks, and historical 30-year climatological baselines
for Karnataka districts. Clearly separated and transparently marked as synthetic/demo benchmarks.
"""

from datetime import datetime, timedelta
import random
from typing import Dict, Any, List, Optional
from app.schemas.climate import (
    DailyWeatherPoint,
    WeatherForecastResponse,
    SeasonalClimateOutlook,
    HistoricalClimateProfile,
    CompleteClimateSummary,
)

# Climatological baseline database for Karnataka districts (derived from IMD 1991-2020 normals)
DISTRICT_CLIMATE_BASELINES: Dict[str, Dict[str, Any]] = {
    "Kolar": {
        "zone": "Eastern Dry Zone (Zone 5)",
        "annual_rainfall_mm": 744.0,
        "kharif_rainfall_mm": 395.0,
        "rabi_rainfall_mm": 242.0,
        "summer_rainfall_mm": 107.0,
        "summer_max_temp_c": 36.5,
        "winter_min_temp_c": 14.8,
        "monsoon_onset": "June 5 - June 10",
        "drought_vulnerability": "High",
    },
    "Bengaluru": {
        "zone": "Eastern Dry Zone (Zone 5)",
        "annual_rainfall_mm": 924.0,
        "kharif_rainfall_mm": 510.0,
        "rabi_rainfall_mm": 275.0,
        "summer_rainfall_mm": 139.0,
        "summer_max_temp_c": 34.8,
        "winter_min_temp_c": 15.5,
        "monsoon_onset": "June 4 - June 8",
        "drought_vulnerability": "Medium",
    },
    "Bengaluru Rural": {
        "zone": "Eastern Dry Zone (Zone 5)",
        "annual_rainfall_mm": 860.0,
        "kharif_rainfall_mm": 480.0,
        "rabi_rainfall_mm": 250.0,
        "summer_rainfall_mm": 130.0,
        "summer_max_temp_c": 35.2,
        "winter_min_temp_c": 15.0,
        "monsoon_onset": "June 5 - June 9",
        "drought_vulnerability": "Medium",
    },
    "Mandya": {
        "zone": "Southern Dry Zone (Zone 6)",
        "annual_rainfall_mm": 691.0,
        "kharif_rainfall_mm": 355.0,
        "rabi_rainfall_mm": 245.0,
        "summer_rainfall_mm": 91.0,
        "summer_max_temp_c": 36.2,
        "winter_min_temp_c": 16.0,
        "monsoon_onset": "June 6 - June 11",
        "drought_vulnerability": "Medium",
    },
    "Hassan": {
        "zone": "Southern Transition Zone (Zone 7)",
        "annual_rainfall_mm": 1030.0,
        "kharif_rainfall_mm": 680.0,
        "rabi_rainfall_mm": 210.0,
        "summer_rainfall_mm": 140.0,
        "summer_max_temp_c": 33.5,
        "winter_min_temp_c": 13.8,
        "monsoon_onset": "June 2 - June 6",
        "drought_vulnerability": "Low",
    },
    "Davanagere": {
        "zone": "Central Dry Zone (Zone 4)",
        "annual_rainfall_mm": 644.0,
        "kharif_rainfall_mm": 380.0,
        "rabi_rainfall_mm": 178.0,
        "summer_rainfall_mm": 86.0,
        "summer_max_temp_c": 38.2,
        "winter_min_temp_c": 16.8,
        "monsoon_onset": "June 8 - June 14",
        "drought_vulnerability": "High",
    },
    "Belagavi": {
        "zone": "Northern Transition Zone (Zone 8)",
        "annual_rainfall_mm": 808.0,
        "kharif_rainfall_mm": 540.0,
        "rabi_rainfall_mm": 165.0,
        "summer_rainfall_mm": 103.0,
        "summer_max_temp_c": 36.0,
        "winter_min_temp_c": 14.2,
        "monsoon_onset": "June 6 - June 10",
        "drought_vulnerability": "Medium",
    },
    "Dharwad": {
        "zone": "Northern Transition Zone (Zone 8)",
        "annual_rainfall_mm": 772.0,
        "kharif_rainfall_mm": 490.0,
        "rabi_rainfall_mm": 182.0,
        "summer_rainfall_mm": 100.0,
        "summer_max_temp_c": 37.0,
        "winter_min_temp_c": 14.5,
        "monsoon_onset": "June 6 - June 11",
        "drought_vulnerability": "Medium",
    },
    "Chikkaballapura": {
        "zone": "Eastern Dry Zone (Zone 5)",
        "annual_rainfall_mm": 738.0,
        "kharif_rainfall_mm": 410.0,
        "rabi_rainfall_mm": 230.0,
        "summer_rainfall_mm": 98.0,
        "summer_max_temp_c": 36.8,
        "winter_min_temp_c": 14.2,
        "monsoon_onset": "June 5 - June 10",
        "drought_vulnerability": "High",
    },
    "Tumakuru": {
        "zone": "Central Dry Zone (Zone 4)",
        "annual_rainfall_mm": 688.0,
        "kharif_rainfall_mm": 370.0,
        "rabi_rainfall_mm": 220.0,
        "summer_rainfall_mm": 98.0,
        "summer_max_temp_c": 37.0,
        "winter_min_temp_c": 15.2,
        "monsoon_onset": "June 6 - June 11",
        "drought_vulnerability": "High",
    },
    "Chitradurga": {
        "zone": "Central Dry Zone (Zone 4)",
        "annual_rainfall_mm": 573.0,
        "kharif_rainfall_mm": 320.0,
        "rabi_rainfall_mm": 170.0,
        "summer_rainfall_mm": 83.0,
        "summer_max_temp_c": 38.6,
        "winter_min_temp_c": 15.8,
        "monsoon_onset": "June 8 - June 13",
        "drought_vulnerability": "High",
    },
    "Raichur": {
        "zone": "North Eastern Dry Zone (Zone 2)",
        "annual_rainfall_mm": 621.0,
        "kharif_rainfall_mm": 410.0,
        "rabi_rainfall_mm": 140.0,
        "summer_rainfall_mm": 71.0,
        "summer_max_temp_c": 41.5,
        "winter_min_temp_c": 16.5,
        "monsoon_onset": "June 9 - June 15",
        "drought_vulnerability": "High",
    },
    "Kalaburagi": {
        "zone": "North Eastern Dry Zone (Zone 2)",
        "annual_rainfall_mm": 777.0,
        "kharif_rainfall_mm": 560.0,
        "rabi_rainfall_mm": 145.0,
        "summer_rainfall_mm": 72.0,
        "summer_max_temp_c": 42.0,
        "winter_min_temp_c": 16.0,
        "monsoon_onset": "June 8 - June 14",
        "drought_vulnerability": "High",
    },
    "Shivamogga": {
        "zone": "Southern Transition & Hilly Zone (Zone 7/9)",
        "annual_rainfall_mm": 1813.0,
        "kharif_rainfall_mm": 1480.0,
        "rabi_rainfall_mm": 190.0,
        "summer_rainfall_mm": 143.0,
        "summer_max_temp_c": 34.0,
        "winter_min_temp_c": 14.0,
        "monsoon_onset": "June 1 - June 5",
        "drought_vulnerability": "Low",
    },
}

DEFAULT_BASELINE = {
    "zone": "Karnataka Agro-Climatic Zone (General)",
    "annual_rainfall_mm": 780.0,
    "kharif_rainfall_mm": 460.0,
    "rabi_rainfall_mm": 210.0,
    "summer_rainfall_mm": 110.0,
    "summer_max_temp_c": 36.5,
    "winter_min_temp_c": 15.2,
    "monsoon_onset": "June 5 - June 12",
    "drought_vulnerability": "Medium",
}


class ClimateService:
    """Service handling weather forecasting, seasonal outlooks, and baseline climatology."""

    @staticmethod
    def get_historical_baseline(district: str) -> HistoricalClimateProfile:
        norm_district = district.strip().title()
        data = DISTRICT_CLIMATE_BASELINES.get(norm_district, DEFAULT_BASELINE)
        return HistoricalClimateProfile(
            district=norm_district,
            agro_climatic_zone=data["zone"],
            average_annual_rainfall_mm=data["annual_rainfall_mm"],
            kharif_rainfall_mm=data["kharif_rainfall_mm"],
            rabi_rainfall_mm=data["rabi_rainfall_mm"],
            summer_rainfall_mm=data["summer_rainfall_mm"],
            mean_max_summer_temp_c=data["summer_max_temp_c"],
            mean_min_winter_temp_c=data["winter_min_temp_c"],
            typical_monsoon_onset=data["monsoon_onset"],
            drought_vulnerability_index=data["drought_vulnerability"],
            baseline_period="1991-2020 IMD 30-Year Climatological Normals",
            data_source="synthetic_karnataka_climatology",
            is_demo=True,
        )

    @staticmethod
    def get_weather_forecast(district: str, days: int = 7) -> WeatherForecastResponse:
        norm_district = district.strip().title()
        baseline = DISTRICT_CLIMATE_BASELINES.get(norm_district, DEFAULT_BASELINE)
        now = datetime.now()
        
        # Seed pseudo-random generator with district name + day so it's deterministic within a single day
        day_seed = int(now.strftime("%Y%m%d")) + sum(ord(c) for c in norm_district)
        rng = random.Random(day_seed)
        
        forecast_points: List[DailyWeatherPoint] = []
        is_high_drought = baseline["drought_vulnerability"] == "High"
        
        conditions_pool = (
            ["Sunny", "Partly Cloudy", "Sunny", "Clear Sky", "Scattered Showers"]
            if is_high_drought
            else ["Partly Cloudy", "Scattered Showers", "Sunny", "Overcast", "Moderate Rain"]
        )
        
        total_forecast_rain = 0.0
        
        for i in range(days):
            point_date = (now + timedelta(days=i)).strftime("%Y-%m-%d")
            base_max = baseline["summer_max_temp_c"] - 4.0 + rng.uniform(-2.5, 2.5)
            base_min = baseline["winter_min_temp_c"] + 3.0 + rng.uniform(-1.5, 1.5)
            condition = rng.choice(conditions_pool)
            
            rain = 0.0
            if "Rain" in condition or "Showers" in condition:
                rain = round(rng.uniform(2.5, 24.0 if not is_high_drought else 12.0), 1)
            total_forecast_rain += rain
            
            humidity = round(rng.uniform(45.0, 85.0), 1)
            wind = round(rng.uniform(8.0, 22.0), 1)
            
            heat_stress = "High" if base_max > 36.5 else ("Moderate" if base_max > 32.0 else "Low")
            dry_spell = "High" if (is_high_drought and rain < 1.0) else "Low"
            
            forecast_points.append(
                DailyWeatherPoint(
                    date=point_date,
                    min_temp_c=round(base_min, 1),
                    max_temp_c=round(base_max, 1),
                    avg_temp_c=round((base_min + base_max) / 2.0, 1),
                    rainfall_mm=rain,
                    humidity_pct=humidity,
                    wind_speed_kmh=wind,
                    condition=condition,
                    heat_stress_risk=heat_stress,
                    dry_spell_risk=dry_spell,
                )
            )
            
        advisory = (
            f"Expected {round(total_forecast_rain, 1)} mm total precipitation over next {days} days in {norm_district}. "
            f"{'Adequate soil moisture for sowing operations.' if total_forecast_rain > 15 else 'Conserve field irrigation; light to moderate precipitation expected.'}"
        )
        
        return WeatherForecastResponse(
            location=f"{norm_district}, Karnataka",
            district=norm_district,
            forecast_horizon_days=days,
            forecast_points=forecast_points,
            summary_advisory=advisory,
            data_source="synthetic_imd_benchmark",
            is_demo=True,
            generated_at=now.isoformat(),
        )

    @staticmethod
    def get_seasonal_outlook(district: str, season: Optional[str] = "Kharif") -> SeasonalClimateOutlook:
        norm_district = district.strip().title()
        baseline = DISTRICT_CLIMATE_BASELINES.get(norm_district, DEFAULT_BASELINE)
        season_clean = season.strip().capitalize() if season else "Kharif"
        
        if season_clean not in ["Kharif", "Rabi", "Summer"]:
            season_clean = "Kharif"
            
        now = datetime.now()
        day_seed = int(now.strftime("%Y%m")) + sum(ord(c) for c in norm_district) + len(season_clean)
        rng = random.Random(day_seed)
        
        if season_clean == "Kharif":
            exp_rain = baseline["kharif_rainfall_mm"]
            period = f"June - October {now.year}"
        elif season_clean == "Rabi":
            exp_rain = baseline["rabi_rainfall_mm"]
            period = f"October {now.year} - January {now.year + 1}"
        else:
            exp_rain = baseline["summer_rainfall_mm"]
            period = f"February - May {now.year}"
            
        anomaly_pct = round(rng.uniform(-8.0, 9.0), 1)
        temp_anomaly_c = round(rng.uniform(0.1, 0.9), 2)
        
        if anomaly_pct > 5.0:
            cat = "Above Normal (Surplus)"
        elif anomaly_pct < -5.0:
            cat = "Below Normal (Deficit)"
        else:
            cat = "Normal"
            
        drought_risk = "Elevated" if (anomaly_pct < -5.0 and baseline["drought_vulnerability"] == "High") else ("Moderate" if anomaly_pct < 0 else "Low")
        heat_risk = "High" if (season_clean == "Summer" or baseline["summer_max_temp_c"] > 38.0) else "Moderate"
        
        adv_en = (
            f"Seasonal rainfall projected at {round(exp_rain * (1 + anomaly_pct/100), 1)} mm ({anomaly_pct:+}% vs long-term mean). "
            f"Recommended strategy: {'Adopt protective irrigation and mulching.' if drought_risk != 'Low' else 'Standard sowing schedule with proper field drainage.'}"
        )
        adv_kn = (
            f"ಋತುಮಾನ ಮಳೆ ಅಂದಾಜು {round(exp_rain * (1 + anomaly_pct/100), 1)} ಮಿಮೀ ({anomaly_pct:+}% ಸರಾಸರಿಗೆ ಹೋಲಿಸಿದರೆ). "
            f"ಶಿಫಾರಸು: {'ರಕ್ಷಣಾತ್ಮಕ ನೀರಾವರಿ ಮತ್ತು ಹೊದಿಕೆ (mulching) ಅಳವಡಿಸಿ.' if drought_risk != 'Low' else 'ಸೂಕ್ತ ಬಸಿದುಹೋಗುವ ಚರಂಡಿಯೊಂದಿಗೆ ನಿಗದಿತ ಬಿತ್ತನೆ ಮುಂದುವರಿಸಿ.'}"
        )
        
        return SeasonalClimateOutlook(
            location=f"{norm_district}, Karnataka",
            district=norm_district,
            season_name=season_clean,
            outlook_period=period,
            rainfall_category=cat,
            expected_seasonal_rainfall_mm=round(exp_rain * (1 + anomaly_pct/100), 1),
            rainfall_anomaly_pct=anomaly_pct,
            temperature_anomaly_c=temp_anomaly_c,
            monsoon_onset_forecast=baseline["monsoon_onset"],
            drought_risk_level=drought_risk,
            heatwave_risk_level=heat_risk,
            agronomic_advice_en=adv_en,
            agronomic_advice_kn=adv_kn,
            data_source="synthetic_imd_seasonal_model",
            is_demo=True,
            generated_at=now.isoformat(),
        )

    @classmethod
    def get_complete_climate_summary(cls, district: str, season: Optional[str] = "Kharif") -> CompleteClimateSummary:
        norm_district = district.strip().title()
        return CompleteClimateSummary(
            district=norm_district,
            short_range_forecast=cls.get_weather_forecast(norm_district, days=7),
            seasonal_outlook=cls.get_seasonal_outlook(norm_district, season=season),
            historical_baseline=cls.get_historical_baseline(norm_district),
            data_source="synthetic_hybrid_meteo",
            is_demo=True,
            generated_at=datetime.now().isoformat(),
        )

