"""The specialist swarm (ADR 019).

Two levels here. The roster and planner are pure and tested directly. The run
itself is driven with a stub model and a real (in-memory) database, because the
point of the deterministic specialists is that they report the same numbers the
rest of the app does — a test that mocked the query layer would miss exactly the
class of bug this design is trying to avoid.
"""

from __future__ import annotations

import asyncio

import pytest

from app.agent.context import AgentContext, bind_context, clear_context
from app.agent.model import StubChatModel
from app.agent.swarm import BY_DOMAIN, BY_ID, DOMAINS, SPECIALISTS
from app.agent.swarm.orchestrator import _plan_prompt, parse_plan, run_swarm
from app.agent.swarm.types import AgentPlan, Assignment, Finding, STATUS_FAILED
from app.core.constants import Role

from tests.helpers import provision_org


class ScriptedStub(StubChatModel):
    """A stub that answers by matching its prompt, so one model can serve
    several roles (planner, distiller, summariser) inside a single run."""

    plan: str = ""

    def _next(self, messages):  # type: ignore[override]
        from langchain_core.messages import AIMessage

        joined = " ".join(str(getattr(m, "content", "") or "") for m in messages)
        if "routing planner" in joined:
            return AIMessage(content=self.plan)
        return AIMessage(content="Digest.")


def _swap_run(monkeypatch, agent_id: str, run) -> None:
    """Replace one specialist's runner, keeping the rest of its row intact.

    The roster's ``BY_ID`` is the single dict the dispatcher reads, so patching
    it here is what ``run_swarm`` will actually reach for.
    """

    from app.agent.swarm import roster as roster_mod

    original = roster_mod.BY_ID[agent_id]
    monkeypatch.setitem(
        roster_mod.BY_ID,
        agent_id,
        original.__class__(
            id=original.id,
            name=original.name,
            domain=original.domain,
            specialization=original.specialization,
            why=original.why,
            run=run,
        ),
    )


# ---------------------------------------------------------------- roster ----


def test_roster_is_five_domains_of_eight():
    """The shape the product promises: 5 orchestrators over 40 specialists."""

    assert len(DOMAINS) == 5
    assert len(SPECIALISTS) == 40
    assert {d.id for d in DOMAINS} == set(BY_DOMAIN)
    assert all(len(group) == 8 for group in BY_DOMAIN.values())


def test_specialist_ids_are_unique_and_complete():
    ids = [s.id for s in SPECIALISTS]
    assert len(set(ids)) == len(ids) == 40
    # A specialist missing from the lookup cannot be planned or dispatched, and
    # the failure would be silent — it would simply never appear in a tree.
    assert set(BY_ID) == set(ids)


def test_every_specialist_describes_itself():
    """The UI renders these strings; an empty one is a blank row."""

    for specialist in SPECIALISTS:
        assert specialist.name.strip()
        assert specialist.specialization.strip()
        assert specialist.why.strip()


def test_model_backed_specialists_are_the_minority():
    """Forty model calls a turn is the thing this design exists to avoid."""

    model_backed = [s for s in SPECIALISTS if s.model_backed]
    assert 0 < len(model_backed) <= 10


def test_no_specialist_accepts_a_tenant_scope():
    """Tenant scope comes from context, never from an argument (ADR 018 §3).

    A specialist that took an ``org_id`` could be talked into reading another
    tenant's data by a planner mistake or a prompt injection. The roster simply
    gives no function the chance.
    """

    import inspect

    for specialist in SPECIALISTS:
        params = inspect.signature(specialist.run).parameters
        assert "org_id" not in params, specialist.id
        assert "organization_id" not in params, specialist.id


# ---------------------------------------------------------------- planner ---


def test_parse_plan_reads_a_swarm():
    plan = parse_plan(
        '{"mode": "swarm", "agents": [{"id": "member_growth", "question": "growth?"}]}'
    )
    assert plan.is_swarm
    assert [a.agent_id for a in plan.agents] == ["member_growth"]


def test_parse_plan_tolerates_a_code_fence():
    plan = parse_plan(
        '```json\n{"mode": "swarm", "agents": [{"id": "refunds", "question": "q"}]}\n```'
    )
    assert plan.is_swarm
    assert [a.agent_id for a in plan.agents] == ["refunds"]


def test_parse_plan_accepts_a_single_agent_swarm():
    """The dispatch size is the planner's call, and one is a size.

    Every agent dispatched is a row the user reads, so a question that one
    analyst's remit covers end to end should cost one row — not a floor's worth
    of padding, and not a forced fallback to the direct path.
    """

    plan = parse_plan(
        '{"mode": "swarm", "reason": "one count, one analyst", '
        '"agents": [{"id": "member_growth", "question": "how many members?"}]}'
    )
    assert plan.is_swarm
    assert len(plan.agents) == 1


def test_the_planner_is_not_told_a_floor():
    """The prompt asks for the size the question needs, with no minimum.

    A restated "between 6 and 40" here would quietly undo the whole point: the
    model would pad a one-lookup question to six agents, and the padding would be
    visible in the tree, because every agent that runs is a row.
    """

    prompt = _plan_prompt()
    assert "from one to forty" in prompt
    assert "between 6" not in prompt
    assert "at least" not in prompt


def test_parse_plan_drops_invented_ids():
    """The planner picks from a menu, but a hallucinated id must not crash."""

    plan = parse_plan(
        '{"mode": "swarm", "agents": ['
        '{"id": "member_growth", "question": "a"},'
        '{"id": "not_a_real_agent", "question": "b"}]}'
    )
    assert [a.agent_id for a in plan.agents] == ["member_growth"]


def test_parse_plan_dedupes_and_defaults_the_question():
    plan = parse_plan(
        '{"mode": "swarm", "agents": ['
        '{"id": "refunds"}, {"id": "refunds", "question": "again"}]}'
    )
    assert [a.agent_id for a in plan.agents] == ["refunds"]
    assert plan.agents[0].question


def test_parse_plan_degrades_to_direct_on_garbage():
    """An unreadable plan should cost the user a swarm, not their answer."""

    for raw in ["", "I think you should ask the revenue team.", "{not json}", "[1,2,3]"]:
        plan = parse_plan(raw)
        assert not plan.is_swarm, raw


def test_parse_plan_respects_direct_mode():
    plan = parse_plan('{"mode": "direct", "agents": [{"id": "refunds", "question": "q"}]}')
    assert not plan.is_swarm


def test_parse_plan_carries_the_reason():
    """The planner's rationale is shown to the user, so it must survive parsing."""

    plan = parse_plan(
        '{"mode": "swarm", "reason": "Cross-cutting margin question.", '
        '"agents": [{"id": "refunds", "question": "q"}]}'
    )
    assert plan.reason == "Cross-cutting margin question."


def test_parse_plan_without_a_reason_is_still_a_plan():
    """A model that omits the field must not cost the turn its fan-out."""

    plan = parse_plan('{"mode": "swarm", "agents": [{"id": "refunds", "question": "q"}]}')
    assert plan.is_swarm
    assert plan.reason == ""


# ------------------------------------------------------------ the run -------


class _Recorder:
    """Collects the frames a run writes, the way the SSE route would."""

    def __init__(self) -> None:
        self.frames: list[dict] = []

    def __call__(self, payload: dict) -> None:
        self.frames.append(payload)

    def of(self, key: str) -> list[dict]:
        return [f[key] for f in self.frames if key in f]


def _plan(*agent_ids: str, reason: str = "") -> AgentPlan:
    return AgentPlan(
        mode="swarm",
        agents=[Assignment(agent_id=a, question="What stands out?") for a in agent_ids],
        reason=reason,
    )


class ReasoningStub(StubChatModel):
    """A stub whose streaming answer carries a reasoning trace.

    Real providers put this in ``additional_kwargs`` on every chunk before the
    answer text begins; the stub's default ``_chunks`` drops it, which is
    exactly the loss this test exists to catch.
    """

    async def _astream(self, messages, **kwargs):  # type: ignore[override]  # noqa: ARG002
        from langchain_core.messages import AIMessageChunk
        from langchain_core.outputs import ChatGenerationChunk

        self._next(messages)  # consume a script entry, as the base class would
        yield ChatGenerationChunk(
            message=AIMessageChunk(
                content="", additional_kwargs={"reasoning_content": "weighing the digests"}
            )
        )
        yield ChatGenerationChunk(message=AIMessageChunk(content="Answer."))


@pytest.mark.asyncio
async def test_swarm_emits_a_row_per_agent_and_a_streamed_answer(db, client):
    _, _, org_id = await provision_org(client, email="owner@g.com", name="Iron Pulse")
    token = bind_context(AgentContext(org_id=org_id, user_id="u1", role=Role.OWNER, session=db))
    writer = _Recorder()
    try:
        dispatched = ["member_growth", "member_lifecycle", "rev_by_method", "refunds"]
        answer = await run_swarm(
            ctx=AgentContext(
                org_id=org_id, user_id="u1", role=Role.OWNER, session=db
            ),
            question="How is the gym doing?",
            plan=_plan(*dispatched),
            writer=writer,
            model=StubChatModel(),
        )
    finally:
        clear_context(token)

    started = {f["id"] for f in writer.of("agent_start")}
    done = {f["id"] for f in writer.of("agent_done")}
    # Every dispatched specialist is announced and then settles — no row is left
    # spinning, which is what the UI would show as a permanent "running…".
    assert set(dispatched) <= started
    assert set(dispatched) <= done
    assert answer

    # Each specialist's own sub-question asked the model for a digest, and the
    # final answer streams as deltas so it types out like the direct path.
    assert writer.of("delta")


@pytest.mark.asyncio
async def test_orchestrators_are_reported_as_agents(db, client):
    """The five orchestrators are agents in the picture, not hidden plumbing."""

    _, _, org_id = await provision_org(client, email="owner@g.com", name="Iron Pulse")
    token = bind_context(AgentContext(org_id=org_id, user_id="u1", role=Role.OWNER, session=db))
    writer = _Recorder()
    try:
        await run_swarm(
            ctx=AgentContext(org_id=org_id, user_id="u1", role=Role.OWNER, session=db),
            question="How is the gym doing?",
            # One specialist from each of three domains -> three orchestrators.
            plan=_plan("member_growth", "rev_by_method", "refunds"),
            writer=writer,
            model=StubChatModel(),
        )
    finally:
        clear_context(token)

    orchestrators = {f["id"] for f in writer.of("agent_start") if f.get("role") == "orchestrator"}
    assert orchestrators == {"orchestrator:members", "orchestrator:revenue"}
    roles = {f.get("role") for f in writer.of("agent_start")}
    assert roles == {"specialist", "orchestrator"}


@pytest.mark.asyncio
async def test_a_failing_agent_does_not_take_the_turn_down(db, client, monkeypatch):
    """One bad query out of forty must not cost the user their answer.

    A swarm that dies because one of forty queries hit a missing column is worse
    than a swarm that reports 39 findings and one failure — and the UI has a row
    for exactly that.
    """

    _, _, org_id = await provision_org(client, email="owner@g.com", name="Iron Pulse")
    ctx = AgentContext(org_id=org_id, user_id="u1", role=Role.OWNER, session=db)
    writer = _Recorder()

    async def boom(*_args, **_kwargs):
        raise RuntimeError("column dropped")

    _swap_run(monkeypatch, "refunds", boom)

    token = bind_context(ctx)
    try:
        answer = await run_swarm(
            ctx=ctx,
            question="How is the gym doing?",
            plan=_plan("refunds", "member_growth"),
            writer=writer,
            model=StubChatModel(),
        )
    finally:
        clear_context(token)

    settled = {f["id"]: f for f in writer.of("agent_done")}
    assert settled["refunds"]["status"] == STATUS_FAILED
    # The healthy agent still reported, and the turn still produced an answer.
    assert settled["member_growth"]["status"] == "done"
    assert answer


@pytest.mark.asyncio
async def test_the_turn_shows_its_own_reasoning(db, client):
    """A swarm turn must show thinking, not only rows.

    The rows say what each agent found. They do not say why this shape was
    chosen, nor what the lead agent made of the five digests — and those are the
    two judgements the turn actually turns on.
    """

    _, _, org_id = await provision_org(client, email="owner@g.com", name="Iron Pulse")
    ctx = AgentContext(org_id=org_id, user_id="u1", role=Role.OWNER, session=db)
    writer = _Recorder()
    token = bind_context(ctx)
    try:
        await run_swarm(
            ctx=ctx,
            question="How is the gym doing?",
            plan=_plan("member_growth", reason="Margin question across several teams."),
            writer=writer,
            model=ReasoningStub(),
        )
    finally:
        clear_context(token)

    thinking = "".join(writer.of("thinking"))
    assert "Margin question across several teams." in thinking, "the dispatch rationale is shown"
    assert "weighing the digests" in thinking, "the lead agent's trace reaches the panel"


@pytest.mark.asyncio
async def test_the_turn_reports_what_it_cost(db, client):
    """The panel must be able to answer 'was that worth it?' with real numbers."""

    _, _, org_id = await provision_org(client, email="owner@g.com", name="Iron Pulse")
    ctx = AgentContext(org_id=org_id, user_id="u1", role=Role.OWNER, session=db)
    writer = _Recorder()
    token = bind_context(ctx)
    try:
        await run_swarm(
            ctx=ctx,
            question="How is the gym doing?",
            plan=_plan("member_growth", "member_lifecycle"),
            writer=writer,
            model=StubChatModel(),
        )
    finally:
        clear_context(token)

    stats = writer.of("swarm_stats")
    assert len(stats) == 1, "one set of numbers per turn"
    line = stats[0]
    assert line["agents"] == 2 and line["domains"] == 1
    # The orchestrator is an agent too, and the header counts it.
    assert line["total"] == 3
    # Planner + one digest + the summariser — and nothing per deterministic agent.
    assert line["model_calls"] == 3
    assert line["done"] + line["skipped"] + line["failed"] == 2
    assert 0 <= line["fanout_ms"] < 60_000
    # The whole turn, planner to answer — the number the header puts under
    # "Worked · N agents". It cannot be smaller than the fan-out it contains, and
    # it exists so a reloaded thread still knows how long the turn took, since
    # the browser's own stopwatch does not survive the page.
    assert line["fanout_ms"] <= line["turn_ms"] < 60_000
    # Emitted last, because that number does not exist until the answer does.
    # A stats frame sent before the fan-out finished would be a guess, and a
    # guess is the one thing this line is not allowed to be.
    assert writer.frames[-1] == {"swarm_stats": line}
    assert writer.of("delta"), "and the answer still preceded it"


@pytest.mark.asyncio
async def test_a_dispatch_built_without_the_planner_is_not_billed_for_one(db, client):
    """`always` mode skips the planner call, so the count must skip it too.

    The model-call count is the number that justifies running forty agents; a
    report that bills a call nobody made is worse than no report.
    """

    _, _, org_id = await provision_org(client, email="owner@g.com", name="Iron Pulse")
    ctx = AgentContext(org_id=org_id, user_id="u1", role=Role.OWNER, session=db)
    writer = _Recorder()
    token = bind_context(ctx)
    try:
        await run_swarm(
            ctx=ctx,
            question="How is the gym doing?",
            plan=AgentPlan(
                mode="swarm",
                agents=[
                    Assignment(agent_id=a, question="What stands out?")
                    for a in ("member_growth", "member_lifecycle")
                ],
                planned=False,
            ),
            writer=writer,
            model=StubChatModel(),
        )
    finally:
        clear_context(token)

    # One digest + the summariser, and no planner.
    assert writer.of("swarm_stats")[0]["model_calls"] == 2


@pytest.mark.asyncio
async def test_evidence_is_capped_before_it_reaches_the_column(db, client, monkeypatch):
    """`detail` is written to a JSON column on every turn, so it is bounded.

    The raw finding keeps its full evidence; only what travels to the client and
    the database is clipped — a wide domain's roll-up is eight findings long and
    the column should not grow with the roster.
    """

    from app.agent.swarm.types import DETAIL_MAX

    async def bloated(*_args, **_kwargs):
        return Finding(agent_id="refunds", status="done", summary="ok", detail="x" * 50_000)

    _swap_run(monkeypatch, "refunds", bloated)

    _, _, org_id = await provision_org(client, email="owner@g.com", name="Iron Pulse")
    ctx = AgentContext(org_id=org_id, user_id="u1", role=Role.OWNER, session=db)
    writer = _Recorder()
    token = bind_context(ctx)
    try:
        await run_swarm(
            ctx=ctx,
            question="How is the gym doing?",
            plan=_plan("refunds"),
            writer=writer,
            model=StubChatModel(),
        )
    finally:
        clear_context(token)

    specialisms = {f["id"]: f for f in writer.of("agent_done")}
    assert len(specialisms["refunds"]["detail"]) <= DETAIL_MAX + 32
    assert specialisms["refunds"]["detail"].endswith("(truncated)")


@pytest.mark.asyncio
async def test_a_failed_agent_is_counted_as_failed(db, client, monkeypatch):
    """The metric and the row must agree about what went wrong."""

    _, _, org_id = await provision_org(client, email="owner@g.com", name="Iron Pulse")
    ctx = AgentContext(org_id=org_id, user_id="u1", role=Role.OWNER, session=db)
    writer = _Recorder()

    async def boom(*_args, **_kwargs):
        raise RuntimeError("column dropped")

    _swap_run(monkeypatch, "refunds", boom)

    token = bind_context(ctx)
    try:
        await run_swarm(
            ctx=ctx,
            question="How is the gym doing?",
            plan=_plan("refunds", "member_growth"),
            writer=writer,
            model=StubChatModel(),
        )
    finally:
        clear_context(token)

    assert writer.of("swarm_stats")[0]["failed"] == 1


@pytest.mark.asyncio
async def test_judgement_agents_carry_the_evidence_they_read(db, client):
    """A conclusion is only checkable against the rows behind it.

    Eight of the forty agents answer with a reading rather than a figure. For
    those, the summary alone is not evidence — it is an opinion — so the rows it
    was shown travel with it.
    """

    from app.agent.swarm.roster import _analyst

    async def gather(_ctx):  # noqa: ARG001
        return ("3 members at risk: Ada, Grace, Lin", "You are a probe.")

    async def ask(_system, _user):  # noqa: ARG001
        return "Three members are drifting."

    _, _, org_id = await provision_org(client, email="owner@g.com", name="Iron Pulse")
    ctx = AgentContext(org_id=org_id, user_id="u1", role=Role.OWNER, session=db)
    token = bind_context(ctx)
    try:
        finding = await _analyst("probe", "Probe", "spec", "why", gather).run(ctx, ask, "q?")
    finally:
        clear_context(token)

    assert finding.summary == "Three members are drifting."
    assert finding.detail == "3 members at risk: Ada, Grace, Lin"


@pytest.mark.asyncio
async def test_a_judgement_agent_with_no_data_spends_nothing(db, client):
    """No evidence is a skip, and a skip must not cost a model call."""

    from app.agent.swarm.roster import _analyst

    async def gather(_ctx):  # noqa: ARG001
        return None

    async def ask(_system, _user):  # noqa: ARG001
        raise AssertionError("a skipped agent must not reach the model")

    _, _, org_id = await provision_org(client, email="owner@g.com", name="Iron Pulse")
    ctx = AgentContext(org_id=org_id, user_id="u1", role=Role.OWNER, session=db)
    token = bind_context(ctx)
    try:
        finding = await _analyst("probe", "Probe", "spec", "why", gather).run(ctx, ask, "q?")
    finally:
        clear_context(token)

    assert finding.status == "skipped"
    assert finding.detail == ""


@pytest.mark.asyncio
async def test_deterministic_specialists_read_real_data(db, client):
    """The point of a deterministic specialist is that its number is the real one."""

    _, _, org_id = await provision_org(client, email="owner@g.com", name="Iron Pulse")
    ctx = AgentContext(org_id=org_id, user_id="u1", role=Role.OWNER, session=db)
    token = bind_context(ctx)

    async def ask(system, user):  # noqa: ARG001
        return "unused"

    try:
        # A brand-new org has no payments, so this one must decline rather than
        # invent a zero it cannot distinguish from "no data".
        finding = await BY_ID["rev_by_method"].run(ctx, ask, "revenue by method?")
    finally:
        clear_context(token)

    assert finding.status == "skipped"
    assert finding.agent_id == "rev_by_method"


@pytest.mark.asyncio
async def test_specialists_run_concurrently(db, client):
    """Forty agents must take as long as the slowest, not the sum."""

    _, _, org_id = await provision_org(client, email="owner@g.com", name="Iron Pulse")
    ctx = AgentContext(org_id=org_id, user_id="u1", role=Role.OWNER, session=db)
    writer = _Recorder()
    dispatched = [s.id for s in SPECIALISTS]

    async def slow(*_args, **_kwargs):
        await asyncio.sleep(0.05)
        return Finding(agent_id="x", status="done", summary="ok")

    from app.agent.swarm import roster as roster_mod

    original = dict(roster_mod.BY_ID)
    for agent_id in dispatched:
        spec = original[agent_id]
        roster_mod.BY_ID[agent_id] = spec.__class__(
            id=spec.id,
            name=spec.name,
            domain=spec.domain,
            specialization=spec.specialization,
            why=spec.why,
            run=slow,
        )

    started = asyncio.get_event_loop().time()
    try:
        token = bind_context(ctx)
        try:
            await run_swarm(
                ctx=ctx,
                question="Everything, please.",
                plan=_plan(*dispatched),
                writer=writer,
                model=StubChatModel(),
            )
        finally:
            clear_context(token)
    finally:
        roster_mod.BY_ID.clear()
        roster_mod.BY_ID.update(original)
    elapsed = asyncio.get_event_loop().time() - started

    assert len(writer.of("agent_start")) >= 40
    # 40 agents x 50ms serial would be 2s; concurrent, the gate of 8 makes it
    # ~250ms. Generous ceiling so a slow CI box does not fail the point.
    assert elapsed < 1.5, f"swarm looks serial: {elapsed:.2f}s"
