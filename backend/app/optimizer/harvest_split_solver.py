"""Scipy-based mathematical optimization engine for Smart Harvest Split and Multi-Mandi Allocation.

Solver: scipy.optimize.linprog (HiGHS backend — bundled with scipy, no external solver needed).
Mathematical formulation is identical to the approved LP spec; only the solver API changes.
"""

import logging
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Tuple

import numpy as np
from scipy.optimize import linprog

from app.schemas.optimizer import (
    OptimizationRequest,
    OptimizationResponse,
    MandiAllocationItem,
    BaselineComparison,
    FinancialSummary,
    DailyInventoryRecord,
    OptimizationAssumptions,
)
from app.services.mandi_service import MandiService

logger = logging.getLogger("agrinexa.optimizer")


# ---------------------------------------------------------------------------
# Variable index builder
# ---------------------------------------------------------------------------

class _VarIndex:
    """Maps named LP variable keys to column indices in the scipy coefficient vector."""

    def __init__(self):
        self._map: Dict[str, int] = {}
        self._n = 0

    def add(self, key: str) -> int:
        if key in self._map:
            return self._map[key]
        idx = self._n
        self._map[key] = idx
        self._n += 1
        return idx

    def idx(self, key: str) -> int:
        return self._map[key]

    @property
    def n(self) -> int:
        return self._n


class HarvestSplitOptimizer:
    """
    Linear Programming solver for post-harvest crop marketing.

    Determines the optimal partition between immediate Day 0 sales and multi-day
    storage hold, allocating produce across candidate Karnataka APMC mandis.

    Uses scipy.optimize.linprog (HiGHS backend) — no external LP solver required.
    """

    def __init__(self, mandi_service: Optional[MandiService] = None):
        self.service = mandi_service or MandiService()
        self.repo = self.service.repo

    # ------------------------------------------------------------------
    # Public entry point
    # ------------------------------------------------------------------

    def optimize(self, request: OptimizationRequest) -> OptimizationResponse:
        """Execute harvest split optimization with conservation and capacity constraints."""
        crop = self.service.find_crop(request.crop_id)
        if not crop:
            raise ValueError(f"Unknown crop identifier: {request.crop_id}")

        crop_meta = next((c for c in self.repo.crops if c["crop_id"] == crop.crop_id), {})
        is_cold = request.storage_type.lower() == "cold"

        # Shelf life: T_shelf is the FINAL permitted selling day.
        # Day (T_shelf + 1) is the first prohibited day.
        shelf_life_days = int(
            crop_meta.get("shelf_life_cold_days" if is_cold else "shelf_life_ambient_days", 14)
        )
        first_prohibited_day = shelf_life_days + 1

        decay_rate = float(
            crop_meta.get("daily_decay_rate_cold" if is_cold else "daily_decay_rate_ambient", 0.01)
        )

        user_max_days = request.max_storage_days if request.max_storage_days is not None else 14
        horizon_days = max(1, min(14, shelf_life_days, user_max_days))

        base_date_str = request.harvest_date or "2026-10-25"
        try:
            base_date = datetime.strptime(base_date_str, "%Y-%m-%d")
        except Exception:
            base_date = datetime(2026, 10, 25)

        all_mandis = self.service.get_all_mandis()
        allowed_mandi_ids = request.preferred_mandi_ids or [m.mandi_id for m in all_mandis]
        candidate_mandis = [m for m in all_mandis if m.mandi_id in allowed_mandi_ids]
        if not candidate_mandis:
            candidate_mandis = all_mandis

        distance_matrix = self.repo.costs.get("distance_matrix_km", {})
        origin_dist = distance_matrix.get(request.origin_mandi_id, {})
        freight_rate = request.freight_rate_per_km_qtl or float(
            self.repo.costs.get("freight_rate_per_km_qtl", 2.25)
        )

        default_storage_rate = 8.0 if is_cold else 3.5
        storage_rate = (
            request.storage_cost_per_qtl_day
            if request.storage_cost_per_qtl_day is not None
            else default_storage_rate
        )

        # Fetch price forecasts
        forecast_points = []
        is_fallback_forecast = False
        try:
            forecast_resp = self.service.get_price_forecast(
                crop_name_or_id=crop.crop_id,
                mandi_id=request.origin_mandi_id,
                historical_days=90,
                forecast_days=14,
            )
            forecast_points = forecast_resp.forecast_points
        except Exception as e:
            logger.warning(f"Forecast generation failed for {crop.crop_id}: {e}")
            is_fallback_forecast = True

        # Current Day 0 prices per mandi
        current_prices: Dict[str, float] = {}
        for m in candidate_mandis:
            p_res = self.service.get_prices(
                crop_name_or_id=crop.crop_id, mandi_id=m.mandi_id, limit=1
            )
            if p_res.prices:
                current_prices[m.mandi_id] = p_res.prices[-1].modal_price
            else:
                current_prices[m.mandi_id] = float(crop_meta.get("base_price_inr", 2000.0))

        bench_day0 = current_prices.get(request.origin_mandi_id) or list(current_prices.values())[0]

        # Price matrix P[mandi_id, day_idx]
        price_matrix: Dict[Tuple[str, int], float] = {}
        for m in candidate_mandis:
            m_ratio = current_prices[m.mandi_id] / max(1.0, bench_day0)
            price_matrix[(m.mandi_id, 0)] = current_prices[m.mandi_id]

            for t_idx in range(1, horizon_days + 1):
                if not is_fallback_forecast and t_idx - 1 < len(forecast_points):
                    fp = forecast_points[t_idx - 1]
                    if request.risk_preference == "conservative":
                        p_val = fp.pessimistic
                    elif request.risk_preference == "growth":
                        p_val = fp.optimistic
                    else:
                        p_val = fp.normal
                else:
                    p_val = bench_day0

                price_matrix[(m.mandi_id, t_idx)] = max(50.0, round(p_val * m_ratio, 2))

        # ----------------------------------------------------------------
        # Build scipy LP
        # ----------------------------------------------------------------
        result = self._solve_scipy(
            request=request,
            candidate_mandis=candidate_mandis,
            price_matrix=price_matrix,
            origin_dist=origin_dist,
            freight_rate=freight_rate,
            storage_rate=storage_rate,
            decay_rate=decay_rate,
            shelf_life_days=shelf_life_days,
            horizon_days=horizon_days,
        )

        if result is None:
            logger.warning("scipy LP infeasible or unbounded — executing analytical fallback.")
            return self._fallback_solver(
                request, crop, candidate_mandis, current_prices, origin_dist,
                freight_rate, is_cold, shelf_life_days, first_prohibited_day,
                decay_rate, base_date,
            )

        x_vals, I_end_vals, I_start_vals, D_vals = result

        # ----------------------------------------------------------------
        # Extract allocation items
        # ----------------------------------------------------------------
        allocations: List[MandiAllocationItem] = []
        imm_sale_total = 0.0

        for t in range(horizon_days + 1):
            sale_date = (base_date + timedelta(days=t)).strftime("%Y-%m-%d")
            for m in candidate_mandis:
                q_val = round(float(x_vals.get((m.mandi_id, t), 0.0)), 3)
                if q_val < 0.001:
                    continue
                if t == 0:
                    imm_sale_total += q_val

                dist_km = origin_dist.get(m.mandi_id, 80.0)
                t_cost = round(dist_km * freight_rate * q_val, 2)
                h_rate = request.handling_charge_per_qtl if request.handling_charge_per_qtl is not None else m.handling_charge_per_qtl
                h_cost = round(h_rate * q_val, 2)
                P = price_matrix[(m.mandi_id, t)]
                gross = round(P * q_val, 2)
                m_cess = round((gross * m.market_fee_percent) / 100.0, 2)
                batch_storage = round(storage_rate * t * q_val, 2) if t > 0 else 0.0
                tot_exp = round(t_cost + h_cost + m_cess + batch_storage, 2)
                net_ret = round(gross - tot_exp, 2)

                allocations.append(
                    MandiAllocationItem(
                        selling_date=sale_date,
                        days_from_harvest=t,
                        mandi_id=m.mandi_id,
                        mandi_name=m.name,
                        district=m.district,
                        distance_km=dist_km,
                        quantity_qtl=q_val,
                        expected_price=P,
                        gross_revenue=gross,
                        transport_cost=t_cost,
                        storage_cost=batch_storage,
                        handling_cost=h_cost,
                        market_cess=m_cess,
                        total_expenses=tot_exp,
                        net_return=net_ret,
                        net_return_per_qtl=round(net_ret / q_val, 2) if q_val > 0 else 0.0,
                    )
                )

        # ----------------------------------------------------------------
        # Daily inventory audit trail
        # ----------------------------------------------------------------
        daily_records: List[DailyInventoryRecord] = []
        d0_sales = round(sum(a.quantity_qtl for a in allocations if a.days_from_harvest == 0), 3)
        d0_end = round(float(I_end_vals.get(0, 0.0)), 3)
        daily_records.append(
            DailyInventoryRecord(
                day=0,
                date=base_date.strftime("%Y-%m-%d"),
                start_inventory=0.0,
                spoilage_loss=0.0,
                sales_volume=d0_sales,
                end_inventory=d0_end,
                storage_cost_incurred=0.0,
            )
        )

        total_spoilage = 0.0
        for t in range(1, horizon_days + 1):
            t_date = (base_date + timedelta(days=t)).strftime("%Y-%m-%d")
            s_inv = round(float(I_start_vals.get(t, 0.0)), 3)
            sp_loss = round(float(D_vals.get(t, 0.0)), 3)
            s_vol = round(sum(a.quantity_qtl for a in allocations if a.days_from_harvest == t), 3)
            e_inv = round(float(I_end_vals.get(t, 0.0)), 3)
            c_cost = round(storage_rate * s_inv, 2)
            total_spoilage += sp_loss

            daily_records.append(
                DailyInventoryRecord(
                    day=t,
                    date=t_date,
                    start_inventory=s_inv,
                    spoilage_loss=sp_loss,
                    sales_volume=s_vol,
                    end_inventory=e_inv,
                    storage_cost_incurred=c_cost,
                )
            )

        stored_qty_val = d0_end
        terminal_unsold_val = daily_records[-1].end_inventory if daily_records else 0.0
        total_spoilage_val = round(total_spoilage, 3)

        # Financial summary
        tot_gross = round(sum(a.gross_revenue for a in allocations), 2)
        tot_transport = round(sum(a.transport_cost for a in allocations), 2)
        tot_storage = round(sum(r.storage_cost_incurred for r in daily_records), 2)
        tot_handling = round(sum(a.handling_cost for a in allocations), 2)
        tot_cess = round(sum(a.market_cess for a in allocations), 2)
        tot_expenses = round(tot_transport + tot_storage + tot_handling + tot_cess, 2)
        tot_net = round(tot_gross - tot_expenses, 2)
        net_per_qtl = round(tot_net / request.total_harvest_qty, 2)

        baseline = self._compute_feasible_baseline(
            request.total_harvest_qty,
            candidate_mandis,
            current_prices,
            origin_dist,
            freight_rate,
            request.handling_charge_per_qtl,
            request.daily_selling_capacity,
        )
        opt_gain_inr = round(max(0.0, tot_net - baseline.net_return), 2)
        opt_gain_pct = round((opt_gain_inr / max(1.0, abs(baseline.net_return))) * 100.0, 1)

        # Conservation check
        total_allocated_sum = round(
            sum(a.quantity_qtl for a in allocations) + total_spoilage_val + terminal_unsold_val, 2
        )
        conservation_reconciled = abs(total_allocated_sum - round(request.total_harvest_qty, 2)) < 0.05

        origin_mandi_obj = self.service.get_mandi_by_id(request.origin_mandi_id)
        origin_name = (
            origin_mandi_obj.name.split("(")[0].strip()
            if origin_mandi_obj
            else request.origin_mandi_id
        )

        rationale = self._generate_advisory_rationale(
            crop.name_en,
            request.total_harvest_qty,
            imm_sale_total,
            stored_qty_val,
            opt_gain_inr,
            opt_gain_pct,
            allocations,
            request.risk_preference,
            baseline,
        )

        return OptimizationResponse(
            crop_id=crop.crop_id,
            crop_name=crop.name_en,
            total_harvest_qty=request.total_harvest_qty,
            origin_mandi_id=request.origin_mandi_id,
            origin_mandi_name=origin_name,
            status="optimal",
            immediate_sale_qty=round(imm_sale_total, 3),
            stored_qty=round(stored_qty_val, 3),
            total_spoilage_qty=round(total_spoilage_val, 3),
            terminal_unsold_qty=round(terminal_unsold_val, 3),
            harvest_conservation_reconciled=conservation_reconciled,
            allocations=allocations,
            daily_inventory=daily_records,
            financial_summary=FinancialSummary(
                total_gross_revenue=tot_gross,
                total_transport_cost=tot_transport,
                total_storage_cost=tot_storage,
                total_handling_cost=tot_handling,
                total_market_cess=tot_cess,
                total_expenses=tot_expenses,
                expected_net_return=tot_net,
                net_return_per_qtl=net_per_qtl,
                baseline=baseline,
                optimization_gain_inr=opt_gain_inr,
                optimization_gain_pct=opt_gain_pct,
            ),
            assumptions=OptimizationAssumptions(
                shelf_life_days=shelf_life_days,
                first_prohibited_day=first_prohibited_day,
                daily_decay_rate=decay_rate,
                storage_type=request.storage_type,
                forecast_model="OLS Trend Regression + Volatility Envelope",
                risk_mode_applied=request.risk_preference,
                terminal_salvage_value_per_qtl=0.0,
                is_demo=True,
                data_source="synthetic",
            ),
            advisory_rationale=rationale,
            is_demo=True,
            data_source="synthetic",
        )

    # ------------------------------------------------------------------
    # scipy LP solver
    # ------------------------------------------------------------------

    def _solve_scipy(
        self,
        request: OptimizationRequest,
        candidate_mandis: list,
        price_matrix: Dict[Tuple[str, int], float],
        origin_dist: dict,
        freight_rate: float,
        storage_rate: float,
        decay_rate: float,
        shelf_life_days: int,
        horizon_days: int,
    ) -> Optional[Tuple[dict, dict, dict, dict]]:
        """
        Formulates and solves the LP using scipy.optimize.linprog (HiGHS).

        Decision variable layout in vector v:
          x[(m, t)]      for m in mandis, t in 0..horizon_days   -> sales
          I_end[0]                                                -> Day-0 storage
          I_end[t]       for t in 1..horizon_days                 -> end-of-day inventory
          I_start[t]     for t in 1..horizon_days                 -> start-of-day inventory
          D[t]           for t in 1..horizon_days                 -> daily spoilage

        Returns (x_vals, I_end_vals, I_start_vals, D_vals) dicts or None if infeasible.
        """
        H = request.total_harvest_qty
        C_store = request.storage_capacity_qty
        daily_cap = request.daily_selling_capacity  # None => no limit

        M = len(candidate_mandis)
        T = horizon_days

        vi = _VarIndex()

        # --- register variables ---
        # x[(mid, t)]
        for m in candidate_mandis:
            for t in range(T + 1):
                vi.add(f"x_{m.mandi_id}_{t}")

        # I_end[0]
        vi.add("I_end_0")

        # I_end[t], I_start[t], D[t] for t = 1..T
        for t in range(1, T + 1):
            vi.add(f"I_end_{t}")
            vi.add(f"I_start_{t}")
            vi.add(f"D_{t}")

        n = vi.n

        # --- objective (linprog minimizes, so negate for maximization) ---
        c_obj = np.zeros(n)

        for m in candidate_mandis:
            dist_km = origin_dist.get(m.mandi_id, 80.0)
            t_cost_per_qtl = dist_km * freight_rate
            h_rate = request.handling_charge_per_qtl if request.handling_charge_per_qtl is not None else m.handling_charge_per_qtl
            fee_pct = m.market_fee_percent / 100.0

            for t in range(T + 1):
                P = price_matrix[(m.mandi_id, t)]
                net_unit = (P * (1.0 - fee_pct)) - (t_cost_per_qtl + h_rate)
                c_obj[vi.idx(f"x_{m.mandi_id}_{t}")] = -net_unit  # negated for minimization

        # Storage costs: charged on I_start[t]
        for t in range(1, T + 1):
            c_obj[vi.idx(f"I_start_{t}")] += storage_rate  # positive = cost to minimize

        # --- bounds ---
        # Default: [0, None] (non-negative, unbounded above)
        bounds = [(0.0, None)] * n

        # x[(m, t)] upper bound: 0 if t > shelf_life (prohibited days)
        for m in candidate_mandis:
            for t in range(T + 1):
                if t > shelf_life_days:
                    bounds[vi.idx(f"x_{m.mandi_id}_{t}")] = (0.0, 0.0)

        # I_end[0] and I_start[t] bounded by storage capacity
        bounds[vi.idx("I_end_0")] = (0.0, float(C_store))
        for t in range(1, T + 1):
            bounds[vi.idx(f"I_start_{t}")] = (0.0, float(C_store))
            bounds[vi.idx(f"I_end_{t}")] = (0.0, float(C_store))

        # --- equality constraints ---
        # We build a list of (row_dict, rhs) pairs, then convert to A_eq / b_eq.
        eq_rows: List[Tuple[Dict[int, float], float]] = []

        # [1] Day 0 harvest conservation:
        #     sum_m x(m,0) + I_end_0 = H
        row: Dict[int, float] = {}
        for m in candidate_mandis:
            row[vi.idx(f"x_{m.mandi_id}_0")] = 1.0
        row[vi.idx("I_end_0")] = 1.0
        eq_rows.append((row, H))

        for t in range(1, T + 1):
            # [2] Carryover: I_start[t] = I_end[t-1]
            row = {
                vi.idx(f"I_start_{t}"): 1.0,
                vi.idx(f"I_end_{t - 1}" if t > 1 else "I_end_0"): -1.0,
            }
            eq_rows.append((row, 0.0))

            # [3] Spoilage: D[t] = decay_rate * I_start[t]
            row = {
                vi.idx(f"D_{t}"): 1.0,
                vi.idx(f"I_start_{t}"): -decay_rate,
            }
            eq_rows.append((row, 0.0))

            # [4] Inventory balance: I_end[t] = I_start[t] - D[t] - sum_m x(m,t)
            #     => I_end[t] - I_start[t] + D[t] + sum_m x(m,t) = 0
            row = {
                vi.idx(f"I_end_{t}"): 1.0,
                vi.idx(f"I_start_{t}"): -1.0,
                vi.idx(f"D_{t}"): 1.0,
            }
            for m in candidate_mandis:
                row[vi.idx(f"x_{m.mandi_id}_{t}")] = 1.0
            eq_rows.append((row, 0.0))

        n_eq = len(eq_rows)
        A_eq = np.zeros((n_eq, n))
        b_eq = np.zeros(n_eq)
        for row_idx, (col_dict, rhs) in enumerate(eq_rows):
            for col_idx, coef in col_dict.items():
                A_eq[row_idx, col_idx] = coef
            b_eq[row_idx] = rhs

        # --- inequality constraints (A_ub @ x <= b_ub) ---
        ub_rows: List[Tuple[Dict[int, float], float]] = []

        if daily_cap is not None and daily_cap > 0:
            for t in range(T + 1):
                row = {}
                for m in candidate_mandis:
                    row[vi.idx(f"x_{m.mandi_id}_{t}")] = 1.0
                ub_rows.append((row, float(daily_cap)))

        A_ub: Optional[np.ndarray] = None
        b_ub: Optional[np.ndarray] = None
        if ub_rows:
            A_ub = np.zeros((len(ub_rows), n))
            b_ub = np.zeros(len(ub_rows))
            for row_idx, (col_dict, rhs) in enumerate(ub_rows):
                for col_idx, coef in col_dict.items():
                    A_ub[row_idx, col_idx] = coef
                b_ub[row_idx] = rhs

        # --- solve ---
        try:
            result = linprog(
                c_obj,
                A_ub=A_ub,
                b_ub=b_ub,
                A_eq=A_eq,
                b_eq=b_eq,
                bounds=bounds,
                method="highs",
                options={"disp": False, "presolve": True},
            )
        except Exception as e:
            logger.error(f"linprog raised exception: {e}")
            return None

        if result.status != 0:
            logger.warning(f"linprog status {result.status}: {result.message}")
            return None

        v = result.x

        # --- unpack solution ---
        x_vals: Dict[Tuple[str, int], float] = {}
        for m in candidate_mandis:
            for t in range(T + 1):
                x_vals[(m.mandi_id, t)] = max(0.0, float(v[vi.idx(f"x_{m.mandi_id}_{t}")]))

        I_end_vals: Dict[int, float] = {}
        I_end_vals[0] = max(0.0, float(v[vi.idx("I_end_0")]))
        for t in range(1, T + 1):
            I_end_vals[t] = max(0.0, float(v[vi.idx(f"I_end_{t}")]))

        I_start_vals: Dict[int, float] = {}
        D_vals: Dict[int, float] = {}
        for t in range(1, T + 1):
            I_start_vals[t] = max(0.0, float(v[vi.idx(f"I_start_{t}")]))
            D_vals[t] = max(0.0, float(v[vi.idx(f"D_{t}")]))

        return x_vals, I_end_vals, I_start_vals, D_vals

    # ------------------------------------------------------------------
    # Feasible immediate-sale baseline
    # ------------------------------------------------------------------

    def _compute_feasible_baseline(
        self,
        total_harvest_qty: float,
        mandis: list,
        current_prices: dict,
        dist_map: dict,
        freight_rate: float,
        handling_override: Optional[float],
        daily_capacity: Optional[float],
    ) -> BaselineComparison:
        """
        Computes an immediate-sale baseline that accounts for the entire harvest.
        Subject to identical Day 0 daily selling capacity, transport, handling, and market cess.
        """
        sold_qty = min(total_harvest_qty, daily_capacity) if daily_capacity else total_harvest_qty
        unsold_qty = round(total_harvest_qty - sold_qty, 3)

        best_m = None
        best_net = -1e15
        best_gross = 0.0
        best_transport = 0.0
        best_handling = 0.0
        best_cess = 0.0

        for m in mandis:
            P = current_prices.get(m.mandi_id, 2000.0)
            dist_km = dist_map.get(m.mandi_id, 80.0)
            t_cost = round(dist_km * freight_rate * sold_qty, 2)
            h_rate = handling_override if handling_override is not None else m.handling_charge_per_qtl
            h_cost = round(h_rate * sold_qty, 2)
            gross = round(P * sold_qty, 2)
            cess = round((gross * m.market_fee_percent) / 100.0, 2)
            net = round(gross - (t_cost + h_cost + cess), 2)
            if net > best_net:
                best_net = net
                best_m = m
                best_gross = gross
                best_transport = t_cost
                best_handling = h_cost
                best_cess = cess

        m_name = best_m.name.split("(")[0].strip() if best_m else "Primary APMC"
        mid = best_m.mandi_id if best_m else "mandi_bengaluru"

        tot_expenses = round(best_transport + best_handling + best_cess, 2)
        net_ret = round(best_gross - tot_expenses, 2)

        return BaselineComparison(
            mandi_id=mid,
            mandi_name=m_name,
            sold_qty=round(sold_qty, 3),
            unsold_qty=round(unsold_qty, 3),
            gross_revenue=best_gross,
            transport_cost=best_transport,
            handling_cost=best_handling,
            market_cess=best_cess,
            total_expenses=tot_expenses,
            net_return=net_ret,
            net_return_per_qtl=round(net_ret / total_harvest_qty, 2),
            unmarketable_loss_qty=unsold_qty,
        )

    # ------------------------------------------------------------------
    # Analytical fallback
    # ------------------------------------------------------------------

    def _fallback_solver(
        self,
        request: OptimizationRequest,
        crop,
        mandis: list,
        current_prices: dict,
        origin_dist: dict,
        freight_rate: float,
        is_cold: bool,
        shelf_life_days: int,
        first_prohibited_day: int,
        decay_rate: float,
        base_date: datetime,
    ) -> OptimizationResponse:
        """Deterministic analytical fallback accounting for full harvest when LP solver is infeasible."""
        baseline = self._compute_feasible_baseline(
            request.total_harvest_qty,
            mandis,
            current_prices,
            origin_dist,
            freight_rate,
            request.handling_charge_per_qtl,
            request.daily_selling_capacity,
        )

        alloc = MandiAllocationItem(
            selling_date=base_date.strftime("%Y-%m-%d"),
            days_from_harvest=0,
            mandi_id=baseline.mandi_id,
            mandi_name=baseline.mandi_name,
            district=mandis[0].district if mandis else "Karnataka",
            distance_km=origin_dist.get(baseline.mandi_id, 80.0),
            quantity_qtl=baseline.sold_qty,
            expected_price=current_prices.get(baseline.mandi_id, 2000.0),
            gross_revenue=baseline.gross_revenue,
            transport_cost=baseline.transport_cost,
            storage_cost=0.0,
            handling_cost=baseline.handling_cost,
            market_cess=baseline.market_cess,
            total_expenses=baseline.total_expenses,
            net_return=baseline.net_return,
            net_return_per_qtl=(
                round(baseline.net_return / baseline.sold_qty, 2) if baseline.sold_qty > 0 else 0.0
            ),
        )

        d0_rec = DailyInventoryRecord(
            day=0,
            date=base_date.strftime("%Y-%m-%d"),
            start_inventory=0.0,
            spoilage_loss=0.0,
            sales_volume=baseline.sold_qty,
            end_inventory=0.0,
            storage_cost_incurred=0.0,
        )

        return OptimizationResponse(
            crop_id=crop.crop_id,
            crop_name=crop.name_en,
            total_harvest_qty=request.total_harvest_qty,
            origin_mandi_id=request.origin_mandi_id,
            origin_mandi_name=baseline.mandi_name,
            status="fallback",
            immediate_sale_qty=baseline.sold_qty,
            stored_qty=0.0,
            total_spoilage_qty=0.0,
            terminal_unsold_qty=baseline.unsold_qty,
            harvest_conservation_reconciled=True,
            allocations=[alloc],
            daily_inventory=[d0_rec],
            financial_summary=FinancialSummary(
                total_gross_revenue=baseline.gross_revenue,
                total_transport_cost=baseline.transport_cost,
                total_storage_cost=0.0,
                total_handling_cost=baseline.handling_cost,
                total_market_cess=baseline.market_cess,
                total_expenses=baseline.total_expenses,
                expected_net_return=baseline.net_return,
                net_return_per_qtl=baseline.net_return_per_qtl,
                baseline=baseline,
                optimization_gain_inr=0.0,
                optimization_gain_pct=0.0,
            ),
            assumptions=OptimizationAssumptions(
                shelf_life_days=shelf_life_days,
                first_prohibited_day=first_prohibited_day,
                daily_decay_rate=decay_rate,
                storage_type=request.storage_type,
                forecast_model="Fallback Direct Allocation",
                risk_mode_applied=request.risk_preference,
                terminal_salvage_value_per_qtl=0.0,
                is_demo=True,
                data_source="synthetic",
            ),
            advisory_rationale=(
                f"Due to strict constraints, direct sale of {baseline.sold_qty:g} quintals to "
                f"{baseline.mandi_name} on Day 0 avoids spoilage losses and secures an immediate "
                f"net return of \u20b9{baseline.net_return:,.0f}."
            ),
            is_demo=True,
            data_source="synthetic",
        )

    # ------------------------------------------------------------------
    # Advisory rationale generator
    # ------------------------------------------------------------------

    def _generate_advisory_rationale(
        self,
        crop_name: str,
        total_qty: float,
        immediate_qty: float,
        stored_qty: float,
        gain_inr: float,
        gain_pct: float,
        allocations: list,
        risk: str,
        baseline: BaselineComparison,
    ) -> str:
        """Generates a farmer-friendly explanation of the optimization output."""
        primary_mandi = (
            allocations[0].mandi_name.split("(")[0].strip()
            if allocations
            else "nearest APMC"
        )

        if stored_qty > 0.5:
            return (
                f"For your {total_qty:g} quintals of {crop_name}, our mathematical model recommends "
                f"a staged split. Sell {immediate_qty:g} quintals on Day 0 to capture current prices "
                f"at {primary_mandi}, while storing {stored_qty:g} quintals for subsequent sale. "
                f"Under your {risk} scenario profile, this strategy yields an estimated net return "
                f"of \u20b9{sum(a.net_return for a in allocations):,.0f}, gaining an extra "
                f"\u20b9{gain_inr:,.0f} (+{gain_pct}%) over a feasible immediate sale baseline "
                f"(\u20b9{baseline.net_return:,.0f})."
            )
        else:
            return (
                f"For your {total_qty:g} quintals of {crop_name}, immediate sale to {primary_mandi} "
                f"is optimal. Current market prices exceed anticipated future price gains after "
                f"accounting for daily storage charges and decay. Selling today secures an immediate "
                f"estimated net return of \u20b9{baseline.net_return:,.0f} while avoiding spoilage risk."
            )
