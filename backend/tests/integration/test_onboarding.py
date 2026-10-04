"""Integration tests for the 90-day onboarding journey (#32).

Covers: auto-start on activation, member self view + milestone completion, the
daily worker advancing the clock and firing due milestones, the silent backfill
of older members (no email spam), the "going quiet" staff task, admin pause/
resume + summary, capability enforcement and tenant isolation.
"""

from __future__ import annotations

import uuid
from datetime import timedelta

import pytest
from sqlmodel import select

from app.core.constants import NotificationKind, OnboardingStatus
from app.core.security import now_utc
from app.integrations.email import outbox
from app.models.membership import OrganizationMember
from app.models.notification import Notification
from app.models.onboarding import OnboardingJourney, OnboardingMilestoneProgress
from app.models.staff import Task
from app.services.onboarding_service import CATALOG
from app.workers.onboarding import run_onboarding_progression
from tests.helpers import OWNER_PROFILE, latest_code_for

PASSWORD = "Sup3rStr0ng!Pass"
MEMBER_PWD = "M3mberStr0ng!Pwd"


async def _provision_gym(client, *, owner_email="owner@onb.com"):
    await client.post("/api/v1/auth/register", json={
        "full_name": "Alex", "email": owner_email,
        "password": PASSWORD, "confirm_password": PASSWORD, **OWNER_PROFILE})
    code = latest_code_for(owner_email)
    await client.post("/api/v1/auth/verify-email", json={"email": owner_email, "code": code})
    r = await client.post("/api/v1/organizations/register", json={
        "owner_email": owner_email,
        "details": {"name": "Iron Pulse Boxing", "default_currency": "USD"},
        "tier": "pro"})
    body = r.json()
    org_id = body["organization"]["id"]
    org_code = body["organization"]["org_code"]
    headers = {"Authorization": f"Bearer {body['access_token']}", "X-Organization-Id": org_id}
    await client.post("/api/v1/organizations/me/connect", headers=headers)
    await client.post("/api/v1/organizations/me/connect/complete", headers=headers)
    r = await client.post("/api/v1/plans", headers=headers, json={
        "name": "Monthly", "price": 149.0, "billing_type": "recurring",
        "cycle_unit": "month", "cycle_length": 1})
    plan_id = r.json()["id"]
    await client.post(f"/api/v1/plans/{plan_id}/publish", headers=headers)
    return headers, org_id, org_code, plan_id


async def _signup_member(client, org_code, plan_id, email) -> str:
    await client.post("/api/v1/memberships/signup/request-email",
                      json={"org_code": org_code, "email": email})
    code = latest_code_for(email)
    await client.post("/api/v1/memberships/signup/verify-email",
                      json={"org_code": org_code, "email": email, "code": code})
    r = await client.post("/api/v1/memberships/signup/set-password",
                          json={"org_code": org_code, "email": email, "password": MEMBER_PWD})
    member_id = r.json()["member_id"]
    await client.post("/api/v1/memberships/signup/pay",
                      headers={"Idempotency-Key": str(uuid.uuid4())},
                      json={"org_code": org_code, "email": email, "plan_id": plan_id})
    return member_id


async def _member_headers(client, org_code, email):
    r = await client.post("/api/v1/auth/member-login",
                          json={"org_code": org_code, "email": email, "password": MEMBER_PWD})
    body = r.json()
    return {"Authorization": f"Bearer {body['access_token']}",
            "X-Organization-Id": body["organization_id"]}


async def _journey(db, member_id) -> OnboardingJourney:
    return (
        await db.execute(
            select(OnboardingJourney).where(OnboardingJourney.member_id == member_id)
        )
    ).scalar_one()


async def _set_started(db, journey: OnboardingJourney, *, days_ago: int):
    journey.started_at = now_utc() - timedelta(days=days_ago)
    db.add(journey)
    await db.commit()


# ----------------------------------------------------------------- start / view
@pytest.mark.asyncio
async def test_journey_starts_on_activation(client, db):
    headers, org_id, org_code, plan_id = await _provision_gym(client)
    member_id = await _signup_member(client, org_code, plan_id, "m@onb.com")
    mheaders = await _member_headers(client, org_code, "m@onb.com")

    journey = await _journey(db, member_id)
    assert journey.status == OnboardingStatus.ACTIVE
    assert journey.current_day == 0

    r = await client.get("/api/v1/onboarding/me", headers=mheaders)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["status"] == "active"
    assert body["total_days"] == 90
    assert len(body["milestones"]) == len(CATALOG)
    welcome = next(m for m in body["milestones"] if m["code"] == "welcome")
    assert welcome["status"] == "pending"      # fired (day 0) but not yet done
    graduate = next(m for m in body["milestones"] if m["code"] == "graduate")
    assert graduate["status"] == "locked"

    # The member got a welcome notification.
    notes = (
        await db.execute(
            select(Notification).where(
                Notification.organization_id == org_id,
                Notification.category == NotificationKind.ONBOARDING,
            )
        )
    ).scalars().all()
    assert any("Welcome" in n.title for n in notes)

    # Admin sees the journey in the roster.
    r = await client.get("/api/v1/onboarding/members", headers=headers)
    assert r.status_code == 200, r.text
    assert any(row["member_id"] == member_id for row in r.json())


@pytest.mark.asyncio
async def test_member_completes_milestone(client, db):
    _h, _org, org_code, plan_id = await _provision_gym(client)
    await _signup_member(client, org_code, plan_id, "m@onb.com")
    mheaders = await _member_headers(client, org_code, "m@onb.com")

    r = await client.post("/api/v1/onboarding/me/milestones/complete",
                          headers=mheaders, json={"code": "welcome"})
    assert r.status_code == 200, r.text
    welcome = next(m for m in r.json()["milestones"] if m["code"] == "welcome")
    assert welcome["status"] == "completed"
    assert welcome["completed_at"] is not None

    # A milestone not yet reached cannot be completed.
    r = await client.post("/api/v1/onboarding/me/milestones/complete",
                          headers=mheaders, json={"code": "graduate"})
    assert r.status_code == 404


# --------------------------------------------------------------------- worker
@pytest.mark.asyncio
async def test_daily_worker_advances_and_completes(client, db):
    _h, org_id, org_code, plan_id = await _provision_gym(client)
    member_id = await _signup_member(client, org_code, plan_id, "m@onb.com")

    journey = await _journey(db, member_id)
    await _set_started(db, journey, days_ago=45)
    await run_onboarding_progression(db, org_id=org_id)
    await db.commit()

    await db.refresh(journey)
    assert journey.current_day == 45
    codes = {
        p.code
        for p in (await db.execute(
            select(OnboardingMilestoneProgress).where(
                OnboardingMilestoneProgress.journey_id == journey.id)
        )).scalars().all()
    }
    assert {"welcome", "first_checkin", "week_1", "week_2", "month_1"} <= codes
    assert "month_2" not in codes and "graduate" not in codes
    assert journey.status == OnboardingStatus.ACTIVE

    # Roll the clock to day 90+: the journey closes with every milestone fired.
    await _set_started(db, journey, days_ago=95)
    await run_onboarding_progression(db, org_id=org_id)
    await db.commit()
    await db.refresh(journey)
    assert journey.current_day == 90
    assert journey.status == OnboardingStatus.COMPLETED
    assert journey.completed_at is not None
    codes = {
        p.code
        for p in (await db.execute(
            select(OnboardingMilestoneProgress).where(
                OnboardingMilestoneProgress.journey_id == journey.id)
        )).scalars().all()
    }
    assert {m.code for m in CATALOG} == codes


@pytest.mark.asyncio
async def test_backfill_does_not_email_older_members(client, db):
    _h, org_id, org_code, plan_id = await _provision_gym(client)
    member_id = await _signup_member(client, org_code, plan_id, "quiet@onb.com")
    journey = await _journey(db, member_id)

    # Simulate an imported member: drop the auto-started journey, set joined_at
    # 40 days ago, and let the worker backfill from scratch.
    from sqlmodel import delete as sql_delete

    await db.execute(
        sql_delete(OnboardingMilestoneProgress).where(
            OnboardingMilestoneProgress.journey_id == journey.id)
    )
    await db.execute(
        sql_delete(OnboardingJourney).where(OnboardingJourney.id == journey.id)
    )
    member = await db.get(OrganizationMember, member_id)
    member.joined_at = now_utc() - timedelta(days=40)
    db.add(member)
    await db.commit()

    outbox.clear()
    await run_onboarding_progression(db, org_id=org_id)
    await db.commit()

    new_journey = await _journey(db, member_id)
    assert new_journey.current_day == 40
    # Old milestones fired silently (no email) during backfill.
    assert not any(m.to == "quiet@onb.com" for m in outbox)


@pytest.mark.asyncio
async def test_quiet_member_raises_one_task(client, db):
    _h, org_id, org_code, plan_id = await _provision_gym(client)
    member_id = await _signup_member(client, org_code, plan_id, "silent@onb.com")
    journey = await _journey(db, member_id)
    await _set_started(db, journey, days_ago=8)
    await db.commit()

    await run_onboarding_progression(db, org_id=org_id)
    await db.commit()
    await run_onboarding_progression(db, org_id=org_id)
    await db.commit()

    tasks = (
        await db.execute(
            select(Task).where(
                Task.organization_id == org_id,
                Task.title.like("%no visits%"),
            )
        )
    ).scalars().all()
    assert len(tasks) == 1

    await db.refresh(journey)
    assert journey.quiet_flag_at is not None


# --------------------------------------------------------------------- admin
@pytest.mark.asyncio
async def test_admin_pause_resume_and_summary(client, db):
    headers, _org, org_code, plan_id = await _provision_gym(client)
    member_id = await _signup_member(client, org_code, plan_id, "m@onb.com")

    r = await client.post(f"/api/v1/onboarding/members/{member_id}/status",
                          headers=headers, json={"pause": True})
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "paused"

    r = await client.get("/api/v1/onboarding/summary", headers=headers)
    assert r.status_code == 200, r.text
    assert r.json()["paused"] == 1

    r = await client.post(f"/api/v1/onboarding/members/{member_id}/status",
                          headers=headers, json={"pause": False})
    assert r.json()["status"] == "active"


@pytest.mark.asyncio
async def test_capability_and_tenant_isolation(client, db):
    headers, org_id, org_code, plan_id = await _provision_gym(client)
    member_id = await _signup_member(client, org_code, plan_id, "m@onb.com")

    # A second org cannot read the first org's journey.
    _h2, _org2, _org_code2, _plan2 = await _provision_gym(client, owner_email="other@onb.com")
    _h2 = _h2
    r = await client.get(f"/api/v1/onboarding/members/{member_id}", headers=_h2)
    assert r.status_code == 404

    # Front desk lacks MANAGE_MEMBERS.
    r = await client.post("/api/v1/staff/invites", headers=headers,
                          json={"role": "front_desk", "email": "desk@onb.com"})
    invite = r.json()["code"]
    r = await client.post("/api/v1/staff/invites/redeem",
                          json={"code": invite, "full_name": "Dana", "password": PASSWORD})
    desk = {"Authorization": f"Bearer {r.json()['access_token']}",
            "X-Organization-Id": r.json()["organization_id"]}
    assert (await client.get("/api/v1/onboarding/members", headers=desk)).status_code == 403
