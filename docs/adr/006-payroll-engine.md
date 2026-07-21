# ADR 006: Trainer Payroll Calculation Engine

**Status:** Accepted

## Context
Gyms pay trainers using multiple compensation methods: fixed salary, hourly wages, per-class rates, and commissions. These components stack per trainer. The system must calculate net pay, generate pay stubs, and track payment execution.

## Decision
Use a **stackable compensation model** per trainer:

- Every trainer has four rate fields: `fixed_monthly_salary`, `hourly_rate`, `per_class_rate`, `commission_rate`
- At payroll run time, the engine calculates each component independently and sums them
- Hours are tracked via shift check-in/check-out
- Classes are counted only if the trainer actually checked in
- Commission is calculated as a percentage of revenue from referred members (12-month attribution window)

## Payroll Run Sequence
1. Auto-generate draft for all active staff
2. Owner reviews, adds bonuses, edits deductions (each change requires a note)
3. Lock on finalize — no more edits
4. Generate per-trainer pay stub PDFs
5. Execute payments (bank transfer CSV, cash, or mobile wallet)

## Consequences
- Simple per-trainer data model (four rate fields on OrganizationMember)
- Clear audit trail via notes on manual changes
- Commission attribution has a fixed 12-month window — no clawbacks
- Pay stubs are stored as PDFs in S3/R2
