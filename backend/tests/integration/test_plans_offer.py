"""Offer-kind aware plan creation, spec validation, and filtering (Phase 0).

Gym orgs create membership offers (offer_kind defaults to membership) exactly as
before; office orgs must create space offers carrying a spec validated against
office-offer.json; academy orgs create course offers. Spec errors and
cross-industry offer kinds are rejected with 422.
"""

from __future__ import annotations

import pytest

from tests.helpers import OWNER_PROFILE, latest_code_for

PASSWORD = "Sup3rStr0ng!Pass"


async def _provision(client, *, name: str, email: str, industry: str = "gym") -> tuple[dict, str]:
    """Register + verify an owner and provision an org. Returns (headers, org_id)."""
    r = await client.post("/api/v1/auth/register", json={
        "full_name": "Venue Owner",
        "email": email,
        "password": PASSWORD,
        "confirm_password": PASSWORD,
        **OWNER_PROFILE,
    })
    assert r.status_code == 201, r.text
    code = latest_code_for(email)
    r = await client.post("/api/v1/auth/verify-email", json={"email": email, "code": code})
    assert r.status_code == 200, r.text

    details = {"name": name, "country": "US", "default_currency": "USD", "industry": industry}
    r = await client.post("/api/v1/organizations/register", json={
        "owner_email": email, "details": details, "tier": "starter",
    })
    assert r.status_code == 200, r.text
    body = r.json()
    headers = {
        "Authorization": f"Bearer {body['access_token']}",
        "X-Organization-Id": body["organization"]["id"],
    }
    return headers, body["organization"]["id"]


@pytest.mark.asyncio
async def test_gym_default_offer_is_membership(client):
    headers, _ = await _provision(client, name="Old Iron", email="gym@p.com")
    r = await client.post("/api/v1/plans", headers=headers, json={
        "name": "Monthly", "price": 149.0, "billing_type": "recurring",
    })
    assert r.status_code == 201, r.text
    assert r.json()["offer_kind"] == "membership"
    assert r.json()["spec"] is None


@pytest.mark.asyncio
async def test_office_space_offer_with_valid_spec(client):
    headers, _ = await _provision(client, name="Flex Spaces", email="off@p.com", industry="office")
    r = await client.post("/api/v1/plans", headers=headers, json={
        "name": "Dedicated desk", "price": 300.0, "billing_type": "recurring",
        "offer_kind": "space",
        "spec": {"space_type": "fixed_desk", "seats_included": 1, "term": "monthly", "billing": "company_invoice"},
    })
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["offer_kind"] == "space"
    assert body["spec"]["space_type"] == "fixed_desk"
    assert body["spec"]["term"] == "monthly"


@pytest.mark.asyncio
async def test_office_offer_requires_spec_and_rejects_invalid(client):
    headers, _ = await _provision(client, name="Shared Hub", email="off2@p.com", industry="office")

    # Missing spec entirely.
    r = await client.post("/api/v1/plans", headers=headers, json={
        "name": "No spec", "price": 100.0, "offer_kind": "space",
    })
    assert r.status_code == 422, r.text

    # Spec missing the required 'billing' property.
    r = await client.post("/api/v1/plans", headers=headers, json={
        "name": "Bad spec", "price": 100.0, "offer_kind": "space",
        "spec": {"space_type": "hot_desk", "term": "monthly"},
    })
    assert r.status_code == 422, r.text


@pytest.mark.asyncio
async def test_cross_industry_offer_rejected(client):
    headers, _ = await _provision(client, name="Flex Spaces 2", email="off3@p.com", industry="office")
    r = await client.post("/api/v1/plans", headers=headers, json={
        "name": "Membership? no", "price": 9.0, "offer_kind": "membership",
    })
    assert r.status_code == 422
    assert "only supports space offers" in r.json()["detail"]


@pytest.mark.asyncio
async def test_academy_course_offer(client):
    headers, _ = await _provision(client, name="Bright Minds", email="acad@p.com", industry="academy")
    r = await client.post("/api/v1/plans", headers=headers, json={
        "name": "O-Level Maths Term", "price": 250.0,
        "offer_kind": "course",
        "spec": {"course_id": "c1", "term": "2026-09", "installments": 2},
    })
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["offer_kind"] == "course"
    assert body["spec"]["installments"] == 2


@pytest.mark.asyncio
async def test_list_plans_filters_by_offer_kind(client):
    headers, _ = await _provision(client, name="Flex Filters", email="off4@p.com", industry="office")
    for i in range(2):
        r = await client.post("/api/v1/plans", headers=headers, json={
            "name": f"Desk {i}", "price": 200.0, "offer_kind": "space",
            "spec": {"space_type": "hot_desk", "seats_included": 1, "term": "monthly", "billing": "card"},
        })
        assert r.status_code == 201, r.text

    r = await client.get("/api/v1/plans", headers=headers)
    assert len(r.json()) == 2
    r = await client.get("/api/v1/plans?offer_kind=space", headers=headers)
    assert len(r.json()) == 2
    r = await client.get("/api/v1/plans?offer_kind=course", headers=headers)
    assert r.json() == []
