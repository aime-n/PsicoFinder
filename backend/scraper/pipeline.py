from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path
import json
import sys

import httpx
from slugify import slugify
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.therapist import Therapist
from app.services.normalization import normalize_text, normalize_token_list
from scraper.adapters import DoctoraliaScraper, ScrapedTherapist


def run_daily_scrape(db: Session) -> dict[str, int]:
    scraper = DoctoraliaScraper()
    fetched = 0
    created = 0
    updated = 0
    failed = 0
    processed = 0
    total_profiles = 0
    failure_rows: list[dict[str, str]] = []

    for page in range(1, settings.scraper_max_pages + 1):
        print(f"\nFetching listing page {page}/{settings.scraper_max_pages}...")
        try:
            html = scraper.fetch_directory_page(page)
        except httpx.HTTPStatusError as exc:
            status = exc.response.status_code if exc.response is not None else None
            if status in {404, 405}:
                print(f"Stopping at page {page}: Doctoralia returned HTTP {status}.")
                break
            raise
        batch = scraper.parse_directory_page(html)
        if not batch:
            break

        fetched += len(batch)
        total_profiles += len(batch)
        page_started_created = created
        page_started_updated = updated
        page_started_failed = failed

        render_progress(
            current=processed,
            total=total_profiles,
            page=page,
            name="queued profiles",
            created=created,
            updated=updated,
            failed=failed,
        )

        enriched_items: list[ScrapedTherapist] = []
        for item, enriched_item, error in enrich_batch(scraper, batch):
            processed += 1
            if error is not None or enriched_item is None:
                failed += 1
                failure_rows.append(
                    {
                        "profile_url": item.profile_url,
                        "source_id": item.source_id,
                        "full_name": item.full_name,
                        "error": repr(error) if error is not None else "enrichment_returned_none",
                    }
                )
                render_progress(
                    current=processed,
                    total=total_profiles,
                    page=page,
                    name=item.full_name,
                    created=created,
                    updated=updated,
                    failed=failed,
                )
                continue

            enriched_items.append(enriched_item)
            render_progress(
                current=processed,
                total=total_profiles,
                page=page,
                name=item.full_name,
                created=created,
                updated=updated,
                failed=failed,
            )

        page_created, page_updated = bulk_upsert_therapists(db, enriched_items)
        created += page_created
        updated += page_updated

        db.commit()
        print(
            f"Page {page} summary: fetched={len(batch)} created={created - page_started_created} "
            f"updated={updated - page_started_updated} failed={failed - page_started_failed}"
        )

    if total_profiles:
        sys.stdout.write("\n")
        sys.stdout.flush()
    write_failure_log(failure_rows)

    return {
        "fetched": fetched,
        "created": created,
        "updated": updated,
        "failed": failed,
    }


def upsert_therapist(db: Session, item: ScrapedTherapist) -> tuple[Therapist, bool]:
    existing = db.execute(
        select(Therapist).where(
            Therapist.source == item.source,
            Therapist.source_id == item.source_id,
        )
    ).scalar_one_or_none()

    slug = slugify(f"{item.full_name}-{item.city or item.source_id}")
    is_clinic = detect_clinic(item)
    city_slug = normalize_text(item.city)
    approach_tags = normalize_token_list(item.approaches)
    specialty_tags = normalize_token_list(item.specialties)
    language_tags = normalize_token_list(item.languages)
    search_text = build_search_text(item)

    if existing:
        existing.profile_url = item.profile_url
        existing.slug = slug
        existing.full_name = item.full_name
        existing.is_clinic = is_clinic
        existing.headline = item.headline
        existing.city = item.city
        existing.city_slug = city_slug or None
        existing.state = item.state
        existing.remote_available = item.remote_available
        existing.price_min = item.price_min
        existing.price_max = item.price_max
        existing.approaches = item.approaches or []
        existing.approach_tags = approach_tags
        existing.specialties = item.specialties or []
        existing.specialty_tags = specialty_tags
        existing.languages = item.languages or []
        existing.language_tags = language_tags
        existing.bio = item.bio
        existing.search_text = search_text
        return existing, False

    therapist = Therapist(
        source=item.source,
        source_id=item.source_id,
        is_clinic=is_clinic,
        profile_url=item.profile_url,
        slug=slug,
        full_name=item.full_name,
        headline=item.headline,
        city=item.city,
        city_slug=city_slug or None,
        state=item.state,
        remote_available=item.remote_available,
        price_min=item.price_min,
        price_max=item.price_max,
        approaches=item.approaches or [],
        approach_tags=approach_tags,
        specialties=item.specialties or [],
        specialty_tags=specialty_tags,
        languages=item.languages or [],
        language_tags=language_tags,
        bio=item.bio,
        search_text=search_text,
    )
    db.add(therapist)
    return therapist, True


def bulk_upsert_therapists(db: Session, items: list[ScrapedTherapist]) -> tuple[int, int]:
    if not items:
        return 0, 0

    source_ids = [item.source_id for item in items]
    existing_source_ids = set(
        db.execute(
            select(Therapist.source_id).where(
                Therapist.source == items[0].source,
                Therapist.source_id.in_(source_ids),
            )
        ).scalars()
    )

    rows = []
    now = datetime.now(timezone.utc)
    for item in items:
        slug = slugify(f"{item.full_name}-{item.city or item.source_id}")
        city_slug = normalize_text(item.city)
        approach_tags = normalize_token_list(item.approaches)
        specialty_tags = normalize_token_list(item.specialties)
        language_tags = normalize_token_list(item.languages)
        search_text = build_search_text(item)
        rows.append(
            {
                "source": item.source,
                "source_id": item.source_id,
                "is_clinic": detect_clinic(item),
                "profile_url": item.profile_url,
                "slug": slug,
                "full_name": item.full_name,
                "headline": item.headline,
                "bio": item.bio,
                "city": item.city,
                "city_slug": city_slug or None,
                "state": item.state,
                "remote_available": item.remote_available,
                "price_min": item.price_min,
                "price_max": item.price_max,
                "approaches": item.approaches or [],
                "approach_tags": approach_tags,
                "specialties": item.specialties or [],
                "specialty_tags": specialty_tags,
                "languages": item.languages or [],
                "language_tags": language_tags,
                "search_text": search_text,
                "is_active": True,
                "last_scraped_at": now,
            }
        )

    stmt = insert(Therapist).values(rows)
    update_columns = {
        "is_clinic": stmt.excluded.is_clinic,
        "profile_url": stmt.excluded.profile_url,
        "slug": stmt.excluded.slug,
        "full_name": stmt.excluded.full_name,
        "headline": stmt.excluded.headline,
        "bio": stmt.excluded.bio,
        "city": stmt.excluded.city,
        "city_slug": stmt.excluded.city_slug,
        "state": stmt.excluded.state,
        "remote_available": stmt.excluded.remote_available,
        "price_min": stmt.excluded.price_min,
        "price_max": stmt.excluded.price_max,
        "approaches": stmt.excluded.approaches,
        "approach_tags": stmt.excluded.approach_tags,
        "specialties": stmt.excluded.specialties,
        "specialty_tags": stmt.excluded.specialty_tags,
        "languages": stmt.excluded.languages,
        "language_tags": stmt.excluded.language_tags,
        "search_text": stmt.excluded.search_text,
        "is_active": stmt.excluded.is_active,
        "last_scraped_at": stmt.excluded.last_scraped_at,
    }
    db.execute(
        stmt.on_conflict_do_update(
            index_elements=[Therapist.source, Therapist.source_id],
            set_=update_columns,
        )
    )

    created = len([item for item in items if item.source_id not in existing_source_ids])
    updated = len(items) - created
    return created, updated


def build_search_text(item: ScrapedTherapist) -> str:
    parts = [
        item.full_name,
        item.headline,
        item.bio,
        item.city,
        item.state,
        *(item.approaches or []),
        *(item.specialties or []),
        *(item.languages or []),
    ]
    return " ".join(filter(None, (normalize_text(part) for part in parts)))


def enrich_batch(
    scraper: DoctoraliaScraper,
    batch: list[ScrapedTherapist],
) -> list[tuple[ScrapedTherapist, ScrapedTherapist | None, Exception | None]]:
    max_workers = max(1, min(settings.scraper_profile_concurrency, len(batch)))
    results: list[tuple[ScrapedTherapist, ScrapedTherapist | None, Exception | None]] = []

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        future_to_item = {
            executor.submit(fetch_and_enrich_profile, scraper, item): item for item in batch
        }

        for future in as_completed(future_to_item):
            item = future_to_item[future]
            try:
                results.append((item, future.result(), None))
            except Exception as exc:
                results.append((item, None, exc))

    return results


def fetch_and_enrich_profile(
    scraper: DoctoraliaScraper,
    item: ScrapedTherapist,
) -> ScrapedTherapist:
    profile_html = scraper.fetch_profile_page(item.profile_url)
    return scraper.enrich_profile(item, profile_html)


def detect_clinic(item: ScrapedTherapist) -> bool:
    if item.source_id.startswith("clinicas/"):
        return True

    url_path = item.profile_url.lower()
    if "/clinicas/" in url_path:
        return True

    headline = (item.headline or "").lower()
    name = item.full_name.lower()
    clinic_markers = [
        "clínica",
        "clinica",
        "instituto",
        "multiclínica",
        "nucleo",
        "núcleo",
        "saúde integrada",
        "centro",
    ]
    return any(marker in name or marker in headline for marker in clinic_markers)


def render_progress(
    current: int,
    total: int,
    page: int,
    name: str,
    created: int,
    updated: int,
    failed: int,
) -> None:
    width = 28
    progress_total = max(total, 1)
    ratio = min(max(current / progress_total, 0), 1)
    filled = int(width * ratio)
    bar = f"[{'=' * filled}{'.' * (width - filled)}]"
    label = truncate(name, 42)
    message = (
        f"\rPage {page} {bar} {current}/{total} "
        f"created={created} updated={updated} failed={failed} "
        f"current={label}"
    )
    sys.stdout.write(message)
    sys.stdout.flush()


def truncate(value: str, max_length: int) -> str:
    clean = " ".join(value.split())
    if len(clean) <= max_length:
        return clean
    return f"{clean[: max_length - 3]}..."


def write_failure_log(rows: list[dict[str, str]]) -> None:
    if not rows:
        return

    logs_dir = Path("logs")
    logs_dir.mkdir(exist_ok=True)
    path = logs_dir / "scrape_failures.jsonl"
    with path.open("w", encoding="utf-8") as handle:
        for row in rows:
            handle.write(json.dumps(row, ensure_ascii=False) + "\n")

    print(f"Saved {len(rows)} failures to {path}")
