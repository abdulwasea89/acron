"""multi-industry core columns (offer_kind/spec_json, category, checklist flags)

Revision ID: 6f7a8b9c0d1e
Revises: 5f6a7b8c9dbe
Create Date: 2026-09-09 00:00:00.000000
"""
from __future__ import annotations

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
import sqlmodel


revision: str = '6f7a8b9c0d1e'
down_revision: str | None = '5f6a7b8c9dbe'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # ---- organizations: canonical industry value + industry checklist flags ----
    # The `industry` column already exists (legacy default 'gym_fitness'). Backfill
    # every legacy row to the canonical 'gym' key. No column add/drop for industry.
    op.execute("UPDATE organizations SET industry = 'gym' WHERE industry = 'gym_fitness'")
    with op.batch_alter_table('organizations', schema=None) as batch_op:
        batch_op.add_column(sa.Column('checklist_companies_added', sa.Boolean(), nullable=False, server_default='0'))
        batch_op.add_column(sa.Column('checklist_courses_added', sa.Boolean(), nullable=False, server_default='0'))
        batch_op.add_column(sa.Column('checklist_invoice_template_set', sa.Boolean(), nullable=False, server_default='0'))

    # ---- membership_plans: offer kind + industry spec ----
    with op.batch_alter_table('membership_plans', schema=None) as batch_op:
        batch_op.add_column(sa.Column('offer_kind', sqlmodel.sql.sqltypes.AutoString(), nullable=False, server_default='membership'))
        batch_op.add_column(sa.Column('spec_json', sqlmodel.sql.sqltypes.AutoString(), nullable=True))
        batch_op.add_column(sa.Column('org_industry', sqlmodel.sql.sqltypes.AutoString(), nullable=True))

    # ---- class_sessions: slot category (class | space_slot | lesson) ----
    with op.batch_alter_table('class_sessions', schema=None) as batch_op:
        batch_op.add_column(sa.Column('category', sqlmodel.sql.sqltypes.AutoString(), nullable=False, server_default='class'))


def downgrade() -> None:
    with op.batch_alter_table('class_sessions', schema=None) as batch_op:
        batch_op.drop_column('category')

    with op.batch_alter_table('membership_plans', schema=None) as batch_op:
        batch_op.drop_column('org_industry')
        batch_op.drop_column('spec_json')
        batch_op.drop_column('offer_kind')

    with op.batch_alter_table('organizations', schema=None) as batch_op:
        batch_op.drop_column('checklist_invoice_template_set')
        batch_op.drop_column('checklist_courses_added')
        batch_op.drop_column('checklist_companies_added')
