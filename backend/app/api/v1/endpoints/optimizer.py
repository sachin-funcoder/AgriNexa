"""Smart Harvest Split and Multi-Mandi Optimization API Endpoint."""

from fastapi import APIRouter, HTTPException, Depends
from app.schemas.optimizer import OptimizationRequest, OptimizationResponse
from app.optimizer.harvest_split_solver import HarvestSplitOptimizer
from app.services.mandi_service import MandiService

router = APIRouter(prefix="/optimizer", tags=["Optimizer"])


def get_optimizer() -> HarvestSplitOptimizer:
    return HarvestSplitOptimizer(MandiService())


@router.post("/harvest-split", response_model=OptimizationResponse)
async def optimize_harvest_split(
    request: OptimizationRequest,
    optimizer: HarvestSplitOptimizer = Depends(get_optimizer)
):
    """
    Computes optimal harvest split between immediate sales and storage hold,
    allocating produce across candidate Karnataka APMC mandis using PuLP linear programming.

    Considers:
    - Current and forecast prices (conservative, balanced, or growth scenario)
    - Transport distance and freight rates
    - Daily storage charges and ambient/cold decay rates
    - APMC handling fees and market cess
    - Storage and daily dispatch limits
    - Strict harvest conservation and inventory balance

    Returns recommended allocation schedule, itemized financial balance, and comparison against feasible immediate sale.
    """
    try:
        return optimizer.optimize(request)
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Optimization failed: {str(e)}")
