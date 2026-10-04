"""create onboarding journeys

90-day new-member onboarding (#32): one journey clock per member and one progress
row per milestone. Tenant-scoped, indexed by org.

Revision ID: f4a5b6c7d8e9
Revises: e3f4a5b6c7d8
Create Date: 2026-10-05 00:00:00.000000
"""
from __future__ import annotations

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
import sqlmodel


revision: str = 'f4a5b6c7d8e9'
down_revision: str | None = 'e3f4a5b6c7d8'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table('onboarding_journeys',
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('organization_id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('member_id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('status', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('started_at', sa.DateTime(), nullable=False),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.Column('current_day', sa.Integer(), nullable=False),
        sa.Column('assigned_trainer_id', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('visits_total', sa.Integer(), nullable=False),
        sa.Column('visits_last_7d', sa.Integer(), nullable=False),
        sa.Column('classes_attended', sa.Integer(), nullable=False),
        sa.Column('quiet_flag_at', sa.DateTime(), nullable=True),
        sa.Column('note', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.ForeignKeyConstraint(['assigned_trainer_id'], ['organization_members.id'], ),
        sa.ForeignKeyConstraint(['member_id'], ['organization_members.id'], ),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('organization_id', 'member_id', name='uq_onboarding_journey_org_member'),
    )
    with op.batch_alter_table('onboarding_journeys', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_onboarding_journeys_id'), ['id'], unique=False)
        batch_op.create_index(batch_op.f('ix_onboarding_journeys_member_id'), ['member_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_onboarding_journeys_organization_id'), ['organization_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_onboarding_journeys_started_at'), ['started_at'], unique=False)
        batch_op.create_index(batch_op.f('ix_onboarding_journeys_status'), ['status'], unique=False)

    op.create_table('onboarding_milestone_progress',
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('organization_id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('journey_id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('member_id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('day', sa.Integer(), nullable=False),
        sa.Column('code', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('status', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.Column('completed_by', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('notes', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.ForeignKeyConstraint(['completed_by'], ['organization_members.id'], ),
        sa.ForeignKeyConstraint(['journey_id'], ['onboarding_journeys.id'], ),
        sa.ForeignKeyConstraint(['member_id'], ['organization_members.id'], ),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('journey_id', 'code', name='uq_onboarding_progress_journey_code'),
    )
    with op.batch_alter_table('onboarding_milestone_progress', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_onboarding_milestone_progress_code'), ['code'], unique=False)
        batch_op.create_index(batch_op.f('ix_onboarding_milestone_progress_day'), ['day'], unique=False)
        batch_op.create_index(batch_op.f('ix_onboarding_milestone_progress_id'), ['id'], unique=False)
        batch_op.create_index(batch_op.f('ix_onboarding_milestone_progress_journey_id'), ['journey_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_onboarding_milestone_progress_member_id'), ['member_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_onboarding_milestone_progress_organization_id'), ['organization_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_onboarding_milestone_progress_status'), ['status'], unique=False)


def downgrade() -> None:
    with op.batch_alter_table('onboarding_milestone_progress', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_onboarding_milestone_progress_status'))
        batch_op.drop_index(batch_op.f('ix_onboarding_milestone_progress_organization_id'))
        batch_op.drop_index(batch_op.f('ix_onboarding_milestone_progress_member_id'))
        batch_op.drop_index(batch_op.f('ix_onboarding_milestone_progress_journey_id'))
        batch_op.drop_index(batch_op.f('ix_onboarding_milestone_progress_id'))
        batch_op.drop_index(batch_op.f('ix_onboarding_milestone_progress_day'))
        batch_op.drop_index(batch_op.f('ix_onboarding_milestone_progress_code'))
    op.drop_table('onboarding_milestone_progress')

    with op.batch_alter_table('onboarding_journeys', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_onboarding_journeys_status'))
        batch_op.drop_index(batch_op.f('ix_onboarding_journeys_started_at'))
        batch_op.drop_index(batch_op.f('ix_onboarding_journeys_organization_id'))
        batch_op.drop_index(batch_op.f('ix_onboarding_journeys_member_id'))
        batch_op.drop_index(batch_op.f('ix_onboarding_journeys_id'))
    op.drop_table('onboarding_journeys')
