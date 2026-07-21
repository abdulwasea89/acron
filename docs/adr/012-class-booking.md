# ADR 012: Class Booking System

**Status:** Accepted

## Context
Gyms schedule classes with trainers. Members need to book spots. Trainers need to check in for their shifts and mark attendance.

## Decision
Build on a simple session + booking model:

- **ClassSession** — title, trainer, start/end time, capacity, cancellation flag
- **Booking** — links a member to a class session with status (confirmed / cancelled / no-show)
- Capacity is enforced at booking time — if `booked_count >= capacity`, new bookings are rejected
- Trainers check in independently via the shift system (not tied to class start)
- Cancelled classes refund bookings or allow transfer to another session

## Consequences
- No recurring class templates — each session is created individually (or via bulk create)
- Capacity enforcement prevents overbooking
- Trainer check-in is separate from class attendance tracking
- Awaiting feature: recurring class patterns and waitlists
