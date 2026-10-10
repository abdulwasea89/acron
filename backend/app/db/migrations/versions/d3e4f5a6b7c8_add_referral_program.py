"""add member referral program and reward tracking

Revision ID: d3e4f5a6b7c8
Revises: c8d9e0f1a2b3
Create Date: 2026-10-10 00:00:00.000000
"""
from __future__ import annotations

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
import sqlmodel


revision: str = "d3e4f5a6b7c8"
down_revision: str | None = "c8d9e0f1a2b3"
branch_labels: str | Sequence[str] | None = None
depends_on: str | None = None


def upgrade() -> None:
    op.create_table(
        "referral_programs",
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("id", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("organization_id", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("enabled", sa.Boolean(), nullable=False),
        sa.Column("reward_description", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("updated_by", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"]),
        sa.ForeignKeyConstraint(["updated_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("organization_id"),
    )
    with op.batch_alter_table("referral_programs", schema=None) as batch_op:
        batch_op.create_index("ix_referral_programs_id", ["id"], unique=False)
        batch_op.create_index("ix_referral_programs_organization_id", ["organization_id"], unique=True)

    op.create_table(
        "referral_codes",
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("id", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("organization_id", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("member_id", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("code", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"]),
        sa.ForeignKeyConstraint(["member_id"], ["organization_members.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("organization_id", "member_id", name="uq_referral_code_member"),
        sa.UniqueConstraint("organization_id", "code", name="uq_referral_code_org_code"),
    )
    with op.batch_alter_table("referral_codes", schema=None) as batch_op:
        batch_op.create_index("ix_referral_codes_id", ["id"], unique=False)
        batch_op.create_index("ix_referral_codes_organization_id", ["organization_id"], unique=False)
        batch_op.create_index("ix_referral_codes_member_id", ["member_id"], unique=False)
        batch_op.create_index("ix_referral_codes_code", ["code"], unique=False)

    op.create_table(
        "referrals",
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("id", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("organization_id", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("referral_code_id", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("referrer_member_id", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("referred_member_id", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("status", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("reward_description", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("qualified_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"]),
        sa.ForeignKeyConstraint(["referral_code_id"], ["referral_codes.id"]),
        sa.ForeignKeyConstraint(["referrer_member_id"], ["organization_members.id"]),
        sa.ForeignKeyConstraint(["referred_member_id"], ["organization_members.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("referred_member_id", name="uq_referral_referred_member"),
    )
    with op.batch_alter_table("referrals", schema=None) as batch_op:
        batch_op.create_index("ix_referrals_id", ["id"], unique=False)
        batch_op.create_index("ix_referrals_organization_id", ["organization_id"], unique=False)
        batch_op.create_index("ix_referrals_referral_code_id", ["referral_code_id"], unique=False)
        batch_op.create_index("ix_referrals_referrer_member_id", ["referrer_member_id"], unique=False)
        batch_op.create_index("ix_referrals_referred_member_id", ["referred_member_id"], unique=False)
        batch_op.create_index("ix_referrals_status", ["status"], unique=False)

    op.create_table(
        "referral_rewards",
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("id", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("organization_id", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("referral_id", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("recipient_member_id", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("description", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("status", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("earned_at", sa.DateTime(), nullable=False),
        sa.Column("fulfilled_at", sa.DateTime(), nullable=True),
        sa.Column("fulfilled_by", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"]),
        sa.ForeignKeyConstraint(["referral_id"], ["referrals.id"]),
        sa.ForeignKeyConstraint(["recipient_member_id"], ["organization_members.id"]),
        sa.ForeignKeyConstraint(["fulfilled_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("referral_id", "recipient_member_id", name="uq_referral_reward_recipient"),
    )
    with op.batch_alter_table("referral_rewards", schema=None) as batch_op:
        batch_op.create_index("ix_referral_rewards_id", ["id"], unique=False)
        batch_op.create_index("ix_referral_rewards_organization_id", ["organization_id"], unique=False)
        batch_op.create_index("ix_referral_rewards_referral_id", ["referral_id"], unique=False)
        batch_op.create_index("ix_referral_rewards_recipient_member_id", ["recipient_member_id"], unique=False)
        batch_op.create_index("ix_referral_rewards_status", ["status"], unique=False)

    with op.batch_alter_table("leads", schema=None) as batch_op:
        batch_op.add_column(sa.Column("converted_member_id", sqlmodel.sql.sqltypes.AutoString(), nullable=True))
        batch_op.add_column(sa.Column("referred_by_member_id", sqlmodel.sql.sqltypes.AutoString(), nullable=True))
        batch_op.create_foreign_key("fk_leads_converted_member_id", "organization_members", ["converted_member_id"], ["id"])
        batch_op.create_foreign_key("fk_leads_referred_by_member_id", "organization_members", ["referred_by_member_id"], ["id"])


def downgrade() -> None:
    with op.batch_alter_table("leads", schema=None) as batch_op:
        batch_op.drop_constraint("fk_leads_referred_by_member_id", type_="foreignkey")
        batch_op.drop_constraint("fk_leads_converted_member_id", type_="foreignkey")
        batch_op.drop_column("referred_by_member_id")
        batch_op.drop_column("converted_member_id")

    with op.batch_alter_table("referral_rewards", schema=None) as batch_op:
        for name in ("status", "recipient_member_id", "referral_id", "organization_id", "id"):
            batch_op.drop_index(f"ix_referral_rewards_{name}")
    op.drop_table("referral_rewards")

    with op.batch_alter_table("referrals", schema=None) as batch_op:
        for name in ("status", "referred_member_id", "referrer_member_id", "referral_code_id", "organization_id", "id"):
            batch_op.drop_index(f"ix_referrals_{name}")
    op.drop_table("referrals")

    with op.batch_alter_table("referral_codes", schema=None) as batch_op:
        for name in ("code", "member_id", "organization_id", "id"):
            batch_op.drop_index(f"ix_referral_codes_{name}")
    op.drop_table("referral_codes")

    with op.batch_alter_table("referral_programs", schema=None) as batch_op:
        batch_op.drop_index("ix_referral_programs_organization_id")
        batch_op.drop_index("ix_referral_programs_id")
    op.drop_table("referral_programs")
