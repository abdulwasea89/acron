"""Graph state for the assistant agent.

``MessagesState`` supplies the ``messages`` channel with the ``add_messages``
reducer (append, and update-by-id on resume). The one added channel, ``blocked``,
lets the input guardrail short-circuit the graph to END before a model call.
Tool activity is read from the message stream rather than stored separately, so
there is no second source of truth to keep in sync.

``swarm_plan`` is the second added channel (ADR 019): the planner writes the
specialists it wants dispatched, or ``None`` when the turn should take the
ordinary ReAct path. It is passed as plain dicts rather than ``Assignment``
objects because graph state is checkpointed, and a plan is short-lived
scaffolding that should not need to survive as a typed object. It carries the
planner's reasoning alongside the dispatch list, because the swarm node emits
that reasoning as the turn's first thinking step and would otherwise have to
re-derive a decision it was not party to.
"""

from __future__ import annotations

from typing import TypedDict

from langgraph.graph import MessagesState


class SwarmPlan(TypedDict):
    """A planned fan-out: why, whether a model chose it, and who."""

    reason: str
    planned: bool
    agents: list[dict]


class AgentState(MessagesState):
    """State threaded through the assistant graph."""

    # Set by the input guardrail when a request is refused before the model runs.
    blocked: bool

    # The swarm's dispatch list and its rationale, or None for the direct path.
    swarm_plan: SwarmPlan | None

    # Wall-clock start of the turn, as ``time.monotonic()``. Recorded here rather
    # than inside the swarm so the duration the UI reports covers the planner
    # too — a turn whose header said "3s" while the planner took two of them
    # would be reporting the wrong number.
    turn_started_at: float | None
