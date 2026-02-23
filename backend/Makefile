PYTHON ?= uv run

.PHONY: api scrape db-upgrade db-downgrade db-revision db-current lint

api:
	$(PYTHON) uvicorn app.main:app --reload

scrape:
	$(PYTHON) python -m scraper.run

db-upgrade:
	$(PYTHON) alembic upgrade head

db-downgrade:
	$(PYTHON) alembic downgrade -1

db-revision:  # make db-revision MESSAGE="add is_clinic"
	$(PYTHON) alembic revision --autogenerate -m "$(MESSAGE)"

db-current:
	$(PYTHON) alembic current

lint:
	$(PYTHON) ruff check .

