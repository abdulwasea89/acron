"""Walk-ins, day passes, guest log and lockers (Section 1.3, #22).

A ``Visitor`` is a non-member at the front desk: a day-pass buyer, a guest of a
member, a trial, or a plain walk-in. The guest log is the list of them. A day
pass with a price also records a ``Payment`` (kind=day_pass) so front-desk money
lands in the same ledger as everything else.

``Locker`` is the facility register: a numbered locker that can be assigned to a
holder and released. Tenant-scoped on both (Security Rule #1).
"""

from __future__ import annotations

from datetime import datetime

from sqlmodel import Field, UniqueConstraint

from app.core.constants import LockerStatus, PaymentMethod, VisitorKind
from app.models.base import TimestampModel, UUIDModel, utcnow


class Visitor(UUIDModel, TimestampModel, table=True):
    __tablename__ = "visitors"

    organization_id: str = Field(index=True, foreign_key="organizations.id")

    name: str
    phone: str | None = None
    email: str | None = None

    kind: VisitorKind = Field(default=VisitorKind.WALK_IN, index=True)
    # Set when the visitor is a guest of an existing member.
    host_member_id: str | None = Field(default=None, foreign_key="organization_members.id")

    # Day-pass money (kind=day_pass). Kept on the visitor too so the desk sees it
    # without joining the payment ledger.
    amount: float = 0.0
    method: PaymentMethod | None = Field(default=None)
    payment_id: str | None = Field(default=None, foreign_key="payments.id")
    paid: bool = False

    locker_number: str | None = None
    note: str | None = None

    checked_in_at: datetime = Field(default_factory=utcnow, index=True)
    checked_out_at: datetime | None = None

    logged_by: str | None = Field(default=None, foreign_key="users.id")
    idempotency_key: str | None = Field(default=None, index=True)


class Locker(UUIDModel, TimestampModel, table=True):
    __tablename__ = "lockers"
    __table_args__ = (
        UniqueConstraint("organization_id", "number", name="uq_lockers_org_number"),
    )

    organization_id: str = Field(index=True, foreign_key="organizations.id")
    number: str = Field(index=True)
    status: LockerStatus = Field(default=LockerStatus.FREE, index=True)

    # Free-text holder name (member, visitor, whoever holds the key).
    holder_label: str | None = None
    assigned_at: datetime | None = None
    note: str | None = None
