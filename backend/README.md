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
