"""create challenges, streaks, leaderboards

Challenges, streak tracking, and the leaderboard aggregated from attendance
(#38). Gym-defined challenges (N visits / N classes / streak length), one
progress row per (challenge, member) that completes exactly once, and a per
member streak summary maintained by the daily worker.
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
import sqlmodel


revision: str = "d8e9f0a1b2c3"
down_revision: str | None = "c7d8e9f0a1b2"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "gym_challenges",
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("id", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("organization_id", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("title", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("description", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column("goal_type", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("goal_target", sa.Integer(), nullable=False),
        sa.Column("reward", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column("status", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("is_public", sa.Boolean(), nullable=False),
        sa.Column("starts_at", sa.DateTime(), nullable=False),
        sa.Column("ends_at", sa.DateTime(), nullable=False),
        sa.Column("created_by_member_id", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column("published_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(
            ["created_by_member_id"],
            ["organization_members.id"],
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    with op.batch_alter_table("gym_challenges", schema=None) as batch_op:
        batch_op.create_index(
            batch_op.f("ix_gym_challenges_starts_at"), ["starts_at"], unique=False
        )
        batch_op.create_index(batch_op.f("ix_gym_challenges_status"), ["status"], unique=False)
        batch_op.create_index(batch_op.f("ix_gym_challenges_ends_at"), ["ends_at"], unique=False)
        batch_op.create_index(
            batch_op.f("ix_gym_challenges_goal_type"), ["goal_type"], unique=False
        )
        batch_op.create_index(batch_op.f("ix_gym_challenges_id"), ["id"], unique=False)
        batch_op.create_index(
            batch_op.f("ix_gym_challenges_organization_id"), ["organization_id"], unique=False
        )

    op.create_table(
        "member_challenge_progress",
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("id", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("organization_id", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("challenge_id", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("member_id", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("status", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("progress", sa.Integer(), nullable=False),
        sa.Column("started_at", sa.DateTime(), nullable=False),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(
            ["challenge_id"],
            ["gym_challenges.id"],
        ),
        sa.ForeignKeyConstraint(
            ["member_id"],
            ["organization_members.id"],
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("challenge_id", "member_id", name="uq_member_challenge_progress"),
    )
    with op.batch_alter_table("member_challenge_progress", schema=None) as batch_op:
        batch_op.create_index(
            batch_op.f("ix_member_challenge_progress_challenge_id"), ["challenge_id"], unique=False
        )
        batch_op.create_index(batch_op.f("ix_member_challenge_progress_id"), ["id"], unique=False)
        batch_op.create_index(
            batch_op.f("ix_member_challenge_progress_member_id"), ["member_id"], unique=False
        )
        batch_op.create_index(
            batch_op.f("ix_member_challenge_progress_organization_id"),
            ["organization_id"],
            unique=False,
        )
        batch_op.create_index(
            batch_op.f("ix_member_challenge_progress_status"), ["status"], unique=False
        )

    op.create_table(
        "member_streaks",
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("id", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("organization_id", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("member_id", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("current_streak", sa.Integer(), nullable=False),
        sa.Column("best_streak", sa.Integer(), nullable=False),
        sa.Column("last_active_date", sa.Date(), nullable=True),
        sa.ForeignKeyConstraint(
            ["member_id"],
            ["organization_members.id"],
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("organization_id", "member_id", name="uq_member_streak_org_member"),
    )
    with op.batch_alter_table("member_streaks", schema=None) as batch_op:
        batch_op.create_index(batch_op.f("ix_member_streaks_id"), ["id"], unique=False)
        batch_op.create_index(
            batch_op.f("ix_member_streaks_member_id"), ["member_id"], unique=False
        )
        batch_op.create_index(
            batch_op.f("ix_member_streaks_organization_id"), ["organization_id"], unique=False
        )


def downgrade() -> None:
    with op.batch_alter_table("member_streaks", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_member_streaks_organization_id"))
        batch_op.drop_index(batch_op.f("ix_member_streaks_member_id"))
        batch_op.drop_index(batch_op.f("ix_member_streaks_id"))
    op.drop_table("member_streaks")

    with op.batch_alter_table("member_challenge_progress", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_member_challenge_progress_status"))
        batch_op.drop_index(batch_op.f("ix_member_challenge_progress_organization_id"))
        batch_op.drop_index(batch_op.f("ix_member_challenge_progress_member_id"))
        batch_op.drop_index(batch_op.f("ix_member_challenge_progress_id"))
        batch_op.drop_index(batch_op.f("ix_member_challenge_progress_challenge_id"))
    op.drop_table("member_challenge_progress")

    with op.batch_alter_table("gym_challenges", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_gym_challenges_organization_id"))
        batch_op.drop_index(batch_op.f("ix_gym_challenges_id"))
        batch_op.drop_index(batch_op.f("ix_gym_challenges_goal_type"))
        batch_op.drop_index(batch_op.f("ix_gym_challenges_ends_at"))
        batch_op.drop_index(batch_op.f("ix_gym_challenges_status"))
        batch_op.drop_index(batch_op.f("ix_gym_challenges_starts_at"))
    op.drop_table("gym_challenges")
