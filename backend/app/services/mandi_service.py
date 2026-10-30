"""
Mandi Service & Data Access Layer for AgriNexa.

Provides business logic and repository abstraction for Mandis, Crops,
Prices, and Dashboard KPIs. Designed to decouple data persistence
(synthetic CSV/JSON today, Supabase PostgreSQL tomorrow) from API routers.
"""

import json
import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional, Tuple
import numpy as np
import pandas as pd

from app.core.exceptions import AgriNexaException
from app.schemas.crop import CropResponse
from app.schemas.dashboard import CropDashboardCard, DashboardSummaryResponse
from app.schemas.mandi import MandiResponse
from app.schemas.price import (
    AnomalyRecord, ForecastPoint, ForecastResponse,
    PriceQueryResponse, PriceRecord, PriceStats
)

logger = logging.getLogger("agrinexa.mandi_service")

# Resolve path to synthetic data folder
BASE_DATA_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "data", "synthetic")
)


class MandiDataRepository:
    """
    In-memory data store for Mandi intelligence.
    Loads and caches synthetic datasets on startup for fast, reproducible querying.
    """
    _instance: Optional["MandiDataRepository"] = None

    def __init__(self, data_dir: str = BASE_DATA_DIR):
        self.data_dir = data_dir
        self.mandis: List[Dict] = []
        self.crops: List[Dict] = []
        self.costs: Dict = {}
        self.df_prices: pd.DataFrame = pd.DataFrame()
        self._is_loaded = False
        self.load_data()

    @classmethod
    def get_instance(cls) -> "MandiDataRepository":
        if cls._instance is None:
            cls._instance = MandiDataRepository()
        return cls._instance

    def load_data(self):
        """Loads JSON metadata and merges prices with arrivals CSVs."""
        if self._is_loaded:
            return

        try:
            mandis_file = os.path.join(self.data_dir, "mandis.json")
            with open(mandis_file, "r", encoding="utf-8") as f:
                self.mandis = json.load(f)

            crops_file = os.path.join(self.data_dir, "crops.json")
            with open(crops_file, "r", encoding="utf-8") as f:
                self.crops = json.load(f)

            costs_file = os.path.join(self.data_dir, "costs.json")
            with open(costs_file, "r", encoding="utf-8") as f:
                self.costs = json.load(f)

            prices_file = os.path.join(self.data_dir, "prices.csv")
            arrivals_file = os.path.join(self.data_dir, "arrivals.csv")

            if os.path.exists(prices_file) and os.path.exists(arrivals_file):
                df_p = pd.read_csv(prices_file)
                df_a = pd.read_csv(arrivals_file)
                # Merge on date, mandi_id, crop_id
                self.df_prices = pd.merge(
                    df_p,
                    df_a[["date", "mandi_id", "crop_id", "arrival_quantity", "arrival_unit"]],
                    on=["date", "mandi_id", "crop_id"],
                    how="left"
                )
                self.df_prices["date"] = pd.to_datetime(self.df_prices["date"])
                self.df_prices = self.df_prices.sort_values(by=["date", "mandi_id", "crop_id"])
                logger.info(f"Loaded {len(self.df_prices)} merged price & arrival records.")
            else:
                logger.warning("Prices or arrivals CSV not found. Data repository running empty.")

            self._is_loaded = True
        except Exception as e:
            logger.error(f"Failed to load synthetic data from {self.data_dir}: {e}")
            raise AgriNexaException(
                message=f"Failed to initialize Mandi dataset: {str(e)}",
                status_code=500
            )


class MandiService:
    """
    Business service executing data querying, filtering, and aggregation.
    """

    def __init__(self, repository: Optional[MandiDataRepository] = None):
        self.repo = repository or MandiDataRepository.get_instance()

    def get_all_mandis(self) -> List[MandiResponse]:
        """Returns list of all available Karnataka APMC mandis."""
        return [MandiResponse(**m) for m in self.repo.mandis]

    def get_mandi_by_id(self, mandi_id: str) -> Optional[MandiResponse]:
        """Finds a mandi by ID, or None if not found."""
        for m in self.repo.mandis:
            if m["mandi_id"].lower() == mandi_id.lower():
                return MandiResponse(**m)
        return None

    def get_all_crops(self) -> List[CropResponse]:
        """Returns list of all supported commodities."""
        return [CropResponse(**c) for c in self.repo.crops]

    def find_crop(self, crop_identifier: str) -> Optional[CropResponse]:
        """
        Flexible lookup supporting crop_id (e.g., 'crop_tomato')
        or common names (e.g., 'tomato', 'Tomato', 'Green Chilli').
        """
        target = crop_identifier.strip().lower().replace(" ", "_")
        for c in self.repo.crops:
            cid = c["crop_id"].lower()
            name_en = c["name_en"].lower().replace(" ", "_")
            if target == cid or target == name_en or target in cid:
                return CropResponse(**c)
        return None

    def get_prices(
        self,
        crop_name_or_id: Optional[str] = None,
        mandi_id: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        limit: int = 365
    ) -> PriceQueryResponse:
        """
        Filters price and arrival records by crop, mandi, and date range.
        Calculates descriptive summary statistics.
        """
        df = self.repo.df_prices

        # Lookup crop metadata if specified
        matched_crop: Optional[CropResponse] = None
        if crop_name_or_id:
            matched_crop = self.find_crop(crop_name_or_id)
            if not matched_crop:
                raise AgriNexaException(
                    message=f"Unknown crop '{crop_name_or_id}'. Supported crops: Tomato, Onion, Potato, Maize, Green Chilli, Ragi.",
                    status_code=404,
                    details={"requested_crop": crop_name_or_id}
                )
            df = df[df["crop_id"] == matched_crop.crop_id]

        # Lookup mandi metadata if specified
        matched_mandi: Optional[MandiResponse] = None
        if mandi_id:
            matched_mandi = self.get_mandi_by_id(mandi_id)
            if not matched_mandi:
                raise AgriNexaException(
                    message=f"Unknown mandi '{mandi_id}'.",
                    status_code=404,
                    details={"requested_mandi_id": mandi_id}
                )
            df = df[df["mandi_id"] == matched_mandi.mandi_id]

        # Date filtering
        if start_date:
            try:
                s_dt = pd.to_datetime(start_date)
                df = df[df["date"] >= s_dt]
            except Exception:
                raise AgriNexaException(
                    message=f"Invalid start_date format '{start_date}'. Expected YYYY-MM-DD.",
                    status_code=400
                )

        if end_date:
            try:
                e_dt = pd.to_datetime(end_date)
                df = df[df["date"] <= e_dt]
            except Exception:
                raise AgriNexaException(
                    message=f"Invalid end_date format '{end_date}'. Expected YYYY-MM-DD.",
                    status_code=400
                )

        if start_date and end_date and pd.to_datetime(start_date) > pd.to_datetime(end_date):
            raise AgriNexaException(
                message=f"start_date ({start_date}) cannot be later than end_date ({end_date}).",
                status_code=400
            )

        # Handle empty result set
        total_records = len(df)
        if total_records == 0:
            return PriceQueryResponse(
                crop_id=matched_crop.crop_id if matched_crop else None,
                crop_name=matched_crop.name_en if matched_crop else None,
                mandi_id=matched_mandi.mandi_id if matched_mandi else None,
                mandi_name=matched_mandi.name if matched_mandi else None,
                start_date=start_date,
                end_date=end_date,
                records_count=0,
                stats=None,
                prices=[],
                is_demo=True,
                data_source="synthetic"
            )

        # Apply record limit (take most recent if larger than limit)
        if total_records > limit:
            df_subset = df.tail(limit)
        else:
            df_subset = df

        # Compute summary metrics over the filtered set
        min_p = float(df["min_price"].min())
        max_p = float(df["max_price"].max())
        avg_modal = float(round(df["modal_price"].mean(), 2))
        latest_row = df.iloc[-1]
        latest_p = float(latest_row["modal_price"])
        avg_arr = float(round(df["arrival_quantity"].mean(), 1)) if "arrival_quantity" in df.columns else None

        stats = PriceStats(
            min_price_observed=min_p,
            max_price_observed=max_p,
            avg_modal_price=avg_modal,
            latest_modal_price=latest_p,
            total_records=total_records,
            avg_daily_arrival=avg_arr
        )

        # Lookup dicts for names
        mandi_map = {m["mandi_id"]: m["name"] for m in self.repo.mandis}
        crop_map = {c["crop_id"]: c["name_en"] for c in self.repo.crops}

        records: List[PriceRecord] = []
        for _, row in df_subset.iterrows():
            d_str = row["date"].strftime("%Y-%m-%d")
            records.append(
                PriceRecord(
                    date=d_str,
                    mandi_id=row["mandi_id"],
                    mandi_name=mandi_map.get(row["mandi_id"]),
                    crop_id=row["crop_id"],
                    crop_name=crop_map.get(row["crop_id"]),
                    min_price=float(row["min_price"]),
                    modal_price=float(row["modal_price"]),
                    max_price=float(row["max_price"]),
                    price_unit=row.get("price_unit", "INR/quintal"),
                    arrival_quantity=float(row["arrival_quantity"]) if pd.notna(row.get("arrival_quantity")) else None,
                    arrival_unit=row.get("arrival_unit", "quintals"),
                    data_source="synthetic",
                    is_demo=True
                )
            )

        return PriceQueryResponse(
            crop_id=matched_crop.crop_id if matched_crop else None,
            crop_name=matched_crop.name_en if matched_crop else None,
            mandi_id=matched_mandi.mandi_id if matched_mandi else None,
            mandi_name=matched_mandi.name if matched_mandi else None,
            start_date=start_date,
            end_date=end_date,
            records_count=total_records,
            stats=stats,
            prices=records,
            is_demo=True,
            data_source="synthetic"
        )

    def get_dashboard_summary(self) -> DashboardSummaryResponse:
        """
        Aggregates latest real-time signals and day-over-day price momentum
        for each supported crop at its benchmark hub.
        """
        df = self.repo.df_prices
        if df.empty:
            raise AgriNexaException("Dataset is empty. Cannot generate dashboard summary.", status_code=500)

        # Primary benchmark mandi mapping for each commodity
        primary_benchmarks = {
            "crop_tomato": "mandi_kolar",       # Major tomato market
            "crop_onion":  "mandi_bengaluru",   # Major onion trading hub
            "crop_potato": "mandi_hassan",      # Major potato center
            "crop_maize":  "mandi_davanagere",  # Major maize grain center
            "crop_chilli": "mandi_hubballi",    # Major chilli commercial yard
            "crop_ragi":   "mandi_mandya"       # South Karnataka ragi belt
        }

        mandi_map = {m["mandi_id"]: m["name"] for m in self.repo.mandis}
        cards: List[CropDashboardCard] = []

        max_date = df["date"].max()
        max_date_str = max_date.strftime("%Y-%m-%d")

        for crop in self.repo.crops:
            cid = crop["crop_id"]
            benchmark_mandi_id = primary_benchmarks.get(cid, "mandi_bengaluru")
            benchmark_name = mandi_map.get(benchmark_mandi_id, "Primary Mandi")

            # Filter records for this crop and its benchmark mandi
            crop_df = df[(df["crop_id"] == cid) & (df["mandi_id"] == benchmark_mandi_id)]
            if crop_df.empty:
                # Fallback to any mandi for this crop
                crop_df = df[df["crop_id"] == cid]

            if len(crop_df) >= 2:
                today_row = crop_df.iloc[-1]
                yesterday_row = crop_df.iloc[-2]
                today_price = float(today_row["modal_price"])
                yesterday_price = float(yesterday_row["modal_price"])
                latest_arr = float(today_row.get("arrival_quantity", 0.0))
            elif len(crop_df) == 1:
                today_row = crop_df.iloc[-1]
                today_price = float(today_row["modal_price"])
                yesterday_price = today_price
                latest_arr = float(today_row.get("arrival_quantity", 0.0))
            else:
                today_price = float(crop["base_price_inr"])
                yesterday_price = today_price
                latest_arr = 0.0

            # Calculate change percent
            if yesterday_price > 0:
                pct = round(((today_price - yesterday_price) / yesterday_price) * 100.0, 1)
            else:
                pct = 0.0

            if pct > 1.0:
                trend = "up"
                advisory = f"Price is trending upward in {benchmark_name}. Hold strategy can capture further gains if storage permits."
            elif pct < -1.0:
                trend = "down"
                advisory = f"High arrivals in {benchmark_name} exerting downward pressure. Consider immediate partial sale to mitigate risk."
            else:
                trend = "stable"
                advisory = f"Market prices in {benchmark_name} are steady. Plan transportation according to proximity and local buyer demand."

            cards.append(
                CropDashboardCard(
                    crop_id=cid,
                    name_en=crop["name_en"],
                    name_kn=crop["name_kn"],
                    category=crop["category"],
                    today_modal_price=today_price,
                    yesterday_modal_price=yesterday_price,
                    price_change_percent=pct,
                    trend_direction=trend,
                    latest_arrival_qtl=latest_arr,
                    arrival_unit="quintals",
                    primary_mandi_id=benchmark_mandi_id,
                    primary_mandi_name=benchmark_name,
                    advisory_summary=advisory,
                    shelf_life_days=crop["shelf_life_ambient_days"]
                )
            )

        return DashboardSummaryResponse(
            generated_at=datetime.now(timezone.utc).isoformat(),
            date_of_data=max_date_str,
            total_mandis_monitored=len(self.repo.mandis),
            total_crops_tracked=len(self.repo.crops),
            commodity_cards=cards,
            is_demo=True,
            data_source="synthetic"
        )

    def get_price_forecast(
        self,
        crop_name_or_id: str,
        mandi_id: Optional[str] = None,
        historical_days: int = 90,
        forecast_days: int = 14
    ) -> ForecastResponse:
        """
        Generates a 14-day multi-scenario price forecast using linear trend regression.

        Algorithm:
        1. Select historical_days of daily modal price data for the requested crop + mandi.
        2. Fit a simple linear regression (OLS) over the time index to extract slope (daily trend).
        3. Project forward for forecast_days using the trend slope as 'normal' scenario.
        4. Apply historical volatility (standard deviation of daily returns) to create:
           - Optimistic band: normal + 1.5σ × sqrt(horizon) price envelope
           - Pessimistic band: normal - 0.8σ × sqrt(horizon) price envelope
        5. Detect historical anomalies using Z-score > 2.2 threshold on 30-day rolling mean.
        """
        # ── 1. Validate crop ──────────────────────────────────────────────────
        crop = self.find_crop(crop_name_or_id)
        if not crop:
            raise AgriNexaException(
                message=f"Unknown crop '{crop_name_or_id}'.",
                status_code=404
            )

        # ── 2. Resolve benchmark mandi ────────────────────────────────────────
        PRIMARY_BENCHMARKS = {
            "crop_tomato": "mandi_kolar",
            "crop_onion":  "mandi_bengaluru",
            "crop_potato": "mandi_hassan",
            "crop_maize":  "mandi_davanagere",
            "crop_chilli": "mandi_hubballi",
            "crop_ragi":   "mandi_mandya"
        }
        target_mandi_id = mandi_id or PRIMARY_BENCHMARKS.get(crop.crop_id, "mandi_bengaluru")
        mandi_obj = self.get_mandi_by_id(target_mandi_id)
        if not mandi_obj:
            raise AgriNexaException(
                message=f"Unknown mandi '{target_mandi_id}'.",
                status_code=404
            )

        # ── 3. Filter historical data ─────────────────────────────────────────
        df = self.repo.df_prices
        crop_df = df[
            (df["crop_id"] == crop.crop_id) & (df["mandi_id"] == target_mandi_id)
        ].sort_values("date")

        if len(crop_df) < 10:
            raise AgriNexaException(
                message=f"Insufficient historical data for {crop.name_en} at {mandi_obj.name}.",
                status_code=422
            )

        # Take the last historical_days records
        hist_df = crop_df.tail(historical_days).copy()
        prices = hist_df["modal_price"].values.astype(float)
        n = len(prices)

        # ── 4. Linear regression for trend ───────────────────────────────────
        x = np.arange(n)
        slope, intercept = np.polyfit(x, prices, 1)

        # Compute daily % changes for volatility estimation
        pct_changes = np.diff(prices) / prices[:-1]
        vol = float(np.std(pct_changes)) if len(pct_changes) > 1 else 0.02
        last_price = float(prices[-1])

        # Trend metrics
        first_fitted = intercept + slope * 0
        last_fitted  = intercept + slope * (n - 1)
        trend_strength_pct = round(((last_fitted - first_fitted) / first_fitted) * 100, 2) if first_fitted > 0 else 0.0

        if slope > 2.0:
            trend_direction = "up"
        elif slope < -2.0:
            trend_direction = "down"
        else:
            trend_direction = "stable"

        # ── 5. Build 14-day forecast points ──────────────────────────────────
        last_date = hist_df["date"].max()
        forecast_points: List[ForecastPoint] = []

        for day in range(1, forecast_days + 1):
            future_date = last_date + timedelta(days=day)
            # Project price from last known using linear slope
            proj_base = last_price + slope * day

            # Volatility expands with sqrt(time horizon) — standard Brownian motion
            vol_spread = vol * last_price * (day ** 0.5)
            optimistic  = round(max(0.0, proj_base + vol_spread * 1.5), 2)
            normal      = round(max(0.0, proj_base), 2)
            pessimistic = round(max(0.0, proj_base - vol_spread * 0.8), 2)

            forecast_points.append(ForecastPoint(
                date=future_date.strftime("%Y-%m-%d"),
                optimistic=optimistic,
                normal=normal,
                pessimistic=pessimistic
            ))

        # ── 6. Detect anomalies (Z-score on 30-day rolling mean) ─────────────
        mandi_map = {m["mandi_id"]: m["name"] for m in self.repo.mandis}
        anomalies: List[AnomalyRecord] = []

        # Use full crop history for anomaly detection (not just recent window)
        anom_df = df[df["crop_id"] == crop.crop_id].copy().sort_values("date")

        for mid in anom_df["mandi_id"].unique():
            mdf = anom_df[anom_df["mandi_id"] == mid].copy()
            if len(mdf) < 30:
                continue

            mdf["rolling_mean"] = mdf["modal_price"].rolling(30, min_periods=7).mean()
            mdf["rolling_std"]  = mdf["modal_price"].rolling(30, min_periods=7).std()
            mdf = mdf.dropna(subset=["rolling_mean", "rolling_std"])
            mdf["z_score"] = (mdf["modal_price"] - mdf["rolling_mean"]) / mdf["rolling_std"].clip(lower=1.0)

            for _, row in mdf[mdf["z_score"].abs() > 2.2].iterrows():
                atype = "spike" if row["z_score"] > 0 else "crash"
                anomalies.append(AnomalyRecord(
                    date=row["date"].strftime("%Y-%m-%d"),
                    modal_price=float(row["modal_price"]),
                    anomaly_type=atype,
                    deviation_pct=round(float(row["z_score"]) * 100 / 2.2, 1),
                    mandi_id=mid,
                    mandi_name=mandi_map.get(mid)
                ))

        # Sort anomalies by date descending, cap at 20 most recent
        anomalies.sort(key=lambda a: a.date, reverse=True)
        anomalies = anomalies[:20]

        return ForecastResponse(
            crop_id=crop.crop_id,
            crop_name=crop.name_en,
            mandi_id=target_mandi_id,
            mandi_name=mandi_obj.name,
            historical_days=n,
            forecast_days=forecast_days,
            trend_direction=trend_direction,
            trend_strength_pct=trend_strength_pct,
            avg_daily_change=round(float(slope), 2),
            last_known_price=last_price,
            forecast_points=forecast_points,
            anomalies=anomalies,
            model_type="linear_regression_scenario",
            is_demo=True,
            data_source="synthetic"
        )
