import logging
import time
from datetime import datetime, timezone
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from api.routers import health, market_data, llm
from app.settings import settings


app = FastAPI(title="liquidity-pulse API", version="0.1.0")

# CORS
_cors_origins = [
    o.strip()
    for o in (settings.cors_origins or "").split(",")
    if o.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for API
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers (no DB required)
app.include_router(health.router)
app.include_router(market_data.router)
app.include_router(llm.router)


@app.get("/")
def root():
    return {"status": "ok", "docs": "/docs"}


# -----------------------
# Simple access logging middleware (time + client IP)
# -----------------------
_access_logger = logging.getLogger("api.access")


def _get_client_ip(request: Request) -> str:
    xff = request.headers.get("x-forwarded-for")
    if xff:
        return xff.split(",")[0].strip()
    try:
        return request.client.host  # type: ignore[return-value]
    except Exception:
        return "unknown"


@app.middleware("http")
async def log_requests(request: Request, call_next):
    t0 = time.time()
    client_ip = _get_client_ip(request)
    ts = datetime.now(timezone.utc).isoformat()
    method = request.method
    path = request.url.path
    ua = request.headers.get("user-agent", "")
    response = await call_next(request)
    dur_ms = int((time.time() - t0) * 1000)
    try:
        _access_logger.info(
            f"{ts} ip={client_ip} {method} {path} status={response.status_code} dur={dur_ms}ms ua={ua}"
        )
    except Exception:
        pass
    return response
