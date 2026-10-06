"""create nps surveys

Net Promoter surveys at day 7/30/90 of membership with optional free-text
comments and a complaint cluster tag (#37). Tenant-scoped, at most one survey
per (member, milestone).

Revision ID: c7d8e9f0a1b2
Revises: b6c7d8e9f0a1
Create Date: 2026-10-06 00:00:00.000000
"""
from __future__ import annotations

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
import sqlmodel


revision: str = 'c7d8e9f0a1b2'
down_revision: str | None = 'b6c7d8e9f0a1'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table('nps_surveys',
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('organization_id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('member_id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('milestone', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('status', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('sent_at', sa.DateTime(), nullable=False),
        sa.Column('responded_at', sa.DateTime(), nullable=True),
        sa.Column('score', sa.Integer(), nullable=True),
        sa.Column('comment', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('cluster_tag', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.ForeignKeyConstraint(['member_id'], ['organization_members.id'], ),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('member_id', 'milestone', name='uq_nps_survey_member_milestone'),
    )
    with op.batch_alter_table('nps_surveys', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_nps_surveys_id'), ['id'], unique=False)
        batch_op.create_index(batch_op.f('ix_nps_surveys_member_id'), ['member_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_nps_surveys_milestone'), ['milestone'], unique=False)
        batch_op.create_index(batch_op.f('ix_nps_surveys_organization_id'), ['organization_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_nps_surveys_sent_at'), ['sent_at'], unique=False)
        batch_op.create_index(batch_op.f('ix_nps_surveys_status'), ['status'], unique=False)


def downgrade() -> None:
    with op.batch_alter_table('nps_surveys', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_nps_surveys_status'))
        batch_op.drop_index(batch_op.f('ix_nps_surveys_sent_at'))
        batch_op.drop_index(batch_op.f('ix_nps_surveys_organization_id'))
        batch_op.drop_index(batch_op.f('ix_nps_surveys_milestone'))
        batch_op.drop_index(batch_op.f('ix_nps_surveys_member_id'))
        batch_op.drop_index(batch_op.f('ix_nps_surveys_id'))
    op.drop_table('nps_surveys')