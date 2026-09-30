"""The swarm through the real graph (ADR 019).

`tests/unit/test_swarm.py` drives the orchestrator directly. This file drives it
the way production does — through the compiled graph, the SSE route and the
stored transcript — because the wiring is the part that a unit test of the
orchestrator cannot see: a planner that eats the model's first turn, a custom
frame that never leaves the node, a step shape that persists but does not parse.
"""

from __future__ import annotations

import json

import pytest

from app.agent.model import StubChatModel

from tests.helpers import provision_org


@pytest.fixture(autouse=True)
def stub_provider(monkeypatch):
    monkeypatch.setattr("app.core.config.settings.groq_api_key", "")


def _frames(text: str) -> list[dict]:
    out: list[dict] = []
    for line in text.splitlines():
        if line.startswith("data:"):
            out.append(json.loads(line[len("data:") :].strip()))
    return out


async def _ask(client, question: str = "How is the gym doing this month?") -> list[dict]:
    _, headers, _ = await provision_org(client, email="owner@g.com", name="Iron Pulse")
    conv = (
        await client.post(
            "/api/v1/assistant/conversations",
            headers={**headers, "Idempotency-Key": "k1"},
            json={"content": question},
        )
    ).json()
    r = await client.post(
        f"/api/v1/assistant/conversations/{conv['id']}/stream", headers=headers, json={}
    )
    return _frames(r.text)


@pytest.mark.asyncio
async def test_auto_mode_takes_the_direct_path_without_a_provider(client, monkeypatch):
    """`auto` plans with a model, so with no provider there is nothing to plan
    with — and the turn must still be answered the ordinary way."""

    monkeypatch.setattr("app.core.config.settings.assistant_swarm_mode", "auto")
    monkeypatch.setattr("app.agent.graph.build_chat_model", lambda **kw: StubChatModel())

    frames = await _ask(client)

    assert not any("agent_start" in f for f in frames)
    assert any("delta" in f for f in frames), "the direct path still answered"
    assert frames[-1].get("done") is True


@pytest.mark.asyncio
async def test_always_mode_runs_the_swarm_through_the_graph(client, monkeypatch):
    """The full path: planner → swarm node → frames → answer → transcript."""

    monkeypatch.setattr("app.core.config.settings.assistant_swarm_mode", "always")
    monkeypatch.setattr("app.agent.graph.build_chat_model", lambda **kw: StubChatModel())

    frames = await _ask(client)

    started = [f["agent_start"] for f in frames if "agent_start" in f]
    settled = [f["agent_done"] for f in frames if "agent_done" in f]
    assert started, "the swarm announced its agents"
    assert {a["id"] for a in started} == {d["id"] for d in settled}, "every row settled"

    # Forty specialists plus one orchestrator per domain that has one.
    assert len([a for a in started if a.get("role") == "specialist"]) == 40
    assert len([a for a in started if a.get("role") == "orchestrator"]) == 5

    # Each row carries what the UI renders: a name, what it is for, why it ran,
    # and the lookup it performed. The tool is on every row, not only the eight
    # model-backed ones — thirty-two of the forty read the database, and a label
    # that appeared on a fifth of the rows would read as a defect.
    for agent in started:
        assert agent["name"]
        assert agent["specialization"]
        assert agent.get("why"), agent["id"]
        assert agent["tool"], agent["id"]

    assert {a["tool"] for a in started if a.get("role") == "orchestrator"} == {
        f"distil_{d}" for d in ("members", "revenue", "payroll", "operations", "risk")
    }

    assert any("delta" in f for f in frames), "the lead agent's answer streams"
    assert frames[-1].get("done") is True


@pytest.mark.asyncio
async def test_the_tree_is_persisted_with_the_turn(client, monkeypatch):
    """A reloaded thread must show the same tree, folded — not lose it."""

    monkeypatch.setattr("app.core.config.settings.assistant_swarm_mode", "always")
    monkeypatch.setattr("app.agent.graph.build_chat_model", lambda **kw: StubChatModel())

    _, headers, _ = await provision_org(client, email="owner@g.com", name="Iron Pulse")
    conv = (
        await client.post(
            "/api/v1/assistant/conversations",
            headers={**headers, "Idempotency-Key": "k1"},
            json={"content": "How is the gym doing this month?"},
        )
    ).json()
    await client.post(
        f"/api/v1/assistant/conversations/{conv['id']}/stream", headers=headers, json={}
    )

    detail = (
        await client.get(f"/api/v1/assistant/conversations/{conv['id']}", headers=headers)
    ).json()
    assistant = [m for m in detail["messages"] if m["role"] == "assistant"]
    assert assistant, "the turn was stored"

    agents = [s for s in (assistant[-1]["steps"] or []) if s.get("type") == "agent"]
    assert len(agents) == 45, "40 specialists + 5 orchestrators survive the round trip"
    assert all(s["status"] in {"done", "skipped", "failed"} for s in agents)
    # The finding is persisted, not just the row: a reloaded tree that showed
    # names but no results would be worse than no tree.
    assert any(s.get("summary") for s in agents)

    # The turn's cost survives too, so a reloaded panel can still say what the
    # fan-out was worth and how long it took, rather than only names and rows.
    swarm = [s for s in assistant[-1]["steps"] if s.get("type") == "swarm"]
    assert len(swarm) == 1
    assert swarm[0]["total"] == 45
    assert swarm[0]["model_calls"] >= 2
    # Without a stored duration the header would render "Worked · 45 agents" and
    # nothing under it after a reload — the client's stopwatch dies with the page.
    assert 0 < swarm[0]["turn_ms"] < 120_000


@pytest.mark.asyncio
async def test_a_swarm_turn_reports_its_seconds_and_its_agents(client, monkeypatch):
    """The header the turn shows: elapsed seconds plus how many agents ran."""

    monkeypatch.setattr("app.core.config.settings.assistant_swarm_mode", "always")
    monkeypatch.setattr("app.agent.graph.build_chat_model", lambda **kw: StubChatModel())

    frames = await _ask(client)

    started = [f["agent_start"] for f in frames if "agent_start" in f]
    stats = [f["swarm_stats"] for f in frames if "swarm_stats" in f]
    assert len(stats) == 1
    # What the tree draws and what the header counts are the same number.
    assert stats[0]["total"] == len(started) == 45
    # The seconds the header shows under the count. It is sent, not measured in
    # the browser, so the header has it on the first frame after a reload too.
    assert stats[0]["turn_ms"] > 0
    # Sent after the answer it describes, so the client can render the seconds
    # the moment the turn ends rather than watching the panel go blank. The
    # terminal `done` frame is written by the service after the node returns, so
    # the stats frame is the last one the swarm itself emits.
    assert "swarm_stats" in frames[-2], "the last frame before the terminal done"
    assert any("delta" in f for f in frames[: frames.index(frames[-2])]), "after the answer"
    # The claim forty agents has to justify: not one model call per agent. Five
    # digests and a summariser are the floor; the judgement agents that found
    # something to read add a call each. Pinned exactly in test_swarm.py, where
    # the plan is controlled — here the point is only that the counting is real
    # and the total stays far below the agent count.
    assert stats[0]["model_calls"] >= 6
    assert stats[0]["model_calls"] < stats[0]["total"]


@pytest.mark.asyncio
async def test_off_mode_never_plans(client, monkeypatch):
    """`off` is the escape hatch: no planner call, exactly the 018 behaviour."""

    monkeypatch.setattr("app.core.config.settings.assistant_swarm_mode", "off")
    monkeypatch.setattr("app.agent.graph.build_chat_model", lambda **kw: StubChatModel())

    frames = await _ask(client)

    assert not any("agent_start" in f for f in frames)
    assert frames[-1].get("done") is True
