# =============================================================================
# API (Python)
# =============================================================================

VENV := .venv/bin
PYTHON := $(VENV)/python
PIP := $(VENV)/pip

run:
	$(VENV)/uvicorn api.main:app --reload --port 8000

install:
	python3 -m venv .venv
	$(PIP) install -r requirements.txt

test:
	$(VENV)/pytest -q

fmt:
	$(VENV)/black api/ app/ tests/
	$(VENV)/isort api/ app/ tests/

clean-cache:
	rm -rf cache/series/*.csv

# =============================================================================
# Frontend (Next.js)
# =============================================================================

fe-install:
	cd frontend && npm install

fe-dev:
	cd frontend && npm run dev

fe-build:
	cd frontend && npm run build

# =============================================================================
# Development (run both)
# =============================================================================

# Run API and frontend together (requires 2 terminals or use & for background)
dev:
	@echo "Run in separate terminals:"
	@echo "  Terminal 1: make run"
	@echo "  Terminal 2: make fe-dev"
