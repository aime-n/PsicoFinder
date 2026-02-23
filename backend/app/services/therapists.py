from datetime import datetime

from sqlalchemy import asc, desc, func, select, true
from sqlalchemy.orm import Session

from app.models.therapist import Therapist
from app.services.normalization import normalize_language_label, normalize_text


def list_therapists(
    db: Session,
    q: str | None,
    city: list[str] | None,
    specialty: list[str] | None,
    approach: list[str] | None,
    language: str | None,
    remote_only: bool,
    include_clinics: bool,
    min_price: int | None,
    max_price: int | None,
    sort: str,
    limit: int,
    offset: int,
) -> tuple[list[Therapist], int]:
    stmt = select(Therapist).where(Therapist.is_active.is_(True))
    count_stmt = select(func.count()).select_from(Therapist).where(Therapist.is_active.is_(True))

    if not include_clinics:
        stmt = stmt.where(Therapist.is_clinic.is_(False))
        count_stmt = count_stmt.where(Therapist.is_clinic.is_(False))

    if q:
        predicate = Therapist.search_text.ilike(f"%{normalize_text(q)}%")
        stmt = stmt.where(predicate)
        count_stmt = count_stmt.where(predicate)

    if city:
        city_tokens = [normalize_text(value) for value in city if normalize_text(value)]
        if city_tokens:
            stmt = stmt.where(Therapist.city_slug.in_(city_tokens))
            count_stmt = count_stmt.where(Therapist.city_slug.in_(city_tokens))

    if specialty:
        specialty_tokens = [normalize_text(value) for value in specialty if normalize_text(value)]
        if specialty_tokens:
            stmt = stmt.where(Therapist.specialty_tags.overlap(specialty_tokens))
            count_stmt = count_stmt.where(Therapist.specialty_tags.overlap(specialty_tokens))

    if approach:
        approach_tokens = [normalize_text(value) for value in approach if normalize_text(value)]
        if approach_tokens:
            stmt = stmt.where(Therapist.approach_tags.overlap(approach_tokens))
            count_stmt = count_stmt.where(Therapist.approach_tags.overlap(approach_tokens))

    if language:
        language_token = normalize_text(language)
        stmt = stmt.where(Therapist.language_tags.contains([language_token]))
        count_stmt = count_stmt.where(Therapist.language_tags.contains([language_token]))

    if remote_only:
        stmt = stmt.where(Therapist.remote_available.is_(True))
        count_stmt = count_stmt.where(Therapist.remote_available.is_(True))

    if min_price is not None:
        stmt = stmt.where(Therapist.price_min.is_not(None), Therapist.price_min >= min_price)
        count_stmt = count_stmt.where(Therapist.price_min.is_not(None), Therapist.price_min >= min_price)

    if max_price is not None:
        stmt = stmt.where(Therapist.price_min.is_not(None), Therapist.price_min <= max_price)
        count_stmt = count_stmt.where(Therapist.price_min.is_not(None), Therapist.price_min <= max_price)

    stmt = stmt.order_by(*build_sort(sort)).offset(offset).limit(limit)

    items = db.execute(stmt).scalars().all()
    total = db.execute(count_stmt).scalar_one()
    return items, total


def build_sort(sort: str):
    if sort == "price_asc":
        return (
            asc(Therapist.price_min).nullslast(),
            desc(Therapist.updated_at),
        )
    if sort == "price_desc":
        return (
            desc(Therapist.price_min).nullslast(),
            desc(Therapist.updated_at),
        )
    if sort == "name_asc":
        return (
            asc(Therapist.full_name),
            desc(Therapist.updated_at),
        )
    return (desc(Therapist.updated_at),)


def list_approach_facets(
    db: Session,
    include_clinics: bool,
    q: str | None = None,
    limit: int = 24,
) -> list[dict[str, str | int]]:
    approach_values = func.jsonb_array_elements_text(Therapist.approaches).table_valued("value").alias("approach_values")

    stmt = (
        select(
            approach_values.c.value.label("label"),
            func.lower(approach_values.c.value).label("value"),
            func.count().label("count"),
        )
        .select_from(Therapist)
        .join(approach_values, true())
        .where(Therapist.is_active.is_(True))
        .group_by(approach_values.c.value, func.lower(approach_values.c.value))
        .order_by(func.count().desc(), approach_values.c.value.asc())
        .limit(limit)
    )

    if not include_clinics:
        stmt = stmt.where(Therapist.is_clinic.is_(False))

    if q:
        query_token = normalize_text(q)
        if query_token:
            stmt = stmt.where(func.array_to_string(Therapist.approach_tags, " ").ilike(f"%{query_token}%"))

    rows = db.execute(stmt).all()
    return [
        {
            "label": row.label,
            "value": row.value,
            "count": row.count,
        }
        for row in rows
        if row.label and row.value
    ]


def list_specialty_facets(
    db: Session,
    include_clinics: bool,
    q: str | None = None,
    limit: int = 24,
) -> list[dict[str, str | int]]:
    specialty_values = func.jsonb_array_elements_text(Therapist.specialties).table_valued("value").alias(
        "specialty_values"
    )

    stmt = (
        select(
            specialty_values.c.value.label("label"),
            func.lower(specialty_values.c.value).label("value"),
            func.count().label("count"),
        )
        .select_from(Therapist)
        .join(specialty_values, true())
        .where(Therapist.is_active.is_(True))
        .group_by(specialty_values.c.value, func.lower(specialty_values.c.value))
        .order_by(func.count().desc(), specialty_values.c.value.asc())
        .limit(limit)
    )

    if not include_clinics:
        stmt = stmt.where(Therapist.is_clinic.is_(False))

    if q:
        query_token = normalize_text(q)
        if query_token:
            stmt = stmt.where(func.array_to_string(Therapist.specialty_tags, " ").ilike(f"%{query_token}%"))

    rows = db.execute(stmt).all()
    return [
        {
            "label": row.label,
            "value": row.value,
            "count": row.count,
        }
        for row in rows
        if row.label and row.value
    ]


def list_city_facets(
    db: Session,
    include_clinics: bool,
    q: str | None = None,
    limit: int = 24,
) -> list[dict[str, str | int]]:
    stmt = (
        select(
            Therapist.city.label("label"),
            Therapist.city_slug.label("value"),
            func.count().label("count"),
        )
        .where(Therapist.is_active.is_(True), Therapist.city.is_not(None), Therapist.city_slug.is_not(None))
        .group_by(Therapist.city, Therapist.city_slug)
        .order_by(func.count().desc(), Therapist.city.asc())
        .limit(limit)
    )

    if not include_clinics:
        stmt = stmt.where(Therapist.is_clinic.is_(False))

    if q:
        query_token = normalize_text(q)
        if query_token:
            stmt = stmt.where(Therapist.city_slug.ilike(f"%{query_token}%"))

    rows = db.execute(stmt).all()
    return [
        {
            "label": row.label,
            "value": row.value,
            "count": row.count,
        }
        for row in rows
        if row.label and row.value
    ]


def list_language_facets(
    db: Session,
    include_clinics: bool,
    q: str | None = None,
    limit: int = 24,
) -> list[dict[str, str | int]]:
    language_values = func.jsonb_array_elements_text(Therapist.languages).table_valued("value").alias(
        "language_values"
    )

    stmt = (
        select(
            language_values.c.value.label("label"),
            func.lower(language_values.c.value).label("value"),
            func.count().label("count"),
        )
        .select_from(Therapist)
        .join(language_values, true())
        .where(Therapist.is_active.is_(True))
        .group_by(language_values.c.value, func.lower(language_values.c.value))
        .order_by(func.count().desc(), language_values.c.value.asc())
        .limit(limit)
    )

    if not include_clinics:
        stmt = stmt.where(Therapist.is_clinic.is_(False))

    if q:
        query_token = normalize_text(q)
        if query_token:
            stmt = stmt.where(func.array_to_string(Therapist.language_tags, " ").ilike(f"%{query_token}%"))

    rows = db.execute(stmt).all()
    items: list[dict[str, str | int]] = []
    seen: set[str] = set()
    for row in rows:
        if not row.label or not row.value:
            continue
        label = normalize_language_label(row.label)
        if not label:
            continue
        value = normalize_text(label)
        if value in seen:
            continue
        seen.add(value)
        items.append({"label": label, "value": value, "count": row.count})
    return items


def get_therapist_metadata(db: Session) -> dict[str, int | datetime | None]:
    row = db.execute(
        select(
            func.max(Therapist.last_scraped_at).label("latest_scraped_at"),
            func.count().label("active_count"),
        ).where(Therapist.is_active.is_(True))
    ).one()
    return {
        "latest_scraped_at": row.latest_scraped_at,
        "active_count": row.active_count,
    }
