"""Soil Suitability Service (Task 9).
Evaluates farmer soil parameters against crop agronomic specifications and generates
actionable soil amendment recommendations.
"""

from typing import Dict, Any, Tuple, List, Optional
from app.schemas.soil import LandProfileCreateRequest


class SoilSuitabilityService:
    """Evaluates soil compatibility and formulates agronomic amendment recommendations."""

    @staticmethod
    def evaluate_soil_compatibility(
        profile: LandProfileCreateRequest,
        crop: Dict[str, Any]
    ) -> Tuple[float, float, List[str], List[str], Optional[str]]:
        """
        Calculates:
        - soil_score (0 - 100)
        - confidence_penalty_factor (0.0 to 1.0)
        - why_reasons_en
        - why_reasons_kn
        - amendment_advice
        """
        soil_type = (profile.soil_type or "").strip()
        suitable_soils = crop.get("suitable_soil_types", [])
        
        # 1. Soil Type Match
        if soil_type.lower() in ["unknown / not tested", "unknown", "other"]:
            soil_type_score = 65.0
            confidence_soil = 0.5  # Heavy penalty for unmeasured soil
            reasons_en = [f"Soil type '{soil_type}' is unconfirmed; preliminary suitability assumed based on district average."]
            reasons_kn = [f"ಮಣ್ಣಿನ ಪ್ರಕಾರ '{soil_type}' ದೃಢಪಟ್ಟಿಲ್ಲ; ಜಿಲ್ಲೆಯ ಸರಾಸರಿಯ ಆಧಾರದ ಮೇಲೆ ಅಂದಾಜು ಮಾಡಲಾಗಿದೆ."]
        elif any(soil_type.lower() in s.lower() or s.lower() in soil_type.lower() for s in suitable_soils):
            soil_type_score = 95.0
            confidence_soil = 1.0
            reasons_en = [f"Field soil type ({soil_type}) is highly compatible with {crop.get('name_en')}."]
            reasons_kn = [f"ಜಮೀನಿನ {soil_type} ಮಣ್ಣು {crop.get('name_kn')} ಬೆಳೆಗೆ ಅತ್ಯಂತ ಸೂಕ್ತವಾಗಿದೆ."]
        else:
            soil_type_score = 45.0
            confidence_soil = 0.8
            reasons_en = [f"Field soil ({soil_type}) is sub-optimal; requires soil conditioning for {crop.get('name_en')}."]
            reasons_kn = [f"{soil_type} ಮಣ್ಣು ಈ ಬೆಳೆಗೆ ಕಡಿಮೆ ಹೊಂದಾಣಿಕೆಯಾಗುತ್ತದೆ; ಮಣ್ಣು ಸುಧಾರಣೆ ಅಗತ್ಯವಿದೆ."]

        # 2. pH Evaluation
        ph = profile.soil_ph
        ph_score = 75.0
        confidence_ph = 1.0
        amendment = crop.get("soil_amendment_advice")

        if ph is not None:
            min_ph = crop.get("min_ph", 5.5)
            max_ph = crop.get("max_ph", 8.0)
            opt_min = crop.get("optimal_ph_min", 6.2)
            opt_max = crop.get("optimal_ph_max", 7.2)

            if opt_min <= ph <= opt_max:
                ph_score = 100.0
                reasons_en.append(f"Soil pH ({ph}) is in the optimal range ({opt_min} - {opt_max}).")
                reasons_kn.append(f"ಮಣ್ಣಿನ pH ({ph}) ಸೂಕ್ತ ವ್ಯಾಪ್ತಿಯಲ್ಲಿದೆ ({opt_min} - {opt_max}).")
            elif min_ph <= ph <= max_ph:
                ph_score = 80.0
                reasons_en.append(f"Soil pH ({ph}) is tolerable ({min_ph} - {max_ph}).")
                reasons_kn.append(f"ಮಣ್ಣಿನ pH ({ph}) ಸಹನೀಯ ಮಟ್ಟದಲ್ಲಿದೆ ({min_ph} - {max_ph}).")
            else:
                ph_score = 35.0
                reasons_en.append(f"Soil pH ({ph}) is outside ideal limits ({min_ph} - {max_ph}).")
                reasons_kn.append(f"ಮಣ್ಣಿನ pH ({ph}) ಸೂಕ್ತ ಮಿತಿಯಿಂದ ಹೊರಗಿದೆ ({min_ph} - {max_ph}).")
                if ph < min_ph:
                    amendment = (amendment or "") + f" Acidic soil (pH {ph}): apply agricultural lime or dolomite @ 250-400 kg/acre."
                else:
                    amendment = (amendment or "") + f" Alkaline / sodic soil (pH {ph}): apply agricultural gypsum @ 300-500 kg/acre."
        else:
            # Soil pH not provided
            ph_score = 70.0
            confidence_ph = 0.6  # Penalty for unmeasured pH
            reasons_en.append("Soil pH not tested; neutral pH assumed. Soil testing recommended.")
            reasons_kn.append("ಮಣ್ಣಿನ pH ಪರೀಕ್ಷಿಸಲಾಗಿಲ್ಲ; ಸಾಮಾನ್ಯ pH ಊಹಿಸಲಾಗಿದೆ. ಮಣ್ಣು ಪರೀಕ್ಷೆ ಶಿಫಾರಸು ಮಾಡಲಾಗಿದೆ.")

        # 3. Drainage Check
        drainage = (profile.drainage_capacity or "Good").capitalize()
        req_drainage = crop.get("drainage_requirement", ["Good", "Moderate"])
        if drainage in req_drainage:
            drainage_score = 95.0
        elif drainage == "Poor" and "Poor" not in req_drainage:
            drainage_score = 30.0
            reasons_en.append("Poor field drainage poses waterlogging risk for this crop.")
            reasons_kn.append("ಕಳಪೆ ಚರಂಡಿ ವ್ಯವಸ್ಥೆಯು ನೀರು ನಿಲ್ಲುವ ಅಪಾಯವನ್ನುಂಟುಮಾಡುತ್ತದೆ.")
        else:
            drainage_score = 75.0

        # Weighted composite soil score
        final_soil_score = round((soil_type_score * 0.50) + (ph_score * 0.35) + (drainage_score * 0.15), 1)
        final_confidence = round(confidence_soil * confidence_ph * 100.0, 1)

        return final_soil_score, final_confidence, reasons_en, reasons_kn, amendment

