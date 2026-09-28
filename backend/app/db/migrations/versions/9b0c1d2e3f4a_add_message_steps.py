"""add steps_json to conversation_messages

Stores the assistant turn's reasoning + tool trace (ADR 018) so the transcript
can render the steps behind an answer after a reload.

Revision ID: 9b0c1d2e3f4a
Revises: 8a9b0c1d2e3f
Create Date: 2026-09-28 00:30:00.000000
"""
from __future__ import annotations

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "9b0c1d2e3f4a"
down_revision: str | None = "8a9b0c1d2e3f"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("conversation_messages", schema=None) as batch_op:
        batch_op.add_column(sa.Column("steps_json", sa.Text(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("conversation_messages", schema=None) as batch_op:
        batch_op.drop_column("steps_json")
