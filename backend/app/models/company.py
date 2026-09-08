"""Company: a corporate tenant of an office/coworking venue.

In the office vertical the paying unit is a *company*, not a person: one company
holds one or more seat contracts, its seat-holders sit under it, and it is billed
by B2B invoice. Gym/academy orgs never create rows here.
"""

from __future__ import annotations

from sqlmodel import Field

from app.models.base import TimestampModel, UUIDModel


class Company(UUIDModel, TimestampModel, table=True):
    __tablename__ = "companies"

    organization_id: str = Field(index=True, foreign_key="organizations.id")

    name: str
    contact_name: str | None = None
    contact_email: str | None = None
    contact_phone: str | None = None
    # Where invoices are emailed. Falls back to contact_email at send time.
    billing_email: str | None = None
    tax_id: str | None = None
    address: str | None = None
    notes: str | None = None

    # active | deactivated. Deactivating freezes seat-holder invites & new contracts.
    status: str = Field(default="active", index=True)
