"""create attendance

One row per member gym visit — the behaviour signal (Section 1.3, #18).
Tenant-scoped, append-only, indexed by org and check-in time.

Revision ID: c1d2e3f4a5b6
Revises: b2c3d4e5f6a7
Create Date: 2026-10-03 00:00:00.000000
"""
from __future__ import annotations

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
import sqlmodel


revision: str = 'c1d2e3f4a5b6'
down_revision: str | None = 'b2c3d4e5f6a7'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table('attendance',
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('organization_id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('member_id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('checked_in_at', sa.DateTime(), nullable=False),
        sa.Column('method', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('source', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('checked_in_by', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('class_session_id', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('note', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('idempotency_key', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.ForeignKeyConstraint(['class_session_id'], ['class_sessions.id'], ),
        sa.ForeignKeyConstraint(['member_id'], ['organization_members.id'], ),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )
    with op.batch_alter_table('attendance', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_attendance_checked_in_at'), ['checked_in_at'], unique=False)
        batch_op.create_index(batch_op.f('ix_attendance_id'), ['id'], unique=False)
        batch_op.create_index(batch_op.f('ix_attendance_idempotency_key'), ['idempotency_key'], unique=False)
        batch_op.create_index(batch_op.f('ix_attendance_member_id'), ['member_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_attendance_method'), ['method'], unique=False)
        batch_op.create_index(batch_op.f('ix_attendance_organization_id'), ['organization_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_attendance_source'), ['source'], unique=False)


def downgrade() -> None:
    with op.batch_alter_table('attendance', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_attendance_source'))
        batch_op.drop_index(batch_op.f('ix_attendance_organization_id'))
        batch_op.drop_index(batch_op.f('ix_attendance_method'))
        batch_op.drop_index(batch_op.f('ix_attendance_member_id'))
        batch_op.drop_index(batch_op.f('ix_attendance_idempotency_key'))
        batch_op.drop_index(batch_op.f('ix_attendance_id'))

    op.drop_table('attendance')
