"""Seed the dev database with test data so invoice PDF download can be tried.

Usage:
  cd backend && source .venv/bin/activate && python ../scripts/seed_db.py

This creates one org, activates its SaaS subscription, and inserts a paid
SAAS_SUBSCRIPTION payment record so the billing page shows an invoice with
a "Download PDF" link.
"""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlmodel import SQLModel

import app.db.base  # noqa: F401  register models

from app.core.constants import PaymentKind, PaymentMethod, PaymentStatus, SaasStatus, SaasTier
from app.models.organization import Organization
from app.models.payment import Payment


async def seed() -> None:
    from app.core.config import settings
    from app.core.security import now_utc

    engine = create_async_engine(settings.database_url, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)

    maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with maker() as session:
        orgs = list(
            (await session.execute(
                __import__("sqlmodel").select(Organization).limit(1)
            )).scalars()
        )

        if orgs:
            org = orgs[0]
            print(f"Using existing org: {org.name!r} (id={org.id[:12]}…)")
        else:
            org = Organization(
                name="Iron Pulse Boxing",
                org_code="IRON-PULS-3K9",
                address="123 Main St, New York, NY 10001",
                country="US",
                timezone="America/New_York",
                default_currency="USD",
                saas_tier=SaasTier.PRO,
                saas_status=SaasStatus.ACTIVE,
                member_cap=100,
                saas_current_period_end=now_utc() + timedelta(days=25),
            )
            session.add(org)
            await session.flush()
            print(f"Created org: {org.name!r} (id={org.id[:12]}…)")

        payment = Payment(
            organization_id=org.id,
            kind=PaymentKind.SAAS_SUBSCRIPTION,
            method=PaymentMethod.CARD,
            status=PaymentStatus.SUCCEEDED,
            amount=79.00,
            tax_amount=0.0,
            currency="USD",
            paid_at=now_utc() - timedelta(days=5),
            created_at=now_utc() - timedelta(days=5),
        )
        session.add(payment)
        await session.commit()
        print(f"Created dummy invoice: id={payment.id[:12]}…")
        print()
        print(f"  → Download at: /api/download/saas-billing/invoices/{payment.id}/pdf")
        print(f"  → Open billing page and click the PDF link in the invoice table")


asyncio.run(seed())
