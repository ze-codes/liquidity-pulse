import yaml
from pathlib import Path
from typing import Dict, List, Any

# Paths relative to project root (assuming this file is in app/)
PROJECT_ROOT = Path(__file__).parent.parent
INDICATOR_REGISTRY_PATH = PROJECT_ROOT / "indicator_registry.yaml"
SERIES_REGISTRY_PATH = PROJECT_ROOT / "series_registry.yaml"

def load_indicator_registry() -> List[Dict[str, Any]]:
    """Load indicator definitions from indicator_registry.yaml."""
    if not INDICATOR_REGISTRY_PATH.exists():
        return []
    with open(INDICATOR_REGISTRY_PATH) as f:
        return yaml.safe_load(f) or []

def load_series_registry() -> Dict[str, Dict[str, Any]]:
    """Load series definitions from series_registry.yaml."""
    if not SERIES_REGISTRY_PATH.exists():
        return {}
    with open(SERIES_REGISTRY_PATH) as f:
        data = yaml.safe_load(f) or {}
        return data.get("series", {})

# Module-level singletons (loaded once on import)
INDICATOR_REGISTRY = load_indicator_registry()
SERIES_REGISTRY = load_series_registry()

