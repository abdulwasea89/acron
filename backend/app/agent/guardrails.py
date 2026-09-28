"""Deterministic input guardrail (ADR 018).

A cheap, predictable filter that runs before the model. It is not the main
safety mechanism — tenant scoping and write confirmation are — but it stops the
obvious cases early and for free. Model-based checks and PII handling are later
phases; this node stays a pure function with no side effects.
"""

from __future__ import annotations

from langchain_core.messages import AIMessage

from app.agent.state import AgentState

# Deliberately tiny and literal. Semantic filtering is a model-based guardrail,
# which is slower and belongs in a later layer, not here.
_BANNED = (
    "ignore previous instructions",
    "ignore all previous",
    "disregard your instructions",
    "reveal your system prompt",
    "print your system prompt",
)

_REFUSAL = (
    "I can't help with that request. I can answer questions about your "
    "organization's members, revenue, plans, and payroll."
)


def input_guardrail(state: AgentState) -> dict:
    """Refuse obviously adversarial input before paying for a model call."""

    last = state["messages"][-1] if state["messages"] else None
    text = (getattr(last, "content", "") or "").lower() if last else ""
    if any(phrase in text for phrase in _BANNED):
        return {"blocked": True, "messages": [AIMessage(content=_REFUSAL)]}
    return {"blocked": False}
