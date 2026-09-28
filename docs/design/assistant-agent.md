# Design: Assistant agent

> Working backwards from the owner's experience, then the smallest end-to-end
> slice that proves it. Reviewed before code (ADR 018).

## The owner experience

An owner opens the assistant and types: *"How much did we take last week, and
who's about to expire?"* The assistant looks up the revenue and the expiry list
with tools, answers with the real numbers, and shows which lookups it ran. Later
they type *"Refund Sam's last payment"*: the assistant shows a proposal —
payment, amount, reason — and the owner taps **Confirm**; only then does the
refund run, and it appears in the audit log with the owner as actor. Nothing the
assistant does can read another gym's data, and no write happens without a tap.

## Problem / customer outcome

- **Problem:** the phase-1 assistant only describes a static snapshot; it cannot
  answer time-ranged or record-level questions and cannot act.
- **Outcome:** sourced answers over live data, plus guarded writes, without
  weakening tenant isolation or the "zero double-charge" guarantee.

## Options considered

| Option | Verdict |
| --- | --- |
| Expand the snapshot prompt | Rejected: stale, token-heavy, still no writes. |
| LangGraph agent, tools over existing services | **Chosen** (ADR 018). |
| Raw function-calling with a hand-rolled loop | Rejected: we would rebuild checkpointing, interrupts, and streaming. |

## Scope of the first slice (Phase 0 + 1a)

In: the `agent/` package, a minimal graph (`guardrail → model ⇄ tools`), the
model factory with stub fallback, the minimal prompt, two read tools
(`get_headline_metrics`, `search_members`), and the route wired to the graph with
existing SSE frames.

Out (explicitly): write tools, the resume endpoint, Postgres checkpointing,
subgraphs, evals. Those are Phases 3–5.

## Risks

- **Double execution on resume.** Mitigated: writes are idempotent and are only
  introduced in Phase 3.
- **Provider coupling.** Mitigated: one factory names the provider.
- **Prompt injection via tool output.** Mitigated: tool output is delimited as
  data; tested in Phase 5.
