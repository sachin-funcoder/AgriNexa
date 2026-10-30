"""Pydantic schemas for Farmer Land & Soil Profile Management (Task 9)."""

from typing import List, Optional
from pydantic import BaseModel, Field


class LandProfileCreateRequest(BaseModel):
    farm_name: Optional[str] = Field("My Farm", description="Optional farm name / parcel label")
    state: str = Field("Karnataka", description="State name (extensible across India)")
    district: str = Field(..., description="District (e.g. Kolar, Bengaluru, Mandya, Hassan)")
    taluk: Optional[str] = Field(None, description="Taluk / Tehsil")
    village: Optional[str] = Field(None, description="Village name")
    latitude: Optional[float] = Field(None, description="Optional GPS latitude")
    longitude: Optional[float] = Field(None, description="Optional GPS longitude")
    
    # Land properties
    total_area: float = Field(..., gt=0, description="Total land area")
    area_unit: str = Field("acres", description="'acres', 'hectares', or 'guntas'")
    land_type: str = Field(..., description="'Dryland', 'Irrigated land', 'Rainfed land', 'Wetland', 'Mixed farming land'")
    
    # Soil properties
    soil_type: str = Field(..., description="'Red soil', 'Black soil', 'Alluvial soil', 'Laterite soil', 'Sandy soil', 'Clay soil', 'Loamy soil', 'Silty soil', 'Other', 'Unknown / Not tested'")
    soil_ph: Optional[float] = Field(None, ge=3.0, le=11.0, description="Optional measured soil pH (e.g. 6.5)")
    electrical_conductivity: Optional[float] = Field(None, ge=0, description="Optional EC in dS/m")
    nitrogen_level: Optional[str] = Field("Unknown", description="'Low', 'Medium', 'High', 'Unknown'")
    phosphorus_level: Optional[str] = Field("Unknown", description="'Low', 'Medium', 'High', 'Unknown'")
    potassium_level: Optional[str] = Field("Unknown", description="'Low', 'Medium', 'High', 'Unknown'")
    organic_carbon: Optional[float] = Field(None, ge=0, le=5.0, description="Organic Carbon percentage (OC %)")
    soil_texture: Optional[str] = Field(None, description="e.g. 'Sandy clay loam', 'Fine silt'")
    drainage_capacity: Optional[str] = Field("Good", description="'Poor', 'Moderate', 'Good', 'Excessive', 'Unknown'")
    
    # Water & Irrigation
    water_source: str = Field(..., description="'Rainfed only', 'Borewell', 'Open well', 'Canal irrigation', 'Drip irrigation', 'Sprinkler irrigation', 'Other'")
    water_availability: str = Field(..., description="'low', 'medium', 'high'")
    irrigation_frequency: Optional[str] = Field(None, description="e.g. 'Daily', 'Alternate days', 'Weekly'")
    
    # Cultivation & Farmer Preferences
    preferred_categories: Optional[List[str]] = Field(default_factory=list, description="e.g. ['Cereal / Millet', 'Vegetable', 'Pulse']")
    preferred_duration: Optional[str] = Field(None, description="'Short (<90 days)', 'Medium (90-130 days)', 'Long (>130 days)'")
    crop_purpose: Optional[str] = Field("mixed", description="'food', 'commercial', 'mixed'")
    risk_preference: str = Field("balanced", description="'conservative', 'balanced', 'growth'")
    budget_inr: Optional[float] = Field(None, ge=0, description="Available cultivation budget in INR")
    preferred_sowing_season: Optional[str] = Field("Kharif", description="'Kharif', 'Rabi', 'Summer'")


class LandProfileResponse(BaseModel):
    id: str
    user_id: Optional[str] = None
    farm_name: str
    state: str
    district: str
    taluk: Optional[str] = None
    village: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    total_area: float
    area_unit: str
    land_type: str
    soil_type: str
    soil_ph: Optional[float] = None
    electrical_conductivity: Optional[float] = None
    nitrogen_level: Optional[str] = "Unknown"
    phosphorus_level: Optional[str] = "Unknown"
    potassium_level: Optional[str] = "Unknown"
    organic_carbon: Optional[float] = None
    soil_texture: Optional[str] = None
    drainage_capacity: Optional[str] = "Good"
    water_source: str
    water_availability: str
    irrigation_frequency: Optional[str] = None
    preferred_categories: List[str] = []
    preferred_duration: Optional[str] = None
    crop_purpose: Optional[str] = "mixed"
    risk_preference: str = "balanced"
    budget_inr: Optional[float] = None
    preferred_sowing_season: Optional[str] = "Kharif"
    is_demo: bool = True
    created_at: str
    updated_at: str

