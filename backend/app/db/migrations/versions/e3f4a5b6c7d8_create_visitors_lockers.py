"""create visitors and lockers

Walk-ins / day passes / guest log + locker register (Section 1.3, #22).

Revision ID: e3f4a5b6c7d8
Revises: d2e3f4a5b6c7
Create Date: 2026-10-03 00:00:00.000000
"""
from __future__ import annotations

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
import sqlmodel


revision: str = 'e3f4a5b6c7d8'
down_revision: str | None = 'd2e3f4a5b6c7'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table('visitors',
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('organization_id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('name', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('phone', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('email', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('kind', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('host_member_id', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('amount', sa.Float(), nullable=False),
        sa.Column('method', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('payment_id', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('paid', sa.Boolean(), nullable=False),
        sa.Column('locker_number', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('note', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('checked_in_at', sa.DateTime(), nullable=False),
        sa.Column('checked_out_at', sa.DateTime(), nullable=True),
        sa.Column('logged_by', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('idempotency_key', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.ForeignKeyConstraint(['host_member_id'], ['organization_members.id'], ),
        sa.ForeignKeyConstraint(['logged_by'], ['users.id'], ),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ),
        sa.ForeignKeyConstraint(['payment_id'], ['payments.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )
    with op.batch_alter_table('visitors', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_visitors_checked_in_at'), ['checked_in_at'], unique=False)
        batch_op.create_index(batch_op.f('ix_visitors_id'), ['id'], unique=False)
        batch_op.create_index(batch_op.f('ix_visitors_idempotency_key'), ['idempotency_key'], unique=False)
        batch_op.create_index(batch_op.f('ix_visitors_kind'), ['kind'], unique=False)
        batch_op.create_index(batch_op.f('ix_visitors_organization_id'), ['organization_id'], unique=False)

    op.create_table('lockers',
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('organization_id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('number', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('status', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('holder_label', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('assigned_at', sa.DateTime(), nullable=True),
        sa.Column('note', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('organization_id', 'number', name='uq_lockers_org_number'),
    )
    with op.batch_alter_table('lockers', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_lockers_id'), ['id'], unique=False)
        batch_op.create_index(batch_op.f('ix_lockers_number'), ['number'], unique=False)
        batch_op.create_index(batch_op.f('ix_lockers_organization_id'), ['organization_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_lockers_status'), ['status'], unique=False)


def downgrade() -> None:
    with op.batch_alter_table('lockers', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_lockers_status'))
        batch_op.drop_index(batch_op.f('ix_lockers_organization_id'))
        batch_op.drop_index(batch_op.f('ix_lockers_number'))
        batch_op.drop_index(batch_op.f('ix_lockers_id'))
    op.drop_table('lockers')

    with op.batch_alter_table('visitors', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_visitors_organization_id'))
        batch_op.drop_index(batch_op.f('ix_visitors_kind'))
        batch_op.drop_index(batch_op.f('ix_visitors_idempotency_key'))
        batch_op.drop_index(batch_op.f('ix_visitors_id'))
        batch_op.drop_index(batch_op.f('ix_visitors_checked_in_at'))
    op.drop_table('visitors')
