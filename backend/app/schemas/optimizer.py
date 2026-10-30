"""Pydantic schemas for Smart Harvest Split and Multi-Mandi Optimization."""

from typing import List, Optional, Dict
from pydantic import BaseModel, Field, model_validator


class OptimizationRequest(BaseModel):
    crop_id: str = Field(..., description="Crop identifier, e.g. 'crop_tomato'")
    total_harvest_qty: float = Field(..., gt=0.0, description="Total harvest volume in quintals")
    harvest_date: Optional[str] = Field(None, description="Harvest observation date in YYYY-MM-DD")
    origin_mandi_id: str = Field("mandi_kolar", description="Farm vicinity / origin mandi ID for distance benchmarking")
    preferred_mandi_ids: Optional[List[str]] = Field(None, description="Subset of mandis considered, or None for all")
    storage_capacity_qty: float = Field(0.0, ge=0.0, description="Maximum storage capacity in quintals (0 = no storage available)")
    storage_type: str = Field("ambient", description="'ambient' or 'cold'")
    storage_cost_per_qtl_day: Optional[float] = Field(None, ge=0.0, description="Storage cost INR/qtl/day")
    freight_rate_per_km_qtl: Optional[float] = Field(None, ge=0.0, description="Freight cost INR/km/qtl")
    handling_charge_per_qtl: Optional[float] = Field(None, ge=0.0, description="Handling charge INR/qtl")
    daily_selling_capacity: Optional[float] = Field(None, gt=0.0, description="Max quintals dispatchable across all mandis per day")
    max_storage_days: Optional[int] = Field(None, ge=0, le=30, description="Maximum days farmer wishes to store")
    risk_preference: str = Field("balanced", description="'conservative', 'balanced', or 'growth'")

    @model_validator(mode="after")
    def validate_inputs(self):
        if self.daily_selling_capacity is not None and self.daily_selling_capacity <= 0:
            raise ValueError("daily_selling_capacity must be greater than zero.")
        return self


class MandiAllocationItem(BaseModel):
    selling_date: str = Field(..., description="Date of proposed sale YYYY-MM-DD")
    days_from_harvest: int = Field(..., ge=0, description="Days stored prior to sale (0 = immediate harvest day)")
    mandi_id: str = Field(..., description="Target APMC mandi identifier")
    mandi_name: str = Field(..., description="Display name of target mandi")
    district: str = Field(..., description="District in Karnataka")
    distance_km: float = Field(..., ge=0.0, description="Distance from farm origin in km")
    quantity_qtl: float = Field(..., ge=0.0, description="Harvest quantity allocated for sale in quintals")
    expected_price: float = Field(..., ge=0.0, description="Expected auction selling price (INR/quintal)")
    gross_revenue: float = Field(..., ge=0.0, description="Gross revenue from this batch in INR")
    transport_cost: float = Field(..., ge=0.0, description="Transportation freight cost in INR")
    storage_cost: float = Field(..., ge=0.0, description="Storage cost accumulated for this batch in INR")
    handling_cost: float = Field(..., ge=0.0, description="Handling and labor cost in INR")
    market_cess: float = Field(..., ge=0.0, description="APMC statutory market cess in INR")
    total_expenses: float = Field(..., ge=0.0, description="Total marketing expenses for this batch in INR")
    net_return: float = Field(..., description="Net return in INR (Gross Revenue - Total Expenses)")
    net_return_per_qtl: float = Field(..., description="Net return per quintal in INR")


class BaselineComparison(BaseModel):
    """
    Feasible immediate-sale baseline accounting for the entire harvest.
    Subject to identical Day 0 selling capacity, transport, handling, and market cess.
    """
    mandi_id: str = Field(..., description="Best APMC mandi selected for Day 0 immediate sale")
    mandi_name: str = Field(..., description="Name of baseline mandi")
    sold_qty: float = Field(..., ge=0.0, description="Quantity sold immediately on Day 0")
    unsold_qty: float = Field(..., ge=0.0, description="Quantity that could not be sold on Day 0 due to capacity limits")
    gross_revenue: float = Field(..., ge=0.0, description="Gross sales revenue on Day 0 in INR")
    transport_cost: float = Field(..., ge=0.0, description="Transportation freight cost in INR")
    handling_cost: float = Field(..., ge=0.0, description="Handling fee in INR")
    market_cess: float = Field(..., ge=0.0, description="Statutory APMC fee in INR")
    total_expenses: float = Field(..., ge=0.0, description="Total expenses in INR")
    net_return: float = Field(..., description="Net return from immediate Day 0 sale in INR")
    net_return_per_qtl: float = Field(..., description="Net return per quintal of total harvest in INR")
    unmarketable_loss_qty: float = Field(0.0, ge=0.0, description="Produce lost if unsold on Day 0 without storage")


class FinancialSummary(BaseModel):
    total_gross_revenue: float = Field(..., description="Sum of gross revenues across all sales batches")
    total_transport_cost: float = Field(..., description="Total freight cost")
    total_storage_cost: float = Field(..., description="Total storage cost (only charged on produce while held in storage)")
    total_handling_cost: float = Field(..., description="Total handling charge")
    total_market_cess: float = Field(..., description="Total statutory market fee")
    total_expenses: float = Field(..., description="Sum of all logistics, storage, handling and market fees")
    expected_net_return: float = Field(..., description="Net take-home profit (Gross Revenue - Total Expenses)")
    net_return_per_qtl: float = Field(..., description="Net return per quintal of initial harvest volume")
    baseline: BaselineComparison = Field(..., description="Feasible Day 0 immediate sale baseline accounting for full harvest")
    optimization_gain_inr: float = Field(..., description="Incremental net return over feasible baseline in INR")
    optimization_gain_pct: float = Field(..., description="Incremental percentage gain over baseline")


class DailyInventoryRecord(BaseModel):
    day: int = Field(..., ge=0, description="Day index (0 = harvest day)")
    date: str = Field(..., description="Calendar date YYYY-MM-DD")
    start_inventory: float = Field(..., ge=0.0, description="Inventory in storage at start of day (quintals)")
    spoilage_loss: float = Field(..., ge=0.0, description="Spoilage decay during the day (quintals)")
    sales_volume: float = Field(..., ge=0.0, description="Total sales dispatched on this day (quintals)")
    end_inventory: float = Field(..., ge=0.0, description="Inventory remaining in storage at end of day (quintals)")
    storage_cost_incurred: float = Field(..., ge=0.0, description="Storage cost charged for this day in INR")


class OptimizationAssumptions(BaseModel):
    shelf_life_days: int = Field(..., description="Configured shelf-life (the FINAL permitted selling day)")
    first_prohibited_day: int = Field(..., description="First day on which sales are strictly prohibited (shelf_life + 1)")
    daily_decay_rate: float = Field(..., description="Daily spoilage fraction applied to inventory at start of day")
    storage_type: str = Field(..., description="'ambient' or 'cold'")
    forecast_model: str = Field("OLS Trend Regression + Volatility Envelope", description="Forecasting method applied")
    risk_mode_applied: str = Field(..., description="Risk preference scenario used: 'conservative', 'balanced', or 'growth'")
    terminal_salvage_value_per_qtl: float = Field(0.0, description="Terminal salvage revenue per quintal of unsold produce (0.0)")
    is_demo: bool = Field(True, description="Indicates simulated demonstration data")
    data_source: str = Field("synthetic", description="Origin of data")


class OptimizationResponse(BaseModel):
    crop_id: str = Field(..., description="Crop identifier")
    crop_name: str = Field(..., description="Crop common name")
    total_harvest_qty: float = Field(..., description="Total harvest volume in quintals")
    origin_mandi_id: str = Field(..., description="Farm origin identifier")
    origin_mandi_name: str = Field(..., description="Farm origin display name")
    status: str = Field(..., description="'optimal', 'feasible', or 'fallback'")
    immediate_sale_qty: float = Field(..., ge=0.0, description="Quintals sold immediately on harvest Day 0")
    stored_qty: float = Field(..., ge=0.0, description="Quintals transferred to storage on Day 0")
    total_spoilage_qty: float = Field(..., ge=0.0, description="Total spoilage loss across storage days (quintals)")
    terminal_unsold_qty: float = Field(..., ge=0.0, description="Produce remaining unsold at horizon end (quintals)")
    harvest_conservation_reconciled: bool = Field(True, description="True if sales + spoilage + unsold == total harvest")
    allocations: List[MandiAllocationItem] = Field(..., description="Batch allocations across mandis and dates")
    daily_inventory: List[DailyInventoryRecord] = Field(..., description="Day-by-day inventory audit trail")
    financial_summary: FinancialSummary = Field(..., description="Complete revenue, expenses, and baseline comparison")
    assumptions: OptimizationAssumptions = Field(..., description="Model boundaries and parameter metadata")
    advisory_rationale: str = Field(..., description="Plain-language explanation of recommendation")
    is_demo: bool = Field(True, description="Synthetic demonstration flag")
    data_source: str = Field("synthetic", description="Data origin")
