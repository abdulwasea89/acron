# ADR 019: A specialist swarm as the assistant's second execution path

**Status:** Accepted — supersedes ADR 018 §1 and §5

## Context

ADR 018 made the assistant a single ReAct agent: one model, 19 tools, a serial
loop, and an activity panel that showed the turn's reasoning and tool calls.

That is the right shape for the questions the assistant mostly gets — "how many
members do I have", "show me pending receipts" — and it should keep answering
them. It is the wrong shape for the questions that make a gym owner open a chat
in the first place: *"how is the business actually doing"*, *"why did revenue
drop last month"*. Those are not lookups. They are several small analyses whose
answers only mean something together, and a serial tool loop answers them either
slowly or not at all — nineteen sequential round-trips is both the latency and
the reason the model stops before it has looked at everything.

The product ask is explicit: **~40 specialists running concurrently, grouped
under 5 orchestrators, with 1 lead agent summarising, and every one of them
visible in the UI with its reasoning and its specialization.**

## Decision

### 1. A second execution path, chosen per turn — not a replacement

ADR 018 §1 is superseded only in that the single-ReAct-agent shape is no longer
the *only* topology. It remains the default. A planner node now sits between the
guardrail and the model:

```
START → guardrail → (blocked? END : planner)
planner → swarm   (cross-cutting question: fan out, then summarise)
planner → model   (everything else: the existing ReAct loop, unchanged)
```

`settings.assistant_swarm_mode` is `auto` (the planner decides), `always` (all
forty, for demos), or `off` (no planner call at all — not a call that always
says no, so the setting costs nothing).

The gate is not a nicety. Forty model calls to answer "how many members do I
have" is a worse product: slower, dearer, and less accurate than one. A swarm
that fires on every message is a swarm nobody keeps.

But the gate is on the **size**, not on the swarm. The planner is asked how many
specialists the question needs, and one is a valid answer — "how many members do
I have" is one analyst's entire remit, so it dispatches one. There is no floor
and no target. A floor would be the wrong answer to the only question that
matters here, and it would be visible: every agent dispatched is a row the user
reads, so padding the list to look thorough is not a private inefficiency.

### 2. A specialist is not obliged to call a model

This is what makes forty agents affordable. Thirty-two of the forty roster
entries are a single read-only aggregate over the org's own tables — exact,
effectively free, and returning the same number the dashboard shows, because
they read the same services and columns. The remaining eight are the ones where
the answer is a judgement rather than a number (churn risk, receipt fraud,
schedule conflicts, audit anomalies, pricing coherence, collections severity,
idempotency health, data quality); those gather their own evidence first and then
ask.

A full swarm turn is therefore **~7 model calls** (1 planner + 5 domain digests
+ 1 summariser) plus whichever judgement specialists were actually dispatched —
not forty.

### 3. Concurrency supplies the parallelism, not the provider

ADR 018 §5 records that `gpt-oss-120b` does not support parallel tool calls on
Groq, and that limitation stands — *within one agent*. It is now scoped rather
than global: the swarm's forty agents run concurrently under `asyncio.gather`
behind a semaphore, so wall-clock is the slowest specialist, not the sum. The
provider's serial-tool constraint is irrelevant to a design that never asks one
agent to call two tools at once.

The semaphore bound (8) is about the shared `AsyncSession`, not CPU: an
`AsyncSession` is not safe for concurrent use, so every deterministic specialist
must be read-only. `swarm/queries.py` is where that invariant lives, and it is
enforced by construction — there is no write helper to reach for.

### 4. Four phases

1. **Plan** (1 call). The roster — id, domain, name, specialization — is the
   menu. The planner returns `{"mode": "direct"|"swarm", "reason": "...",
   "agents": [...]}`, each agent with its own sub-question, and **however many it
   judges the question needs, from one to forty**. Ids it invents are dropped
   rather than trusted, and an unparseable plan degrades to `direct`: a bad plan
   should cost the user a swarm, never their answer. `direct` is reserved for
   questions no specialist can help with — a greeting, a question about the
   assistant itself — rather than for small ones, which now get a small swarm.
2. **Fan out.** Every chosen specialist runs concurrently. Each failure is
   converted into a `failed` finding — one bad query out of forty must not cost
   the turn, and the UI has a row for exactly that.
3. **Distil** (5 calls, concurrent). Each orchestrator reads only its own team's
   findings and writes a digest. This is what makes it an orchestrator rather
   than a `gather`: forty raw findings do not fit in a prompt, five digests do.
4. **Summarise** (1 call). The lead agent answers from the five digests and
   streams as `delta` frames, so the answer types out exactly as it does on the
   direct path.

### 4a. The turn's own reasoning is part of the tree, not just its rows

The rows say what each agent found. They do not say why this shape was chosen,
or what the lead agent made of five digests — and those are the two judgements
the turn actually turns on. Both are now emitted as `thinking`, the same frame
the direct path already uses:

- The **planner's rationale** returns as a `reason` field on the plan, survives
  in the `swarm_plan` channel, and is written as the turn's first thinking step.
  "Forty agents ran" is not self-justifying, and without this the choice looks
  like it was made by nobody.
- The **lead agent's trace** is forwarded from the summariser's stream. It was
  dropped — `_summarise` read only `chunk.content` — which is why a swarm turn
  showed no thinking at all while a direct turn showed plenty. The two paths now
  split reasoning and answer identically, and share one `_reasoning` helper
  (duplicated rather than imported: `graph` imports the swarm, so reaching back
  would close a cycle).

Per-agent deliberation rides on `detail`, not on `thinking`: a judgement agent's
summary is the model's *reading* of rows it was shown, and a reading is only
checkable against what it read, so the evidence travels with the conclusion. An
orchestrator carries its team's raw findings for the same reason. That is what
"the agents think a lot" has to mean in a design whose whole cost argument is
that thirty-two of forty agents are a single query — inventing a reasoning trace
for a `COUNT(*)` would be theatre, so the honesty is in showing the rows instead.

### 4b. The turn reports what it cost

`swarm_stats` closes the fan-out: agents, domains, total, model calls, the
done/skipped/failed split, the fan-out's own duration, and `turn_ms` — the whole
turn, planner to answer. The model calls go through one funnel (`_ask_fn`) that
increments a tally, so the number is the number the turn made rather than an
estimate.

Two of those fields reach the UI and the rest do not. The header reads
`Worked · 45 agents` with the duration on the line below, and that is the entire
display: an earlier revision also rendered a row of counters (`13 model calls`,
`10.6s fan-out`, `26 reported`, `14 no data`) above the tree, and it competed
with the header for the same glance. The counts are still recorded — they are
what the cost argument rests on, and they cost nothing to store — but a header
that says two things beats one that says seven.

`turn_ms` is the reason the frame is emitted **last**, after the summariser has
streamed its answer: the number does not exist until then. It is measured from
`turn_started_at`, recorded in the graph's `plan_node` before the planner runs,
so the duration covers the planner too — a header that said "3s" while the
planner took two of them would be reporting the wrong turn. The reason to send
it at all is that the client already runs a stopwatch, and that stopwatch starts
when the panel mounts and dies with the page; a reloaded thread would otherwise
show no duration at all. `swarm_stats` is stored as its own `swarm` step, so a
thread written last week renders its seconds exactly like one written now.

### 5. The tree is a first-class part of the contract

Two frames carry it: `agent_start` (id, name, domain, role, specialization, why,
tool) and `agent_done` (id, status, summary, detail, ms). The five orchestrators
are announced with the same frames, flagged `role: "orchestrator"` — they are
agents in the picture the product asked for, they just start after their team.

Every row carries a `tool` — the lookup that agent performed, named like a call
(`read_member_growth`, `distil_revenue`). This is the swarm's counterpart to the
assistant's tool steps, and it exists because the two are easy to confuse: a
swarm turn emits **no** `tool_start`/`tool_result` frames at all, since its
agents read the database through the service layer rather than through the
nineteen tools, which only run inside the ReAct loop. A UI that showed tool
activity on the direct path and silence on the swarm path looked like a
regression. The label is per agent rather than per turn, and it is on all forty
rows rather than only the eight that reach a model: thirty-two rows with a name
and eight without reads as a defect, not as a cost breakdown.

`agent_done` is matched **by id**, unlike the existing `finishTool`, which walks
back to the newest unfinished step. That difference is load-bearing: tools run
one at a time so position is a valid correlation, but the swarm's agents run
concurrently and settle out of order, so position would hang a finding on
whichever agent happened to start last.

Steps persist as a fourth `AssistantStep` variant (`type: "agent"`, plus
`type: "swarm"` for the stats row) alongside `thinking` and `tool`. No
migration: `MessageOut.steps` is already `list[dict]` and the column is JSON, so
a thread written before this change and one written after both render.

### 6. The roster is not given the chance to be careless

Forty specialist prompts is forty opportunities to leak a tenant. Every entry
obeys ADR 018 §3 unchanged: none takes an `org_id`, and all read scope from
`current_context()`. `test_swarm.py` asserts this by inspecting the signature of
every `run` in the roster — a new specialist that accepts a scope argument fails
the suite rather than reaching production.

## Consequences

- **Positive:** cross-cutting questions get answered from evidence rather than
  from whatever the model happened to look at; the work behind an answer is
  visible and attributable per agent; the direct path is untouched, so simple
  lookups keep their current latency and cost.
- **Cost:** the swarm adds two serial model round-trips (plan, then summarise)
  before and after the fan-out. On a twenty-agent turn that is still net-faster
  than twenty serial tool calls; on a three-agent turn it is slower, which is the
  entire argument for the `direct` path existing.
- **New failure modes:** partial fan-out failure (handled — `failed` findings),
  planner hallucinating agent ids (handled — dropped), concurrent reads against
  one session (bounded by semaphore; write helpers deliberately absent).
- **New client contract:** three swarm-specific SSE frames (`agent_start`,
  `agent_done`, `swarm_stats`) plus the `thinking` frames the direct path already
  sent, and two stored step variants (`agent`, `swarm`). Older clients ignore
  unknown frames and unknown step types, so a mixed-version deploy degrades to
  "the tree does not appear" rather than to an error.
- **Not built:** the roster's specialists are single-query analysts. None of them
  chains, retries, or deliberates, and none writes. If a future specialist needs
  to write, it goes through the ADR 018 `interrupt()` gate, not through the
  swarm's concurrency.
