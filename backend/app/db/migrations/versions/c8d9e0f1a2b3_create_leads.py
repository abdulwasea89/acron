"""create tenant-scoped lead profiles

Revision ID: c8d9e0f1a2b3
Revises: e9f0a1b2c3d4
Create Date: 2026-10-10 00:00:00.000000
"""
from __future__ import annotations

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
import sqlmodel


revision: str = "c8d9e0f1a2b3"
down_revision: str | None = "e9f0a1b2c3d4"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "leads",
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("id", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("organization_id", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("name", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("email", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column("phone", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column("goal", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column("budget", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column("preferred_times", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column("preferences", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column("source", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("stage", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("created_by", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column("profile_sources", sa.JSON(), nullable=False),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    with op.batch_alter_table("leads", schema=None) as batch_op:
        batch_op.create_index("ix_leads_id", ["id"], unique=False)
        batch_op.create_index("ix_leads_organization_id", ["organization_id"], unique=False)
        batch_op.create_index("ix_leads_email", ["email"], unique=False)
        batch_op.create_index("ix_leads_source", ["source"], unique=False)
        batch_op.create_index("ix_leads_stage", ["stage"], unique=False)


def downgrade() -> None:
    with op.batch_alter_table("leads", schema=None) as batch_op:
        batch_op.drop_index("ix_leads_stage")
        batch_op.drop_index("ix_leads_source")
        batch_op.drop_index("ix_leads_email")
        batch_op.drop_index("ix_leads_organization_id")
        batch_op.drop_index("ix_leads_id")
    op.drop_table("leads")
