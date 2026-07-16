"""add saas lifecycle columns (retry_count, state_changed_at)

Revision ID: 3a1b2c3d4e5f
Revises: 2cf868cb9e8a
Create Date: 2026-07-17 03:30:00.000000
"""
from __future__ import annotations

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
import sqlmodel


revision: str = '3a1b2c3d4e5f'
down_revision: str | None = '2cf868cb9e8a'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table('organizations', schema=None) as batch_op:
        batch_op.add_column(sa.Column('saas_retry_count', sa.Integer(), nullable=False, server_default='0'))
        batch_op.add_column(sa.Column('saas_state_changed_at', sa.DateTime(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('organizations', schema=None) as batch_op:
        batch_op.drop_column('saas_state_changed_at')
        batch_op.drop_column('saas_retry_count')
