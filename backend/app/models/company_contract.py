"""CompanyContract: a company's space commitment for a block of seats.

Signed against a *published space plan* (offer_kind="space"). The per-seat price
and term are snapshotted from the plan + its spec at signing so later plan edits
never reprice an existing contract (mirrors the Subscription price-snapshot
rule). Contract money for a billing period = seats x price_per_seat.
"""

from __future__ import annotations

from datetime import date

from sqlmodel import Field

from app.models.base import TimestampModel, UUIDModel


class CompanyContract(UUIDModel, TimestampModel, table=True):
    __tablename__ = "company_contracts"

    organization_id: str = Field(index=True, foreign_key="organizations.id")
    company_id: str = Field(index=True, foreign_key="companies.id")
    plan_id: str = Field(foreign_key="membership_plans.id")

    # Snapshot of the offer at signing.
    seats: int
    price_per_seat: float
    currency: str = "USD"
    # monthly | quarterly | annual — copied from the plan spec.
    term: str
    # Room-booking credits granted for this term (spec.room_credits), drawn down
    # when seat-holders book meeting-room slots.
    room_credits_remaining: int = 0

    start_date: date
    end_date: date | None = None  # set when the contract is ended early
    next_billing_at: date  # when the next term's invoice falls due

    notes: str | None = None

    # active | ended
    status: str = Field(default="active", index=True)
