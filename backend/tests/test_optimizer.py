"""Deterministic unit and integration tests for Smart Harvest Split Optimization Engine."""

import pytest
from app.schemas.optimizer import OptimizationRequest, OptimizationResponse
from app.optimizer.harvest_split_solver import HarvestSplitOptimizer
from app.services.mandi_service import MandiService


@pytest.fixture(scope="module")
def optimizer():
    return HarvestSplitOptimizer(MandiService())


def test_harvest_conservation(optimizer):
    """
    Test 1: Global Harvest Conservation
    Verifies that Total Sales + Total Spoilage + Terminal Unsold == Total Harvest
    """
    H = 100.0
    req = OptimizationRequest(
        crop_id="crop_tomato",
        total_harvest_qty=H,
        storage_capacity_qty=60.0,
        storage_type="ambient",
        risk_preference="balanced"
    )
    res = optimizer.optimize(req)

    assert res.status in ["optimal", "feasible"]
    total_sales = sum(a.quantity_qtl for a in res.allocations)
    total_spoilage = res.total_spoilage_qty
    terminal_unsold = res.terminal_unsold_qty

    reconciled_sum = round(total_sales + total_spoilage + terminal_unsold, 2)
    assert abs(reconciled_sum - H) < 0.1, (
        f"Conservation violated: Sales ({total_sales}) + Spoilage ({total_spoilage}) + "
        f"Unsold ({terminal_unsold}) = {reconciled_sum} != Harvest ({H})"
    )
    assert res.harvest_conservation_reconciled is True


def test_inventory_flow_and_spoilage(optimizer):
    """
    Test 2: Inter-day inventory balance and daily spoilage calculation
    Verifies that for each storage day t:
    I_start[t] == I_end[t-1]
    D[t] == decay_rate * I_start[t]
    I_end[t] == I_start[t] - D[t] - Sales[t]
    """
    req = OptimizationRequest(
        crop_id="crop_onion",
        total_harvest_qty=80.0,
        storage_capacity_qty=50.0,
        storage_type="ambient",
        risk_preference="growth"
    )
    res = optimizer.optimize(req)

    decay_rate = res.assumptions.daily_decay_rate
    daily_records = {r.day: r for r in res.daily_inventory}

    for t in range(1, len(daily_records)):
        rec = daily_records[t]
        prev_rec = daily_records[t - 1]

        # Carryover check
        assert abs(rec.start_inventory - prev_rec.end_inventory) < 0.05, (
            f"Day {t} start inventory {rec.start_inventory} != Day {t-1} end inventory {prev_rec.end_inventory}"
        )

        # Spoilage check
        expected_spoilage = round(decay_rate * rec.start_inventory, 3)
        assert abs(rec.spoilage_loss - expected_spoilage) < 0.05, (
            f"Day {t} spoilage {rec.spoilage_loss} != expected {expected_spoilage}"
        )

        # Ending inventory balance
        computed_end = round(rec.start_inventory - rec.spoilage_loss - rec.sales_volume, 3)
        assert abs(rec.end_inventory - computed_end) < 0.05, (
            f"Day {t} balance error: end {rec.end_inventory} != start - spoilage - sales ({computed_end})"
        )


def test_storage_costs_no_charge_on_sold(optimizer):
    """
    Test 3: Storage costs are strictly charged on held inventory and NEVER on produce already sold.
    Day 0 sales must incur ₹0 storage cost.
    """
    req = OptimizationRequest(
        crop_id="crop_tomato",
        total_harvest_qty=50.0,
        storage_capacity_qty=25.0,
        storage_type="ambient",
        storage_cost_per_qtl_day=4.0
    )
    res = optimizer.optimize(req)

    # Check Day 0 allocations
    day0_allocs = [a for a in res.allocations if a.days_from_harvest == 0]
    for a in day0_allocs:
        assert a.storage_cost == 0.0, f"Day 0 allocation {a} was improperly charged storage cost {a.storage_cost}"

    # Check daily inventory storage cost calculation
    for rec in res.daily_inventory:
        if rec.day == 0:
            assert rec.storage_cost_incurred == 0.0
        else:
            expected_cost = round(rec.start_inventory * 4.0, 2)
            assert abs(rec.storage_cost_incurred - expected_cost) < 0.1


def test_shelf_life_boundary_enforcement(optimizer):
    """
    Test 4: Shelf-Life Boundary Tests
    - Configured shelf-life T_shelf is the FINAL permitted selling day.
    - Day (T_shelf + 1) is the FIRST prohibited selling day (sales must be strictly 0).
    """
    # Tomato ambient shelf-life is 6 days
    req = OptimizationRequest(
        crop_id="crop_tomato",
        total_harvest_qty=100.0,
        storage_capacity_qty=100.0,
        storage_type="ambient",
        max_storage_days=10  # Farmer requested 10 days, but crop shelf life is 6 days
    )
    res = optimizer.optimize(req)

    shelf_life = res.assumptions.shelf_life_days
    first_prohibited = res.assumptions.first_prohibited_day

    assert shelf_life == 6
    assert first_prohibited == 7

    # Sales must be 0 for all days > shelf_life
    for alloc in res.allocations:
        assert alloc.days_from_harvest <= shelf_life, (
            f"Violation: Sale planned on day {alloc.days_from_harvest} which exceeds shelf-life {shelf_life}"
        )


def test_daily_selling_limit(optimizer):
    """
    Test 5: Daily Selling Capacity
    Verifies total daily dispatch across all mandis never exceeds daily_selling_capacity.
    """
    daily_cap = 25.0
    H = 100.0
    req = OptimizationRequest(
        crop_id="crop_potato",
        total_harvest_qty=H,
        storage_capacity_qty=100.0,
        storage_type="ambient",
        daily_selling_capacity=daily_cap
    )
    res = optimizer.optimize(req)

    # Check daily sales in inventory audit trail
    for rec in res.daily_inventory:
        assert rec.sales_volume <= daily_cap + 0.05, (
            f"Day {rec.day} sales {rec.sales_volume} exceeded daily capacity {daily_cap}"
        )


def test_storage_capacity_limits(optimizer):
    """
    Test 6: Storage Capacity Enforcement
    - Case A: Normal storage capacity constraint
    - Case B: Zero storage capacity (C_storage == 0) forcing 100% immediate Day 0 allocation
    """
    # Case A: Limit of 30 qtl
    req_a = OptimizationRequest(
        crop_id="crop_onion",
        total_harvest_qty=100.0,
        storage_capacity_qty=30.0,
        storage_type="ambient"
    )
    res_a = optimizer.optimize(req_a)
    assert res_a.stored_qty <= 30.05, f"Stored qty {res_a.stored_qty} exceeded capacity 30"

    # Case B: Zero storage capacity
    req_b = OptimizationRequest(
        crop_id="crop_onion",
        total_harvest_qty=100.0,
        storage_capacity_qty=0.0,
        storage_type="ambient"
    )
    res_b = optimizer.optimize(req_b)
    assert res_b.stored_qty == 0.0, f"Expected 0 stored qty when capacity is 0, got {res_b.stored_qty}"
    assert abs(res_b.immediate_sale_qty - 100.0) < 0.1, "All produce should be immediate sale when storage is 0"


def test_fair_baseline_comparison(optimizer):
    """
    Test 7: Fair Baseline Comparison
    - Baseline must account for the ENTIRE harvest.
    - If daily capacity < harvest, baseline reports sold_qty and unsold_qty.
    - Uses identical cost formulas for transport, handling, and market cess.
    """
    H = 100.0
    daily_cap = 40.0
    req = OptimizationRequest(
        crop_id="crop_tomato",
        total_harvest_qty=H,
        storage_capacity_qty=80.0,
        daily_selling_capacity=daily_cap
    )
    res = optimizer.optimize(req)

    b = res.financial_summary.baseline
    # Baseline accounts for full harvest
    assert abs(b.sold_qty + b.unsold_qty - H) < 0.05
    assert b.sold_qty == daily_cap
    assert b.unsold_qty == H - daily_cap
    assert b.unmarketable_loss_qty == H - daily_cap

    # Net return per quintal is calculated over full harvest H
    expected_net_per_qtl = round(b.net_return / H, 2)
    assert abs(b.net_return_per_qtl - expected_net_per_qtl) < 0.1


def test_missing_forecast_fallback(optimizer):
    """
    Test 8: Fallback Handling for Missing Forecasts
    Verifies that when forecast fails, solver executes graceful fallback without crashing.
    """
    req = OptimizationRequest(
        crop_id="crop_tomato",
        total_harvest_qty=50.0,
        origin_mandi_id="mandi_kolar"
    )
    # Even if forecast fails, fallback solver accounts for full harvest
    from datetime import datetime
    res = optimizer._fallback_solver(
        req,
        optimizer.service.find_crop("crop_tomato"),
        optimizer.service.get_all_mandis(),
        {"mandi_kolar": 1500.0},
        {"mandi_kolar": 15.0},
        2.25,
        False,
        6,
        7,
        0.045,
        datetime(2026, 10, 25)
    )
    assert res.status == "fallback"
    assert res.immediate_sale_qty == 50.0
    assert res.harvest_conservation_reconciled is True


def test_risk_preferences_scenario_selection(optimizer):
    """
    Test 9: Risk Preference Scenario Verification
    Verifies that:
    - Conservative, Balanced, and Growth modes execute cleanly.
    - Each mode records the correct risk_mode_applied in assumptions.
    - All modes satisfy conservation, non-negativity, and cost reconciliation.
    """
    for risk in ["conservative", "balanced", "growth"]:
        req = OptimizationRequest(
            crop_id="crop_tomato",
            total_harvest_qty=60.0,
            storage_capacity_qty=30.0,
            storage_type="ambient",
            risk_preference=risk
        )
        res = optimizer.optimize(req)

        assert res.assumptions.risk_mode_applied == risk
        assert res.status == "optimal"
        assert res.harvest_conservation_reconciled is True
        assert res.immediate_sale_qty >= 0.0
        assert res.stored_qty >= 0.0
        assert res.financial_summary.total_expenses >= 0.0


def test_invalid_input_validation():
    """
    Test 10: Input Validation
    Verifies invalid inputs (e.g. non-positive harvest qty, zero daily selling capacity) raise errors.
    """
    with pytest.raises(ValueError):
        OptimizationRequest(
            crop_id="crop_tomato",
            total_harvest_qty=-10.0
        )

    with pytest.raises(ValueError):
        OptimizationRequest(
            crop_id="crop_tomato",
            total_harvest_qty=50.0,
            daily_selling_capacity=0.0
        )
