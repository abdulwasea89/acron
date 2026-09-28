"""Assistant agent package (ADR 018).

The agent is a LangGraph ``StateGraph``: a deterministic tenant guardrail, an
LLM node with tools bound, and a tool node. It reads live org data through
tools that wrap the same services the dashboard uses, and performs guarded
writes behind human confirmation.

Modules:

* ``context``  — request-scoped org/user/role + DB session, carried by a
  ``ContextVar`` so tool signatures never mention ``org_id``.
* ``state``    — the graph state (messages + accumulated tool trace).
* ``model``    — the one place a provider is named; stub fallback offline.
* ``prompts``  — the minimal system prompt (identity + policy only).
* ``tools``    — read tools and interrupt-guarded write tools.
* ``guardrails`` — deterministic pre-model checks.
* ``graph``    — composes the nodes into a compiled graph.
* ``service``  — the API the route calls: run a turn, resume an interrupt.
"""

from __future__ import annotations
