"""create member_trainers

Revision ID: 4f5a6b7c8d9e
Revises: 3a1b2c3d4e5f
Create Date: 2026-08-10 00:00:00.000000
"""
from __future__ import annotations

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
import sqlmodel


revision: str = '4f5a6b7c8d9e'
down_revision: str | None = '3a1b2c3d4e5f'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table('member_trainers',
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('organization_id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('member_id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('trainer_member_id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('assigned_by', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('assigned_at', sa.DateTime(), nullable=False),
        sa.Column('active', sa.Boolean(), nullable=False),
        sa.ForeignKeyConstraint(['member_id'], ['organization_members.id'], ),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ),
        sa.ForeignKeyConstraint(['trainer_member_id'], ['organization_members.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('organization_id', 'member_id', 'trainer_member_id', 'active',
                            name='uq_member_trainer_active'),
    )
    with op.batch_alter_table('member_trainers', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_member_trainers_active'), ['active'], unique=False)
        batch_op.create_index(batch_op.f('ix_member_trainers_id'), ['id'], unique=False)
        batch_op.create_index(batch_op.f('ix_member_trainers_member_id'), ['member_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_member_trainers_organization_id'), ['organization_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_member_trainers_trainer_member_id'), ['trainer_member_id'], unique=False)


def downgrade() -> None:
    with op.batch_alter_table('member_trainers', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_member_trainers_trainer_member_id'))
        batch_op.drop_index(batch_op.f('ix_member_trainers_organization_id'))
        batch_op.drop_index(batch_op.f('ix_member_trainers_member_id'))
        batch_op.drop_index(batch_op.f('ix_member_trainers_id'))
        batch_op.drop_index(batch_op.f('ix_member_trainers_active'))

    op.drop_table('member_trainers')
