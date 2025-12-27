"""Live market data endpoints - fetch directly from source APIs, no database."""
from __future__ import annotations

from typing import Any, List, Dict
import traceback

from fastapi import APIRouter, HTTPException

from app.sources import treasury
from app.services import market_data, cache

router = APIRouter(prefix="/live", tags=["live"])

@router.get("/indicators")
def list_indicators() -> List[Dict[str, Any]]:
    """Return indicator definitions from indicator_registry.yaml (no DB)."""
    return market_data.list_indicators()


@router.get("/series-list")
def list_series() -> List[Dict[str, Any]]:
    """Return available data series for visualization."""
    return market_data.list_series()


@router.get("/cache/stats")
def cache_stats() -> Dict[str, Any]:
    """Return cache statistics for both L1 (memory) and L2 (CSV) caches."""
    return {
        "memory": cache.memory_cache.stats(),
        "csv": cache.csv_cache.stats()
    }


@router.post("/cache/clear")
def cache_clear() -> Dict[str, Any]:
    """Clear all cached data (both memory and CSV)."""
    cache.memory_cache.clear()
    csv_count = cache.csv_cache.clear()
    return {"status": "cleared", "csv_files_deleted": csv_count}


@router.get("/debug/tga")
async def debug_tga() -> Dict[str, Any]:
    """Debug endpoint to see raw TGA data."""
    data = await treasury.fetch_tga_latest(limit=10, pages=1)
    raw_rows = data.get("data", [])[:5]  # First 5 rows
    account_types = list(set(row.get("account_type", "MISSING") for row in data.get("data", [])))
    return {
        "raw_sample": raw_rows,
        "account_types_found": account_types,
        "total_rows": len(data.get("data", []))
    }


@router.get("/debug/auctions")
async def debug_auctions() -> Dict[str, Any]:
    """Debug endpoint to see raw auction data."""
    data = await treasury.fetch_auction_schedules(limit=10, pages=1)
    return {
        "raw_sample": data.get("data", [])[:5],
        "total_rows": len(data.get("data", []))
    }


@router.get("/series/{series_id}")
async def get_series(series_id: str, days: int = 180) -> Dict[str, Any]:
    """Fetch a single series with two-tier caching."""
    try:
        return await market_data.get_series(series_id, days)
    except ValueError as e:
        # Convert service error to HTTP error
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/indicators/{indicator_id}")
async def get_indicator_live(indicator_id: str, days: int = 180) -> Dict[str, Any]:
    """Fetch live data for an indicator and compute its value."""
    try:
        return await market_data.get_indicator_live(indicator_id, days)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
