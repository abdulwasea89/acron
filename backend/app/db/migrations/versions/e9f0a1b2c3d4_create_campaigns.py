"""create segmented campaigns

Owner-authored marketing campaigns (#39) with inline audience criteria
(status/plan/min-days-since-last-visit), a channel (in-app/email/both), and a
per-(campaign, member) delivery row that sends exactly once.
"""
from __future__ import annotations

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
import sqlmodel


revision: str = 'e9f0a1b2c3d4'
down_revision: str | None = 'd8e9f0a1b2c3'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table('campaigns',
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('organization_id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('title', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('subject', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('body', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('channel', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('status', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('member_status', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('plan_id', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('min_days_since_last_visit', sa.Integer(), nullable=True),
        sa.Column('scheduled_at', sa.DateTime(), nullable=True),
        sa.Column('sent_at', sa.DateTime(), nullable=True),
        sa.Column('send_limit', sa.Integer(), nullable=False),
        sa.Column('sent_count', sa.Integer(), nullable=False),
        sa.Column('created_by_user_id', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.ForeignKeyConstraint(['created_by_user_id'], ['users.id'], ),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ),
        sa.ForeignKeyConstraint(['plan_id'], ['membership_plans.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )
    with op.batch_alter_table('campaigns', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_campaigns_channel'), ['channel'], unique=False)
        batch_op.create_index(batch_op.f('ix_campaigns_id'), ['id'], unique=False)
        batch_op.create_index(batch_op.f('ix_campaigns_organization_id'), ['organization_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_campaigns_status'), ['status'], unique=False)

    op.create_table('campaign_deliveries',
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('organization_id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('campaign_id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('member_id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('status', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('channel', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('delivered_at', sa.DateTime(), nullable=True),
        sa.Column('error', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.ForeignKeyConstraint(['campaign_id'], ['campaigns.id'], ),
        sa.ForeignKeyConstraint(['member_id'], ['organization_members.id'], ),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('campaign_id', 'member_id', name='uq_campaign_delivery_campaign_member'),
    )
    with op.batch_alter_table('campaign_deliveries', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_campaign_deliveries_campaign_id'), ['campaign_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_campaign_deliveries_id'), ['id'], unique=False)
        batch_op.create_index(batch_op.f('ix_campaign_deliveries_member_id'), ['member_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_campaign_deliveries_organization_id'), ['organization_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_campaign_deliveries_status'), ['status'], unique=False)


def downgrade() -> None:
    with op.batch_alter_table('campaign_deliveries', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_campaign_deliveries_status'))
        batch_op.drop_index(batch_op.f('ix_campaign_deliveries_organization_id'))
        batch_op.drop_index(batch_op.f('ix_campaign_deliveries_member_id'))
        batch_op.drop_index(batch_op.f('ix_campaign_deliveries_id'))
        batch_op.drop_index(batch_op.f('ix_campaign_deliveries_campaign_id'))
    op.drop_table('campaign_deliveries')

    with op.batch_alter_table('campaigns', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_campaigns_status'))
        batch_op.drop_index(batch_op.f('ix_campaigns_organization_id'))
        batch_op.drop_index(batch_op.f('ix_campaigns_id'))
        batch_op.drop_index(batch_op.f('ix_campaigns_channel'))
    op.drop_table('campaigns')