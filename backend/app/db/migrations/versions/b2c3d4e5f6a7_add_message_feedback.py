"""add conversation message feedback

A thumbs up/down a user leaves on an assistant turn. Recorded for review and
model-improvement; never fed back into the conversation. Nullable because most
turns have no rating.

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-10-01 00:00:00.000000
"""
from __future__ import annotations

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
import sqlmodel


revision: str = 'b2c3d4e5f6a7'
down_revision: str | None = 'a1b2c3d4e5f6'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table('conversation_messages', schema=None) as batch_op:
        batch_op.add_column(sa.Column('feedback', sqlmodel.sql.sqltypes.AutoString(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('conversation_messages', schema=None) as batch_op:
        batch_op.drop_column('feedback')
