# ADR 007: Cash Payment Reconciliation

**Status:** Accepted

## Context
Front desk staff log cash payments from members throughout the day. At end of day, the system total must match the actual cash in the drawer. Discrepancies need to be tracked per staff member to detect theft or errors.

## Decision
Implement mandatory end-of-day cash reconciliation:

1. Front desk staff or admin initiates reconciliation from the app
2. System shows total cash payments logged that day
3. Staff counts actual cash and enters the amount
4. System compares and flags any discrepancy
5. Discrepancy is logged with the staff member's name
6. **3 discrepancies in 30 days** by the same staff member triggers an automatic alert to the gym owner

## Consequences
- Low-friction logging (search member, enter amount, confirm)
- Reconciliation is required — cannot be skipped
- Weekly discrepancy reports available by staff member
- Alert threshold prevents systemic issues from going unnoticed
- Receipt PDF auto-generated and emailed to member for their records
