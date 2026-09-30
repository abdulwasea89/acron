"""add plan summary

An AI-written summary recorded on the plan the first time it is viewed. Nullable
because it only exists once generated; ``summary_generated_at`` lets the UI show
when it was written and lets a future job refresh stale summaries.

Revision ID: a1b2c3d4e5f6
Revises: 9b0c1d2e3f4a
Create Date: 2026-10-01 00:00:00.000000
"""
from __future__ import annotations

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
import sqlmodel


revision: str = 'a1b2c3d4e5f6'
down_revision: str | None = '9b0c1d2e3f4a'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table('membership_plans', schema=None) as batch_op:
        batch_op.add_column(sa.Column('summary', sqlmodel.sql.sqltypes.AutoString(), nullable=True))
        batch_op.add_column(sa.Column('summary_generated_at', sa.DateTime(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('membership_plans', schema=None) as batch_op:
        batch_op.drop_column('summary_generated_at')
        batch_op.drop_column('summary')
