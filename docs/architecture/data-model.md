# Core Data Model

> Entities, relationships, and design rules for the Gym Operations Platform.

## Entities & Relationships

```
Organization (tenant root)
├── OrganizationMember (user + role + status per org)
│   ├── Shift (check-in/out records)
│   └── PayrollEntry (per-run compensation)
├── MembershipPlan (gym-defined pricing)
│   └── Subscription (member's active plan)
├── Payment (all money events)
│   └── ReceiptUpload (offline payment proof)
├── ClassSession (scheduled classes)
│   └── Booking (member booking)
├── Task (admin-created tasks)
├── CashReconciliation (end-of-day counts)
└── AuditLog (all state changes)

User (cross-tenant identity)
└── OrganizationMember (link to orgs)
```

## Key Design Rules
- Every entity has `organization_id` for tenant isolation
- Timestamps use naive UTC via `now_utc()` — frontend appends "Z"
- Soft deletes are avoided; hard delete + audit log instead
- All monetary values stored as integers (cents) or use `Numeric` precision
