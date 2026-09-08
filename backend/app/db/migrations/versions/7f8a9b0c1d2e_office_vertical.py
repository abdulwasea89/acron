"""office vertical: companies, company_contracts, invoices + link columns

Revision ID: 7f8a9b0c1d2e
Revises: 6f7a8b9c0d1e
Create Date: 2026-09-09 09:00:00.000000

Office vertical (B2B invoices, invite-only seat-holders). Adds the three office
tables plus nullable link columns on existing tables:
- organizations: B2B invoice template fields
- organization_members.company_id  (a seat-holder sits under a Company)
- payments.invoice_id              (invoice settlements)
"""
from __future__ import annotations

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
import sqlmodel


revision: str = '7f8a9b0c1d2e'
down_revision: str | None = '6f7a8b9c0d1e'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table('companies',
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('organization_id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('name', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('contact_name', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('contact_email', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('contact_phone', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('billing_email', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('tax_id', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('address', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('notes', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('status', sqlmodel.sql.sqltypes.AutoString(), nullable=False, server_default='active'),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )
    with op.batch_alter_table('companies', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_companies_id'), ['id'], unique=False)
        batch_op.create_index(batch_op.f('ix_companies_organization_id'), ['organization_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_companies_status'), ['status'], unique=False)

    op.create_table('company_contracts',
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('organization_id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('company_id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('plan_id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('seats', sa.Integer(), nullable=False),
        sa.Column('price_per_seat', sa.Float(), nullable=False),
        sa.Column('currency', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('term', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('room_credits_remaining', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('start_date', sa.Date(), nullable=False),
        sa.Column('end_date', sa.Date(), nullable=True),
        sa.Column('next_billing_at', sa.Date(), nullable=False),
        sa.Column('notes', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('status', sqlmodel.sql.sqltypes.AutoString(), nullable=False, server_default='active'),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ),
        sa.ForeignKeyConstraint(['plan_id'], ['membership_plans.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )
    with op.batch_alter_table('company_contracts', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_company_contracts_company_id'), ['company_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_company_contracts_id'), ['id'], unique=False)
        batch_op.create_index(batch_op.f('ix_company_contracts_organization_id'), ['organization_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_company_contracts_status'), ['status'], unique=False)

    op.create_table('invoices',
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('organization_id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('company_id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('contract_id', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('invoice_number', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('issue_date', sa.Date(), nullable=False),
        sa.Column('due_date', sa.Date(), nullable=False),
        sa.Column('status', sqlmodel.sql.sqltypes.AutoString(), nullable=False, server_default='draft'),
        sa.Column('subtotal', sa.Float(), nullable=False),
        sa.Column('tax_amount', sa.Float(), nullable=False, server_default='0'),
        sa.Column('total', sa.Float(), nullable=False),
        sa.Column('currency', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('line_items_json', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('notes', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('paid_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ),
        sa.ForeignKeyConstraint(['contract_id'], ['company_contracts.id'], ),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('organization_id', 'invoice_number', name='uq_invoices_org_number'),
    )
    with op.batch_alter_table('invoices', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_invoices_company_id'), ['company_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_invoices_id'), ['id'], unique=False)
        batch_op.create_index(batch_op.f('ix_invoices_organization_id'), ['organization_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_invoices_status'), ['status'], unique=False)

    # ---- B2B invoice template on the tenant root ----
    with op.batch_alter_table('organizations', schema=None) as batch_op:
        batch_op.add_column(sa.Column('invoice_legal_name', sqlmodel.sql.sqltypes.AutoString(), nullable=True))
        batch_op.add_column(sa.Column('invoice_address', sqlmodel.sql.sqltypes.AutoString(), nullable=True))
        batch_op.add_column(sa.Column('invoice_tax_id', sqlmodel.sql.sqltypes.AutoString(), nullable=True))
        batch_op.add_column(sa.Column('invoice_payment_terms_days', sa.Integer(), nullable=True))

    # ---- seat-holder -> company binding (nullable; every pre-existing row is a gym/academy member) ----
    with op.batch_alter_table('organization_members', schema=None) as batch_op:
        batch_op.add_column(sa.Column('company_id', sqlmodel.sql.sqltypes.AutoString(), nullable=True))
        batch_op.create_index(batch_op.f('ix_organization_members_company_id'), ['company_id'], unique=False)

    # ---- invoice settlement link on payments ----
    with op.batch_alter_table('payments', schema=None) as batch_op:
        batch_op.add_column(sa.Column('invoice_id', sqlmodel.sql.sqltypes.AutoString(), nullable=True))
        batch_op.create_index(batch_op.f('ix_payments_invoice_id'), ['invoice_id'], unique=False)


def downgrade() -> None:
    with op.batch_alter_table('payments', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_payments_invoice_id'))
        batch_op.drop_column('invoice_id')

    with op.batch_alter_table('organization_members', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_organization_members_company_id'))
        batch_op.drop_column('company_id')

    with op.batch_alter_table('organizations', schema=None) as batch_op:
        batch_op.drop_column('invoice_payment_terms_days')
        batch_op.drop_column('invoice_tax_id')
        batch_op.drop_column('invoice_address')
        batch_op.drop_column('invoice_legal_name')

    with op.batch_alter_table('invoices', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_invoices_status'))
        batch_op.drop_index(batch_op.f('ix_invoices_organization_id'))
        batch_op.drop_index(batch_op.f('ix_invoices_id'))
        batch_op.drop_index(batch_op.f('ix_invoices_company_id'))

    op.drop_table('invoices')

    with op.batch_alter_table('company_contracts', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_company_contracts_status'))
        batch_op.drop_index(batch_op.f('ix_company_contracts_organization_id'))
        batch_op.drop_index(batch_op.f('ix_company_contracts_id'))
        batch_op.drop_index(batch_op.f('ix_company_contracts_company_id'))

    op.drop_table('company_contracts')

    with op.batch_alter_table('companies', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_companies_status'))
        batch_op.drop_index(batch_op.f('ix_companies_organization_id'))
        batch_op.drop_index(batch_op.f('ix_companies_id'))

    op.drop_table('companies')
