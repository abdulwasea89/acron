# Runbook: assistant agent

Operations for the tool-using assistant (ADR 018). Read the ADR first for the
design; this is the "what to do when".

## Enabling the live model

The assistant degrades gracefully: with no key it answers from a deterministic
offline stub. To go live, set `GROQ_API_KEY` in `backend/.env`; the model id is
`assistant_model` (default `openai/gpt-oss-120b`). No other change is needed —
`app/agent/model.py` is the only place the provider is named.

## Confirmations (human-in-the-loop)

Writes pause the run at an `interrupt()` and surface a confirmation card. The
client resumes through `POST /api/v1/assistant/conversations/{id}/resume` with
`{"resume": {"approved": true|false}}`.

- Nothing is written before approval; a rejection leaves state unchanged.
- The confirmation is idempotent: replaying the same `Idempotency-Key` re-shows
  the prompt instead of starting a second run.
- **If a user reports "the assistant is stuck",** they are almost certainly
  looking at an unanswered confirmation card. Ask them to approve or reject it.

## Stuck or runaway runs

- Each turn is bounded by `assistant_recursion_limit` (default 25 super-steps).
  Exceeding it ends the run with an error frame rather than looping forever.
- Tool results are truncated; history is capped by `assistant_history_limit`.
- A process restart clears an **in-memory** checkpointer, so a paused run cannot
  be resumed. In production the Postgres saver keeps it; check the startup log
  for `Assistant checkpointer: Postgres` versus the fallback warning.

## Checkpoints

- Dev/tests use the in-memory saver. Production uses `AsyncPostgresSaver`,
  created lazily and closed on shutdown.
- Checkpoint tables accumulate over long threads. Add a retention job that
  deletes checkpoints older than the retention window, and never prune write
  rows an interrupted thread still depends on (see LangGraph's checkpointers
  guide).

## Budgets and cost

- `assistant_max_completion_tokens` caps output per model call.
- `gpt-oss-120b` does not support parallel tool calls, so each tool costs a
  full model round-trip. If cost or latency climbs, reduce the tool catalogue
  rather than the loop bound.
- Reasoning tokens are streamed as "thinking" but never persisted.

## Failure modes

| Symptom | Likely cause | Action |
| --- | --- | --- |
| Reply is the "offline stub" text | `GROQ_API_KEY` unset | Set the key and restart |
| `400 ... 'role:tool' content must be a string` | A tool returned a bare `list`/`dict` (an empty list becomes invalid content) | Tools must return ``as_tool_result(...)``; the model node also sanitizes blank tool content |
| Confirmation never resolves | Client did not POST `/resume` | Check the frontend resume proxy |
| "read-only because the subscription is past due" | Org `saas_status` is non-writable | Owner updates billing |
| Interrupt lost after deploy | Bytes were using the in-memory saver | Confirm Postgres checkpointer at startup |
