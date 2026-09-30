"""Swarm vocabulary: what an agent is, and what it produces (ADR 019).

A *specialist* is a named, single-purpose analyst with a fixed remit. It is not
obliged to call a model: most of the roster is a plain async query over the
org's own tables, which is what keeps a 40-agent turn to a handful of model
calls instead of forty. The model-backed specialists are the eight where the
answer is a judgement rather than a number.

Nothing here knows about LangGraph. ``orchestrator`` drives these, and the graph
node calls the orchestrator — the same layering as the rest of ``app.agent``.
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field

from app.agent.context import AgentContext

# What a specialist may report. "skipped" is a real finding — an agent that had
# nothing to work on says so, and the UI shows it as a dash rather than hiding
# the row, so the tree always accounts for all forty.
STATUS_DONE = "done"
STATUS_SKIPPED = "skipped"
STATUS_FAILED = "failed"

# Summaries are read by an orchestrator (and, for the distil step, by a model).
# Long enough to carry a number and its context, short enough that forty of them
# still fit in one prompt.
FINDING_MAX = 400

# Evidence is read by a human in a scrollable panel rather than by a model, so
# the cap is generous — but it is a cap, because this is written to a JSON column
# on every swarm turn and an orchestrator's detail is its whole team's findings.
DETAIL_MAX = 4000


@dataclass
class Finding:
    """One specialist's answer to the sub-question it was given."""

    agent_id: str
    status: str
    summary: str
    # The evidence behind the summary, when there is any. A judgement agent's
    # summary is the model's conclusion, which is only trustworthy next to what
    # it was actually shown — so it carries the rows it read. Empty for a
    # deterministic specialist, whose summary *is* the raw figure.
    detail: str = ""


@dataclass(frozen=True)
class Domain:
    """One of the five orchestrator groups."""

    id: str
    name: str
    blurb: str


# (system_prompt, user_prompt) -> answer text. The orchestrator owns model
# construction; a specialist only knows how to ask. Tests inject a stub here.
AskFn = Callable[[str, str], Awaitable[str]]

# (context, ask, question) -> finding. ``question`` is the sub-question the
# planner wrote for this agent, which is what makes one specialist reusable
# across differently-worded turns.
RunFn = Callable[[AgentContext, AskFn, str], Awaitable[Finding]]


@dataclass(frozen=True)
class Specialist:
    """A named analyst on the roster."""

    id: str
    name: str
    domain: str
    # One line: what this agent is for. Shown beside its name in the UI.
    specialization: str
    # One line: when and why it gets dispatched. Shown when a row is expanded —
    # this is the "why this happens" the activity panel surfaces per agent.
    why: str
    run: RunFn
    # True when ``run`` calls the model, so the UI can mark it and the cost of a
    # turn stays auditable.
    model_backed: bool = False

    def as_frame(self) -> dict:
        """The ``agent_start`` payload the UI opens a row from."""

        return {
            "id": self.id,
            "name": self.name,
            "domain": self.domain,
            "role": "specialist",
            "specialization": self.specialization,
            "why": self.why,
            "model_backed": self.model_backed,
            # The lookup this agent performs, named like a call so the UI can
            # show what each one actually did. Every agent has one, including the
            # thirty-two that read the database rather than asking a model: the
            # work is a query, and "no tool call" would be a worse description of
            # it than naming the query.
            "tool": f"read_{self.id}",
        }

    def as_brief(self) -> dict:
        """The roster entry the planner picks from."""

        return {
            "id": self.id,
            "domain": self.domain,
            "name": self.name,
            "specialization": self.specialization,
        }


@dataclass
class Assignment:
    """The planner's decision for one specialist."""

    agent_id: str
    question: str


@dataclass
class AgentPlan:
    """How a turn should be answered.

    ``mode`` is the complexity gate: ``direct`` means the question did not
    warrant a swarm and the turn runs the ordinary ReAct path unchanged.

    ``reason`` is the planner's own one-line rationale, carried out of the plan
    so it can be shown as the turn's first thinking step. Without it the choice
    of forty agents over one is the only part of the turn with no visible
    reasoning behind it.

    ``planned`` records whether a model was actually consulted. It is False only
    under ``assistant_swarm_mode = "always"``, where the dispatch list is built
    without asking — and it exists so the turn's cost report can be counted
    rather than guessed.
    """

    mode: str
    agents: list[Assignment] = field(default_factory=list)
    reason: str = ""
    planned: bool = True

    @property
    def is_swarm(self) -> bool:
        return self.mode == "swarm" and bool(self.agents)

    def by_domain(self, roster: dict[str, Specialist]) -> dict[str, list[Assignment]]:
        """Group assignments by their specialist's domain, roster order intact."""

        grouped: dict[str, list[Assignment]] = {}
        for assignment in self.agents:
            specialist = roster.get(assignment.agent_id)
            if specialist is None:
                continue
            grouped.setdefault(specialist.domain, []).append(assignment)
        return grouped
