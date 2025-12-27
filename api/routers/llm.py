from typing import Optional, Dict, Any
import json
import uuid

from fastapi import APIRouter, HTTPException, Query, Header
from fastapi.responses import StreamingResponse

from app.settings import settings
from app.llm import orchestrator
from app.llm import history

router = APIRouter(prefix="/llm", tags=["llm"])

@router.post("/brief")
async def brief(
    horizon: str = "1w",
    x_llm_api_key: Optional[str] = Header(None, alias="X-LLM-API-Key")
):
    """
    Generate a market brief using live data.
    """
    if not settings.llm_provider:
        raise HTTPException(status_code=501, detail="LLM provider not configured")
    
    try:
        # Pass the key to the orchestrator (which passes to provider)
        result = await orchestrator.generate_brief(horizon=horizon, api_key=x_llm_api_key)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/ask_stream")
async def ask_stream(
    question: str, 
    horizon: str = "1w", 
    session_id: Optional[str] = None,
    x_llm_api_key: Optional[str] = Header(None, alias="X-LLM-API-Key")
):
    """
    Stream an answer to a question, using live tools and chat history.
    """
    if not question or not question.strip():
        raise HTTPException(status_code=400, detail="question is required")

    # If no session_id provided, generate a temp one (but it won't persist effectively for the user)
    # Ideally frontend sends one.
    sid = session_id or str(uuid.uuid4())
    
    # Save user question
    history.append_message(sid, "user", question)
    
    # Load history
    chat_hist = history.load_history(sid)
    
    async def _sse():
        full_answer = ""
        try:
            async for ev in orchestrator.agent_answer_question_events(
                question=question, 
                horizon=horizon, 
                chat_history=chat_hist,
                api_key=x_llm_api_key
            ):
                # Capture final answer for history
                if ev["event"] == "final":
                    data = ev.get("data", {})
                    full_answer = data.get("answer", "")
                
                # Format SSE
                name = ev.get("event", "message")
                payload = ev.get("data", {})
                yield f"event: {name}\n" + f"data: {json.dumps(payload, default=str)}\n\n"
            
            # Save assistant answer
            if full_answer:
                history.append_message(sid, "assistant", full_answer)
                
        except Exception as e:
            yield f"event: error\n" + f"data: {json.dumps({'message': str(e)})}\n\n"

    return StreamingResponse(_sse(), media_type="text/event-stream", headers={
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Session-ID": sid 
    })


@router.get("/history")
def get_history(session_id: str):
    """Get chat history for a session."""
    return {"messages": history.load_history(session_id)}


@router.delete("/history")
def clear_history(session_id: str):
    """Clear chat history."""
    # We can just write an empty list
    history.save_history(session_id, [])
    return {"status": "cleared"}
