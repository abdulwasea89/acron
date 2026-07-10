"""Member signup & membership schemas (Sections 8, 9)."""

from __future__ import annotations

from pydantic import BaseModel, EmailStr


class SignupStart(BaseModel):
    """Step 1 — org code entry (Section 8.2)."""

    org_code: str
    captcha_token: str | None = None


class SignupStartOut(BaseModel):
    organization_id: str
    organization_name: str
    enrollment_mode: str
    accepting_signups: bool


class SignupEmail(BaseModel):
    """Step 3 — email + verification request."""

    org_code: str
    email: EmailStr
    captcha_token: str | None = None


class SignupVerify(BaseModel):
    org_code: str
    email: EmailStr
    code: str


class SignupSetPassword(BaseModel):
    """Step 4 — password. Creates account in pending_payment."""

    org_code: str
    email: EmailStr
    password: str


class SignupSetPasswordOut(BaseModel):
    member_id: str
    organization_id: str
    member_status: str


class RedeemInvite(BaseModel):
    """Invited member claims their invite: code + a new password (Section 8.4)."""

    org_code: str
    email: EmailStr
    code: str
    password: str


class PublicPlanOut(BaseModel):
    id: str
    name: str
    public_description: str | None
    price: float
    currency: str
    billing_type: str
    featured: bool


class SignupPay(BaseModel):
    """Step 6 — idempotent payment for chosen plan."""

    org_code: str
    email: EmailStr
    plan_id: str
    payment_token: str = "tok_stub"


class ProfileComplete(BaseModel):
    """Step 7 — profile setup."""

    full_name: str
    photo_url: str | None = None
    phone: str | None = None
    emergency_contact: str | None = None


class MemberOut(BaseModel):
    member_id: str
    user_id: str
    email: str
    full_name: str | None
    role: str
    member_status: str
    profile_complete: bool
