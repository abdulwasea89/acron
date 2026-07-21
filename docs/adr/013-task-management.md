# ADR 013: Task Management

**Status:** Accepted

## Context
Gym owners and managers need to assign tasks to staff. Tasks have a title, description, deadline, and assignee. Mobile quick actions should support task creation.

## Decision
Simple task model with minimal state:

- Task entity: title, description, assignee, deadline, done flag
- No complex workflow (statuses are just done/not done)
- Owner and manager can assign tasks to any staff member
- Trainers can assign tasks to themselves only
- Tasks are scoped to the organization (tenant isolated)

## Consequences
- Simple and easy to implement — no state machine needed
- No notifications for task assignment yet (future enhancement)
- No recurring or template tasks in v1
- Tasks appear in the admin web and mobile quick-actions
