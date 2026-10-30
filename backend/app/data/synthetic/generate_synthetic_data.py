"""
Synthetic Mandi Dataset Generator for AgriNexa Demonstration.

UPDATED SPECIFICATION:
- Mean-Reverting Autoregressive AR(1) daily time-series with stochastic innovations.
- Natural day-to-day price variation eliminating flat/clamped periods.
- Injected controlled demonstration anomalies (Tomato Kolar Spike, Onion Bengaluru Crash, Potato Mysuru Surge).
- Export of anomaly_events.json metadata catalog.
- Fixed random seed (42) for 100% reproducibility.

IMPORTANT NOTICE:
This script generates SYNTHETIC DEMONSTRATION DATA for development, testing,
and system validation. These figures are NOT actual market transactions and must
never be cited as authentic AGMARKNET, e-NAM, or government-verified statistics.
"""

import json
import math
import os
from datetime import datetime, timezone
import numpy as np
import pandas as pd

# Set fixed random seed for 100% reproducibility
RANDOM_SEED = 42
np.random.seed(RANDOM_SEED)

OUTPUT_DIR = os.path.dirname(os.path.abspath(__file__))

# ---------------------------------------------------------------------------
# 1. MANDIS METADATA (8 Karnataka Mandis)
# ---------------------------------------------------------------------------
MANDIS = [
    {
        "mandi_id": "mandi_bengaluru",
        "name": "Bengaluru (Yeshwanthpur APMC)",
        "district": "Bengaluru Urban",
        "state": "Karnataka",
        "latitude": 13.0238,
        "longitude": 77.5529,
        "facilities": ["Cold Storage", "Electronic Weighing", "Warehouse", "Testing Lab"],
        "market_fee_percent": 1.5,
        "handling_charge_per_qtl": 20.0,
        "is_demo": True,
        "data_source": "synthetic"
    },
    {
        "mandi_id": "mandi_kolar",
        "name": "Kolar APMC Market Yard",
        "district": "Kolar",
        "state": "Karnataka",
        "latitude": 13.1367,
        "longitude": 78.1340,
        "facilities": ["Cold Storage", "Auction Shed", "Electronic Weighing"],
        "market_fee_percent": 1.5,
        "handling_charge_per_qtl": 15.0,
        "is_demo": True,
        "data_source": "synthetic"
    },
    {
        "mandi_id": "mandi_mysuru",
        "name": "Mysuru (Bandipalya APMC)",
        "district": "Mysuru",
        "state": "Karnataka",
        "latitude": 12.2778,
        "longitude": 76.6806,
        "facilities": ["Auction Shed", "Weighing Bridge", "Storage Warehouse"],
        "market_fee_percent": 1.5,
        "handling_charge_per_qtl": 14.0,
        "is_demo": True,
        "data_source": "synthetic"
    },
    {
        "mandi_id": "mandi_mandya",
        "name": "Mandya APMC Yard",
        "district": "Mandya",
        "state": "Karnataka",
        "latitude": 12.5242,
        "longitude": 76.8958,
        "facilities": ["Auction Shed", "Farmer Rest House", "Weighing Platform"],
        "market_fee_percent": 1.5,
        "handling_charge_per_qtl": 12.0,
        "is_demo": True,
        "data_source": "synthetic"
    },
    {
        "mandi_id": "mandi_hubballi",
        "name": "Hubballi (Amargol APMC)",
        "district": "Dharwad",
        "state": "Karnataka",
        "latitude": 15.3942,
        "longitude": 75.1058,
        "facilities": ["Cold Storage", "Bulk Grain Silos", "Electronic Weighing"],
        "market_fee_percent": 1.5,
        "handling_charge_per_qtl": 16.0,
        "is_demo": True,
        "data_source": "synthetic"
    },
    {
        "mandi_id": "mandi_belagavi",
        "name": "Belagavi APMC Yard",
        "district": "Belagavi",
        "state": "Karnataka",
        "latitude": 15.8497,
        "longitude": 74.4977,
        "facilities": ["Auction Shed", "Vegetable Trading Platform"],
        "market_fee_percent": 1.5,
        "handling_charge_per_qtl": 13.0,
        "is_demo": True,
        "data_source": "synthetic"
    },
    {
        "mandi_id": "mandi_davanagere",
        "name": "Davanagere APMC Yard",
        "district": "Davanagere",
        "state": "Karnataka",
        "latitude": 14.4644,
        "longitude": 75.9218,
        "facilities": ["Grain Storage", "Electronic Weighing", "Warehouse"],
        "market_fee_percent": 1.5,
        "handling_charge_per_qtl": 14.0,
        "is_demo": True,
        "data_source": "synthetic"
    },
    {
        "mandi_id": "mandi_hassan",
        "name": "Hassan APMC Yard",
        "district": "Hassan",
        "state": "Karnataka",
        "latitude": 13.0033,
        "longitude": 76.1004,
        "facilities": ["Cold Storage", "Potato Grading Centre", "Electronic Weighing"],
        "market_fee_percent": 1.5,
        "handling_charge_per_qtl": 15.0,
        "is_demo": True,
        "data_source": "synthetic"
    }
]

# ---------------------------------------------------------------------------
# 2. CROPS METADATA (6 Karnataka Crops with Realistic Baselines)
# ---------------------------------------------------------------------------
CROPS = [
    {
        "crop_id": "crop_tomato",
        "name_en": "Tomato",
        "name_kn": "ಟೊಮ್ಯಾಟೋ",
        "category": "Perishable Vegetable",
        "shelf_life_ambient_days": 6,
        "shelf_life_cold_days": 21,
        "daily_decay_rate_ambient": 0.045,
        "daily_decay_rate_cold": 0.008,
        "standard_unit": "Quintal (100 kg)",
        "base_price_inr": 820.0,     # Normal baseline ₹750–₹880/qtl in Karnataka autumn
        "daily_volatility": 0.035,   # ~3.5% daily variation
        "ar_phi": 0.91,              # Strong mean reversion
        "base_arrival_qtl": 2800.0,
        "is_demo": True,
        "data_source": "synthetic"
    },
    {
        "crop_id": "crop_onion",
        "name_en": "Onion",
        "name_kn": "ಈರುಳ್ಳಿ",
        "category": "Semi-Perishable Vegetable",
        "shelf_life_ambient_days": 45,
        "shelf_life_cold_days": 120,
        "daily_decay_rate_ambient": 0.005,
        "daily_decay_rate_cold": 0.001,
        "standard_unit": "Quintal (100 kg)",
        "base_price_inr": 2350.0,    # Normal baseline ₹2,000–₹2,600/qtl
        "daily_volatility": 0.024,
        "ar_phi": 0.93,
        "base_arrival_qtl": 3800.0,
        "is_demo": True,
        "data_source": "synthetic"
    },
    {
        "crop_id": "crop_potato",
        "name_en": "Potato",
        "name_kn": "ಆಲೂಗಡ್ಡೆ",
        "category": "Tuber Vegetable",
        "shelf_life_ambient_days": 60,
        "shelf_life_cold_days": 180,
        "daily_decay_rate_ambient": 0.003,
        "daily_decay_rate_cold": 0.0008,
        "standard_unit": "Quintal (100 kg)",
        "base_price_inr": 1680.0,    # Normal baseline ₹1,500–₹1,850/qtl
        "daily_volatility": 0.018,
        "ar_phi": 0.94,
        "base_arrival_qtl": 2400.0,
        "is_demo": True,
        "data_source": "synthetic"
    },
    {
        "crop_id": "crop_maize",
        "name_en": "Maize",
        "name_kn": "ಮೆಕ್ಕೆಜೋಳ",
        "category": "Grain / Cereal",
        "shelf_life_ambient_days": 180,
        "shelf_life_cold_days": 360,
        "daily_decay_rate_ambient": 0.0008,
        "daily_decay_rate_cold": 0.0002,
        "standard_unit": "Quintal (100 kg)",
        "base_price_inr": 2100.0,    # Normal baseline ₹1,950–₹2,250/qtl
        "daily_volatility": 0.012,
        "ar_phi": 0.95,
        "base_arrival_qtl": 5200.0,
        "is_demo": True,
        "data_source": "synthetic"
    },
    {
        "crop_id": "crop_chilli",
        "name_en": "Green Chilli",
        "name_kn": "ಹಸಿ ಮೆಣಸಿನಕಾಯಿ",
        "category": "Perishable Spice",
        "shelf_life_ambient_days": 5,
        "shelf_life_cold_days": 18,
        "daily_decay_rate_ambient": 0.055,
        "daily_decay_rate_cold": 0.012,
        "standard_unit": "Quintal (100 kg)",
        "base_price_inr": 4250.0,    # Normal baseline ₹3,800–₹4,800/qtl
        "daily_volatility": 0.040,
        "ar_phi": 0.89,
        "base_arrival_qtl": 950.0,
        "is_demo": True,
        "data_source": "synthetic"
    },
    {
        "crop_id": "crop_ragi",
        "name_en": "Ragi",
        "name_kn": "ರಾಗಿ",
        "category": "Millet / Cereal",
        "shelf_life_ambient_days": 240,
        "shelf_life_cold_days": 400,
        "daily_decay_rate_ambient": 0.0005,
        "daily_decay_rate_cold": 0.0001,
        "standard_unit": "Quintal (100 kg)",
        "base_price_inr": 3150.0,    # Normal baseline ₹2,950–₹3,350/qtl
        "daily_volatility": 0.010,
        "ar_phi": 0.96,
        "base_arrival_qtl": 1450.0,
        "is_demo": True,
        "data_source": "synthetic"
    }
]

# ---------------------------------------------------------------------------
# 3. LOGISTICS & OPERATIONAL COSTS
# ---------------------------------------------------------------------------
COSTS = {
    "distance_matrix_km": {
        "mandi_bengaluru": {
            "mandi_kolar": 70.0,
            "mandi_mysuru": 145.0,
            "mandi_mandya": 100.0,
            "mandi_hubballi": 410.0,
            "mandi_belagavi": 505.0,
            "mandi_davanagere": 260.0,
            "mandi_hassan": 180.0
        },
        "mandi_kolar": {
            "mandi_bengaluru": 70.0,
            "mandi_mysuru": 215.0,
            "mandi_mandya": 170.0,
            "mandi_hubballi": 465.0,
            "mandi_belagavi": 560.0,
            "mandi_davanagere": 320.0,
            "mandi_hassan": 245.0
        },
        "mandi_mysuru": {
            "mandi_bengaluru": 145.0,
            "mandi_kolar": 215.0,
            "mandi_mandya": 45.0,
            "mandi_hubballi": 490.0,
            "mandi_belagavi": 585.0,
            "mandi_davanagere": 350.0,
            "mandi_hassan": 120.0
        },
        "mandi_mandya": {
            "mandi_bengaluru": 100.0,
            "mandi_kolar": 170.0,
            "mandi_mysuru": 45.0,
            "mandi_hubballi": 450.0,
            "mandi_belagavi": 545.0,
            "mandi_davanagere": 310.0,
            "mandi_hassan": 105.0
        },
        "mandi_hubballi": {
            "mandi_bengaluru": 410.0,
            "mandi_kolar": 465.0,
            "mandi_mysuru": 490.0,
            "mandi_mandya": 450.0,
            "mandi_belagavi": 95.0,
            "mandi_davanagere": 150.0,
            "mandi_hassan": 340.0
        },
        "mandi_belagavi": {
            "mandi_bengaluru": 505.0,
            "mandi_kolar": 560.0,
            "mandi_mysuru": 585.0,
            "mandi_mandya": 545.0,
            "mandi_hubballi": 95.0,
            "mandi_davanagere": 240.0,
            "mandi_hassan": 430.0
        },
        "mandi_davanagere": {
            "mandi_bengaluru": 260.0,
            "mandi_kolar": 320.0,
            "mandi_mysuru": 350.0,
            "mandi_mandya": 310.0,
            "mandi_hubballi": 150.0,
            "mandi_belagavi": 240.0,
            "mandi_hassan": 190.0
        },
        "mandi_hassan": {
            "mandi_bengaluru": 180.0,
            "mandi_kolar": 245.0,
            "mandi_mysuru": 120.0,
            "mandi_mandya": 105.0,
            "mandi_hubballi": 340.0,
            "mandi_belagavi": 430.0,
            "mandi_davanagere": 190.0
        }
    },
    "freight_rate_per_km_qtl": 2.25,
    "storage_ambient_inr_per_qtl_day": 3.5,
    "storage_cold_inr_per_qtl_day": 8.0,
    "loading_unloading_inr_per_qtl": 10.0,
    "is_demo": True,
    "data_source": "synthetic"
}

# ---------------------------------------------------------------------------
# 4. CONTROLLED ANOMALY SPECIFICATIONS
# ---------------------------------------------------------------------------
ANOMALIES = [
    {
        "anomaly_id": "ANOMALY-001",
        "crop_id": "crop_tomato",
        "mandi_id": "mandi_kolar",
        "date": "2026-10-15",
        "anomaly_type": "PRICE_SPIKE",
        "normal_reference_price": 815.0,
        "anomalous_price": 1335.0,
        "percentage_change": 63.8,
        "explanation": "Severe unseasonal flash flooding in Kolar catchment area disrupted harvest logistics, reducing daily arrivals by 70% and triggering a +63.8% spot price surge.",
        "is_synthetic": True
    },
    {
        "anomaly_id": "ANOMALY-002",
        "crop_id": "crop_onion",
        "mandi_id": "mandi_bengaluru",
        "date": "2026-10-08",
        "anomaly_type": "PRICE_CRASH",
        "normal_reference_price": 2380.0,
        "anomalous_price": 1380.0,
        "percentage_change": -42.0,
        "explanation": "Simultaneous unexpected arrivals of 350 truckloads from Maharashtra alongside local Chitradurga harvest resulted in extreme APMC yard congestion and panic distress selling, crashing spot prices by 42.0%.",
        "is_synthetic": True
    },
    {
        "anomaly_id": "ANOMALY-003",
        "crop_id": "crop_potato",
        "mandi_id": "mandi_mysuru",
        "date": "2026-10-18",
        "anomaly_type": "UNUSUAL_ARRIVAL_SURGE",
        "normal_reference_price": 1690.0,
        "anomalous_price": 1220.0,
        "normal_reference_arrival_qtl": 2350.0,
        "anomalous_arrival_qtl": 8450.0,
        "percentage_change": -27.8,
        "explanation": "Massive release of cold-storage holdings from Hassan district dumped into Bandipalya APMC yard, surging arrivals to 8,450 quintals (+260%) and depressing modal prices by 27.8%.",
        "is_synthetic": True
    }
]

# ---------------------------------------------------------------------------
# 5. TIME-SERIES SYNTHETIC DATA GENERATOR WITH AR(1) & ANOMALIES
# ---------------------------------------------------------------------------
def generate_timeseries(start_date="2024-01-01", end_date="2026-10-25"):
    """
    Generates natural, non-flat daily prices and arrivals across 8 mandis and 6 crops.
    Employs an Autoregressive Mean-Reverting AR(1) model with daily stochastic variance,
    seasonal harmonics, weekday trade cycles, and injected demonstration anomalies.
    """
    dates = pd.date_range(start=start_date, end=end_date, freq="D")
    num_days = len(dates)

    # Date string lookup map: 'YYYY-MM-DD' -> index t
    date_to_idx = {d.strftime("%Y-%m-%d"): i for i, d in enumerate(dates)}

    prices_records = []
    arrivals_records = []

    # Regional mandi factors
    mandi_factors = {
        "mandi_bengaluru": {"price_mult": 1.06, "arrival_mult": 1.35},
        "mandi_kolar":     {"price_mult": 0.98, "arrival_mult": 1.30},
        "mandi_mysuru":    {"price_mult": 0.97, "arrival_mult": 0.95},
        "mandi_mandya":    {"price_mult": 0.94, "arrival_mult": 0.85},
        "mandi_hubballi":  {"price_mult": 1.01, "arrival_mult": 1.15},
        "mandi_belagavi":  {"price_mult": 0.96, "arrival_mult": 1.05},
        "mandi_davanagere":{"price_mult": 0.97, "arrival_mult": 1.20},
        "mandi_hassan":    {"price_mult": 0.96, "arrival_mult": 1.10}
    }

    for crop in CROPS:
        crop_id = crop["crop_id"]
        base_p = crop["base_price_inr"]
        base_a = crop["base_arrival_qtl"]
        sigma = crop["daily_volatility"]
        phi = crop["ar_phi"]

        # Seasonal peak day of year
        season_offset = 60 if "tomato" in crop_id else 120

        for mandi in MANDIS:
            mandi_id = mandi["mandi_id"]
            p_mult = mandi_factors[mandi_id]["price_mult"]
            a_mult = mandi_factors[mandi_id]["arrival_mult"]

            # Mandi-specific specialization
            if crop_id == "crop_tomato" and mandi_id == "mandi_kolar":
                a_mult *= 1.35
            elif crop_id == "crop_maize" and mandi_id == "mandi_davanagere":
                a_mult *= 1.30
            elif crop_id == "crop_potato" and mandi_id == "mandi_hassan":
                a_mult *= 1.35

            # 1. Generate stationary Mean-Reverting AR(1) process for price
            # Ensures temporal continuity without drifting away to extreme floors
            ar_price = np.zeros(num_days)
            ar_arrival = np.zeros(num_days)
            for t in range(1, num_days):
                ar_price[t] = phi * ar_price[t-1] + np.random.normal(0, sigma)
                ar_arrival[t] = 0.88 * ar_arrival[t-1] + np.random.normal(0, 0.08)

            # Pre-generate daily prices & arrivals array
            mandi_prices_arr = np.zeros(num_days)
            mandi_arrivals_arr = np.zeros(num_days)

            for t, d in enumerate(dates):
                day_of_year = d.day_of_year
                day_of_week = d.dayofweek # 0=Monday, 6=Sunday

                # Seasonal component (±10% to ±14% wave)
                seasonal_cycle = 0.12 * math.sin(2 * math.pi * (day_of_year - season_offset) / 365.25)

                # Day-of-week liquidity rhythm (Mondays/Thursdays slightly more active)
                dow_price_factor = 0.012 if day_of_week in [0, 3] else (-0.008 if day_of_week == 6 else 0.0)
                dow_arrival_factor = 0.06 if day_of_week in [0, 3] else (-0.05 if day_of_week == 6 else 0.0)

                # Daily random jitter so no two days are identical
                daily_jitter_p = np.random.normal(0, 0.012)
                daily_jitter_a = np.random.normal(0, 0.05)

                # Arrival calculation
                arrival_factor = max(0.3, 1.0 - (seasonal_cycle * 0.6) + ar_arrival[t] + dow_arrival_factor + daily_jitter_a)
                arr_qtl = round(base_a * a_mult * arrival_factor, 1)

                # Modal price calculation with arrival elasticity
                elasticity = -0.12
                price_factor = 1.0 + seasonal_cycle + ar_price[t] + dow_price_factor + daily_jitter_p + (elasticity * (arrival_factor - 1.0))
                # Ensure sensible positive boundaries
                price_factor = max(0.55, min(1.65, price_factor))

                mod_price = round(base_p * p_mult * price_factor, 0)
                mandi_prices_arr[t] = mod_price
                mandi_arrivals_arr[t] = arr_qtl

            # ---------------------------------------------------------------
            # 2. INJECT CONTROLLED ANOMALIES
            # ---------------------------------------------------------------
            # Anomaly A: Tomato Spike at Kolar on 2026-10-15
            if crop_id == "crop_tomato" and mandi_id == "mandi_kolar":
                idx = date_to_idx.get("2026-10-15")
                if idx is not None:
                    # Inject spike with realistic 4-day decay
                    mandi_prices_arr[idx]     = 1335.0  # +63.8% spike
                    mandi_arrivals_arr[idx]   = 950.0   # severe supply drop
                    if idx + 1 < num_days:
                        mandi_prices_arr[idx + 1] = 1270.0
                        mandi_arrivals_arr[idx + 1] = 1180.0
                    if idx + 2 < num_days:
                        mandi_prices_arr[idx + 2] = 1145.0
                        mandi_arrivals_arr[idx + 2] = 1620.0
                    if idx + 3 < num_days:
                        mandi_prices_arr[idx + 3] = 995.0
                        mandi_arrivals_arr[idx + 3] = 2240.0
                    if idx + 4 < num_days:
                        mandi_prices_arr[idx + 4] = 885.0

            # Anomaly B: Onion Crash at Bengaluru on 2026-10-08
            if crop_id == "crop_onion" and mandi_id == "mandi_bengaluru":
                idx = date_to_idx.get("2026-10-08")
                if idx is not None:
                    # Inject crash with realistic recovery
                    mandi_prices_arr[idx]     = 1380.0  # -42% crash
                    mandi_arrivals_arr[idx]   = 9200.0  # extreme supply glut
                    if idx + 1 < num_days:
                        mandi_prices_arr[idx + 1] = 1460.0
                        mandi_arrivals_arr[idx + 1] = 7800.0
                    if idx + 2 < num_days:
                        mandi_prices_arr[idx + 2] = 1710.0
                        mandi_arrivals_arr[idx + 2] = 5900.0
                    if idx + 3 < num_days:
                        mandi_prices_arr[idx + 3] = 1960.0
                        mandi_arrivals_arr[idx + 3] = 4600.0
                    if idx + 4 < num_days:
                        mandi_prices_arr[idx + 4] = 2190.0

            # Anomaly C: Potato Arrival Surge at Mysuru on 2026-10-18
            if crop_id == "crop_potato" and mandi_id == "mandi_mysuru":
                idx = date_to_idx.get("2026-10-18")
                if idx is not None:
                    mandi_arrivals_arr[idx]   = 8450.0  # +260% surge
                    mandi_prices_arr[idx]     = 1220.0  # -27.8% drop
                    if idx + 1 < num_days:
                        mandi_arrivals_arr[idx + 1] = 6200.0
                        mandi_prices_arr[idx + 1]   = 1340.0
                    if idx + 2 < num_days:
                        mandi_arrivals_arr[idx + 2] = 3900.0
                        mandi_prices_arr[idx + 2]   = 1520.0

            # ---------------------------------------------------------------
            # 3. CONVERT TO FINAL RECORDS WITH SPREADS
            # ---------------------------------------------------------------
            for t, d in enumerate(dates):
                d_str = d.strftime("%Y-%m-%d")
                modal_p = float(mandi_prices_arr[t])
                arr_q = float(mandi_arrivals_arr[t])

                # Spread guarantees: min_price <= modal_price <= max_price
                down_pct = np.random.uniform(0.04, 0.08)
                up_pct = np.random.uniform(0.04, 0.10)
                spread_down = round(modal_p * down_pct, 0)
                spread_up = round(modal_p * up_pct, 0)

                min_p = max(50.0, modal_p - spread_down)
                max_p = modal_p + spread_up

                assert min_p <= modal_p <= max_p, f"Price inequality violation on {d_str}"
                assert arr_q >= 0, f"Negative arrival on {d_str}"

                prices_records.append({
                    "date": d_str,
                    "mandi_id": mandi_id,
                    "crop_id": crop_id,
                    "min_price": float(min_p),
                    "modal_price": float(modal_p),
                    "max_price": float(max_p),
                    "price_unit": "INR/quintal",
                    "data_source": "synthetic",
                    "is_demo": True
                })

                arrivals_records.append({
                    "date": d_str,
                    "mandi_id": mandi_id,
                    "crop_id": crop_id,
                    "arrival_quantity": float(arr_q),
                    "arrival_unit": "quintals",
                    "data_source": "synthetic",
                    "is_demo": True
                })

    return prices_records, arrivals_records


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    print(f"Generating enhanced synthetic dataset in: {OUTPUT_DIR}")

    # Write static metadata files
    mandis_path = os.path.join(OUTPUT_DIR, "mandis.json")
    with open(mandis_path, "w", encoding="utf-8") as f:
        json.dump(MANDIS, f, indent=2, ensure_ascii=False)
    print(f"  [OK] Saved {mandis_path} ({len(MANDIS)} mandis)")

    crops_path = os.path.join(OUTPUT_DIR, "crops.json")
    with open(crops_path, "w", encoding="utf-8") as f:
        json.dump(CROPS, f, indent=2, ensure_ascii=False)
    print(f"  [OK] Saved {crops_path} ({len(CROPS)} crops)")

    costs_path = os.path.join(OUTPUT_DIR, "costs.json")
    with open(costs_path, "w", encoding="utf-8") as f:
        json.dump(COSTS, f, indent=2, ensure_ascii=False)
    print(f"  [OK] Saved {costs_path}")

    # Save anomaly events catalog
    anomalies_path = os.path.join(OUTPUT_DIR, "anomaly_events.json")
    with open(anomalies_path, "w", encoding="utf-8") as f:
        json.dump(ANOMALIES, f, indent=2, ensure_ascii=False)
    print(f"  [OK] Saved {anomalies_path} ({len(ANOMALIES)} documented anomalies)")

    # Generate enhanced time-series records
    print("  Generating daily price and arrival records across 8 mandis and 6 crops...")
    prices_data, arrivals_data = generate_timeseries()

    # Save prices.csv
    df_prices = pd.DataFrame(prices_data)
    prices_path = os.path.join(OUTPUT_DIR, "prices.csv")
    df_prices.to_csv(prices_path, index=False)
    print(f"  [OK] Saved {prices_path} ({len(df_prices)} daily records)")

    # Save arrivals.csv
    df_arrivals = pd.DataFrame(arrivals_data)
    arrivals_path = os.path.join(OUTPUT_DIR, "arrivals.csv")
    df_arrivals.to_csv(arrivals_path, index=False)
    print(f"  [OK] Saved {arrivals_path} ({len(df_arrivals)} daily records)")


if __name__ == "__main__":
    main()
