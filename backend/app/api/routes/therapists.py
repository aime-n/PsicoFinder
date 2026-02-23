from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.therapist import (
    ApproachFacetListResponse,
    CityFacetListResponse,
    LanguageFacetListResponse,
    SpecialtyFacetListResponse,
    TherapistMetadataResponse,
    TherapistListResponse,
    TherapistRead,
)
from app.services.therapists import (
    list_approach_facets,
    list_city_facets,
    list_language_facets,
    list_specialty_facets,
    get_therapist_metadata,
    list_therapists,
)

router = APIRouter()


@router.get("/approaches", response_model=ApproachFacetListResponse)
def get_approach_facets(
    include_clinics: bool = Query(default=False),
    q: str | None = Query(default=None),
    limit: int = Query(default=24, ge=1, le=100),
    db: Session = Depends(get_db),
) -> ApproachFacetListResponse:
    return ApproachFacetListResponse(
        items=list_approach_facets(db, include_clinics=include_clinics, q=q, limit=limit)
    )


@router.get("/cities", response_model=CityFacetListResponse)
def get_city_facets(
    include_clinics: bool = Query(default=False),
    q: str | None = Query(default=None),
    limit: int = Query(default=24, ge=1, le=100),
    db: Session = Depends(get_db),
) -> CityFacetListResponse:
    return CityFacetListResponse(items=list_city_facets(db, include_clinics=include_clinics, q=q, limit=limit))


@router.get("/specialties", response_model=SpecialtyFacetListResponse)
def get_specialty_facets(
    include_clinics: bool = Query(default=False),
    q: str | None = Query(default=None),
    limit: int = Query(default=24, ge=1, le=100),
    db: Session = Depends(get_db),
) -> SpecialtyFacetListResponse:
    return SpecialtyFacetListResponse(
        items=list_specialty_facets(db, include_clinics=include_clinics, q=q, limit=limit)
    )


@router.get("/languages", response_model=LanguageFacetListResponse)
def get_language_facets(
    include_clinics: bool = Query(default=False),
    q: str | None = Query(default=None),
    limit: int = Query(default=24, ge=1, le=100),
    db: Session = Depends(get_db),
) -> LanguageFacetListResponse:
    return LanguageFacetListResponse(
        items=list_language_facets(db, include_clinics=include_clinics, q=q, limit=limit)
    )


@router.get("/metadata", response_model=TherapistMetadataResponse)
def get_metadata(db: Session = Depends(get_db)) -> TherapistMetadataResponse:
    return TherapistMetadataResponse(**get_therapist_metadata(db))


@router.get("", response_model=TherapistListResponse)
def get_therapists(
    q: str | None = Query(default=None, description="Search by name, city, or headline."),
    city: list[str] | None = Query(default=None),
    specialty: list[str] | None = Query(default=None),
    approach: list[str] | None = Query(default=None),
    language: str | None = Query(default=None),
    remote_only: bool = Query(default=False),
    include_clinics: bool = Query(default=False),
    min_price: int | None = Query(default=None, ge=0),
    max_price: int | None = Query(default=None, ge=0),
    sort: str = Query(default="updated_desc", pattern="^(updated_desc|price_asc|price_desc|name_asc)$"),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> TherapistListResponse:
    items, total = list_therapists(
        db=db,
        q=q,
        city=city,
        specialty=specialty,
        approach=approach,
        language=language,
        remote_only=remote_only,
        include_clinics=include_clinics,
        min_price=min_price,
        max_price=max_price,
        sort=sort,
        limit=limit,
        offset=offset,
    )
    return TherapistListResponse(items=[TherapistRead.model_validate(item) for item in items], total=total)
