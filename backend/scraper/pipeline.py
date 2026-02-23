from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
import sys

from slugify import slugify
from sqlalchemy import select
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

    for page in range(1, settings.scraper_max_pages + 1):
        print(f"\nFetching listing page {page}/{settings.scraper_max_pages}...")
        html = scraper.fetch_directory_page(page)
        batch = scraper.parse_directory_page(html)
        if not batch:
            break

        fetched += len(batch)
        total_profiles += len(batch)
        render_progress(
            current=processed,
            total=total_profiles,
            page=page,
            name="queued profiles",
            created=created,
            updated=updated,
            failed=failed,
        )

        for item, enriched_item, error in enrich_batch(scraper, batch):
            try:
                if error is not None or enriched_item is None:
                    failed += 1
                    continue

                therapist, was_created = upsert_therapist(db, enriched_item)
                therapist.last_scraped_at = datetime.now(timezone.utc)
                if was_created:
                    created += 1
                else:
                    updated += 1
            except Exception:
                failed += 1
            finally:
                processed += 1
                render_progress(
                    current=processed,
                    total=total_profiles,
                    page=page,
                    name=item.full_name,
                    created=created,
                    updated=updated,
                    failed=failed,
                )

        db.commit()

    if total_profiles:
        sys.stdout.write("\n")
        sys.stdout.flush()

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
