# Architecture Notes

## Product direction

PsicoFinder should behave like a search product, not like a scraper UI. The scraper is an ingestion mechanism behind the scenes. Users should browse therapists from our own database, with consistent search, trust signals, and performance.

## Recommended deployment split

- `frontend/` on Vercel
- `backend/` on Railway
- PostgreSQL on Supabase

This split keeps the frontend simple and CDN-friendly, while the backend gets a real Python runtime, stable DB connectivity, and a cleaner place to run maintenance jobs. Supabase remains the system of record for therapists and search data.

## Why not backend on Vercel by default

FastAPI can be made to run on Vercel, but that is best when the API is very light and stateless. This project wants:

- relational database access
- Alembic migrations
- scheduled ingestion
- room for heavier scraping logic

That points more naturally to Railway.

## Data model v1

Start with one main `therapists` table and add related tables only when the ingestion shape becomes stable. For the first version, JSONB arrays for `specialties`, `approaches`, and `languages` are a good compromise between speed and flexibility.

Later, if search and filtering become more advanced, normalize into:

- `therapist_specialties`
- `therapist_languages`
- `therapist_approaches`
- `locations`
- `source_snapshots`

## Scraper strategy

- Keep scraping logic in `backend/scraper/`
- Parse source fields into a normalized therapist payload
- Upsert into Postgres
- Avoid scraping from the browser-facing app
- Add source-specific adapters later if we ingest from more than one directory

## Scheduling options

### Best first option

GitHub Actions daily schedule is a good start because it is easy to audit, easy to change, and cheap.

### When to move away from GitHub Actions

Move the schedule closer to the runtime platform if:

- the job gets longer or more fragile
- the source requires region-specific IP behavior
- you need retries, queues, or stronger observability

At that point, Railway cron or a worker service becomes the better fit.

## Immediate next steps

1. Install Python 3.12 locally so `uv sync` works.
2. Run Alembic against the Postgres database.
3. Make the scraper adapter parse real Doctoralia markup using stable selectors.
4. Seed enough data to test the frontend against the API.
5. Add pagination, therapist details, and search ranking.
