"""Integration tests for NPS surveys at day 7/30/90 and complaint clustering (#37)."""

from __future__ import annotations

import uuid
from datetime import timedelta

import pytest
from sqlmodel import select

from app.core.constants import MemberStatus, NotificationKind
from app.core.security import now_utc
from app.models.membership import OrganizationMember
from app.models.notification import Notification
from app.models.nps import NpsSurvey
from app.services import nps_service as nps
from app.workers.nps import run_nps_sweep
from tests.helpers import OWNER_PROFILE, latest_code_for

PASSWORD = "Sup3rStr0ng!Pass"
MEMBER_PWD = "M3mberStr0ng!Pwd"


async def _provision_gym(client, *, owner_email="owner@nps.com"):
    await client.post(
        "/api/v1/auth/register",
        json={
            "full_name": "Alex",
            "email": owner_email,
            "password": PASSWORD,
            "confirm_password": PASSWORD,
            **OWNER_PROFILE,
        },
    )
    code = latest_code_for(owner_email)
    await client.post("/api/v1/auth/verify-email", json={"email": owner_email, "code": code})
    r = await client.post(
        "/api/v1/organizations/register",
        json={
            "owner_email": owner_email,
            "details": {"name": "Iron Pulse Boxing", "default_currency": "USD"},
            "tier": "pro",
        },
    )
    body = r.json()
    org_id = body["organization"]["id"]
    org_code = body["organization"]["org_code"]
    headers = {"Authorization": f"Bearer {body['access_token']}", "X-Organization-Id": org_id}
    await client.post("/api/v1/organizations/me/connect", headers=headers)
    await client.post("/api/v1/organizations/me/connect/complete", headers=headers)
    r = await client.post(
        "/api/v1/plans",
        headers=headers,
        json={
            "name": "Monthly",
            "price": 149.0,
            "billing_type": "recurring",
            "cycle_unit": "month",
            "cycle_length": 1,
        },
    )
    plan_id = r.json()["id"]
    await client.post(f"/api/v1/plans/{plan_id}/publish", headers=headers)
    return headers, org_id, org_code, plan_id


async def _signup_member(client, org_code, plan_id, email) -> str:
    await client.post(
        "/api/v1/memberships/signup/request-email", json={"org_code": org_code, "email": email}
    )
    code = latest_code_for(email)
    await client.post(
        "/api/v1/memberships/signup/verify-email",
        json={"org_code": org_code, "email": email, "code": code},
    )
    r = await client.post(
        "/api/v1/memberships/signup/set-password",
        json={"org_code": org_code, "email": email, "password": MEMBER_PWD},
    )
    member_id = r.json()["member_id"]
    await client.post(
        "/api/v1/memberships/signup/pay",
        headers={"Idempotency-Key": str(uuid.uuid4())},
        json={"org_code": org_code, "email": email, "plan_id": plan_id},
    )
    return member_id


async def _member_headers(client, org_code, email):
    r = await client.post(
        "/api/v1/auth/member-login",
        json={"org_code": org_code, "email": email, "password": MEMBER_PWD},
    )
    body = r.json()
    return {
        "Authorization": f"Bearer {body['access_token']}",
        "X-Organization-Id": body["organization_id"],
    }


async def _set_joined(db, member_id, *, days_ago):
    member = await db.get(OrganizationMember, member_id)
    member.joined_at = now_utc() - timedelta(days=days_ago)
    db.add(member)
    await db.commit()


async def _survey(db, member_id) -> NpsSurvey:
    return (
        await db.execute(
            select(NpsSurvey)
            .where(NpsSurvey.member_id == member_id)
            .execution_options(populate_existing=True)
        )
    ).scalar_one()


# ------------------------------------------------------------------- worker
@pytest.mark.asyncio
async def test_worker_fires_due_survey_and_dedups(client, db):
    _h, org_id, org_code, plan_id = await _provision_gym(client)
    member_id = await _signup_member(client, org_code, plan_id, "due@nps.com")
    await _set_joined(db, member_id, days_ago=7)

    out = await run_nps_sweep(db, org_id=org_id)
    await db.commit()
    assert out["sent"] == 1
    survey = await _survey(db, member_id)
    assert survey.milestone.value == "day_7"
    assert survey.status.value == "sent"

    # Day 30 is not due yet.
    await run_nps_sweep(db, org_id=org_id)
    await db.commit()
    assert (
        await db.execute(select(NpsSurvey).where(NpsSurvey.member_id == member_id))
    ).scalars().all().__len__() == 1

    # A notification of kind NPS was created.
    notif = (
        (
            await db.execute(
                select(Notification).where(
                    Notification.organization_id == org_id,
                    Notification.category == NotificationKind.NPS,
                )
            )
        )
        .scalars()
        .all()
    )
    assert len(notif) == 1
    assert "recommend" in (notif[0].body or "").lower()

    # Moving to day 30 fires exactly the day_30 survey.
    await _set_joined(db, member_id, days_ago=31)
    out = await run_nps_sweep(db, org_id=org_id)
    await db.commit()
    assert out["sent"] == 1
    milestones = {
        s.milestone.value
        for s in (await db.execute(select(NpsSurvey).where(NpsSurvey.member_id == member_id)))
        .scalars()
        .all()
    }
    assert milestones == {"day_7", "day_30"}


@pytest.mark.asyncio
async def test_worker_skips_off_window_members_silently(client, db):
    _h, org_id, org_code, plan_id = await _provision_gym(client)
    member_id = await _signup_member(client, org_code, plan_id, "late@nps.com")
    await _set_joined(db, member_id, days_ago=120)

    out = await run_nps_sweep(db, org_id=org_id)
    await db.commit()
    assert out["sent"] == 0
    assert out["skipped"] == 3
    surveys = (
        (await db.execute(select(NpsSurvey).where(NpsSurvey.member_id == member_id)))
        .scalars()
        .all()
    )
    assert {s.status.value for s in surveys} == {"skipped"}
    # No spam: not a single NPS notification.
    notifs = (
        (
            await db.execute(
                select(Notification).where(Notification.category == NotificationKind.NPS)
            )
        )
        .scalars()
        .all()
    )
    assert notifs == []


@pytest.mark.asyncio
async def test_worker_skips_non_active_members(client, db):
    _h, org_id, org_code, plan_id = await _provision_gym(client)
    member_id = await _signup_member(client, org_code, plan_id, "frozen@nps.com")
    await _set_joined(db, member_id, days_ago=10)
    member = await db.get(OrganizationMember, member_id)
    member.member_status = MemberStatus.FROZEN
    db.add(member)
    await db.commit()

    await run_nps_sweep(db, org_id=org_id)
    await db.commit()
    survey = await _survey(db, member_id)
    assert survey.milestone.value == "day_7"
    assert survey.status.value == "skipped"


# ------------------------------------------------------------------ member api
@pytest.mark.asyncio
async def test_member_responds_via_api_and_cluster_is_set(client, db):
    _h, org_id, org_code, plan_id = await _provision_gym(client)
    member_id = await _signup_member(client, org_code, plan_id, "sara@nps.com")
    await _set_joined(db, member_id, days_ago=7)
    await run_nps_sweep(db, org_id=org_id)
    await db.commit()
    survey = await _survey(db, member_id)

    mh = await _member_headers(client, org_code, "sara@nps.com")
    r = await client.get("/api/v1/nps/me", headers=mh)
    assert r.status_code == 200, r.text
    assert r.json()["next_milestone"] == "day_30"
    assert r.json()["surveys"][0]["open"] is True

    # Detractor with a pricing complaint -> billing cluster.
    r = await client.post(
        f"/api/v1/nps/me/{survey.id}/respond",
        headers=mh,
        json={"score": 2, "comment": "too expensive, the renewal fee jumped"},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["surveys"][0]["status"] == "responded"
    assert body["surveys"][0]["score"] == 2
    assert body["surveys"][0]["cluster_tag"] == "billing"

    survey = await _survey(db, member_id)
    assert survey.status.value == "responded"

    # Re-submitting is idempotent: no change, no error.
    r = await client.post(
        f"/api/v1/nps/me/{survey.id}/respond",
        headers=mh,
        json={"score": 10, "comment": "changed my mind"},
    )
    assert r.status_code == 200, r.text
    survey = await _survey(db, member_id)
    assert survey.score == 2
    assert survey.comment == "too expensive, the renewal fee jumped"

    # Someone else's survey is 404, and an invalid score is rejected.
    r = await client.post("/api/v1/nps/me/does-not-exist/respond", headers=mh, json={"score": 9})
    assert r.status_code == 404
    r = await client.post(f"/api/v1/nps/me/{survey.id}/respond", headers=mh, json={"score": 11})
    assert r.status_code == 422


# ------------------------------------------------------------- clustering / nps
@pytest.mark.asyncio
async def test_clustering_keyword_taxonomy():
    assert nps.cluster_complaint("the equipment is broken and showers are dirty") == "facilities"
    assert nps.cluster_complaint("front desk staff never answers") == "staff"
    assert nps.cluster_complaint("classes keep getting cancelled last minute") == "classes"
    assert nps.cluster_complaint("my trainer is always late") == "trainers"
    assert nps.cluster_complaint("the app crashes on login") == "app"
    assert nps.cluster_complaint("giraffes ate my mat") == "other"
    assert nps.cluster_complaint(None) is None
    assert nps.cluster_complaint("   ") is None


@pytest.mark.asyncio
async def test_nps_summary_calculates_score(client, db):
    _h, org_id, org_code, plan_id = await _provision_gym(client)
    member_id = await _signup_member(client, org_code, plan_id, "scored@nps.com")

    mh = await _member_headers(client, org_code, "scored@nps.com")
    responded_ids: set[str] = set()
    for days_ago, score in ((7, 0), (30, 0), (90, 0)):
        await _set_joined(db, member_id, days_ago=days_ago)
        await run_nps_sweep(db, org_id=org_id)
        await db.commit()
        surveys = (
            (await db.execute(select(NpsSurvey).where(NpsSurvey.member_id == member_id)))
            .scalars()
            .all()
        )
        opened = [s for s in surveys if s.id not in responded_ids]
        assert len(opened) == 1, f"expected one new survey at {days_ago} days: {surveys}"
        r = await client.post(
            f"/api/v1/nps/me/{opened[0].id}/respond", headers=mh, json={"score": score}
        )
        assert r.status_code == 200, r.text
        responded_ids.add(opened[0].id)

    r = await client.get("/api/v1/nps/summary", headers=_h)
    assert r.status_code == 200, r.text
    summary = r.json()
    assert summary["responded"] == 3
    assert summary["response_rate"] == 100.0
    assert summary["promoters"] == 0
    assert summary["passives"] == 0
    assert summary["detractors"] == 3
    assert summary["nps_score"] == -100.0
    assert len(summary["by_milestone"]) == 3
    assert {b["milestone"] for b in summary["by_milestone"]} == {"day_7", "day_30", "day_90"}

    # A mix of promoters and a detractor yields the classic formula.
    for email, score in (("p1@nps.com", 10), ("p2@nps.com", 9)):
        mid = await _signup_member(client, org_code, plan_id, email)
        await _set_joined(db, mid, days_ago=7)
        await run_nps_sweep(db, org_id=org_id)
        await db.commit()
        s2 = await _survey(db, mid)
        mh2 = await _member_headers(client, org_code, email)
        r = await client.post(f"/api/v1/nps/me/{s2.id}/respond", headers=mh2, json={"score": score})
        assert r.status_code == 200, r.text

    summary = (await client.get("/api/v1/nps/summary", headers=_h)).json()
    assert summary["responded"] == 5
    assert summary["promoters"] == 2
    assert summary["detractors"] == 3
    assert summary["nps_score"] == -20.0  # (2 - 3) / 5 * 100


@pytest.mark.asyncio
async def test_complaint_clusters_group_comments(client, db):
    _h, org_id, org_code, plan_id = await _provision_gym(client)
    member_id = await _signup_member(client, org_code, plan_id, "complain@nps.com")
    await _set_joined(db, member_id, days_ago=7)
    await run_nps_sweep(db, org_id=org_id)
    await db.commit()
    survey = await _survey(db, member_id)
    mh = await _member_headers(client, org_code, "complain@nps.com")
    await client.post(
        f"/api/v1/nps/me/{survey.id}/respond",
        headers=mh,
        json={"score": 3, "comment": "locker room is filthy, showers broken"},
    )

    # Second complaint from another member -> same theme groups together.
    m2 = await _signup_member(client, org_code, plan_id, "complain2@nps.com")
    await _set_joined(db, m2, days_ago=7)
    await run_nps_sweep(db, org_id=org_id)
    await db.commit()
    s2 = await _survey(db, m2)
    mh2 = await _member_headers(client, org_code, "complain2@nps.com")
    await client.post(
        f"/api/v1/nps/me/{s2.id}/respond",
        headers=mh2,
        json={"score": 4, "comment": "no soap in the showers at 6am"},
    )

    r = await client.get("/api/v1/nps/clusters", headers=_h)
    assert r.status_code == 200, r.text
    clusters = r.json()
    facilities = next(c for c in clusters if c["theme"] == "facilities")
    assert facilities["total"] == 2
    assert facilities["detractors"] == 2
    assert len(facilities["examples"]) == 2


# ----------------------------------------------------------------- admin api
@pytest.mark.asyncio
async def test_admin_api_capability_and_isolation(client, db):
    headers, org_id, org_code, plan_id = await _provision_gym(client)
    member_id = await _signup_member(client, org_code, plan_id, "admin@nps.com")
    await _set_joined(db, member_id, days_ago=7)
    await run_nps_sweep(db, org_id=org_id)
    await db.commit()
    survey = await _survey(db, member_id)
    mh = await _member_headers(client, org_code, "admin@nps.com")
    r = await client.post(
        f"/api/v1/nps/me/{survey.id}/respond", headers=mh, json={"score": 8, "comment": "all good"}
    )
    assert r.status_code == 200, r.text

    r = await client.get("/api/v1/nps/summary", headers=headers)
    assert r.status_code == 200, r.text
    assert r.json()["responded"] == 1

    r = await client.get("/api/v1/nps/responses", headers=headers)
    assert r.status_code == 200, r.text
    assert r.json()[0]["member_id"] == member_id
    assert r.json()[0]["comment"] == "all good"

    r = await client.get("/api/v1/nps/clusters", headers=headers)
    assert r.status_code == 200, r.text

    r = await client.get(f"/api/v1/nps/members/{member_id}", headers=headers)
    assert r.status_code == 200, r.text
    assert r.json()["surveys"][0]["cluster_tag"] == "other"

    # Tenant isolation + capability.
    _h2, _org2, _c2, _p2 = await _provision_gym(client, owner_email="other@nps.com")
    assert (await client.get(f"/api/v1/nps/members/{member_id}", headers=_h2)).status_code == 404

    r = await client.post(
        "/api/v1/staff/invites",
        headers=headers,
        json={"role": "front_desk", "email": "desk@nps.com"},
    )
    invite = r.json()["code"]
    r = await client.post(
        "/api/v1/staff/invites/redeem",
        json={"code": invite, "full_name": "Dana", "password": PASSWORD},
    )
    desk = {
        "Authorization": f"Bearer {r.json()['access_token']}",
        "X-Organization-Id": r.json()["organization_id"],
    }
    assert (await client.get("/api/v1/nps/summary", headers=desk)).status_code == 403
