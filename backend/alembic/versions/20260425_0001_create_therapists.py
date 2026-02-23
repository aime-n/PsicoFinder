"""create therapists table

Revision ID: 20260425_0001
Revises:
Create Date: 2026-04-25 12:00:00
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260425_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")
    op.create_table(
        "therapists",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("source", sa.String(length=50), nullable=False),
        sa.Column("source_id", sa.String(length=255), nullable=False),
        sa.Column("is_clinic", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("profile_url", sa.Text(), nullable=False),
        sa.Column("slug", sa.String(length=255), nullable=False),
        sa.Column("full_name", sa.String(length=255), nullable=False),
        sa.Column("headline", sa.String(length=255), nullable=True),
        sa.Column("bio", sa.Text(), nullable=True),
        sa.Column("city", sa.String(length=120), nullable=True),
        sa.Column("city_slug", sa.String(length=120), nullable=True),
        sa.Column("state", sa.String(length=120), nullable=True),
        sa.Column("remote_available", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("price_min", sa.Integer(), nullable=True),
        sa.Column("price_max", sa.Integer(), nullable=True),
        sa.Column(
            "approaches",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
        sa.Column(
            "approach_tags",
            postgresql.ARRAY(sa.String()),
            nullable=False,
            server_default=sa.text("'{}'::text[]"),
        ),
        sa.Column(
            "specialties",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
        sa.Column(
            "specialty_tags",
            postgresql.ARRAY(sa.String()),
            nullable=False,
            server_default=sa.text("'{}'::text[]"),
        ),
        sa.Column(
            "languages",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
        sa.Column(
            "language_tags",
            postgresql.ARRAY(sa.String()),
            nullable=False,
            server_default=sa.text("'{}'::text[]"),
        ),
        sa.Column("search_text", sa.Text(), nullable=False, server_default=sa.text("''")),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("last_scraped_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("profile_url"),
        sa.UniqueConstraint("slug"),
        sa.UniqueConstraint("source", "source_id", name="uq_therapists_source_source_id"),
    )
    op.create_index("ix_therapists_city", "therapists", ["city"], unique=False)
    op.create_index("ix_therapists_city_slug", "therapists", ["city_slug"], unique=False)
    op.create_index("ix_therapists_full_name", "therapists", ["full_name"], unique=False)
    op.create_index("ix_therapists_is_clinic", "therapists", ["is_clinic"], unique=False)
    op.create_index("ix_therapists_is_active", "therapists", ["is_active"], unique=False)
    op.create_index("ix_therapists_price_min", "therapists", ["price_min"], unique=False)
    op.create_index(
        "ix_therapists_search_text_trgm",
        "therapists",
        ["search_text"],
        unique=False,
        postgresql_using="gin",
        postgresql_ops={"search_text": "gin_trgm_ops"},
    )
    op.create_index(
        "ix_therapists_specialty_tags_gin",
        "therapists",
        ["specialty_tags"],
        unique=False,
        postgresql_using="gin",
    )
    op.create_index(
        "ix_therapists_approach_tags_gin",
        "therapists",
        ["approach_tags"],
        unique=False,
        postgresql_using="gin",
    )
    op.create_index(
        "ix_therapists_language_tags_gin",
        "therapists",
        ["language_tags"],
        unique=False,
        postgresql_using="gin",
    )
    op.create_index(
        "ix_therapists_remote_city_price",
        "therapists",
        ["remote_available", "city_slug", "price_min"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_therapists_remote_city_price", table_name="therapists")
    op.drop_index("ix_therapists_language_tags_gin", table_name="therapists")
    op.drop_index("ix_therapists_approach_tags_gin", table_name="therapists")
    op.drop_index("ix_therapists_specialty_tags_gin", table_name="therapists")
    op.drop_index("ix_therapists_search_text_trgm", table_name="therapists")
    op.drop_index("ix_therapists_price_min", table_name="therapists")
    op.drop_index("ix_therapists_is_active", table_name="therapists")
    op.drop_index("ix_therapists_is_clinic", table_name="therapists")
    op.drop_index("ix_therapists_full_name", table_name="therapists")
    op.drop_index("ix_therapists_city_slug", table_name="therapists")
    op.drop_index("ix_therapists_city", table_name="therapists")
    op.drop_table("therapists")
