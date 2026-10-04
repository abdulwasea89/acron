"""Integration tests for the inactivity ladder (#35)."""

from __future__ import annotations

import uuid
from datetime import timedelta

import pytest
from sqlmodel import select

from app.core.security import now_utc
from app.integrations.email import outbox
from app.models.attendance import Attendance
from app.models.inactivity_ladder import InactivityLadderProgress
from app.models.membership import OrganizationMember
from app.services import inactivity_ladder_service as ladder
from tests.helpers import OWNER_PROFILE, latest_code_for

PASSWORD = "Sup3rStr0ng!Pass"
MEMBER_PWD = "M3mberStr0ng!Pwd"


async def _provision_gym(client, *, owner_email="owner@lad.com"):
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


async def _set_joined(db, member_id, *, days_ago):
    m = await db.get(OrganizationMember, member_id)
    m.joined_at = now_utc() - timedelta(days=days_ago)
    db.add(m)
    await db.commit()


async def _fired_days(db, member_id) -> list[int]:
    rows = (await db.execute(
        select(InactivityLadderProgress).where(InactivityLadderProgress.member_id == member_id)
    )).scalars().all()
    return sorted(r.rung_day for r in rows)


# --------------------------------------------------------------------- firing
@pytest.mark.asyncio
async def test_ladder_fires_progressively(client, db):
    _h, org_id, org_code, plan_id = await _provision_gym(client)
    member_id = await _signup_member(client, org_code, plan_id, "m@lad.com")
    await _set_joined(db, member_id, days_ago=20)

    await ladder.run_sweep(db, org_id=org_id)
    await db.commit()
    assert await _fired_days(db, member_id) == [5, 10, 14]

    # Day 21 arrives: only the last rung fires (the earlier ones were current).
    await _set_joined(db, member_id, days_ago=25)
    await ladder.run_sweep(db, org_id=org_id)
    await db.commit()
    assert await _fired_days(db, member_id) == [5, 10, 14, 21]


@pytest.mark.asyncio
async def test_ladder_dedup_within_episode(client, db):
    _h, org_id, org_code, plan_id = await _provision_gym(client)
    member_id = await _signup_member(client, org_code, plan_id, "m@lad.com")
    await _set_joined(db, member_id, days_ago=20)

    await ladder.run_sweep(db, org_id=org_id)
    await ladder.run_sweep(db, org_id=org_id)  # same day, no repeats
    await db.commit()
    assert await _fired_days(db, member_id) == [5, 10, 14]


@pytest.mark.asyncio
async def test_visit_resets_episode(client, db):
    _h, org_id, org_code, plan_id = await _provision_gym(client)
    member_id = await _signup_member(client, org_code, plan_id, "m@lad.com")
    await _set_joined(db, member_id, days_ago=60)

    # A previous episode's rung fired BEFORE the member's last visit.
    db.add(InactivityLadderProgress(
        organization_id=org_id, member_id=member_id, rung_day=5,
        fired_at=now_utc() - timedelta(days=45), status="fired"))
    # They visited 40 days ago, then went quiet again.
    db.add(Attendance(organization_id=org_id, member_id=member_id,
                      checked_in_at=now_utc() - timedelta(days=40)))
    await db.commit()

    await ladder.run_sweep(db, org_id=org_id)
    await db.commit()

    rows = (await db.execute(
        select(InactivityLadderProgress).where(
            InactivityLadderProgress.member_id == member_id,
            InactivityLadderProgress.rung_day == 5)
    )).scalars().all()
    assert len(rows) == 2                      # re-fired in the new episode
    assert (await _fired_days(db, member_id)) == [5, 5, 10, 14, 21]


@pytest.mark.asyncio
async def test_frozen_member_paused(client, db):
    _h, org_id, org_code, plan_id = await _provision_gym(client)
    member_id = await _signup_member(client, org_code, plan_id, "frozen@lad.com")
    await _set_joined(db, member_id, days_ago=30)
    m = await db.get(OrganizationMember, member_id)
    from app.core.constants import MemberStatus

    m.member_status = MemberStatus.FROZEN
    db.add(m)
    await db.commit()

    await ladder.run_sweep(db, org_id=org_id)
    await db.commit()
    assert await _fired_days(db, member_id) == []


# ----------------------------------------------------------------------- API
@pytest.mark.asyncio
async def test_complete_rung_and_custom_template(client, db):
    headers, org_id, org_code, plan_id = await _provision_gym(client)
    member_id = await _signup_member(client, org_code, plan_id, "m@lad.com")
    await _set_joined(db, member_id, days_ago=20)
    await ladder.run_sweep(db, org_id=org_id)
    await db.commit()

    # Staff closes the day-5 rung.
    r = await client.post(
        f"/api/v1/inactivity-ladder/members/{member_id}/rungs/5/complete", headers=headers)
    assert r.status_code == 200, r.text
    day5 = next(x for x in r.json()["rungs"] if x["day"] == 5)
    assert day5["status"] == "completed"
    assert r.json()["days_inactive"] == 20

    # Owner customizes a rung; a fresh member's firing uses the new copy.
    r = await client.patch("/api/v1/inactivity-ladder/config/5", headers=headers,
                           json={"email_subject": "Come back, champ"})
    assert r.status_code == 200, r.text
    assert r.json()["email_subject"] == "Come back, champ"

    other = await _signup_member(client, org_code, plan_id, "fresh@lad.com")
    await _set_joined(db, other, days_ago=6)
    outbox.clear()
    await ladder.run_sweep(db, org_id=org_id)
    await db.commit()
    assert any(m.subject == "Come back, champ" for m in outbox)


@pytest.mark.asyncio
async def test_ladder_capability_and_isolation(client, db):
    headers, org_id, org_code, plan_id = await _provision_gym(client)
    member_id = await _signup_member(client, org_code, plan_id, "m@lad.com")

    # Other org cannot read this member's ladder.
    _h2, _org2, _c2, _p2 = await _provision_gym(client, owner_email="other@lad.com")
    assert (await client.get(
        f"/api/v1/inactivity-ladder/members/{member_id}", headers=_h2)).status_code == 404

    # Front desk lacks VIEW_RETENTION.
    r = await client.post("/api/v1/staff/invites", headers=headers,
                          json={"role": "front_desk", "email": "desk@lad.com"})
    invite = r.json()["code"]
    r = await client.post("/api/v1/staff/invites/redeem",
                          json={"code": invite, "full_name": "Dana", "password": PASSWORD})
    desk = {"Authorization": f"Bearer {r.json()['access_token']}",
            "X-Organization-Id": r.json()["organization_id"]}
    assert (await client.get("/api/v1/inactivity-ladder/config", headers=desk)).status_code == 403
