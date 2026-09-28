# Documentation style

Adapted from the Google developer documentation style guide and the Microsoft
Writing Style Guide. These rules apply to hand-written docs (`docs/**`, module
docstrings, READMEs). Generated reference (OpenAPI) is authoritative for
endpoints; hand-written docs link to it rather than restating it.

## Voice

- **Second person** ("you"), **active voice**, present tense.
- **Conditions before instructions**: "If the run is stuck, ...", not "Do X,
  if the run is stuck."
- Conversational but not frivolous. "Make every word matter."
- Write for a **global audience**: avoid idioms, cultural references, and
  ambiguous dates (write `2026-01-31`, not `1/31`).

## Structure (Diátaxis)

| Kind | Where | Answers |
| --- | --- | --- |
| Explanation | `docs/adr/`, `docs/design/` | Why did we decide this? |
| How-to | `docs/setup/`, runbooks | How do I do this task? |
| Reference | `docs/api.md`, generated OpenAPI | What are the exact fields? |
| Tutorial | README / AGENTS.md | Walk me through it once. |

## Formatting

- Sentence case for titles and headings.
- Numbered lists for sequences; bullets otherwise; serial commas.
- Code in `code font`; UI elements in **bold**.
- Descriptive link text ("see ADR 018"), never "click here".
- No "currently" / "soon" / "will be" — documentation is timeless.

## Code comments

- Comments explain **why** (constraints, tradeoffs, invariants), not **what**.
- Module docstrings state purpose, why it exists, and invariants.
- Cite the source of truth: `Security Rule #1`, `ADR 018`, `§10.8`.
- Never narrate code; delete a comment a better name would replace.
- A stale comment is a bug: update or delete it in the same change.
