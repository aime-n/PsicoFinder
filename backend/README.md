# Backend

## Commands

```bash
uv sync
uv run uvicorn app.main:app --reload
uv run alembic upgrade head
uv run python -m scraper.run
```

## Supabase setup

Use two connection strings when possible:

- `DATABASE_URL`: Supabase pooled connection for the running API
- `DATABASE_DIRECT_URL`: Supabase direct connection for Alembic migrations

Both should include `sslmode=require`.

## Makefile shortcuts

```bash
make api
make db-upgrade
make scrape
make db-revision MESSAGE="add new fields"
```

## Deployment recommendation

Deploy this service on Railway, keep PostgreSQL on Supabase, and point the frontend on Vercel to the Railway API base URL.

## Cloud Run deployment

Cloud Run is a good fit if you want to avoid a fixed monthly hosting bill.

### Build

Use the Dockerfile in this directory and deploy from `backend/` as the source root.

### Environment variables

Set these on the Cloud Run service:

- `DATABASE_URL`: Supabase pooled connection string for the API
- `DATABASE_DIRECT_URL`: optional direct connection string, useful for local Alembic runs
- `APP_ENV`: `production`
- `SCRAPER_MAX_PAGES`: consider lowering this if you want to keep runtime and DB usage small

### Start command

Cloud Run will provide `PORT`. The container already listens on `${PORT:-8080}`.
