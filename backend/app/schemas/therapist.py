from datetime import datetime

from pydantic import BaseModel, ConfigDict


class TherapistRead(BaseModel):
    id: int
    slug: str
    full_name: str
    is_clinic: bool
    headline: str | None
    bio: str | None
    city: str | None
    state: str | None
    remote_available: bool
    price_min: int | None
    price_max: int | None
    approaches: list[str]
    specialties: list[str]
    languages: list[str]
    profile_url: str
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TherapistListResponse(BaseModel):
    items: list[TherapistRead]
    total: int


class ApproachFacet(BaseModel):
    label: str
    value: str
    count: int


class ApproachFacetListResponse(BaseModel):
    items: list[ApproachFacet]


class SpecialtyFacet(BaseModel):
    label: str
    value: str
    count: int


class SpecialtyFacetListResponse(BaseModel):
    items: list[SpecialtyFacet]


class LanguageFacet(BaseModel):
    label: str
    value: str
    count: int


class LanguageFacetListResponse(BaseModel):
    items: list[LanguageFacet]


class CityFacet(BaseModel):
    label: str
    value: str
    count: int


class CityFacetListResponse(BaseModel):
    items: list[CityFacet]


class TherapistMetadataResponse(BaseModel):
    latest_scraped_at: datetime | None
    active_count: int
