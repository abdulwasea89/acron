"""create inbox tables

Shared team inbox: conversations + messages across channels (Section 1.3, #20).

Revision ID: d2e3f4a5b6c7
Revises: c1d2e3f4a5b6
Create Date: 2026-10-03 00:00:00.000000
"""
from __future__ import annotations

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
import sqlmodel


revision: str = 'd2e3f4a5b6c7'
down_revision: str | None = 'c1d2e3f4a5b6'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table('inbox_conversations',
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('organization_id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('member_id', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('channel', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('contact_handle', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('contact_name', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('subject', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('status', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('assigned_to', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('last_message_at', sa.DateTime(), nullable=False),
        sa.Column('unread_count', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['assigned_to'], ['users.id'], ),
        sa.ForeignKeyConstraint(['member_id'], ['organization_members.id'], ),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )
    with op.batch_alter_table('inbox_conversations', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_inbox_conversations_assigned_to'), ['assigned_to'], unique=False)
        batch_op.create_index(batch_op.f('ix_inbox_conversations_channel'), ['channel'], unique=False)
        batch_op.create_index(batch_op.f('ix_inbox_conversations_contact_handle'), ['contact_handle'], unique=False)
        batch_op.create_index(batch_op.f('ix_inbox_conversations_id'), ['id'], unique=False)
        batch_op.create_index(batch_op.f('ix_inbox_conversations_last_message_at'), ['last_message_at'], unique=False)
        batch_op.create_index(batch_op.f('ix_inbox_conversations_member_id'), ['member_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_inbox_conversations_organization_id'), ['organization_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_inbox_conversations_status'), ['status'], unique=False)

    op.create_table('inbox_messages',
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('organization_id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('conversation_id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('direction', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('sender_kind', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('sender_user_id', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('body', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('channel', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('external_id', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('delivery_status', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('idempotency_key', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.ForeignKeyConstraint(['conversation_id'], ['inbox_conversations.id'], ),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ),
        sa.ForeignKeyConstraint(['sender_user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )
    with op.batch_alter_table('inbox_messages', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_inbox_messages_conversation_id'), ['conversation_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_inbox_messages_direction'), ['direction'], unique=False)
        batch_op.create_index(batch_op.f('ix_inbox_messages_external_id'), ['external_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_inbox_messages_id'), ['id'], unique=False)
        batch_op.create_index(batch_op.f('ix_inbox_messages_idempotency_key'), ['idempotency_key'], unique=False)
        batch_op.create_index(batch_op.f('ix_inbox_messages_organization_id'), ['organization_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_inbox_messages_sender_kind'), ['sender_kind'], unique=False)


def downgrade() -> None:
    with op.batch_alter_table('inbox_messages', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_inbox_messages_sender_kind'))
        batch_op.drop_index(batch_op.f('ix_inbox_messages_organization_id'))
        batch_op.drop_index(batch_op.f('ix_inbox_messages_idempotency_key'))
        batch_op.drop_index(batch_op.f('ix_inbox_messages_id'))
        batch_op.drop_index(batch_op.f('ix_inbox_messages_external_id'))
        batch_op.drop_index(batch_op.f('ix_inbox_messages_direction'))
        batch_op.drop_index(batch_op.f('ix_inbox_messages_conversation_id'))

    op.drop_table('inbox_messages')

    with op.batch_alter_table('inbox_conversations', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_inbox_conversations_status'))
        batch_op.drop_index(batch_op.f('ix_inbox_conversations_organization_id'))
        batch_op.drop_index(batch_op.f('ix_inbox_conversations_member_id'))
        batch_op.drop_index(batch_op.f('ix_inbox_conversations_last_message_at'))
        batch_op.drop_index(batch_op.f('ix_inbox_conversations_id'))
        batch_op.drop_index(batch_op.f('ix_inbox_conversations_contact_handle'))
        batch_op.drop_index(batch_op.f('ix_inbox_conversations_channel'))
        batch_op.drop_index(batch_op.f('ix_inbox_conversations_assigned_to'))

    op.drop_table('inbox_conversations')
