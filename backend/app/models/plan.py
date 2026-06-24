"""MembershipPlan: owner-defined plans members subscribe to (Section 6).

Plans are 100% owner-defined (not platform templates). They carry pricing, tax
handling, billing type, inclusions/rules (stored as JSON strings), visibility,
and lifecycle status. Editing price never repricing existing members (Section
6.7) — that is enforced in the service by snapshotting price onto Subscription.
"""

from __future__ import annotations

from sqlmodel import Field

from app.core.constants import PlanBillingType, PlanStatus, PlanVisibility, TaxMode
from app.models.base import TimestampModel, UUIDModel


class MembershipPlan(UUIDModel, TimestampModel, table=True):
    __tablename__ = "membership_plans"

    organization_id: str = Field(index=True, foreign_key="organizations.id")

    # Basics (Section 6.1)
    name: str
    public_description: str | None = None
    internal_notes: str | None = None

    # Pricing (Section 6.2)
    price: float = 0.0
    currency: str = "USD"
    tax_mode: TaxMode = Field(default=TaxMode.INCLUSIVE)
    tax_rate: float = 0.0  # fraction, applies when tax_mode == ADDED

    # Billing type (Section 6.3)
    billing_type: PlanBillingType = Field(default=PlanBillingType.RECURRING)
    cycle_length: int | None = None      # for recurring
    cycle_unit: str | None = None        # day/week/month
    auto_renew: bool = True
    trial_days: int = 0
    pack_size: int | None = None         # for one_time_pack (N classes)
    validity_days: int | None = None     # pack validity window

    # Inclusions & rules stored as JSON strings (Section 6.4 / 6.5)
    inclusions_json: str | None = None
    rules_json: str | None = None

    # Visibility & lifecycle (Section 6.6 / 6.7)
    visibility: PlanVisibility = Field(default=PlanVisibility.PUBLIC)
    status: PlanStatus = Field(default=PlanStatus.DRAFT, index=True)
    featured: bool = False

    # When archived, members migrate to this plan at next renewal (Section 6.7)
    replacement_plan_id: str | None = Field(default=None, foreign_key="membership_plans.id")
