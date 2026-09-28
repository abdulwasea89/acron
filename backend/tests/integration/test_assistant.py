"""Assistant conversations: streaming, replay, and tenant isolation.

The provider is pinned to stub mode in every test, so the full path — routing,
SSE framing, persistence, replay, scoping — is exercised with the vendor
removed. A failure here is a plumbing failure, never a Groq failure.
"""

from __future__ import annotations

import json

import pytest
from sqlmodel import select

from app.core.config import settings
from app.models.membership import OrganizationMember
from app.services import assistant_service as assistant

from tests.helpers import OWNER_PROFILE, latest_code_for

PASSWORD = "Sup3rStr0ng!Pass"
MEMBER_PWD = "M3mberStr0ng!Pwd"


@pytest.fixture(autouse=True)
def stub_provider(monkeypatch):
    """Pin the assistant to its offline stub, whatever the local .env holds."""

    monkeypatch.setattr(settings, "groq_api_key", "")


def _frames(text: str) -> list[dict]:
    """Decode the SSE body into its JSON payloads."""

    out: list[dict] = []
    for line in text.splitlines():
        if line.startswith("data:"):
            out.append(json.loads(line[len("data:") :].strip()))
    return out


async def _provision_org(client, *, email: str, name: str) -> tuple[str, dict, str]:
    """Register an owner and provision their org -> (org_code, headers, org_id)."""

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


async def _create_conversation(client, headers: dict, content: str, key: str) -> dict:
    r = await client.post(
        "/api/v1/assistant/conversations",
        headers={**headers, "Idempotency-Key": key},
        json={"content": content},
    )
    assert r.status_code == 201, r.text
    return r.json()


# --------------------------------------------------------------------------- #
# Happy path
# --------------------------------------------------------------------------- #


async def test_create_stream_and_reload(client):
    _, headers, _ = await _provision_org(client, email="owner@g.com", name="Iron Pulse Boxing")

    conv = await _create_conversation(
        client, headers, "How many active members do we have?", "key-create-1"
    )
    assert conv["title"] == "How many active members do we have?"
    assert [m["role"] for m in conv["messages"]] == ["user"]

    # The session page's call: no content, answer the trailing user turn.
    r = await client.post(
        f"/api/v1/assistant/conversations/{conv['id']}/stream", headers=headers, json={}
    )
    assert r.status_code == 200, r.text
    assert r.headers["content-type"].startswith("text/event-stream")

    frames = _frames(r.text)
    assert frames, "no SSE frames were emitted"
    assert any("delta" in f for f in frames), "expected streamed deltas"
    done = [f for f in frames if f.get("done")]
    assert len(done) == 1
    assert done[0]["message_id"]
    assert not [f for f in frames if f.get("error")]

    # Reload: both turns are in the database, and the answer is the stub's.
    detail = (
        await client.get(
            f"/api/v1/assistant/conversations/{conv['id']}", headers=headers
        )
    ).json()
    assert [m["role"] for m in detail["messages"]] == ["user", "assistant"]
    answer = detail["messages"][1]
    assert "offline stub" in answer["content"]
    assert answer["model"] is None  # stub mode records no model id
    assert answer["error"] is None


async def test_stream_with_content_appends_then_answers(client):
    _, headers, _ = await _provision_org(client, email="owner@g.com", name="Iron Pulse")

    conv = await _create_conversation(client, headers, "First question", "key-create-1")
    await client.post(
        f"/api/v1/assistant/conversations/{conv['id']}/stream",
        headers=headers,
        json={},
    )

    # Composer send: append the next turn and answer it in one call.
    r = await client.post(
        f"/api/v1/assistant/conversations/{conv['id']}/stream",
        headers={**headers, "Idempotency-Key": "key-send-2"},
        json={"content": "Second question"},
    )
    assert r.status_code == 200, r.text
    assert [f for f in _frames(r.text) if f.get("done")]

    detail = (
        await client.get(
            f"/api/v1/assistant/conversations/{conv['id']}", headers=headers
        )
    ).json()
    assert [m["role"] for m in detail["messages"]] == [
        "user",
        "assistant",
        "user",
        "assistant",
    ]
    assert detail["messages"][2]["content"] == "Second question"


async def test_grounding_carries_this_orgs_identity(client, db):
    """The prompt names *this* gym and its money context, and nothing more.

    Org data (plans, metrics) moved behind tools (ADR 018), so the prompt holds
    identity + policy only. The data itself is asserted in the tool tests.
    """

    _, headers, org_id = await _provision_org(
        client, email="owner@g.com", name="Iron Pulse Boxing"
    )
    created = await client.post(
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
    await client.post(f"/api/v1/plans/{created.json()['id']}/publish", headers=headers)

    prompt = await assistant.build_system_prompt(db, org_id=org_id)

    assert "Iron Pulse Boxing" in prompt
    assert "USD" in prompt
    # Enums are interpolated by value, not repr: f-stringing a str-mixin Enum
    # yields "GymStatus.OPEN", which is noise the model has to see past.
    assert "GymStatus." not in prompt
    assert "Status: open" in prompt
    # The plan is fetched by a tool, so it must NOT be baked into the prompt.
    assert "Monthly" not in prompt


async def test_the_prompt_reaches_the_model(client):
    """Grounding is built *and* handed to the provider, not just assembled."""

    _, headers, _ = await _provision_org(client, email="owner@g.com", name="Iron Pulse Boxing")
    conv = await _create_conversation(client, headers, "What do our plans cost?", "key-create-1")

    r = await client.post(
        f"/api/v1/assistant/conversations/{conv['id']}/stream", headers=headers, json={}
    )
    answer = "".join(f["delta"] for f in _frames(r.text) if "delta" in f)

    # The stub reports the size of the context it was handed; a prompt that
    # never got attached would show up here as a near-empty number.
    assert "organization context" in answer
    size = int(answer.split("given ")[1].split(" characters")[0].replace(",", ""))
    assert size > 500


# --------------------------------------------------------------------------- #
# Idempotency
# --------------------------------------------------------------------------- #


async def test_create_requires_idempotency_key(client):
    _, headers, _ = await _provision_org(client, email="owner@g.com", name="Iron Pulse")

    r = await client.post(
        "/api/v1/assistant/conversations", headers=headers, json={"content": "Hi"}
    )
    assert r.status_code == 400
    assert "Idempotency-Key" in r.json()["detail"]


async def test_create_replay_returns_the_same_conversation(client):
    _, headers, _ = await _provision_org(client, email="owner@g.com", name="Iron Pulse")

    first = await _create_conversation(client, headers, "Same prompt", "key-dup")
    second = await _create_conversation(client, headers, "Same prompt", "key-dup")

    assert first["id"] == second["id"]
    listed = (await client.get("/api/v1/assistant/conversations", headers=headers)).json()
    assert len(listed) == 1


async def test_answered_thread_replays_instead_of_regenerating(client):
    _, headers, _ = await _provision_org(client, email="owner@g.com", name="Iron Pulse")

    conv = await _create_conversation(client, headers, "One question", "key-create-1")
    url = f"/api/v1/assistant/conversations/{conv['id']}/stream"
    await client.post(url, headers=headers, json={})
    await client.post(url, headers=headers, json={})  # a reload mid-conversation

    messages = (
        await client.get(f"/api/v1/assistant/conversations/{conv['id']}", headers=headers)
    ).json()["messages"]
    # One reply to one question — the second call replayed, it did not generate.
    assert [m["role"] for m in messages] == ["user", "assistant"]


# --------------------------------------------------------------------------- #
# Tenant isolation (Security Rule #1)
# --------------------------------------------------------------------------- #


async def test_another_org_cannot_read_or_stream(client):
    _, org_a, _ = await _provision_org(client, email="a@g.com", name="Org A")
    _, org_b, _ = await _provision_org(client, email="b@g.com", name="Org B")

    conv = await _create_conversation(client, org_a, "Org A secret", "key-a")

    detail = await client.get(f"/api/v1/assistant/conversations/{conv['id']}", headers=org_b)
    assert detail.status_code == 404

    stream = await client.post(
        f"/api/v1/assistant/conversations/{conv['id']}/stream", headers=org_b, json={}
    )
    assert stream.status_code == 404

    delete = await client.delete(
        f"/api/v1/assistant/conversations/{conv['id']}", headers=org_b
    )
    assert delete.status_code == 404

    # Still there for its owner.
    assert (
        await client.get(f"/api/v1/assistant/conversations/{conv['id']}", headers=org_a)
    ).status_code == 200


async def test_a_colleague_in_the_same_org_cannot_read_it(client, db):
    org_code, owner_headers, org_id = await _provision_org(
        client, email="owner@g.com", name="Iron Pulse"
    )
    await client.post(
        "/api/v1/plans",
        headers=owner_headers,
        json={
            "name": "Monthly",
            "price": 149.0,
            "billing_type": "recurring",
            "cycle_unit": "month",
            "cycle_length": 1,
        },
    )
    plans = (await client.get("/api/v1/plans", headers=owner_headers)).json()
    for plan in plans:
        await client.post(f"/api/v1/plans/{plan['id']}/publish", headers=owner_headers)

    conv = await _create_conversation(client, owner_headers, "Owner only", "key-owner")

    # A second person joins the same gym and is promoted to manager, so the
    # capability check passes and only the ownership check is under test.
    email = "manager@g.com"
    await client.post(
        "/api/v1/memberships/signup/request-email", json={"org_code": org_code, "email": email}
    )
    code = latest_code_for(email)
    await client.post(
        "/api/v1/memberships/signup/verify-email",
        json={"org_code": org_code, "email": email, "code": code},
    )
    await client.post(
        "/api/v1/memberships/signup/set-password",
        json={"org_code": org_code, "email": email, "password": MEMBER_PWD},
    )

    membership = (
        await db.execute(
            select(OrganizationMember).where(
                OrganizationMember.organization_id == org_id,
                OrganizationMember.role == "member",
            )
        )
    ).scalars().first()
    assert membership is not None
    membership.role = "manager"
    db.add(membership)
    await db.commit()

    login = await client.post(
        "/api/v1/auth/login",
        json={"org_code": org_code, "email": email, "password": MEMBER_PWD},
    )
    assert login.status_code == 200, login.text
    body = login.json()
    assert body["role"] == "manager"
    colleague = {
        "Authorization": f"Bearer {body['access_token']}",
        "X-Organization-Id": body["organization_id"],
    }

    assert (
        await client.get(f"/api/v1/assistant/conversations/{conv['id']}", headers=colleague)
    ).status_code == 404
    assert (
        await client.post(
            f"/api/v1/assistant/conversations/{conv['id']}/stream", headers=colleague, json={}
        )
    ).status_code == 404
    # The history rail shows them nothing either.
    assert (await client.get("/api/v1/assistant/conversations", headers=colleague)).json() == []
