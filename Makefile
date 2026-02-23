PYTHON ?= uv run

.PHONY: help install api scrape db-upgrade db-downgrade db-revision db-current frontend-dev frontend-build

help:
	@printf "Targets:\n"
	@printf "  install         Install frontend and backend dependencies\n"
	@printf "  api             Run FastAPI locally\n"
	@printf "  scrape          Run scraper manually\n"
	@printf "  db-upgrade      Apply Alembic migrations\n"
	@printf "  db-downgrade    Roll back one Alembic migration\n"
	@printf "  db-revision     Create a new Alembic revision. Usage: make db-revision MESSAGE=\"add table\"\n"
	@printf "  db-current      Show current Alembic revision\n"
	@printf "  frontend-dev    Run Vite frontend locally\n"
	@printf "  frontend-build  Build frontend assets\n"

install:
	cd backend && uv sync
	cd frontend && npm install

api:
	cd backend && $(PYTHON) uvicorn app.main:app --reload

scrape:
	cd backend && $(PYTHON) python -m scraper.run

db-upgrade:
	cd backend && $(PYTHON) alembic upgrade head

db-downgrade:
	cd backend && $(PYTHON) alembic downgrade -1

db-revision:
	cd backend && $(PYTHON) alembic revision --autogenerate -m "$(MESSAGE)"

db-current:
	cd backend && $(PYTHON) alembic current

frontend-dev:
	cd frontend && npm run dev

frontend-build:
	cd frontend && npm run build

