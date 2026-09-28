"""Test helpers."""

from __future__ import annotations

import re

from app.integrations.email import outbox

# Required owner-profile fields added to registration (Section 4.2). Spread into
# /auth/register payloads so tests supply the now-mandatory fields.
OWNER_PROFILE = {
    "cnic": "42101-1234567-8",
    "phone": "+92 300 1234567",
    "occupation": "Owner",
    "education": "BSc",
    "address": "1 Gym St",
    "date_of_birth": "1990-01-01",
    "gender": "male",
    "city": "Karachi",
    "emergency_contact": "Kin +92 300 7654321",
}


def latest_code_for(email: str) -> str:
    """Extract the 6-digit code from the most recent email to ``email``."""

    for mail in reversed(outbox):
        if mail.to == email.lower() or mail.to == email:
            m = re.search(r"\b(\d{6})\b", mail.body)
            if m:
                return m.group(1)
    raise AssertionError(f"No code email found for {email}")


def latest_token_for(email: str, marker: str = "reset: ") -> str:
    for mail in reversed(outbox):
        if mail.to in (email.lower(), email) and marker in mail.body:
            return mail.body.split(marker, 1)[1].strip()
    raise AssertionError(f"No token email found for {email}")


PASSWORD = "Sup3rStr0ng!Pass"


async def provision_org(client, *, email: str, name: str) -> tuple[str, dict, str]:
    """Register an owner and provision their org -> (org_code, headers, org_id).

    Shared by the assistant and agent test modules so both exercise the same
    real signup path rather than a shortcut.
    """

    await client.post(
        "/api/v1/auth/register",
        json={
            "full_name": "Alex",
            "email": email,
            "password": PASSWORD,
            "confirm_password": PASSWORD,
            **OWNER_PROFILE,
        },
    )
    code = latest_code_for(email)
    await client.post("/api/v1/auth/verify-email", json={"email": email, "code": code})
    r = await client.post(
        "/api/v1/organizations/register",
        json={
            "owner_email": email,
            "details": {"name": name, "default_currency": "USD"},
            "tier": "pro",
        },
    )
    body = r.json()
    org_id = body["organization"]["id"]
    return (
        body["organization"]["org_code"],
        {"Authorization": f"Bearer {body['access_token']}", "X-Organization-Id": org_id},
        org_id,
    )
