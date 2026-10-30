"""Land Profile Service (Task 9).
Manages farmer land parcels, soil test parameters, and irrigation profile persistence.
"""

import json
import uuid
from datetime import datetime
from typing import Optional, List
from app.db.database import get_db_connection
from app.schemas.soil import LandProfileCreateRequest, LandProfileResponse


class LandProfileService:
    """CRUD operations for farmer land profiles with farmer isolation."""

    @staticmethod
    def create_or_update_profile(
        req: LandProfileCreateRequest,
        user_id: Optional[str] = None
    ) -> LandProfileResponse:
        conn = get_db_connection()
        cursor = conn.cursor()
        now = datetime.now().isoformat()

        # Check if user already has an existing land profile to update
        existing_id = None
        if user_id:
            cursor.execute("SELECT id FROM land_profiles WHERE user_id = ? LIMIT 1", (user_id,))
            row = cursor.fetchone()
            if row:
                existing_id = row["id"]

        profile_id = existing_id or f"land_{uuid.uuid4().hex[:10]}"
        categories_json = json.dumps(req.preferred_categories or [])

        if existing_id:
            cursor.execute(
                """
                UPDATE land_profiles SET
                    farm_name = ?, state = ?, district = ?, taluk = ?, village = ?,
                    latitude = ?, longitude = ?, total_area = ?, area_unit = ?,
                    land_type = ?, soil_type = ?, soil_ph = ?, electrical_conductivity = ?,
                    nitrogen_level = ?, phosphorus_level = ?, potassium_level = ?,
                    organic_carbon = ?, soil_texture = ?, drainage_capacity = ?,
                    water_source = ?, water_availability = ?, irrigation_frequency = ?,
                    preferred_categories = ?, preferred_duration = ?, crop_purpose = ?,
                    risk_preference = ?, budget_inr = ?, preferred_sowing_season = ?,
                    updated_at = ?
                WHERE id = ?
                """,
                (
                    req.farm_name, req.state, req.district, req.taluk, req.village,
                    req.latitude, req.longitude, req.total_area, req.area_unit,
                    req.land_type, req.soil_type, req.soil_ph, req.electrical_conductivity,
                    req.nitrogen_level, req.phosphorus_level, req.potassium_level,
                    req.organic_carbon, req.soil_texture, req.drainage_capacity,
                    req.water_source, req.water_availability, req.irrigation_frequency,
                    categories_json, req.preferred_duration, req.crop_purpose,
                    req.risk_preference, req.budget_inr, req.preferred_sowing_season,
                    now, profile_id
                )
            )
        else:
            cursor.execute(
                """
                INSERT INTO land_profiles (
                    id, user_id, farm_name, state, district, taluk, village,
                    latitude, longitude, total_area, area_unit, land_type, soil_type,
                    soil_ph, electrical_conductivity, nitrogen_level, phosphorus_level,
                    potassium_level, organic_carbon, soil_texture, drainage_capacity,
                    water_source, water_availability, irrigation_frequency,
                    preferred_categories, preferred_duration, crop_purpose,
                    risk_preference, budget_inr, preferred_sowing_season,
                    is_demo, created_at, updated_at
                ) VALUES (
                    ?, ?, ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?, ?,
                    ?, ?, ?, ?,
                    ?, ?, ?, ?,
                    ?, ?, ?,
                    ?, ?, ?,
                    ?, ?, ?,
                    1, ?, ?
                )
                """,
                (
                    profile_id, user_id, req.farm_name, req.state, req.district, req.taluk, req.village,
                    req.latitude, req.longitude, req.total_area, req.area_unit, req.land_type, req.soil_type,
                    req.soil_ph, req.electrical_conductivity, req.nitrogen_level, req.phosphorus_level,
                    req.potassium_level, req.organic_carbon, req.soil_texture, req.drainage_capacity,
                    req.water_source, req.water_availability, req.irrigation_frequency,
                    categories_json, req.preferred_duration, req.crop_purpose,
                    req.risk_preference, req.budget_inr, req.preferred_sowing_season,
                    now, now
                )
            )

        conn.commit()
        conn.close()

        return LandProfileService.get_profile_by_id(profile_id)

    @staticmethod
    def get_profile_by_id(profile_id: str, user_id: Optional[str] = None) -> Optional[LandProfileResponse]:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        if user_id:
            cursor.execute("SELECT * FROM land_profiles WHERE id = ? AND user_id = ?", (profile_id, user_id))
        else:
            cursor.execute("SELECT * FROM land_profiles WHERE id = ?", (profile_id,))
            
        row = cursor.fetchone()
        conn.close()

        if not row:
            return None

        return LandProfileService._row_to_model(row)

    @staticmethod
    def get_profile_for_user(user_id: str) -> Optional[LandProfileResponse]:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM land_profiles WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1", (user_id,))
        row = cursor.fetchone()
        conn.close()

        if not row:
            return None

        return LandProfileService._row_to_model(row)

    @staticmethod
    def _row_to_model(row) -> LandProfileResponse:
        cats = []
        if row["preferred_categories"]:
            try:
                cats = json.loads(row["preferred_categories"])
            except Exception:
                cats = []

        return LandProfileResponse(
            id=row["id"],
            user_id=row["user_id"],
            farm_name=row["farm_name"] or "My Farm",
            state=row["state"],
            district=row["district"],
            taluk=row["taluk"],
            village=row["village"],
            latitude=row["latitude"],
            longitude=row["longitude"],
            total_area=row["total_area"],
            area_unit=row["area_unit"],
            land_type=row["land_type"],
            soil_type=row["soil_type"],
            soil_ph=row["soil_ph"],
            electrical_conductivity=row["electrical_conductivity"],
            nitrogen_level=row["nitrogen_level"] or "Unknown",
            phosphorus_level=row["phosphorus_level"] or "Unknown",
            potassium_level=row["potassium_level"] or "Unknown",
            organic_carbon=row["organic_carbon"],
            soil_texture=row["soil_texture"],
            drainage_capacity=row["drainage_capacity"] or "Good",
            water_source=row["water_source"],
            water_availability=row["water_availability"],
            irrigation_frequency=row["irrigation_frequency"],
            preferred_categories=cats,
            preferred_duration=row["preferred_duration"],
            crop_purpose=row["crop_purpose"] or "mixed",
            risk_preference=row["risk_preference"] or "balanced",
            budget_inr=row["budget_inr"],
            preferred_sowing_season=row["preferred_sowing_season"] or "Kharif",
            is_demo=bool(row["is_demo"]),
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )

