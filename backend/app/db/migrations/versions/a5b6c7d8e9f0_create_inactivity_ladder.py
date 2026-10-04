"""create inactivity ladder

Deterministic escalating outreach for quiet members (#35): a per-org rung
config and a per-member firing log. Tenant-scoped, indexed by org.

Revision ID: a5b6c7d8e9f0
Revises: f4a5b6c7d8e9
Create Date: 2026-10-05 00:00:00.000000
"""
from __future__ import annotations

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
import sqlmodel


revision: str = 'a5b6c7d8e9f0'
down_revision: str | None = 'f4a5b6c7d8e9'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table('inactivity_ladder_rungs',
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('organization_id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('day', sa.Integer(), nullable=False),
        sa.Column('code', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('name', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('member_action', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('staff_action', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('email_subject', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('email_body', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('organization_id', 'day', name='uq_inactivity_rung_org_day'),
    )
    with op.batch_alter_table('inactivity_ladder_rungs', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_inactivity_ladder_rungs_day'), ['day'], unique=False)
        batch_op.create_index(batch_op.f('ix_inactivity_ladder_rungs_id'), ['id'], unique=False)
        batch_op.create_index(batch_op.f('ix_inactivity_ladder_rungs_organization_id'), ['organization_id'], unique=False)

    op.create_table('inactivity_ladder_progress',
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('organization_id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('member_id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('rung_day', sa.Integer(), nullable=False),
        sa.Column('status', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('fired_at', sa.DateTime(), nullable=False),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.Column('completed_by', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('channel', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.ForeignKeyConstraint(['completed_by'], ['organization_members.id'], ),
        sa.ForeignKeyConstraint(['member_id'], ['organization_members.id'], ),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )
    with op.batch_alter_table('inactivity_ladder_progress', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_inactivity_ladder_progress_fired_at'), ['fired_at'], unique=False)
        batch_op.create_index(batch_op.f('ix_inactivity_ladder_progress_id'), ['id'], unique=False)
        batch_op.create_index(batch_op.f('ix_inactivity_ladder_progress_member_id'), ['member_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_inactivity_ladder_progress_organization_id'), ['organization_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_inactivity_ladder_progress_rung_day'), ['rung_day'], unique=False)
        batch_op.create_index(batch_op.f('ix_inactivity_ladder_progress_status'), ['status'], unique=False)


def downgrade() -> None:
    with op.batch_alter_table('inactivity_ladder_progress', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_inactivity_ladder_progress_status'))
        batch_op.drop_index(batch_op.f('ix_inactivity_ladder_progress_rung_day'))
        batch_op.drop_index(batch_op.f('ix_inactivity_ladder_progress_organization_id'))
        batch_op.drop_index(batch_op.f('ix_inactivity_ladder_progress_member_id'))
        batch_op.drop_index(batch_op.f('ix_inactivity_ladder_progress_id'))
        batch_op.drop_index(batch_op.f('ix_inactivity_ladder_progress_fired_at'))
    op.drop_table('inactivity_ladder_progress')

    with op.batch_alter_table('inactivity_ladder_rungs', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_inactivity_ladder_rungs_organization_id'))
        batch_op.drop_index(batch_op.f('ix_inactivity_ladder_rungs_id'))
        batch_op.drop_index(batch_op.f('ix_inactivity_ladder_rungs_day'))
    op.drop_table('inactivity_ladder_rungs')
