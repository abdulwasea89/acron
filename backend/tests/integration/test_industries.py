"""Industry registration, catalog, offer schema, and checklist integration tests.

Phase 0: registering with a chosen industry persists it, the catalog + offer
schemas are public, /organizations/me/industry reflects the org's vertical, and
the setup checklist is ordered by the industry registry. Gym (default) is the
regression baseline.
"""

from __future__ import annotations

import pytest

from tests.helpers import OWNER_PROFILE, latest_code_for

PASSWORD = "Sup3rStr0ng!Pass"


async def _register_org(client, *, name: str, email: str, industry: str | None = None) -> dict:
    """Register + verify an owner, then provision an org. Returns response body."""
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

    details = {"name": name, "country": "US", "default_currency": "USD"}
    if industry is not None:
        details["industry"] = industry
    r = await client.post("/api/v1/organizations/register", json={
        "owner_email": email,
        "details": details,
        "tier": "starter",
    })
    assert r.status_code == 200, r.text
    return r.json()


def _headers(body: dict) -> dict:
    return {
        "Authorization": f"Bearer {body['access_token']}",
        "X-Organization-Id": body["organization"]["id"],
    }


@pytest.mark.asyncio
async def test_industries_catalog_is_public_and_complete(client):
    r = await client.get("/api/v1/industries")
    assert r.status_code == 200, r.text
    keys = [item["key"] for item in r.json()]
    assert keys == ["gym", "office", "academy"]


@pytest.mark.asyncio
async def test_office_detail_shape(client):
    r = await client.get("/api/v1/industries/office")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["key"] == "office"
    assert body["offer_kind"] == "space"
    assert body["money"] == "b2b_invoice"
    assert body["requires_connect"] is False
    assert body["roles_labels"]["member"] == "Seat-holder"
    assert body["payer_noun"] == "company"
    assert body["checklist"][-1]["code"] == "done"
    assert body["checklist"][0]["code"] == "companies"
    assert "companies" in body["modules"] and "classes" not in body["modules"]


@pytest.mark.asyncio
async def test_offer_schemas_are_served(client):
    r = await client.get("/api/v1/industries/academy/offer-schema")
    assert r.status_code == 200, r.text
    schema = r.json()
    assert schema["$schema"].endswith("draft-07/schema#")
    assert set(schema["required"]) == {"course_id", "term"}

    r = await client.get("/api/v1/industries/office/offer-schema")
    assert r.status_code == 200, r.text
    assert "hot_desk" in r.json()["properties"]["space_type"]["enum"]

    assert (await client.get("/api/v1/industries/salon/offer-schema")).status_code == 404


@pytest.mark.asyncio
async def test_register_office_persists_industry_and_checklist(client):
    body = await _register_org(client, name="Flex Spaces", email="office@x.com", industry="office")
    headers = _headers(body)
    org = body["organization"]

    assert org["industry"] == "office"

    r = await client.get("/api/v1/organizations/me", headers=headers)
    assert r.json()["industry"] == "office"

    r = await client.get("/api/v1/organizations/me/industry", headers=headers)
    meta = r.json()
    assert meta["key"] == "office"
    assert "companies" in meta["modules"]

    r = await client.get("/api/v1/organizations/me/checklist", headers=headers)
    steps = r.json()["steps"]
    codes = [s["code"] for s in steps]
    assert codes == ["companies", "offer", "invoices", "staff", "done"]


@pytest.mark.asyncio
async def test_register_gym_default_is_gym(client):
    body = await _register_org(client, name="Old Iron", email="gym@x.com")
    headers = _headers(body)

    assert body["organization"]["industry"] == "gym"

    r = await client.get("/api/v1/organizations/me/checklist", headers=headers)
    codes = [s["code"] for s in r.json()["steps"]]
    assert codes == ["stripe", "offer", "enroll", "staff", "done"]


@pytest.mark.asyncio
async def test_unknown_industry_rejected_at_registration(client):
    r = await client.post("/api/v1/auth/register", json={
        "full_name": "Salon Owner",
        "email": "salon@x.com",
        "password": PASSWORD,
        "confirm_password": PASSWORD,
        **OWNER_PROFILE,
    })
    assert r.status_code == 201, r.text
    code = latest_code_for("salon@x.com")
    await client.post("/api/v1/auth/verify-email", json={"email": "salon@x.com", "code": code})

    r = await client.post("/api/v1/organizations/register", json={
        "owner_email": "salon@x.com",
        "details": {"name": "Hair Palace", "industry": "salon"},
        "tier": "starter",
    })
    assert r.status_code == 422
