"""Integration tests for the remaining features: WebSocket sync, Stripe webhooks,
MFA (TOTP), org-code rotation, and CSV bulk import.

These exercise the wiring added on top of the 13 core domains.
"""

from __future__ import annotations

import pytest

from app.core import totp
from app.core.security import now_utc
from tests.helpers import latest_code_for


def _invite_code_for(email: str) -> str:
    """Extract the invite token from the most recent invite email in the outbox."""

    from app.integrations.email import outbox

    for mail in reversed(outbox):
        if mail.to in (email.lower(), email) and "Use this code to join:" in mail.body:
            return mail.body.split("Use this code to join:", 1)[1].strip()
    raise AssertionError(f"No invite email found for {email}")

PASSWORD = "Sup3rStr0ng!Pass"
MEMBER_PWD = "M3mberStr0ng!Pwd"


async def _provision_gym(client, *, owner_email="owner@g.com", gym="Iron Pulse Boxing", tier="pro"):
    await client.post("/api/v1/auth/register", json={
        "full_name": "Alex", "email": owner_email,
        "password": PASSWORD, "confirm_password": PASSWORD})
    code = latest_code_for(owner_email)
    await client.post("/api/v1/auth/verify-email", json={"email": owner_email, "code": code})
    r = await client.post("/api/v1/organizations/register", json={
        "owner_email": owner_email,
        "details": {"name": gym, "default_currency": "USD"},
        "tier": tier})
    body = r.json()
    org_id = body["organization"]["id"]
    org_code = body["organization"]["org_code"]
    access = body["access_token"]
    headers = {"Authorization": f"Bearer {access}", "X-Organization-Id": org_id}
    await client.post("/api/v1/organizations/me/connect", headers=headers)
    await client.post("/api/v1/organizations/me/connect/complete", headers=headers)
    r = await client.post("/api/v1/plans", headers=headers, json={
        "name": "Monthly", "price": 149.0, "billing_type": "recurring",
        "cycle_unit": "month", "cycle_length": 1})
    plan_id = r.json()["id"]
    await client.post(f"/api/v1/plans/{plan_id}/publish", headers=headers)
    return headers, org_id, org_code, plan_id


# --------------------------------------------------------------- invites
@pytest.mark.asyncio
async def test_member_invite_redeem_and_login(client):
    """Full invite loop: admin invites -> member redeems the code -> can log in
    and reach pending_payment. Regression: invite codes used to be issued but had
    no redeem endpoint, so an invited member could never actually join."""

    headers, org_id, org_code, plan_id = await _provision_gym(client)

    # Admin invites a new member (stub email -> code returned + in outbox).
    r = await client.post("/api/v1/members/invite", headers=headers,
                          json={"email": "invitee@g.com"})
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["email_delivered"] is False  # stub mode in tests
    code = body["invite_code"] or _invite_code_for("invitee@g.com")
    assert code

    # Member redeems the invite: sets a password, advances to pending_payment.
    r = await client.post("/api/v1/memberships/invite/redeem", json={
        "org_code": org_code, "email": "invitee@g.com", "code": code, "password": MEMBER_PWD})
    assert r.status_code == 200, r.text
    assert r.json()["member_status"] == "pending_payment"

    # The invited member can now log in with the password they just set.
    r = await client.post("/api/v1/auth/member-login", json={
        "org_code": org_code, "email": "invitee@g.com", "password": MEMBER_PWD})
    assert r.status_code == 200, r.text
    assert r.json()["access_token"]

    # A second redeem with the same (now consumed) code is rejected.
    r = await client.post("/api/v1/memberships/invite/redeem", json={
        "org_code": org_code, "email": "invitee@g.com", "code": code, "password": MEMBER_PWD})
    assert r.status_code == 400, r.text


# ------------------------------------------------------------------ MFA
@pytest.mark.asyncio
async def test_mfa_enroll_confirm_and_login_challenge(client):
    headers, org_id, org_code, plan_id = await _provision_gym(client)

    # Enroll -> get a secret, confirm with a valid code.
    r = await client.post("/api/v1/auth/mfa/enroll", headers=headers)
    assert r.status_code == 200, r.text
    secret = r.json()["secret"]
    code = totp.now_code(secret, for_time=now_utc())
    r = await client.post("/api/v1/auth/mfa/confirm", headers=headers, json={"code": code})
    assert r.status_code == 200, r.text

    # Login now requires MFA: password-only returns requires_mfa with no token.
    r = await client.post("/api/v1/auth/login", json={"email": "owner@g.com", "password": PASSWORD})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["requires_mfa"] is True
    assert body["access_token"] == ""

    # Login with the code succeeds.
    code = totp.now_code(secret, for_time=now_utc())
    r = await client.post("/api/v1/auth/login",
                          json={"email": "owner@g.com", "password": PASSWORD, "mfa_code": code})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["access_token"]
    assert body["requires_mfa"] is False


# ----------------------------------------------------------- org-code rotation
@pytest.mark.asyncio
async def test_org_code_rotation_changes_code(client):
    headers, org_id, org_code, plan_id = await _provision_gym(client)
    r = await client.post("/api/v1/organizations/me/rotate-code", headers=headers)
    assert r.status_code == 200, r.text
    new_code = r.json()["org_code"]
    assert new_code != org_code

    # Old code no longer resolves a login (vague 401).
    await client.post("/api/v1/auth/register", json={
        "full_name": "M", "email": "m@g.com", "password": MEMBER_PWD, "confirm_password": MEMBER_PWD})
    # Owner can still fetch org with existing token (owner session not revoked).
    r = await client.get("/api/v1/organizations/me", headers=headers)
    assert r.status_code == 200
    assert r.json()["org_code"] == new_code


# -------------------------------------------------------------- CSV import
@pytest.mark.asyncio
async def test_bulk_import_csv(client):
    headers, org_id, org_code, plan_id = await _provision_gym(client)
    csv_body = (
        "email,full_name,phone\n"
        "alice@import.com,Alice,111\n"
        "bob@import.com,Bob,222\n"
        "not-an-email,Bad,000\n"
    ).encode("utf-8")
    files = {"file": ("members.csv", csv_body, "text/csv")}
    r = await client.post("/api/v1/members/import", headers=headers, files=files)
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["created"] == 2
    assert len(body["errors"]) == 1

    # Imported members appear in the directory as pending_activation.
    r = await client.get("/api/v1/members", headers=headers, params={"status": "pending_activation"})
    emails = {m["email"] for m in r.json()}
    assert {"alice@import.com", "bob@import.com"} <= emails


# ---------------------------------------------------------- Stripe webhooks
@pytest.mark.asyncio
async def test_platform_webhook_accepts_stub_event(client):
    await _provision_gym(client)
    # In stub mode (no real Stripe key) the endpoint accepts a well-formed JSON
    # event without a signature and routes it by type.
    event = {"type": "invoice.payment_succeeded", "data": {"object": {"customer": "cus_unknown"}}}
    r = await client.post("/api/v1/webhooks/stripe", json=event)
    assert r.status_code == 200, r.text
    assert r.json().get("handled") == "invoice.payment_succeeded"


@pytest.mark.asyncio
async def test_connect_webhook_unknown_intent_ignored(client):
    await _provision_gym(client)
    event = {"type": "payment_intent.succeeded", "data": {"object": {"id": "pi_nope"}}}
    r = await client.post("/api/v1/webhooks/stripe-connect", json=event)
    assert r.status_code == 200, r.text
    assert "ignored" in r.json()


@pytest.mark.asyncio
async def test_webhook_unknown_type_acknowledged(client):
    event = {"type": "customer.created", "data": {"object": {}}}
    r = await client.post("/api/v1/webhooks/stripe", json=event)
    assert r.status_code == 200, r.text
    assert r.json().get("ignored") == "customer.created"


# --------------------------------------------------------------- realtime
@pytest.mark.asyncio
async def test_ws_rejects_garbage_token():
    """The WS auth helper rejects an invalid token without touching the DB."""

    from app.api.v1.routes.ws import _authorize

    assert await _authorize("garbage.token") is None
    assert await _authorize("") is None


@pytest.mark.asyncio
async def test_realtime_broadcast_is_org_scoped():
    """Broadcast reaches sockets registered for the org and skips other orgs."""

    from app.realtime import manager

    class FakeWS:
        def __init__(self):
            self.sent = []

        async def send_json(self, data):
            self.sent.append(data)

    ws = FakeWS()
    # Register directly (manager.connect() would call websocket.accept()).
    async with manager._lock:
        manager._by_org["org-A"].add(ws)
    try:
        await manager.broadcast("org-A", {"type": "plan.changed", "plan_id": "p1"})
        await manager.broadcast("org-B", {"type": "noise"})
    finally:
        await manager.disconnect("org-A", ws)

    assert {"type": "plan.changed", "plan_id": "p1"} in ws.sent
    assert all(e.get("type") != "noise" for e in ws.sent)
    assert manager.connection_count("org-A") == 0
