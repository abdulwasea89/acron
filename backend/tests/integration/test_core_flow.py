"""End-to-end test of the runnable core: owner register -> verify -> provision
gym -> create & publish plan -> checklist unblocks member signup."""

from __future__ import annotations

import pytest

from tests.helpers import OWNER_PROFILE, latest_code_for

PASSWORD = "Sup3rStr0ng!Pass"


@pytest.mark.asyncio
async def test_owner_registration_to_published_plan(client):
    # Step 1: owner account
    r = await client.post("/api/v1/auth/register", json={
        "full_name": "Alex Owner",
        "email": "alex@ironpulse.com",
        "password": PASSWORD,
        "confirm_password": PASSWORD,
        **OWNER_PROFILE,
    })
    assert r.status_code == 201, r.text

    # Step 1.5: email verification
    code = latest_code_for("alex@ironpulse.com")
    r = await client.post("/api/v1/auth/verify-email", json={
        "email": "alex@ironpulse.com", "code": code,
    })
    assert r.status_code == 200, r.text

    # Step 2-4: gym details + tier + payment -> provision
    r = await client.post("/api/v1/organizations/register", json={
        "owner_email": "alex@ironpulse.com",
        "details": {"name": "Iron Pulse Boxing", "country": "US", "default_currency": "USD"},
        "tier": "pro",
    })
    assert r.status_code == 200, r.text
    body = r.json()
    org_id = body["organization"]["id"]
    org_code = body["organization"]["org_code"]
    access = body["access_token"]
    assert body["organization"]["member_cap"] == 100  # Pro tier
    assert "-" in org_code

    headers = {"Authorization": f"Bearer {access}", "X-Organization-Id": org_id}

    # Checklist: plan not yet published -> member signup blocked
    r = await client.get("/api/v1/organizations/me/checklist", headers=headers)
    assert r.status_code == 200, r.text
    assert r.json()["member_signup_unblocked"] is False

    # Create a plan (draft)
    r = await client.post("/api/v1/plans", headers=headers, json={
        "name": "Monthly", "price": 149.0, "billing_type": "recurring",
    })
    assert r.status_code == 201, r.text
    plan_id = r.json()["id"]
    assert r.json()["status"] == "draft"

    # Publish it -> unblocks member signup
    r = await client.post(f"/api/v1/plans/{plan_id}/publish", headers=headers)
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "published"

    r = await client.get("/api/v1/organizations/me/checklist", headers=headers)
    assert r.json()["member_signup_unblocked"] is True


@pytest.mark.asyncio
async def test_weak_password_rejected(client):
    r = await client.post("/api/v1/auth/register", json={
        "full_name": "Weak", "email": "weak@x.com",
        "password": "weak", "confirm_password": "weak",
        **OWNER_PROFILE,
    })
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_tenant_isolation_header_mismatch(client):
    # Register + verify + provision owner A
    await client.post("/api/v1/auth/register", json={
        "full_name": "Ann Owner", "email": "a@a.com", "password": PASSWORD, "confirm_password": PASSWORD,
        **OWNER_PROFILE})
    code = latest_code_for("a@a.com")
    await client.post("/api/v1/auth/verify-email", json={"email": "a@a.com", "code": code})
    r = await client.post("/api/v1/organizations/register", json={
        "owner_email": "a@a.com",
        "details": {"name": "Gym A"}, "tier": "starter"})
    access = r.json()["access_token"]

    # Wrong X-Organization-Id header -> 403 (Security Rule #1)
    r = await client.get("/api/v1/organizations/me/checklist", headers={
        "Authorization": f"Bearer {access}", "X-Organization-Id": "some-other-org"})
    assert r.status_code == 403
