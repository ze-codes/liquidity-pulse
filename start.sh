#!/bin/bash
set -e

echo "Starting Liquidity Pulse API..."
exec uvicorn api.main:app --host 0.0.0.0 --port ${PORT:-8000}
