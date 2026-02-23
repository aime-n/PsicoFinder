from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Therapist(Base):
    __tablename__ = "therapists"
    __table_args__ = (
        UniqueConstraint("source", "source_id", name="uq_therapists_source_source_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    source: Mapped[str] = mapped_column(String(50), nullable=False)
    source_id: Mapped[str] = mapped_column(String(255), nullable=False)
    is_clinic: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    profile_url: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    slug: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), index=True, nullable=False)
    headline: Mapped[str | None] = mapped_column(String(255), nullable=True)
    bio: Mapped[str | None] = mapped_column(Text, nullable=True)
    city: Mapped[str | None] = mapped_column(String(120), index=True, nullable=True)
    city_slug: Mapped[str | None] = mapped_column(String(120), index=True, nullable=True)
    state: Mapped[str | None] = mapped_column(String(120), nullable=True)
    remote_available: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    price_min: Mapped[int | None] = mapped_column(Integer, nullable=True)
    price_max: Mapped[int | None] = mapped_column(Integer, nullable=True)
    approaches: Mapped[list[str]] = mapped_column(JSONB, default=list, nullable=False)
    approach_tags: Mapped[list[str]] = mapped_column(ARRAY(String()), default=list, nullable=False)
    specialties: Mapped[list[str]] = mapped_column(JSONB, default=list, nullable=False)
    specialty_tags: Mapped[list[str]] = mapped_column(ARRAY(String()), default=list, nullable=False)
    languages: Mapped[list[str]] = mapped_column(JSONB, default=list, nullable=False)
    language_tags: Mapped[list[str]] = mapped_column(ARRAY(String()), default=list, nullable=False)
    search_text: Mapped[str] = mapped_column(Text, default="", nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True, nullable=False)
    last_scraped_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
