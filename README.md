# PsicoFinder

PsicoFinder is a therapist discovery platform with a React frontend and a FastAPI backend backed by PostgreSQL. The product goal is simple: make it easier for people to find therapists with the right specialties, modality, and location.

## Recommended stack

- Frontend: React + Vite + TypeScript, deployed on Vercel
- Backend API: FastAPI + SQLAlchemy, deployed on Railway
- Database: Supabase Postgres
- Migrations: Alembic
- Scraper: Python service in `backend/scraper/`
- Job scheduling: GitHub Actions for a daily scraper run
- Python environment: `uv`

## Why this stack

Vercel is a strong fit for the frontend because it is fast, simple, and pairs naturally with a Vite/React app. With your database already on Supabase, the clean split is `Vercel frontend + FastAPI backend + Supabase Postgres`. Railway is a solid default for the backend, but Cloud Run is also a good option if you want pay-as-you-go hosting without a fixed monthly bill.

## Repository layout

```text
frontend/              React app for search and discovery UX
backend/
  app/
    api/               FastAPI routers
    core/              config and database wiring
    models/            SQLAlchemy models
    schemas/           Pydantic schemas
    services/          application services
    main.py            FastAPI entrypoint
  scraper/             scraping pipeline and persistence entrypoints
  alembic/             migrations
  pyproject.toml       uv-managed Python project
.github/workflows/     CI and scheduled scraper job
```

## Quick start

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Backend with uv

```bash
cd backend
uv sync
cp .env.example .env
uv run alembic upgrade head
uv run uvicorn app.main:app --reload
```

For Supabase, use:

- `DATABASE_URL` for the running API, ideally the Supabase pooled connection string
- `DATABASE_DIRECT_URL` for Alembic migrations, ideally the direct connection string

Both should include `?sslmode=require`.

### Makefile shortcuts

```bash
make db-upgrade
make api
make scrape
make frontend-dev
```

### Run the scraper manually

```bash
cd backend
uv run python -m scraper.run
```

## First product milestones

1. Build a searchable therapist directory backed by PostgreSQL instead of scraping on-demand from the UI.
2. Persist therapist profiles, specialties, prices, online availability, and source metadata.
3. Run a daily sync job through GitHub Actions or Railway cron.
4. Add curation, trust, and quality signals on top of raw scraped data.

## Notes for the next phase

- Start with scraping as an ingestion path, but keep the app architecture independent from any single source.
- Store raw source fields plus normalized searchable fields.
- Use Supabase as the system of record and keep filtering database-first.
- Add geocoding and specialty normalization after the first ingestion pipeline is stable.
- If the scraper grows heavier or needs proxies, move the schedule from GitHub Actions to Railway cron or another worker platform.
- The current filtering path is database-first: the scraper writes normalized filter tags and a precomputed search field so Postgres can answer therapist searches with indexes.
