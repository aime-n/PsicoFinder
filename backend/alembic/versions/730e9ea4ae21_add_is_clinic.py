"""add is_clinic

Revision ID: 730e9ea4ae21
Revises: 20260425_0001
Create Date: 2026-04-25 14:02:42.792216
"""
from alembic import op
import sqlalchemy as sa



# revision identifiers, used by Alembic.
revision = '730e9ea4ae21'
down_revision = '20260425_0001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "therapists",
        sa.Column("is_clinic", sa.Boolean(), nullable=True, server_default=sa.false()),
    )
    op.execute(
        """
        UPDATE therapists
        SET is_clinic = true
        WHERE source_id LIKE 'clinicas/%'
           OR profile_url LIKE '%/clinicas/%'
        """
    )
    op.execute(
        """
        UPDATE therapists
        SET is_clinic = false
        WHERE is_clinic IS NULL
        """
    )
    op.alter_column("therapists", "is_clinic", nullable=False, server_default=sa.false())
    op.create_index(op.f("ix_therapists_is_clinic"), "therapists", ["is_clinic"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_therapists_is_clinic"), table_name="therapists")
    op.drop_column("therapists", "is_clinic")
