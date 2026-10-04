"""create celebrations and win-back

Loyalty acknowledgements (birthdays/anniversaries/milestones) and lapsed-member
win-back attempts (#36). Tenant-scoped.

Revision ID: b6c7d8e9f0a1
Revises: a5b6c7d8e9f0
Create Date: 2026-10-05 00:00:00.000000
"""
from __future__ import annotations

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
import sqlmodel


revision: str = 'b6c7d8e9f0a1'
down_revision: str | None = 'a5b6c7d8e9f0'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table('member_celebrations',
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('organization_id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('member_id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('kind', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('key', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('title', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('body', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('sent_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['member_id'], ['organization_members.id'], ),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('member_id', 'kind', 'key', name='uq_member_celebration_kind_key'),
    )
    with op.batch_alter_table('member_celebrations', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_member_celebrations_id'), ['id'], unique=False)
        batch_op.create_index(batch_op.f('ix_member_celebrations_key'), ['key'], unique=False)
        batch_op.create_index(batch_op.f('ix_member_celebrations_kind'), ['kind'], unique=False)
        batch_op.create_index(batch_op.f('ix_member_celebrations_member_id'), ['member_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_member_celebrations_organization_id'), ['organization_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_member_celebrations_sent_at'), ['sent_at'], unique=False)

    op.create_table('win_back_attempts',
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('organization_id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('member_id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('status', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('offer_text', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('channel', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('contacted_at', sa.DateTime(), nullable=False),
        sa.Column('recovered_at', sa.DateTime(), nullable=True),
        sa.Column('recovered_amount', sa.Float(), nullable=True),
        sa.ForeignKeyConstraint(['member_id'], ['organization_members.id'], ),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )
    with op.batch_alter_table('win_back_attempts', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_win_back_attempts_contacted_at'), ['contacted_at'], unique=False)
        batch_op.create_index(batch_op.f('ix_win_back_attempts_id'), ['id'], unique=False)
        batch_op.create_index(batch_op.f('ix_win_back_attempts_member_id'), ['member_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_win_back_attempts_organization_id'), ['organization_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_win_back_attempts_status'), ['status'], unique=False)


def downgrade() -> None:
    with op.batch_alter_table('win_back_attempts', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_win_back_attempts_status'))
        batch_op.drop_index(batch_op.f('ix_win_back_attempts_organization_id'))
        batch_op.drop_index(batch_op.f('ix_win_back_attempts_member_id'))
        batch_op.drop_index(batch_op.f('ix_win_back_attempts_id'))
        batch_op.drop_index(batch_op.f('ix_win_back_attempts_contacted_at'))
    op.drop_table('win_back_attempts')

    with op.batch_alter_table('member_celebrations', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_member_celebrations_sent_at'))
        batch_op.drop_index(batch_op.f('ix_member_celebrations_organization_id'))
        batch_op.drop_index(batch_op.f('ix_member_celebrations_member_id'))
        batch_op.drop_index(batch_op.f('ix_member_celebrations_kind'))
        batch_op.drop_index(batch_op.f('ix_member_celebrations_key'))
        batch_op.drop_index(batch_op.f('ix_member_celebrations_id'))
    op.drop_table('member_celebrations')
