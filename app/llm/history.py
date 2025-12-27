import json
import os
import time
from pathlib import Path
from typing import List, Dict, Any

from app.settings import settings

CACHE_DIR = Path(settings.cache_dir) / "chats"
CACHE_DIR.mkdir(parents=True, exist_ok=True)

def _get_path(session_id: str) -> Path:
    # Sanitize session_id
    safe_id = "".join(c for c in session_id if c.isalnum() or c in "-_")
    return CACHE_DIR / f"{safe_id}.json"

def load_history(session_id: str) -> List[Dict[str, str]]:
    path = _get_path(session_id)
    if not path.exists():
        return []
    try:
        with open(path, "r") as f:
            data = json.load(f)
            return data.get("messages", [])
    except Exception:
        return []

def save_history(session_id: str, messages: List[Dict[str, str]]):
    path = _get_path(session_id)
    try:
        data = {
            "session_id": session_id,
            "updated_at": time.time(),
            "messages": messages
        }
        with open(path, "w") as f:
            json.dump(data, f, indent=2)
    except Exception:
        pass

def append_message(session_id: str, role: str, content: str):
    history = load_history(session_id)
    # Limit history to last 20 messages to prevent context overflow
    history.append({"role": role, "content": content})
    if len(history) > 20:
        history = history[-20:]
    save_history(session_id, history)

