#!/bin/bash
set -e

echo "Running database migrations..."
alembic upgrade head

echo "Loading registry..."
python -m app.registry_loader registry.yaml || echo "Registry load skipped (may already exist)"

echo "Starting server..."
exec uvicorn api.main:app --host 0.0.0.0 --port ${PORT:-8000}

