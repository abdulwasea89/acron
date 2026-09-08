"""Office vertical: desk/room slot schemas.

Space slots are ClassSession rows with ``category="space_slot"`` shared with gym
classes and academy lessons — one scheduling table. Booking delegates to the
classes booking machinery (idempotent, capacity-gated).
"""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class SpaceSlotCreate(BaseModel):
    title: str  # e.g. "Meeting Room A", "Desk 14"
    starts_at: datetime
    ends_at: datetime | None = None
    capacity: int = 1


class SpaceBookingCreate(BaseModel):
    slot_id: str


class SpaceSlotOut(BaseModel):
    id: str
    category: str
    title: str
    starts_at: datetime
    ends_at: datetime | None
    capacity: int
    booked_count: int
    cancelled: bool


class SpaceBookingOut(BaseModel):
    """A seat-holder's space booking joined with its slot (self-service)."""

    booking_id: str
    status: str
    slot: SpaceSlotOut
