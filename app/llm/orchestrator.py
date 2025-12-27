from __future__ import annotations

import asyncio
import json
import statistics
from datetime import datetime
from typing import Any, Dict, List, Optional, AsyncGenerator

from app.settings import settings
from app.llm.providers import get_provider
from app.llm.prompts import build_brief_prompt, build_agent_system_prompt, build_agent_step_prompt
from app.llm.context import build_brief_context
from app.services import market_data

# -----------------------------------------------------------------------------
# Z-Score Helper
# -----------------------------------------------------------------------------
def compute_z_score(values: List[float], window: int = 20) -> Optional[float]:
    if len(values) < window:
        return None
    recent = values[-window:]
    if len(recent) < 2:
        return None
    try:
        avg = statistics.mean(recent)
        stdev = statistics.stdev(recent)
        if stdev == 0:
            return 0.0
        current = recent[-1]
        return (current - avg) / stdev
    except Exception:
        return None

# -----------------------------------------------------------------------------
# Data Fetching (Live)
# -----------------------------------------------------------------------------

async def fetch_snapshot_data(horizon: str = "1w") -> Dict[str, Any]:
    """
    Fetch data for all indicators to build a 'snapshot' context on the fly.
    """
    # 1. List all indicators
    indicators_meta = market_data.list_indicators()
    
    # 2. Fetch data for each (parallel)
    # Filter to 'core' or 'key' indicators to save time/tokens? 
    # For now, fetch all but maybe limit history length.
    tasks = []
    for ind in indicators_meta:
        tasks.append(market_data.get_indicator_live(ind["id"], days=60))  # need enough for z-score
    
    results = await asyncio.gather(*tasks, return_exceptions=True)
    
    indicator_data = []
    for meta, res in zip(indicators_meta, results):
        if isinstance(res, Exception):
            continue
        
        items = res.get("items", [])
        if not items:
            continue
            
        # Get latest value
        latest = items[-1]
        val = latest["value"]
        date = latest["date"]
        
        # Compute z-score
        values = [i["value"] for i in items]
        z = compute_z_score(values, window=20)
        
        # Determine status/label
        # Rudimentary logic: if z > 1 -> supportive (+1), < -1 -> draining (-1), else neutral
        # Real logic should come from registry 'scoring', but for MVP this is fine.
        # Or better: check directionality.
        direction = meta.get("directionality", "higher_is_supportive")
        status = "0"
        if z is not None:
            if direction == "higher_is_supportive":
                if z > 1.0: status = "+1"
                elif z < -1.0: status = "-1"
            else: # lower_is_supportive
                if z > 1.0: status = "-1"
                elif z < -1.0: status = "+1"
        
        status_label = "neutral"
        if status == "+1": status_label = "supportive"
        if status == "-1": status_label = "draining"

        indicator_data.append({
            "id": meta["id"],
            "name": meta["name"],
            "category": meta.get("category"),
            "latest_value": val,
            "z20": round(z, 2) if z is not None else None,
            "status": status,
            "status_label": status_label,
            "obs_date": date,
            "notes": meta.get("description", "")
        })
    
    # Sort by absolute z-score desc (importance)
    indicator_data.sort(key=lambda x: abs(x["z20"] or 0), reverse=True)
    
    # Construct 'snapshot' object compatible with prompts
    # We need a 'regime'. Rudimentary regime: sum of statuses
    score = sum(1 for i in indicator_data if i["status"] == "+1") - sum(1 for i in indicator_data if i["status"] == "-1")
    # Normalized score -100 to 100?
    # Max score = len(indicator_data)
    max_score = len(indicator_data)
    
    regime_label = "Neutral"
    if score > max_score * 0.3: regime_label = "Supportive"
    elif score < -max_score * 0.3: regime_label = "Restrictive"
    
    return {
        "as_of": datetime.now().isoformat(),
        "regime": {
            "label": regime_label,
            "tilt": f"{score:+d}",
            "score": score,
            "max_score": max_score
        },
        "indicators": indicator_data,
        "buckets": [] # TODO: grouping by category if needed
    }

# -----------------------------------------------------------------------------
# Brief Generation
# -----------------------------------------------------------------------------

async def generate_brief(horizon: str = "1w", api_key: Optional[str] = None, provider: Optional[str] = None) -> Dict[str, Any]:
    """
    Generate a market brief using live data.
    """
    snapshot = await fetch_snapshot_data(horizon)
    
    # Build context
    indicator_ids = [i["id"] for i in snapshot["indicators"]]
    context = {
        "regime": snapshot["regime"],
        "indicator_ids": indicator_ids,
        "buckets": []
    }
    
    # Format for prompt
    indicator_infos = []
    for i in snapshot["indicators"]:
        indicator_infos.append({
            "id": i["id"],
            "name": i["name"],
            "latest_value": i["latest_value"],
            "z20": i["z20"],
            "status_label": i["status_label"],
            "status": i["status"],
            "obs_date": i["obs_date"]
        })
    
    prompt = build_brief_prompt(context, indicator_infos=indicator_infos)
    
    # Get provider (with optional name override)
    llm = get_provider(api_key=api_key, provider_name=provider)
    
    # Run in threadpool if sync, but we are async now so...
    # The provider.complete is sync. We should run it in executor.
    loop = asyncio.get_running_loop()
    try:
        raw_markdown = await loop.run_in_executor(None, llm.complete, prompt)
    except Exception as e:
        raw_markdown = f"Error generating brief: {str(e)}"

    return {
        "markdown": raw_markdown,
        "snapshot": snapshot
    }

# -----------------------------------------------------------------------------
# Tools for Agent
# -----------------------------------------------------------------------------

def normalize_id(text: str) -> str:
    """Normalize ID by lowercasing and replacing separators with underscore."""
    if not text:
        return ""
    text = text.lower().strip()
    # Replace common separators
    for char in [" ", "/", "-", "."]:
        text = text.replace(char, "_")
    return text

async def execute_tool(name: str, args: Dict[str, Any]) -> Any:
    try:
        if name == "get_doc":
            raw_id = args.get("id", "")
            norm_id = normalize_id(raw_id)
            
            # Try indicator first (exact match then normalized)
            registry = market_data.list_indicators()
            ind = next((i for i in registry if i["id"] == raw_id or i["id"] == norm_id), None)
            if ind:
                return ind
                
            # Try series
            series_list = market_data.list_series()
            ser = next((s for s in series_list if s["id"] == raw_id or s["id"] == norm_id), None)
            if ser:
                return ser
                
            return f"No doc found for ID: {raw_id} (normalized: {norm_id})"

        if name == "get_history":
            raw_id = args.get("id", "")
            norm_id = normalize_id(raw_id)
            days = int(args.get("days", 90))
            
            # Try indicator
            try:
                res = await market_data.get_indicator_live(raw_id, days=days)
                return {
                    "id": raw_id,
                    "type": "indicator",
                    "items": res["items"][-20:] # Return last 20 points to save tokens
                }
            except Exception:
                # Retry normalized
                try:
                    res = await market_data.get_indicator_live(norm_id, days=days)
                    return {
                        "id": norm_id,
                        "type": "indicator",
                        "items": res["items"][-20:]
                    }
                except Exception:
                    pass
            
            # Try series
            try:
                res = await market_data.get_series(raw_id, days=days)
                return {
                    "id": raw_id,
                    "type": "series",
                    "items": res["items"][-20:]
                }
            except Exception:
                # Retry normalized
                try:
                    res = await market_data.get_series(norm_id, days=days)
                    return {
                        "id": norm_id,
                        "type": "series",
                        "items": res["items"][-20:]
                    }
                except Exception:
                    return f"No history found for ID: {raw_id}"
                
        return f"Unknown tool: {name}"

    except Exception as e:
        return f"Tool execution error: {str(e)}"


# -----------------------------------------------------------------------------
# Agent Stream
# -----------------------------------------------------------------------------

async def agent_answer_question_events(
    question: str, 
    horizon: str = "1w", 
    chat_history: List[Dict[str, str]] = [],
    api_key: Optional[str] = None,
    provider: Optional[str] = None
) -> AsyncGenerator[Dict[str, Any], None]:
    """
    Async generator for agent events (SSE).
    """
    llm = get_provider(api_key=api_key, provider_name=provider)
    
    # 1. Fetch brief context (lightweight)
    snapshot = await fetch_snapshot_data(horizon)
    top_indicators = snapshot["indicators"][:6] # Top 6 by z-score
    
    # Build context string
    context_str = "Current Market Snapshot:\n"
    for i in top_indicators:
        context_str += f"- {i['name']} ({i['id']}): {i['latest_value']} (z={i['z20']}) -> {i['status_label']}\n"
        
    known_indicators = [i["id"] for i in snapshot["indicators"]]
    known_series = [s["id"] for s in market_data.list_series()]
    
    known_ids_context = f"Known IDs: {', '.join(known_indicators[:50])}... (and series)"
    
    tool_catalog = (
        "Tools:\n"
        "- get_doc(id): Get metadata for indicator/series.\n"
        "- get_history(id, days=90): Get recent data points.\n"
        "Usage: TOOL <name> <json_args>"
    )
    
    system = build_agent_system_prompt(known_ids_context, tool_catalog)
    
    messages = [{"role": "system", "content": system}]
    
    # Add history
    for msg in chat_history:
        messages.append(msg)
        
    messages.append({"role": "user", "content": f"Context:\n{context_str}\n\nQuestion: {question}"})
    
    yield {"event": "start", "data": {"horizon": horizon}}
    
    # Track tool usage to prevent loops
    tool_history: List[tuple] = []
    
    # Agent Loop
    for _ in range(5):
        prompt = build_agent_step_prompt(align_with_brief=False)
        model_input = messages + [{"role": "user", "content": prompt}]
        
        buffer = ""
        tool_buf = ""
        in_tool = False
        
        # Generator for tokens
        def token_gen():
            return llm.stream(str(model_input)) # This is sync
            
        try:
            for token in token_gen():
                buffer += token
                yield {"event": "thinking_token", "data": {"text": token}}
                
                if "TOOL" in buffer and not in_tool:
                    in_tool = True
                    
                if "FINAL" in buffer:
                    pass
        except Exception as e:
            yield {"event": "error", "data": {"message": str(e)}}
            return

        # Parse buffer for decision
        if "TOOL" in buffer:
            try:
                # Naive parse: TOOL name {args}
                parts = buffer.split("TOOL", 1)[1].strip().split(" ", 1)
                name = parts[0]
                args_str = parts[1] if len(parts) > 1 else "{}"
                args = json.loads(args_str)
                
                # Check for loops
                tool_sig = (name, json.dumps(args, sort_keys=True))
                if tool_sig in tool_history:
                    # Loop detected - break out
                    yield {"event": "decision", "data": {"type": "final"}}
                    msg = "I'm having trouble finding information on that item. It may not be in my database."
                    yield {"event": "final", "data": {"answer": msg}}
                    return
                
                tool_history.append(tool_sig)
                
                yield {"event": "decision", "data": {"type": "tool", "name": name}}
                yield {"event": "tool_call", "data": {"name": name, "args": args}}
                
                result = await execute_tool(name, args)
                
                res_str = str(result)[:500] # Truncate
                messages.append({"role": "assistant", "content": buffer})
                messages.append({"role": "user", "content": f"Tool Result: {res_str}"})
                
                yield {"event": "tool_result", "data": {"name": name, "summary": res_str}}
                continue # Loop again
                
            except Exception as e:
                # Failed to parse tool, fall through
                pass
        
        if "FINAL" in buffer:
            answer = buffer.split("FINAL", 1)[1].strip()
            yield {"event": "decision", "data": {"type": "final"}}
            yield {"event": "final", "data": {"answer": answer}}
            return
            
        # If no tool and no final, just yield as answer (fallback)
        yield {"event": "final", "data": {"answer": buffer}}
        return
    
    # If loop finishes without returning, force a final answer
    yield {"event": "final", "data": {"answer": "I'm sorry, I couldn't find enough information to answer that question confidently."}}
