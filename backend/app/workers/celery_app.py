"""Celery application + beat schedule (Section: Queue; CLAUDE.md "Background jobs").

The heavy lifting lives in the async worker modules (``receipt_pipeline``,
``payment_reconciliation``, ``notifications``, ``spot_audit``, ``payroll_runner``),
which are plain ``async`` functions callable inline — that's what the tests and
the request path use. This module wraps the *scheduled* ones as Celery tasks and
declares the beat schedule:

  * reconcile stuck payments — every 2 minutes (Section 13.6)
  * expire due memberships + grace reminders — hourly (Section 9.5)
  * SaaS lifecycle enforcement — hourly (Section 3.2.4)
  * weekly receipt spot-audit + reversal-rate tuning — weekly (Section 10.5-6)

Each task opens its own ``AsyncSession`` and runs the async worker via
``asyncio.run`` (Celery workers are synchronous). Tasks iterate every org so a
single beat tick covers the whole platform.

Import-safe with no broker running: constructing the ``Celery`` object does not
connect. ``celery -A app.workers.celery_app.celery_app worker --beat`` starts it
for real; Redis is the broker (``settings.redis_url``).
"""

from __future__ import annotations

import asyncio
from collections.abc import Awaitable, Callable

from celery import Celery
from celery.schedules import crontab
from sqlmodel import select

from app.core.config import settings
from app.db.session import async_session_maker
from app.models.organization import Organization

celery_app = Celery(
    "gym_platform",
    broker=settings.redis_url,
    backend=settings.redis_url,
)
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_acks_late=True,
    worker_max_tasks_per_child=200,
)


def _run(coro: Awaitable) -> object:
    """Run an async coroutine from a synchronous Celery task."""

    return asyncio.run(coro)


async def _for_each_org(fn: Callable[[object, str], Awaitable[dict]]) -> dict:
    """Open a session, run ``fn(session, org_id)`` for every org, commit once."""

    results: dict[str, object] = {}
    async with async_session_maker() as session:
        org_ids = (await session.execute(select(Organization.id))).scalars().all()
        for org_id in org_ids:
            try:
                results[org_id] = await fn(session, org_id)
            except Exception as exc:  # one org failing must not stop the sweep
                results[org_id] = {"error": str(exc)}
        await session.commit()
    return {"orgs": len(results), "results": results}


# --------------------------------------------------------------------- tasks
@celery_app.task(name="payments.reconcile_stuck")
def reconcile_stuck_task() -> dict:
    from app.workers.payment_reconciliation import reconcile_stuck

    async def _go():
        async with async_session_maker() as session:
            out = await reconcile_stuck(session)  # all orgs at once
            await session.commit()
            return out

    return _run(_go())


@celery_app.task(name="memberships.expire_and_remind")
def expire_and_remind_task() -> dict:
    from app.workers.notifications import expire_due_memberships, send_grace_reminders

    async def _per_org(session, org_id):
        expired = await expire_due_memberships(session, org_id=org_id)
        reminded = await send_grace_reminders(session, org_id=org_id)
        return {"expired": expired, "reminded": reminded}

    return _run(_for_each_org(_per_org))


@celery_app.task(name="saas.enforce_lifecycle")
def enforce_saas_lifecycle_task() -> dict:
    from app.services.saas_billing_service import enforce_lifecycle

    async def _go():
        async with async_session_maker() as session:
            orgs = (await session.execute(select(Organization))).scalars().all()
            for org in orgs:
                await enforce_lifecycle(session, org=org)
            await session.commit()
            return {"orgs": len(orgs)}

    return _run(_go())


@celery_app.task(name="receipts.weekly_spot_audit")
def weekly_spot_audit_task() -> dict:
    from app.workers.spot_audit import run_spot_audit

    async def _per_org(session, org_id):
        return await run_spot_audit(session, org_id=org_id)

    return _run(_for_each_org(_per_org))


# ----------------------------------------------------------------- schedule
celery_app.conf.beat_schedule = {
    "reconcile-stuck-payments": {
        "task": "payments.reconcile_stuck",
        "schedule": 120.0,  # every 2 minutes (Section 13.6)
    },
    "expire-and-remind": {
        "task": "memberships.expire_and_remind",
        "schedule": crontab(minute=0),  # hourly
    },
    "enforce-saas-lifecycle": {
        "task": "saas.enforce_lifecycle",
        "schedule": crontab(minute=5),  # hourly, offset
    },
    "weekly-spot-audit": {
        "task": "receipts.weekly_spot_audit",
        "schedule": crontab(minute=0, hour=3, day_of_week=1),  # Mondays 03:00 UTC
    },
}
