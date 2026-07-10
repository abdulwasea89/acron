"""Organization schemas (Sections 3, 4, 7)."""

from __future__ import annotations

from pydantic import BaseModel, EmailStr

from app.core.constants import EnrollmentMode, GymStatus, SaasTier


class GymDetails(BaseModel):
    """Step 2 — gym details (Section 4.4)."""

    name: str
    country: str = "US"
    timezone: str = "UTC"
    default_currency: str = "USD"
    address: str | None = None
    logo_url: str | None = None
    accent_color: str | None = None
    working_hours: str | None = None


class RegisterGymRequest(BaseModel):
    """Complete owner registration: gym details + tier + (stub) card token.

    The owner must already exist and be email-verified (from /auth/register +
    /auth/verify-email). Identified by email here; in production the in-progress
    registration would be tied to a short-lived token.
    """

    owner_email: EmailStr
    details: GymDetails
    tier: SaasTier
    payment_token: str = "tok_stub"  # Stripe-hosted card token in production


class OrganizationOut(BaseModel):
    id: str
    name: str
    org_code: str
    saas_tier: str
    saas_status: str
    enrollment_mode: str
    gym_status: str
    member_cap: int | None
    stripe_connect_status: str
    accent_color: str | None = None
    logo_url: str | None = None


class RegisterGymResponse(BaseModel):
    organization: OrganizationOut
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class SetupChecklist(BaseModel):
    gym_registered: bool = True
    saas_active: bool
    stripe_connected: bool
    plan_published: bool
    enrollment_configured: bool
    staff_invited: bool
    office_configured: bool
    member_signup_unblocked: bool


class EnrollmentModeUpdate(BaseModel):
    enrollment_mode: EnrollmentMode


class GymStatusUpdate(BaseModel):
    gym_status: GymStatus


class ConnectOnboardingOut(BaseModel):
    account_id: str
    onboarding_url: str


class OrgCodeRotateOut(BaseModel):
    org_code: str


class BulkImportResult(BaseModel):
    created: int
    skipped: int
    errors: list[dict]
