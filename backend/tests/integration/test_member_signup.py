"""Member open-enrollment signup flow + idempotent payment (Sections 8, 13)."""

from __future__ import annotations

import uuid

import pytest

from tests.helpers import OWNER_PROFILE, latest_code_for

PASSWORD = "Sup3rStr0ng!Pass"
MEMBER_PWD = "M3mberStr0ng!Pwd"


async def _provision_gym_with_plan(client) -> tuple[str, str, dict]:
    """Owner registers, provisions gym, connects Stripe, publishes a plan."""

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

    # Activate Connect (dev shortcut) so the gym can accept member payments.
    await client.post("/api/v1/organizations/me/connect", headers=headers)
    await client.post("/api/v1/organizations/me/connect/complete", headers=headers)

    # Publish a plan.
    r = await client.post("/api/v1/plans", headers=headers, json={
        "name": "Monthly", "price": 149.0, "billing_type": "recurring",
        "cycle_unit": "month", "cycle_length": 1})
    plan_id = r.json()["id"]
    await client.post(f"/api/v1/plans/{plan_id}/publish", headers=headers)
    return org_code, plan_id, headers


@pytest.mark.asyncio
async def test_full_member_signup(client):
    org_code, plan_id, _ = await _provision_gym_with_plan(client)
    email = "sarah@member.com"

    # Start
    r = await client.post("/api/v1/memberships/signup/start", json={"org_code": org_code})
    assert r.status_code == 200, r.text
    assert r.json()["accepting_signups"] is True

    # Request email + verify
    r = await client.post("/api/v1/memberships/signup/request-email",
                          json={"org_code": org_code, "email": email})
    assert r.status_code == 200, r.text
    code = latest_code_for(email)
    r = await client.post("/api/v1/memberships/signup/verify-email",
                          json={"org_code": org_code, "email": email, "code": code})
    assert r.status_code == 200, r.text

    # Set password -> pending_payment
    r = await client.post("/api/v1/memberships/signup/set-password",
                          json={"org_code": org_code, "email": email, "password": MEMBER_PWD})
    assert r.status_code == 200, r.text
    assert r.json()["member_status"] == "pending_payment"

    # See public plans
    r = await client.get("/api/v1/memberships/signup/plans", params={"org_code": org_code})
    assert r.status_code == 200
    assert any(p["id"] == plan_id for p in r.json())

    # Pay (idempotent) -> active + logged in
    key = str(uuid.uuid4())
    r = await client.post("/api/v1/memberships/signup/pay",
                          headers={"Idempotency-Key": key},
                          json={"org_code": org_code, "email": email, "plan_id": plan_id})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["member_status"] == "active"
    assert body["access_token"]
    member_access = body["access_token"]
    member_org = body["organization_id"]

    # Idempotent replay: same key -> no double charge, still 200
    r2 = await client.post("/api/v1/memberships/signup/pay",
                           headers={"Idempotency-Key": key},
                           json={"org_code": org_code, "email": email, "plan_id": plan_id})
    assert r2.status_code == 200, r2.text

    # Complete profile
    r = await client.post("/api/v1/memberships/me/profile",
                          headers={"Authorization": f"Bearer {member_access}",
                                   "X-Organization-Id": member_org},
                          json={"full_name": "Sarah Chen", "phone": "555-1234"})
    assert r.status_code == 200, r.text
    assert r.json()["profile_complete"] is True


@pytest.mark.asyncio
async def test_idempotency_key_required_for_payment(client):
    org_code, plan_id, _ = await _provision_gym_with_plan(client)
    email = "noidem@member.com"
    await client.post("/api/v1/memberships/signup/request-email",
                      json={"org_code": org_code, "email": email})
    code = latest_code_for(email)
    await client.post("/api/v1/memberships/signup/verify-email",
                      json={"org_code": org_code, "email": email, "code": code})
    await client.post("/api/v1/memberships/signup/set-password",
                      json={"org_code": org_code, "email": email, "password": MEMBER_PWD})
    # No Idempotency-Key header -> 400
    r = await client.post("/api/v1/memberships/signup/pay",
                          json={"org_code": org_code, "email": email, "plan_id": plan_id})
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_signup_blocked_when_no_published_plan(client):
    # Provision gym but DON'T publish a plan.
    await client.post("/api/v1/auth/register", json={
        "full_name": "Bob Owner", "email": "b@g.com", "password": PASSWORD, "confirm_password": PASSWORD,
        **OWNER_PROFILE})
    code = latest_code_for("b@g.com")
    await client.post("/api/v1/auth/verify-email", json={"email": "b@g.com", "code": code})
    r = await client.post("/api/v1/organizations/register", json={
        "owner_email": "b@g.com", "details": {"name": "No Plans Gym"}, "tier": "starter"})
    org_code = r.json()["organization"]["org_code"]

    r = await client.post("/api/v1/memberships/signup/start", json={"org_code": org_code})
    assert r.status_code == 409  # not accepting signups yet
