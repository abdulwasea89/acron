"""Integration tests for challenges, streaks, and leaderboards (#38)."""

from __future__ import annotations

import uuid
from datetime import timedelta

import pytest
from sqlmodel import select

from app.core.constants import NotificationKind
from app.core.security import now_utc
from app.models.attendance import Attendance
from app.models.gamification import MemberChallengeProgress, MemberStreak
from app.models.notification import Notification
from app.workers.gamification import run_gamification_sweep
from tests.helpers import OWNER_PROFILE, latest_code_for

PASSWORD = "Sup3rStr0ng!Pass"
MEMBER_PWD = "M3mberStr0ng!Pwd"


async def _provision_gym(client, *, owner_email="owner@gami.com"):
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


async def _challenge(client, headers, *, days_ago_start=3, days_until_end=7, **kw):
    now = now_utc()
    r = await client.post(
        "/api/v1/challenges",
        headers=headers,
        json={
            "title": kw.get("title", "Summer Streak"),
            "goal_type": kw.get("goal_type", "visits"),
            "goal_target": kw.get("goal_target", 3),
            "reward": kw.get("reward", "20% off next month"),
            "description": "Come to class three times.",
            "starts_at": (now - timedelta(days=days_ago_start)).isoformat(),
            "ends_at": (now + timedelta(days=days_until_end)).isoformat(),
        },
    )
    assert r.status_code == 201, r.text
    cid = r.json()["id"]
    r = await client.post(
        f"/api/v1/challenges/{cid}/status", headers=headers, json={"status": "published"}
    )
    assert r.status_code == 200, r.text
    return cid


async def _attend(db, org_id, member_id, *, days_ago=0, class_session_id=None):
    db.add(
        Attendance(
            organization_id=org_id,
            member_id=member_id,
            checked_in_at=now_utc() - timedelta(days=days_ago),
            class_session_id=class_session_id,
        )
    )
    await db.commit()


async def _progress(db, challenge_id, member_id) -> MemberChallengeProgress | None:
    return (
        await db.execute(
            select(MemberChallengeProgress)
            .where(
                MemberChallengeProgress.challenge_id == challenge_id,
                MemberChallengeProgress.member_id == member_id,
            )
            .execution_options(populate_existing=True)
        )
    ).scalar_one_or_none()


# ------------------------------------------------------------------- worker
@pytest.mark.asyncio
async def test_visit_challenge_completes_and_dedups(client, db):
    _h, org_id, org_code, plan_id = await _provision_gym(client)
    member_id = await _signup_member(client, org_code, plan_id, "gina@gami.com")
    cid = await _challenge(client, _h, goal_target=3)

    await _attend(db, org_id, member_id, days_ago=2)
    await _attend(db, org_id, member_id, days_ago=1)
    await _attend(db, org_id, member_id, days_ago=0)

    out = await run_gamification_sweep(db, org_id=org_id)
    await db.commit()
    assert out["completed"] == 1
    assert out["members"] == 1

    progress = await _progress(db, cid, member_id)
    assert progress is not None
    assert progress.status.value == "completed"
    assert progress.progress == 3
    assert progress.completed_at is not None

    # Exactly one CHALLENGE notification, and a second sweep adds none.
    chall_notifs = (
        (
            await db.execute(
                select(Notification).where(
                    Notification.organization_id == org_id,
                    Notification.category == NotificationKind.CHALLENGE,
                )
            )
        )
        .scalars()
        .all()
    )
    assert len(chall_notifs) == 1
    assert "Summer Streak" in (chall_notifs[0].title or "")

    await run_gamification_sweep(db, org_id=org_id)
    await db.commit()
    chall_notifs = (
        (
            await db.execute(
                select(Notification).where(
                    Notification.organization_id == org_id,
                    Notification.category == NotificationKind.CHALLENGE,
                )
            )
        )
        .scalars()
        .all()
    )
    assert len(chall_notifs) == 1


@pytest.mark.asyncio
async def test_streak_celebrates_once_and_resets_on_gap(client, db):
    _h, org_id, org_code, plan_id = await _provision_gym(client)
    member_id = await _signup_member(client, org_code, plan_id, "streak@gami.com")

    # 7 consecutive active days.
    for d in range(7):
        await _attend(db, org_id, member_id, days_ago=d)

    out = await run_gamification_sweep(db, org_id=org_id)
    await db.commit()
    assert out["streak_celebrations"] == 1

    row = (
        await db.execute(select(MemberStreak).where(MemberStreak.member_id == member_id))
    ).scalar_one()
    assert row.current_streak == 7
    assert row.best_streak == 7

    streak_notifs = (
        (
            await db.execute(
                select(Notification).where(
                    Notification.organization_id == org_id,
                    Notification.category == NotificationKind.STREAK,
                )
            )
        )
        .scalars()
        .all()
    )
    assert len(streak_notifs) == 1
    assert "7-day" in (streak_notifs[0].title or "")

    # No new visit + a day passes -> streak breaks to 0. Simulate that a day
    # has elapsed by replacing attendance with a single visit two days ago.
    for att in (
        (await db.execute(select(Attendance).where(Attendance.member_id == member_id)))
        .scalars()
        .all()
    ):
        await db.delete(att)
    await db.commit()
    await _attend(db, org_id, member_id, days_ago=3)
    await run_gamification_sweep(db, org_id=org_id)
    await db.commit()
    row = (
        await db.execute(select(MemberStreak).where(MemberStreak.member_id == member_id))
    ).scalar_one()
    assert row.current_streak == 0
    assert row.best_streak == 7
    streak_notifs = (
        (
            await db.execute(
                select(Notification).where(
                    Notification.organization_id == org_id,
                    Notification.category == NotificationKind.STREAK,
                )
            )
        )
        .scalars()
        .all()
    )
    assert len(streak_notifs) == 1


@pytest.mark.asyncio
async def test_class_challenge_counts_only_class_visits(client, db):
    _h, org_id, org_code, plan_id = await _provision_gym(client)
    member_id = await _signup_member(client, org_code, plan_id, "classy@gami.com")
    cid = await _challenge(client, _h, goal_type="classes", goal_target=2)

    await _attend(db, org_id, member_id, days_ago=2, class_session_id="cs-1")
    await _attend(db, org_id, member_id, days_ago=1)  # plain gates-out session
    await _attend(db, org_id, member_id, days_ago=0, class_session_id="cs-2")

    out = await run_gamification_sweep(db, org_id=org_id)
    await db.commit()
    assert out["completed"] == 1
    progress = await _progress(db, cid, member_id)
    assert progress.progress == 2


# ------------------------------------------------------------------ member api
@pytest.mark.asyncio
async def test_member_self_and_leaderboard(client, db):
    headers, org_id, org_code, plan_id = await _provision_gym(client)
    m1 = await _signup_member(client, org_code, plan_id, "alice@gami.com")
    m2 = await _signup_member(client, org_code, plan_id, "bob@gami.com")
    cid = await _challenge(client, headers, goal_target=5)

    await _attend(db, org_id, m1, days_ago=3)
    await _attend(db, org_id, m1, days_ago=2)
    await _attend(db, org_id, m1, days_ago=1)
    await _attend(db, org_id, m2, days_ago=1)

    mh = await _member_headers(client, org_code, "alice@gami.com")
    r = await client.get("/api/v1/challenges/me", headers=mh)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["streak"]["current"] == 0  # streak row only exists after a sweep
    assert body["challenges"][0]["id"] == cid
    assert body["challenges"][0]["progress"] == 0  # sweep has not run yet

    r = await client.get("/api/v1/challenges/leaderboard", headers=mh)
    assert r.status_code == 200, r.text
    board = r.json()
    assert len(board) == 2
    assert board[0]["member_id"] == m1
    assert board[0]["check_ins"] == 3
    assert board[1]["check_ins"] == 1

    # After the sweep, progress reflects really visited days.
    out = await run_gamification_sweep(db, org_id=org_id)
    await db.commit()
    assert out["completed"] == 0  # 3 < target 5
    r = await client.get("/api/v1/challenges/me", headers=mh)
    body = r.json()
    assert body["streak"]["current"] == 3
    assert body["challenges"][0]["progress"] == 3
    assert body["challenges"][0]["completed"] is False


# ----------------------------------------------------------------- admin api
@pytest.mark.asyncio
async def test_admin_lifecycle_transitions_and_detail(client, db):
    headers, org_id, org_code, plan_id = await _provision_gym(client)
    member_id = await _signup_member(client, org_code, plan_id, "admin@gami.com")
    cid = await _challenge(client, headers, goal_target=1)
    await _attend(db, org_id, member_id, days_ago=0)
    await run_gamification_sweep(db, org_id=org_id)
    await db.commit()

    r = await client.get("/api/v1/challenges/admin", headers=headers)
    assert r.status_code == 200, r.text
    listing = r.json()
    assert listing[0]["id"] == cid
    assert listing[0]["status"] == "published"
    assert listing[0]["participants"] >= 1

    r = await client.get(f"/api/v1/challenges/admin/{cid}", headers=headers)
    assert r.status_code == 200, r.text
    detail = r.json()
    assert detail["title"] == "Summer Streak"
    assert detail["participants"][0]["member_id"] == member_id
    assert detail["participants"][0]["progress"] == 1

    # Illegal transition: drafted -> paused not allowed; pause of running not ok path.
    now = now_utc()
    r = await client.post(
        "/api/v1/challenges",
        headers=headers,
        json={
            "title": "Drafty",
            "goal_type": "visits",
            "goal_target": 5,
            "starts_at": (now + timedelta(days=1)).isoformat(),
            "ends_at": (now + timedelta(days=20)).isoformat(),
        },
    )
    draft_id = r.json()["id"]
    r = await client.post(
        f"/api/v1/challenges/{draft_id}/status", headers=headers, json={"status": "paused"}
    )
    assert r.status_code == 409

    r = await client.post(
        f"/api/v1/challenges/{cid}/status", headers=headers, json={"status": "archived"}
    )
    assert r.status_code == 200
    r = await client.post(
        f"/api/v1/challenges/{cid}/status", headers=headers, json={"status": "published"}
    )
    assert r.status_code == 409  # archived is final

    # Validation.
    r = await client.post(
        "/api/v1/challenges",
        headers=headers,
        json={
            "title": "Bad",
            "goal_type": "visits",
            "goal_target": 0,
            "starts_at": (now + timedelta(days=1)).isoformat(),
            "ends_at": (now + timedelta(days=2)).isoformat(),
        },
    )
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_admin_capability_and_tenant_isolation(client, db):
    headers, org_id, org_code, plan_id = await _provision_gym(client)
    await _signup_member(client, org_code, plan_id, "iso@gami.com")

    r = await client.post(
        "/api/v1/staff/invites",
        headers=headers,
        json={"role": "front_desk", "email": "desk@gami.com"},
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

    now = now_utc()
    body = {
        "title": "Nope",
        "goal_type": "visits",
        "goal_target": 2,
        "starts_at": (now - timedelta(days=1)).isoformat(),
        "ends_at": (now + timedelta(days=10)).isoformat(),
    }
    assert (await client.post("/api/v1/challenges", headers=desk, json=body)).status_code == 403
    assert (await client.get("/api/v1/challenges/admin", headers=desk)).status_code == 403

    # Other gym cannot read our challenge.
    _h2, _org2, _c2, _p2 = await _provision_gym(client, owner_email="other@gami.com")
    cid = await _challenge(client, headers)
    assert (await client.get(f"/api/v1/challenges/admin/{cid}", headers=_h2)).status_code == 404
    r = await client.get("/api/v1/challenges/admin", headers=_h2)
    assert r.status_code == 200
    assert r.json() == []


@pytest.mark.asyncio
async def test_streak_challenge_counts_current_streak(client, db):
    _h, org_id, org_code, plan_id = await _provision_gym(client)
    member_id = await _signup_member(client, org_code, plan_id, "streakch@gami.com")
    now = now_utc()
    r = await client.post(
        "/api/v1/challenges",
        headers=_h,
        json={
            "title": "One Week",
            "goal_type": "streak",
            "goal_target": 4,
            "starts_at": (now - timedelta(days=1)).isoformat(),
            "ends_at": (now + timedelta(days=20)).isoformat(),
        },
    )
    cid = r.json()["id"]
    await client.post(f"/api/v1/challenges/{cid}/status", headers=_h, json={"status": "published"})

    for d in range(4):
        await _attend(db, org_id, member_id, days_ago=d)
    out = await run_gamification_sweep(db, org_id=org_id)
    await db.commit()
    assert out["completed"] == 1
    progress = await _progress(db, cid, member_id)
    assert progress.progress == 4
