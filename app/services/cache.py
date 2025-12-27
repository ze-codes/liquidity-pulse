import csv
import time
from pathlib import Path
from typing import Any, List, Dict, Optional, Tuple

from app.settings import settings

class CSVCache:
    """File-based CSV cache for series data (L2 Cache)."""
    
    def __init__(self, cache_dir: str, ttl_seconds: int = 3600):
        self._cache_dir = Path(cache_dir) / "series"
        self._ttl = ttl_seconds
        self._cache_dir.mkdir(parents=True, exist_ok=True)
    
    def _get_path(self, series_id: str) -> Path:
        return self._cache_dir / f"{series_id.upper()}.csv"
    
    def is_valid(self, series_id: str) -> bool:
        """Check if cache file exists and is fresh."""
        if settings.cache_disabled:
            return False
        path = self._get_path(series_id)
        if not path.exists():
            return False
        age = time.time() - path.stat().st_mtime
        return age < self._ttl
    
    def read(self, series_id: str) -> Optional[List[Dict[str, Any]]]:
        """Read cached data from CSV file."""
        if settings.cache_disabled:
            return None
        path = self._get_path(series_id)
        if not path.exists():
            return None
        
        try:
            items = []
            with open(path, "r", newline="") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    items.append({
                        "date": row["date"],
                        "value": float(row["value"])
                    })
            return items
        except Exception:
            return None
    
    def write(self, series_id: str, items: List[Dict[str, Any]]) -> None:
        """Write data to CSV file."""
        if settings.cache_disabled:
            return
        path = self._get_path(series_id)
        try:
            with open(path, "w", newline="") as f:
                writer = csv.DictWriter(f, fieldnames=["date", "value"])
                writer.writeheader()
                for item in items:
                    writer.writerow({"date": item["date"], "value": item["value"]})
        except Exception:
            pass  # Silently fail on write errors
    
    def clear(self, series_id: Optional[str] = None) -> int:
        """Clear cache files. If series_id is None, clear all."""
        count = 0
        if series_id:
            path = self._get_path(series_id)
            if path.exists():
                path.unlink()
                count = 1
        else:
            for path in self._cache_dir.glob("*.csv"):
                path.unlink()
                count += 1
        return count
    
    def stats(self) -> Dict[str, Any]:
        """Return cache statistics."""
        files = list(self._cache_dir.glob("*.csv"))
        now = time.time()
        valid = sum(1 for f in files if now - f.stat().st_mtime < self._ttl)
        total_size = sum(f.stat().st_size for f in files)
        return {
            "total_files": len(files),
            "valid_files": valid,
            "total_size_bytes": total_size,
            "ttl_seconds": self._ttl,
            "cache_dir": str(self._cache_dir),
            "disabled": settings.cache_disabled
        }


class TTLCache:
    """Simple in-memory cache with TTL expiration (L1 Cache)."""
    
    def __init__(self, ttl_seconds: int = 3600):
        self._cache: Dict[str, Tuple[float, Any]] = {}
        self._ttl = ttl_seconds
    
    def get(self, key: str) -> Optional[Any]:
        if settings.cache_disabled:
            return None
        entry = self._cache.get(key)
        if entry is None:
            return None
        timestamp, value = entry
        if time.time() - timestamp > self._ttl:
            del self._cache[key]
            return None
        return value
    
    def set(self, key: str, value: Any) -> None:
        if settings.cache_disabled:
            return
        self._cache[key] = (time.time(), value)
    
    def clear(self) -> None:
        self._cache.clear()
    
    def stats(self) -> Dict[str, Any]:
        """Return cache statistics."""
        now = time.time()
        valid = sum(1 for ts, _ in self._cache.values() if now - ts <= self._ttl)
        return {
            "total_entries": len(self._cache),
            "valid_entries": valid,
            "ttl_seconds": self._ttl,
            "disabled": settings.cache_disabled
        }

# Global cache instances
memory_cache = TTLCache(ttl_seconds=settings.cache_ttl_seconds)
csv_cache = CSVCache(cache_dir=settings.cache_dir, ttl_seconds=settings.cache_ttl_seconds)

