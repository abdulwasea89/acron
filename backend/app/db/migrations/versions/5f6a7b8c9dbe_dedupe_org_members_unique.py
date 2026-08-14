"""dedupe organization_members and enforce (org, user) uniqueness

Revision ID: 5f6a7b8c9dbe
Revises: 4f5a6b7c8d9e
Create Date: 2026-08-14 22:55:00.000000

Login crashes with ``MultipleResultsFound`` when a user has more than one
``organization_members`` row in the same org (no DB constraint existed, so
concurrent/scripted invites could double-insert). This migration:
1. Removes duplicates, keeping the oldest row per (org, user) unless a newer
   one is referenced by a downstream table (payments, subscriptions, bookings,
   receipts, tasks, payroll, shifts, classes, member_trainers).
2. Adds a unique constraint so it can never happen again.
"""
from __future__ import annotations

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = '5f6a7b8c9dbe'
down_revision: str | None = '5a6b7c8d9e0f'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# (table, column) pairs whose value references organization_members.id. A row
# that is referenced anywhere is the one we must keep.
REFERENCE_COLUMNS: list[tuple[str, str]] = [
    ("payments", "member_id"),
    ("subscriptions", "member_id"),
    ("class_bookings", "member_id"),
    ("receipt_uploads", "member_id"),
    ("tasks", "assignee_member_id"),
    ("pay_advances", "staff_member_id"),
    ("payroll_entries", "staff_member_id"),
    ("shifts", "staff_member_id"),
    ("class_sessions", "trainer_member_id"),
    ("member_trainers", "member_id"),
    ("member_trainers", "trainer_member_id"),
]


def _is_referenced(conn, member_id: str) -> bool:
    for table, column in REFERENCE_COLUMNS:
        hit = conn.execute(
            sa.text(f"SELECT 1 FROM {table} WHERE {column} = :mid LIMIT 1"),
            {"mid": member_id},
        ).scalar()
        if hit:
            return True
    return False


def _dedupe(conn) -> int:
    groups = conn.execute(
        sa.text(
            "SELECT organization_id, user_id FROM organization_members "
            "GROUP BY organization_id, user_id HAVING count(*) > 1"
        )
    ).all()
    removed = 0
    for org_id, user_id in groups:
        rows = conn.execute(
            sa.text(
                "SELECT id, created_at FROM organization_members "
                "WHERE organization_id = :o AND user_id = :u "
                "ORDER BY created_at ASC, id ASC"
            ),
            {"o": org_id, "u": user_id},
        ).all()
        keep = next((row for row in rows if _is_referenced(conn, row.id)), rows[0])
        for row in rows:
            if row.id == keep.id:
                continue
            conn.execute(
                sa.text("DELETE FROM organization_members WHERE id = :mid"),
                {"mid": row.id},
            )
            removed += 1
    return removed


def upgrade() -> None:
    conn = op.get_bind()
    removed = _dedupe(conn)
    if removed:
        print(f"[dedupe] removed {removed} duplicate organization_members row(s)")
    with op.batch_alter_table('organization_members', schema=None) as batch_op:
        batch_op.create_unique_constraint(
            'uq_organization_members_org_user', ['organization_id', 'user_id']
        )


def downgrade() -> None:
    with op.batch_alter_table('organization_members', schema=None) as batch_op:
        batch_op.drop_constraint('uq_organization_members_org_user', type_='unique')
