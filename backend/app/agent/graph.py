"""Assemble the assistant graph (ADR 018, extended by ADR 019).

Two ways to answer a turn, chosen by the planner:

    START → guardrail → (blocked? END : planner)
    planner → swarm      (a cross-cutting question: fan out, then summarise)
    planner → model      (everything else: the ordinary ReAct loop)
    model  ⇄ tools       ... → END
    swarm                ... → END

The direct path is untouched — same nodes, same edges, same frames. The swarm is
a second terminal branch, not a replacement, so a simple lookup still costs one
model call and the frames the UI already understands still arrive.
"""

from __future__ import annotations

import time
from collections.abc import Sequence
from typing import Any

from langchain_core.messages import AIMessage
from langgraph.config import get_stream_writer
from langgraph.graph import END, START, StateGraph
from langgraph.prebuilt import ToolNode

from app.agent.context import current_context
from app.agent.guardrails import input_guardrail
from app.agent.model import build_chat_model
from app.agent.state import AgentState
from app.agent.swarm import BY_ID, AgentPlan, Assignment, plan_turn, run_swarm
from app.agent.tools import ALL_TOOLS
from app.core.config import settings


def _stream_writer() -> Any:
    """The custom-mode writer, or a no-op when the run is not streaming custom."""

    try:
        return get_stream_writer()
    except Exception:  # noqa: BLE001 — outside a streaming run there is no writer
        return lambda _payload: None


def _reasoning(chunk: Any) -> str | None:
    """Reasoning text from a chunk, across the keys providers use.

    gpt-oss emits a reasoning trace before its answer; forwarding it keeps the
    UI alive during the longest part of the wait.
    """

    extra = getattr(chunk, "additional_kwargs", None) or {}
    return extra.get("reasoning_content") or extra.get("reasoning")


def _sanitize(messages: list[Any]) -> list[Any]:
    """Guarantee no ``role:tool`` message reaches the provider with blank content.

    A tool that returns an empty value yields a ToolMessage whose content is
    empty — or, worse, ``[]`` — which providers reject as invalid ("must be a
    string or at least one item"). Tools now return JSON strings, but a blank
    output must never take the whole run down, so the boundary is guarded here.
    """

    clean: list[Any] = []
    for message in messages:
        if getattr(message, "type", None) == "tool" and not getattr(message, "content", None):
            message = message.model_copy(update={"content": "(no output)"})
        clean.append(message)
    return clean


def build_graph(*, checkpointer: Any, script: Sequence[AIMessage] | None = None) -> Any:
    """Compile the assistant graph for one run.

    ``script`` is a test seam forwarded to the model factory (see
    ``app.agent.model``). The graph is rebuilt per run so a test can swap the
    model; compilation is cheap and the checkpointer is shared.
    """

    model = build_chat_model(script=script).bind_tools(ALL_TOOLS)
    # The swarm needs a model with no tools bound: its agents query the database
    # directly, and the planner must answer with JSON rather than reach for a
    # tool. A second unbound instance keeps the two roles from bleeding — and it
    # is built lazily, so a direct turn never constructs one it won't use.
    planning = _should_plan()
    swarm_model = build_chat_model(script=script) if planning else None
    tools_node = ToolNode(ALL_TOOLS)

    async def call_model(state: AgentState) -> dict:
        writer = _stream_writer()
        chunks: list[Any] = []
        async for chunk in model.astream(_sanitize(state["messages"])):
            chunks.append(chunk)
            if chunk.content:
                writer({"delta": str(chunk.content)})
            if reasoning := _reasoning(chunk):
                writer({"thinking": reasoning})
        if not chunks:
            return {"messages": [AIMessage(content="")]}
        message = chunks[0]
        for extra in chunks[1:]:
            message = message + extra
        return {"messages": [message]}

    async def plan_node(state: AgentState) -> dict:
        """Decide the turn's shape, and record it in state.

        ``off`` skips the planner entirely — not a planning call that always
        says no, but no call at all, so this setting cannot cost a round-trip.
        """

        question = _last_human(state)
        if not planning or not question:
            return {"swarm_plan": None}
        started = time.monotonic()
        if settings.assistant_swarm_mode == "always":
            plan = AgentPlan(
                mode="swarm",
                agents=[Assignment(agent_id=s.id, question=question) for s in BY_ID.values()],
                reason="Every specialist was dispatched, because the swarm is switched on for all turns.",
                planned=False,
            )
        else:
            plan = await plan_turn(question, swarm_model)
        if not plan.is_swarm:
            return {"swarm_plan": None}
        return {
            "swarm_plan": {
                "reason": plan.reason,
                "planned": plan.planned,
                "agents": [
                    {"agent_id": a.agent_id, "question": a.question} for a in plan.agents
                ],
            },
            "turn_started_at": started,
        }

    async def swarm_node(state: AgentState) -> dict:
        """Fan out the planned specialists and answer from their findings.

        The answer is appended as a plain ``AIMessage`` so the graph's terminal
        contract is identical on both paths — the service, the checkpointer and
        the persisted turn do not need to know which branch ran.
        """

        planned = state.get("swarm_plan") or {}
        plan = AgentPlan(
            mode="swarm",
            agents=[
                Assignment(agent_id=entry["agent_id"], question=entry["question"])
                for entry in planned.get("agents") or []
            ],
            reason=planned.get("reason") or "",
            planned=bool(planned.get("planned", True)),
        )
        answer = await run_swarm(
            ctx=current_context(),
            question=_last_human(state),
            plan=plan,
            writer=_stream_writer(),
            model=swarm_model,
            started=state.get("turn_started_at"),
        )
        return {"messages": [AIMessage(content=answer)]}

    def after_guardrail(state: AgentState) -> str:
        return END if state.get("blocked") else "planner"

    def after_plan(state: AgentState) -> str:
        return "swarm" if state.get("swarm_plan") else "model"

    def should_continue(state: AgentState) -> str:
        last = state["messages"][-1]
        return "tools" if getattr(last, "tool_calls", None) else END

    builder = StateGraph(AgentState)
    builder.add_node("guardrail", input_guardrail)
    builder.add_node("planner", plan_node)
    builder.add_node("model", call_model)
    builder.add_node("swarm", swarm_node)
    builder.add_node("tools", tools_node)
    builder.add_edge(START, "guardrail")
    builder.add_conditional_edges("guardrail", after_guardrail, {"planner": "planner", END: END})
    builder.add_conditional_edges("planner", after_plan, {"swarm": "swarm", "model": "model"})
    builder.add_edge("swarm", END)
    builder.add_conditional_edges("model", should_continue, {"tools": "tools", END: END})
    builder.add_edge("tools", "model")
    return builder.compile(checkpointer=checkpointer)


def _last_human(state: AgentState) -> str:
    """The turn's question — the newest human message, as text."""

    for message in reversed(state["messages"]):
        if getattr(message, "type", None) == "human":
            return str(getattr(message, "content", "") or "")
    return ""


def _should_plan() -> bool:
    """Whether this process can plan a swarm at all (ADR 019).

    In ``auto`` the planner is a model call, so with no provider configured
    there is nothing to plan with — the deterministic stub cannot route, and
    spending a call to be told "direct" only slows the turn down. ``always`` is
    the exception: it is the explicit "swarm regardless" switch, used to
    exercise the path without a vendor account.
    """

    if settings.assistant_swarm_mode == "off":
        return False
    if settings.assistant_swarm_mode == "always":
        return True
    return settings.assistant_live
