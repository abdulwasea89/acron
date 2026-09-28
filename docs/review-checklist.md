# Review checklist

Adapted from Google's engineering practices ("What to look for in a code
review"). The standard is **code health**: approve when the change definitely
improves the system, even if it is not perfect. Mark optional polish with
**`Nit:`**.

Review in this order, and price the design before the details.

1. **Design** — does the change belong here, integrate cleanly, and is now the
   right time?
2. **Functionality** — does it do what was intended, and is that good for users?
   Think edge cases and concurrency. Pay special attention to UI changes.
3. **Complexity** — is it more complex than needed? Flag over-engineering;
   solve the problem we have now, not one we speculate about.
4. **Tests** — do they ship with the change, are they correct, and would they
   fail if the code broke?
5. **Naming** — do names fully communicate without being unwieldy?
6. **Comments** — do they explain *why*? Are the stale ones removed?
7. **Style** — handled by `ruff`/`mypy`/`tsc`; do not debate it in review.
8. **Consistency** — match surrounding code unless that worsens health.
9. **Documentation** — if the change alters how someone builds, tests,
   interacts with, or releases the code, the docs changed too.
10. **Every line** — read the code, not just the diff. Ask for clarity rather
    than guessing.

## Acron additions (money + tenant paths)

For anything touching money, tenancy, or the assistant:

- **Tenant scope** — every query is org-scoped as its first predicate.
- **Idempotency** — state changes carry a key; replays return the first result.
- **Audit** — state changes write an `audit_logs` row with an actor.
- **Capability** — the route enforces the capability before the service runs.
- **No invented numbers** — assistant figures trace to a tool result.

Also: tell the author what was good, not only what was wrong.
