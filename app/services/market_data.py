import asyncio
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
from collections import defaultdict

from app.settings import settings
from app.sources import fred, treasury, ofr
from app.registry_loader import SERIES_REGISTRY, load_indicator_registry, load_series_registry
from app.services.cache import memory_cache, csv_cache


def list_indicators() -> List[Dict[str, Any]]:
    """Return all indicators from registry."""
    return load_indicator_registry()


def list_series() -> List[Dict[str, Any]]:
    """Return available data series for visualization (excluding purely internal derived ones)."""
    result = []
    for series_id, meta in SERIES_REGISTRY.items():
        # Skip derived series that are just internal aggregations
        source = meta.get("source", "")
        if source == "DERIVED":
            continue
        result.append({
            "id": series_id,
            "name": meta.get("notes", series_id),
            "cadence": meta.get("cadence", "daily"),
            "units": meta.get("units", "USD"),
            "source": source,
            "description": meta.get("description"),
            "impact": meta.get("impact"),
            "interpretation": meta.get("interpretation"),
        })
    # Sort by source then id
    result.sort(key=lambda x: (x["source"], x["id"]))
    return result


async def get_series(series_id: str, days: int = 180) -> Dict[str, Any]:
    """Fetch a single series with two-tier caching (L1: memory, L2: CSV)."""
    
    sid = series_id.upper()
    cache_key = f"{sid}:{days}"
    cutoff = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")
    
    # L1: Check memory cache (fast, includes days filter)
    cached = memory_cache.get(cache_key)
    if cached is not None:
        return cached
    
    # L2: Check CSV cache (persistent, stores all data)
    if csv_cache.is_valid(sid):
        all_items = csv_cache.read(sid)
        if all_items:
            # Check if cache has data old enough for the request
            earliest_cached = min(i["date"] for i in all_items) if all_items else None
            
            if earliest_cached and earliest_cached <= cutoff:
                # Cache covers the requested range
                filtered = [i for i in all_items if i["date"] >= cutoff]
                meta = SERIES_REGISTRY.get(sid, {})
                result = {"series_id": sid, "source": meta.get("source", "CSV_CACHE"), "items": filtered}
                memory_cache.set(cache_key, result)
                return result
            # Cache doesn't have enough history - need to refetch
            print(f"[DEBUG] Cache miss for {sid}: earliest cached {earliest_cached} > cutoff {cutoff}. Refetching.")
    
    # Miss: Fetch from API
    try:
        result = await fetch_series_uncached(series_id, days)
    except ValueError as e:
        # Re-raise as is (caller handles mapping to HTTP errors)
        raise e
    
    # Save to L1 memory cache
    memory_cache.set(cache_key, result)
    
    # Save to L2 CSV cache (full data, not filtered)
    # Only cache raw series, not derived ones (which depend on other series)
    meta = SERIES_REGISTRY.get(sid, {})
    if meta.get("source") != "DERIVED":
        # Merge with existing cache if it has newer data we're missing
        existing = csv_cache.read(sid) or []
        # Combine: existing + new (dedupe by date, prefer new)
        combined = {i["date"]: i for i in existing}
        for item in result.get("items", []):
            combined[item["date"]] = item
        
        merged = sorted(combined.values(), key=lambda x: x["date"])
        csv_cache.write(sid, merged)
    
    return result


async def fetch_series_uncached(series_id: str, days: int) -> Dict[str, Any]:
    """Fetch series data from source API (no cache). Uses series_registry.yaml for routing."""
    
    sid = series_id.upper()
    meta = SERIES_REGISTRY.get(sid, {})
    source = meta.get("source", "")
    raw_scale = float(meta.get("raw_scale", 1))
    
    print(f"[DEBUG] fetch_series_uncached: {sid}, days={days}, source={source}")

    # ─────────────────────────────────────────────────────────────────────────
    # FRED Series
    # ─────────────────────────────────────────────────────────────────────────
    if source == "FRED":
        if not settings.fred_api_key:
            raise ValueError("FRED_API_KEY not configured")
        
        start_date = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")
        data = await fred.fetch_series(sid, observation_start=start_date, last_n=days + 50)
        
        observations = data.get("observations", [])
        items = []
        for obs in reversed(observations):  # FRED returns desc order
            if obs.get("value") in (None, "", "."):
                continue
            try:
                items.append({
                    "date": obs["date"],
                    "value": float(obs["value"]) * raw_scale
                })
            except (ValueError, KeyError):
                continue
        
        return {"series_id": sid, "source": "FRED", "items": items}
    
    # ─────────────────────────────────────────────────────────────────────────
    # Treasury TGA
    # ─────────────────────────────────────────────────────────────────────────
    if source == "TREASURY_TGA":
        # Each page has multiple account types per date.
        # Density is ~4-5 rows/day. Using divisor 100 implies 10 rows/day safety buffer.
        pages_needed = max(3, (days // 100) + 1)
        data = await treasury.fetch_tga_latest(limit=1000, pages=pages_needed)
        items = []
        seen_dates = set()
        for row in data.get("data", []):
            account_type = (row.get("account_type") or "").lower()
            # Skip explicit Opening Balance rows (present in recent data)
            if "opening balance" in account_type:
                continue
            
            # Match:
            # 1. "Treasury General Account (TGA) Closing Balance" (Newer)
            # 2. "Federal Reserve Account" (Older)
            # 3. "Treasury General Account" (Generic)
            is_match = (
                "closing balance" in account_type or 
                "federal reserve account" in account_type or
                account_type == "treasury general account"
            )
            
            if not is_match:
                continue

            date_str = row.get("record_date")
            if not date_str or date_str in seen_dates:
                continue
            seen_dates.add(date_str)
            try:
                val_str = row.get("open_today_bal") or row.get("close_today_bal")
                if val_str in (None, "", "null"):
                    continue
                val = float(str(val_str).replace(",", "")) * raw_scale
                items.append({"date": date_str, "value": val})
            except (ValueError, TypeError):
                continue
        
        items.sort(key=lambda x: x["date"])
        print(f"[DEBUG] TGA fetched {len(items)} daily items. First: {items[0]['date'] if items else 'None'}, Last: {items[-1]['date'] if items else 'None'}")
        cutoff = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")
        items = [i for i in items if i["date"] >= cutoff]
        
        return {"series_id": sid, "source": "Treasury", "items": items}
    
    # ─────────────────────────────────────────────────────────────────────────
    # Treasury Redemptions
    # ─────────────────────────────────────────────────────────────────────────
    if source == "TREASURY_REDEMPTIONS":
        data = await treasury.fetch_redemptions(limit=1000, pages=5)
        rows = treasury.parse_redemptions_rows(data)
        
        cutoff = datetime.now().date() - timedelta(days=days)
        items = [
            {"date": str(r["observation_date"]), "value": r["value_numeric"] * raw_scale}
            for r in rows
            if r["observation_date"] >= cutoff
        ]
        items.sort(key=lambda x: x["date"])
        
        return {"series_id": sid, "source": "Treasury", "items": items}
    
    # ─────────────────────────────────────────────────────────────────────────
    # Treasury Interest
    # ─────────────────────────────────────────────────────────────────────────
    if source == "TREASURY_INTEREST":
        data = await treasury.fetch_interest_outlays(limit=1000, pages=5)
        rows = treasury.parse_interest_rows(data)
        
        cutoff = datetime.now().date() - timedelta(days=days)
        items = [
            {"date": str(r["observation_date"]), "value": r["value_numeric"] * raw_scale}
            for r in rows
            if r["observation_date"] >= cutoff
        ]
        items.sort(key=lambda x: x["date"])
        
        return {"series_id": sid, "source": "Treasury", "items": items}
    
    # ─────────────────────────────────────────────────────────────────────────
    # Treasury Auctions
    # ─────────────────────────────────────────────────────────────────────────
    if source == "TREASURY_AUCTIONS":
        start_date = (datetime.now() - timedelta(days=days + 30)).strftime("%Y-%m-%d")
        data = await treasury.fetch_auction_schedules(limit=500, pages=3, start_date=start_date)
        rows = treasury.parse_auction_rows(data)
        
        totals_by_date: Dict[str, float] = defaultdict(float)
        for r in rows:
            issue_date = r.get("issue_date")
            if not issue_date:
                continue
            amt = r.get("offering_amount") or r.get("accepted_amount") or 0
            if amt > 0:
                totals_by_date[str(issue_date)] += amt * raw_scale
        
        cutoff = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")
        items = [
            {"date": d, "value": v}
            for d, v in sorted(totals_by_date.items())
            if d >= cutoff
        ]
        
        return {"series_id": sid, "source": "Treasury", "items": items}
    
    # ─────────────────────────────────────────────────────────────────────────
    # OFR Series
    # ─────────────────────────────────────────────────────────────────────────
    if source == "OFR":
        OFR_URL = "https://www.financialresearch.gov/financial-stress-index/data/fsi.csv"
        csv_text = await ofr.fetch_liquidity_stress_csv(OFR_URL)
        rows = ofr.parse_liquidity_stress_csv(csv_text)
        
        cutoff = datetime.now().date() - timedelta(days=days)
        items = [
            {"date": str(r["observation_date"]), "value": r["value_numeric"] * raw_scale}
            for r in rows
            if r["observation_date"] >= cutoff
        ]
        items.sort(key=lambda x: x["date"])
        
        return {"series_id": sid, "source": "OFR", "items": items}
    
    # ─────────────────────────────────────────────────────────────────────────
    # Derived Series (weekly aggregates)
    # ─────────────────────────────────────────────────────────────────────────
    if source == "DERIVED":
        base_series = meta.get("base_series")
        aggregation = meta.get("aggregation")
        
        if not base_series:
            raise ValueError(f"Derived series {sid} missing base_series")
        
        # Weekly sum aggregation
        if aggregation == "weekly_sum":
            base_data = await get_series(base_series, days=days)
            base_items = base_data.get("items", [])
            
            weekly_totals: Dict[str, float] = defaultdict(float)
            week_dates: Dict[str, str] = {}
            
            for item in base_items:
                d = datetime.strptime(item["date"], "%Y-%m-%d")
                week = f"{d.isocalendar()[0]}-W{d.isocalendar()[1]:02d}"
                weekly_totals[week] += item["value"]
                # Friday of that week
                days_ahead = 4 - d.weekday()
                if days_ahead < 0:
                    days_ahead += 7
                friday = d + timedelta(days=days_ahead)
                week_dates[week] = friday.strftime("%Y-%m-%d")
            
            cutoff = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")
            items = [
                {"date": week_dates[w], "value": v}
                for w, v in sorted(weekly_totals.items())
                if week_dates.get(w, "") >= cutoff
            ]
            
            return {"series_id": sid, "source": "DERIVED", "items": items}
        
        # Weekly bill percentage
        if aggregation == "weekly_bill_pct":
            start_date = (datetime.now() - timedelta(days=days + 30)).strftime("%Y-%m-%d")
            data = await treasury.fetch_auction_schedules(limit=500, pages=3, start_date=start_date)
            rows = treasury.parse_auction_rows(data)
            
            bills_by_week: Dict[str, float] = defaultdict(float)
            total_by_week: Dict[str, float] = defaultdict(float)
            week_dates: Dict[str, str] = {}
            
            for r in rows:
                issue_date = r.get("issue_date")
                if not issue_date:
                    continue
                amt = r.get("offering_amount") or r.get("accepted_amount") or 0
                if amt > 0:
                    d = datetime.strptime(str(issue_date), "%Y-%m-%d")
                    week = f"{d.isocalendar()[0]}-W{d.isocalendar()[1]:02d}"
                    total_by_week[week] += amt
                    if r.get("is_bill"):
                        bills_by_week[week] += amt
                    days_ahead = 4 - d.weekday()
                    if days_ahead < 0:
                        days_ahead += 7
                    friday = d + timedelta(days=days_ahead)
                    week_dates[week] = friday.strftime("%Y-%m-%d")
            
            cutoff = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")
            items = []
            for week in sorted(total_by_week.keys()):
                week_date = week_dates.get(week, "")
                if week_date < cutoff:
                    continue
                total = total_by_week[week]
                if total > 0:
                    bill_pct = (bills_by_week.get(week, 0) / total) * 100
                    items.append({"date": week_date, "value": round(bill_pct, 2)})
            
            return {"series_id": sid, "source": "DERIVED", "items": items}
        
        raise ValueError(f"Unknown aggregation type: {aggregation}")
    
    raise ValueError(f"Unknown series: {series_id}. Add it to series_registry.yaml")


async def get_indicator_live(indicator_id: str, days: int = 180) -> Dict[str, Any]:
    """Fetch live data for an indicator and compute its value."""
    registry = load_indicator_registry()
    indicator = next((i for i in registry if i["id"] == indicator_id), None)
    
    if not indicator:
        raise ValueError(f"Unknown indicator: {indicator_id}")
    
    # Override series for indicators with derived/computed series
    SERIES_OVERRIDES = {
        "ust_net_w": ["UST_AUCTION_ISSUES", "UST_REDEMPTIONS", "UST_INTEREST"],
        "bill_share_w": ["UST_BILL_SHARE"],
        "ust_redemptions_w": ["UST_REDEMPTIONS_W"],
        "ust_interest_w": ["UST_INTEREST_W"],
    }
    
    series_ids = SERIES_OVERRIDES.get(indicator_id, indicator.get("series", []))
    series_data = {}
    
    for sid in series_ids:
        try:
            data = await get_series(sid, days=days)
            series_data[sid] = data["items"]
        except ValueError:
            series_data[sid] = []
    
    # Compute indicator values based on type
    items = compute_indicator(indicator_id, indicator, series_data)
    
    return {
        "indicator_id": indicator_id,
        "name": indicator.get("name"),
        "category": indicator.get("category"),
        "directionality": indicator.get("directionality"),
        "items": items
    }


def compute_indicator(indicator_id: str, indicator: Dict, series_data: Dict) -> List[Dict]:
    """Compute indicator values from raw series data."""
    
    # Net Liquidity = WALCL - TGA - RRP
    if indicator_id == "net_liq":
        walcl = {i["date"]: i["value"] for i in series_data.get("WALCL", [])}
        tga = {i["date"]: i["value"] for i in series_data.get("TGA", [])}
        rrp = {i["date"]: i["value"] for i in series_data.get("RRPONTSYD", [])}
        
        # WALCL is weekly, TGA/RRP are daily - forward fill WALCL
        all_dates = sorted(set(tga.keys()) | set(rrp.keys()))
        last_walcl = None
        items = []
        for d in all_dates:
            if d in walcl:
                last_walcl = walcl[d]
            if last_walcl is None:
                continue
            t = tga.get(d)
            r = rrp.get(d)
            if t is not None and r is not None:
                # All values already in actual USD
                net = last_walcl - t - r
                items.append({"date": d, "value": net})
        return items
    
    # Simple delta indicators (5d change)
    if indicator_id in ("rrp_delta", "tga_delta"):
        sid = indicator["series"][0]
        data = series_data.get(sid, [])
        if len(data) < 6:
            return []
        # Data is already in actual USD
        items = []
        for i in range(5, len(data)):
            delta = data[i]["value"] - data[i-5]["value"]
            items.append({"date": data[i]["date"], "value": delta})
        return items
    
    # Weekly delta (reserves)
    if indicator_id == "reserves_w":
        sid = indicator["series"][0]
        data = series_data.get(sid, [])
        if len(data) < 2:
            return []
        items = []
        for i in range(1, len(data)):
            delta = data[i]["value"] - data[i-1]["value"]
            items.append({"date": data[i]["date"], "value": delta})
        return items
    
    # Spread: SOFR - IORB (return raw spread in percentage points)
    if indicator_id == "sofr_iorb":
        sofr = {i["date"]: i["value"] for i in series_data.get("SOFR", [])}
        iorb = {i["date"]: i["value"] for i in series_data.get("IORB", [])}
        
        common = sorted(set(sofr.keys()) & set(iorb.keys()))
        items = []
        for d in common:
            spread = round(sofr[d] - iorb[d], 4)  # Raw spread in percentage points
            items.append({"date": d, "value": spread})
        return items
    
    # Bill - IORB spread (raw spread in percentage points)
    if indicator_id == "bill_iorb":
        # For bill_rrp we'd need RRP_RATE which may not be in FRED
        # Simplified: use DTB4WK - IORB as proxy
        bill = {i["date"]: i["value"] for i in series_data.get("DTB4WK", [])}
        if not bill:
            bill = {i["date"]: i["value"] for i in series_data.get("DTB3", [])}
        iorb = {i["date"]: i["value"] for i in series_data.get("IORB", [])}
        
        common = sorted(set(bill.keys()) & set(iorb.keys()))
        items = []
        for d in common:
            spread = round(bill[d] - iorb[d], 4)  # Raw spread in percentage points
            items.append({"date": d, "value": spread})
        return items
    
    # OFR index - just pass through
    if indicator_id == "ofr_liq_idx":
        return series_data.get("OFR_LIQ_IDX", [])
    
    # Bill share - just pass through
    if indicator_id == "bill_share_w":
        return series_data.get("UST_BILL_SHARE", [])
    
    # Weekly redemptions - just pass through
    if indicator_id == "ust_redemptions_w":
        return series_data.get("UST_REDEMPTIONS_W", [])
    
    # Weekly interest - just pass through
    if indicator_id == "ust_interest_w":
        return series_data.get("UST_INTEREST_W", [])
    
    # Net UST settlements (weekly): Issues - Redemptions - Interest
    if indicator_id == "ust_net_w":
        from collections import defaultdict
        
        issues = {i["date"]: i["value"] for i in series_data.get("UST_AUCTION_ISSUES", [])}
        redemptions = {i["date"]: i["value"] for i in series_data.get("UST_REDEMPTIONS", [])}
        interest = {i["date"]: i["value"] for i in series_data.get("UST_INTEREST", [])}
        
        # Aggregate by ISO week (year-week)
        def get_week(date_str: str) -> str:
            from datetime import datetime
            d = datetime.strptime(date_str, "%Y-%m-%d")
            return f"{d.isocalendar()[0]}-W{d.isocalendar()[1]:02d}"
        
        def get_week_end(date_str: str) -> str:
            """Get the Friday of the week for display."""
            from datetime import datetime, timedelta
            d = datetime.strptime(date_str, "%Y-%m-%d")
            # Days until Friday (weekday 4)
            days_ahead = 4 - d.weekday()
            if days_ahead < 0:
                days_ahead += 7
            friday = d + timedelta(days=days_ahead)
            return friday.strftime("%Y-%m-%d")
        
        weekly_issues: Dict[str, float] = defaultdict(float)
        weekly_redemptions: Dict[str, float] = defaultdict(float)
        weekly_interest: Dict[str, float] = defaultdict(float)
        week_dates: Dict[str, str] = {}  # week -> representative Friday date
        
        for d, v in issues.items():
            w = get_week(d)
            weekly_issues[w] += v
            week_dates[w] = get_week_end(d)
        
        for d, v in redemptions.items():
            w = get_week(d)
            weekly_redemptions[w] += v
            if w not in week_dates:
                week_dates[w] = get_week_end(d)
        
        for d, v in interest.items():
            w = get_week(d)
            weekly_interest[w] += v
            if w not in week_dates:
                week_dates[w] = get_week_end(d)
        
        # Compute net for each week
        all_weeks = sorted(set(weekly_issues.keys()) | set(weekly_redemptions.keys()) | set(weekly_interest.keys()))
        items = []
        for w in all_weeks:
            iss = weekly_issues.get(w, 0)
            red = weekly_redemptions.get(w, 0)
            intr = weekly_interest.get(w, 0)
            # Net = Issues - Redemptions - Interest (positive = drain)
            net = iss - red - intr
            if w in week_dates:
                items.append({"date": week_dates[w], "value": net})
        
        return items
    
    # Default: return first series raw
    for sid in indicator.get("series", []):
        if sid in series_data and series_data[sid]:
            return series_data[sid]
    
    return []
