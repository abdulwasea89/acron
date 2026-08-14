"""In-app notifications API (per-user alert feed).

Both the list/read endpoints and the underlying queries are scoped to
(organization_id, recipient_user_id): one user's alerts must never be visible to
another user in the same org, and never across orgs (Security Rule #1).
"""

from __future__ import annotations

import pytest

from app.core.constants import NotificationKind
from app.models.membership import OrganizationMember
from app.services.notifications_service import create_notification
from sqlmodel import select

from tests.helpers import OWNER_PROFILE, latest_code_for

PASSWORD = "Sup3rStr0ng!Pass"
MEMBER_PWD = "M3mberStr0ng!Pwd"


async def _provision(client) -> tuple[str, str, dict, str]:
    """Register owner, provision gym, connect Stripe, publish a plan.

    Returns (org_code, plan_id, headers, org_id)."""
    await client.post("/api/v1/auth/register", json={
        "full_name": "Alex", "email": "owner@g.com",
        "password": PASSWORD, "confirm_password": PASSWORD, **OWNER_PROFILE})
    code = latest_code_for("owner@g.com")
    await client.post("/api/v1/auth/verify-email", json={"email": "owner@g.com", "code": code})
    r = await client.post("/api/v1/organizations/register", json={
        "owner_email": "owner@g.com",
        "details": {"name": "Iron Pulse Boxing", "default_currency": "USD"},
        "tier": "pro"})
    body = r.json()
    org_id, org_code, access = body["organization"]["id"], body["organization"]["org_code"], body["access_token"]
    headers = {"Authorization": f"Bearer {access}", "X-Organization-Id": org_id}

    await client.post("/api/v1/organizations/me/connect", headers=headers)
    await client.post("/api/v1/organizations/me/connect/complete", headers=headers)

    r = await client.post("/api/v1/plans", headers=headers, json={
        "name": "Monthly", "price": 149.0, "billing_type": "recurring",
        "cycle_unit": "month", "cycle_length": 1})
    plan_id = r.json()["id"]
    await client.post(f"/api/v1/plans/{plan_id}/publish", headers=headers)
    return org_code, plan_id, headers, org_id


async def _owner_user_id(db, org_id: str) -> str:
    member = (
        await db.execute(
            select(OrganizationMember).where(
                OrganizationMember.organization_id == org_id,
            )
        )
    ).scalars().first()
    assert member is not None
    return member.user_id


async def _signup_member(client, org_code: str, email: str) -> dict:
    """Join a second user to the same org and log them in -> (headers, org_id)."""
    await client.post("/api/v1/memberships/signup/request-email",
                      json={"org_code": org_code, "email": email})
    code = latest_code_for(email)
    await client.post("/api/v1/memberships/signup/verify-email",
                      json={"org_code": org_code, "email": email, "code": code})
    await client.post("/api/v1/memberships/signup/set-password",
                      json={"org_code": org_code, "email": email, "password": MEMBER_PWD})
    r = await client.post("/api/v1/auth/login", json={
        "org_code": org_code, "email": email, "password": MEMBER_PWD})
    body = r.json()
    return {
        "access_token": body["access_token"],
        "organization_id": body["organization_id"],
    }


@pytest.mark.asyncio
async def test_list_unread_read_and_read_all(client, db):
    _org_code, _plan_id, headers, org_id = await _provision(client)
    org_row = (
        await db.execute(select(OrganizationMember).where(OrganizationMember.role == "owner"))
    ).scalars().first()
    user_id = org_row.user_id

    # Seed two unread alerts directly (the WS push is a no-op with no sockets).
    for title in ("Alert one", "Alert two"):
        await create_notification(
            db, org_id=org_id, recipient_user_id=user_id, category=NotificationKind.PAYMENT,
            title=title, body="Details.", data={"amount": 149.0, "currency": "USD"},
        )
    await db.commit()

    r = await client.get("/api/v1/notifications", headers=headers)
    assert r.status_code == 200
    rows = r.json()
    assert len(rows) == 2
    assert rows[0]["read"] is False
    assert rows[0]["category"] == "payment"
    assert rows[0]["data"]["amount"] == 149.0
    assert {rows[0]["title"], rows[1]["title"]} == {"Alert one", "Alert two"}

    r = await client.get("/api/v1/notifications/unread-count", headers=headers)
    assert r.status_code == 200
    assert r.json()["count"] == 2

    nid = rows[0]["id"]
    r = await client.post(f"/api/v1/notifications/{nid}/read", headers=headers)
    assert r.status_code == 200
    assert r.json()["read"] is True

    r = await client.get("/api/v1/notifications/unread-count", headers=headers)
    assert r.json()["count"] == 1

    r = await client.post("/api/v1/notifications/read-all", headers=headers)
    assert r.status_code == 200
    assert r.json()["count"] == 1

    r = await client.get("/api/v1/notifications/unread-count", headers=headers)
    assert r.json()["count"] == 0


@pytest.mark.asyncio
async def test_notifications_are_per_user(client, db):
    org_code, _plan_id, _headers, org_id = await _provision(client)
    other = await _signup_member(client, org_code, "member@g.com")
    other_headers = {
        "Authorization": f"Bearer {other['access_token']}",
        "X-Organization-Id": other["organization_id"],
    }

    owner_user_id = await _owner_user_id(db, org_id)
    n = await create_notification(
        db, org_id=org_id, recipient_user_id=owner_user_id, category=NotificationKind.RECEIPT,
        title="Private", body="Only for the owner.",
    )
    await db.commit()

    # A different user in the same org must not see or touch it.
    r = await client.get("/api/v1/notifications", headers=other_headers)
    assert r.status_code == 200
    assert r.json() == []

    r = await client.get("/api/v1/notifications/unread-count", headers=other_headers)
    assert r.json()["count"] == 0

    r = await client.post(f"/api/v1/notifications/{n.id}/read", headers=other_headers)
    assert r.status_code == 404

    # The owner still sees their own alert untouched (the provision headers).
    r = await client.get("/api/v1/notifications/unread-count", headers=_headers)
    assert r.json()["count"] == 1