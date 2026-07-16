"""Organization (tenant root) and per-org settings.

An Organization is one gym. It is the tenant boundary: nearly every other row
carries ``organization_id`` pointing here. Section 1, 3, 4, 7.
"""

from __future__ import annotations

from datetime import datetime

from sqlmodel import Field

from app.core.constants import (
    ConnectStatus,
    EnrollmentMode,
    GymStatus,
    SaasStatus,
    SaasTier,
)
from app.models.base import TimestampModel, UUIDModel


class Organization(UUIDModel, TimestampModel, table=True):
    __tablename__ = "organizations"

    # Identity
    name: str
    org_code: str = Field(index=True, unique=True)  # e.g. IRON-PULS-3K9
    industry: str = "gym_fitness"

    # Locale / branding (Section 4.4)
    country: str = "US"
    timezone: str = "UTC"
    default_currency: str = "USD"
    address: str | None = None
    logo_url: str | None = None
    accent_color: str | None = None
    working_hours: str | None = None  # JSON string of per-day hours

    # SaaS subscription (Section 3)
    saas_tier: SaasTier = Field(default=SaasTier.STARTER)
    saas_status: SaasStatus = Field(default=SaasStatus.TRIALING)
    member_cap: int | None = None  # null = unlimited (Enterprise)
    stripe_customer_id: str | None = None
    stripe_subscription_id: str | None = None
    saas_current_period_end: datetime | None = None
    saas_grace_until: datetime | None = None

    # Stripe Connect for member payments (Section 4.9)
    stripe_connect_account_id: str | None = None
    stripe_connect_status: ConnectStatus = Field(default=ConnectStatus.NONE)

    # Enrollment & operations (Section 7)
    enrollment_mode: EnrollmentMode = Field(default=EnrollmentMode.OPEN)
    gym_status: GymStatus = Field(default=GymStatus.OPEN)
    mfa_required: bool = False
    require_member_profile: bool = True

    # Setup checklist flags (Section 4.8)
    checklist_stripe_connected: bool = False
    checklist_plan_published: bool = False
    checklist_enrollment_configured: bool = False
    checklist_staff_invited: bool = False
    checklist_office_configured: bool = False

    # Org-code abuse control (Section 7.2)
    signup_frozen: bool = False

    # Failed-charge lifecycle (Section 3.2.4)
    saas_retry_count: int = 0  # how many consecutive payment-failure webhooks fired
    saas_state_changed_at: datetime | None = None  # when current saas_status was entered
