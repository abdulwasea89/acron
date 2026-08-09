"""Admin member directory & management schemas (Sections 8, 9, 7.6)."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, EmailStr

from app.schemas.payments import PaymentOut


class MemberDirectoryItem(BaseModel):
    member_id: str
    user_id: str
    email: str
    full_name: str | None
    display_name: str | None = None
    role: str
    member_status: str
    phone: str | None
    profile_complete: bool
    created_at: datetime
    fixed_monthly_salary: float = 0.0
    hourly_rate: float = 0.0
    per_class_rate: float = 0.0
    commission_rate: float = 0.0
    # Display names of the trainers currently assigned to this member.
    assigned_trainers: list[str] = []


class TrainerAssign(BaseModel):
    trainer_member_id: str


class TrainerAssignment(BaseModel):
    """One active trainer->member assignment, resolved for API responses."""

    member_id: str
    trainer_member_id: str
    trainer_name: str
    assigned_at: datetime
    active: bool


class ClientAssignment(BaseModel):
    """A member assigned to a trainer, resolved for the 'my clients' view."""

    member_id: str
    member_name: str | None
    member_email: str
    member_status: str
    assigned_at: datetime


class MemberStatusChange(BaseModel):
    """Admin status action: ban / unban / freeze / unfreeze / cancel."""

    action: str
    reason: str | None = None


class RoleChange(BaseModel):
    role: str


class EmailUpdate(BaseModel):
    email: EmailStr


class ApprovalDecision(BaseModel):
    approve: bool
    reason: str | None = None


class MemberInvite(BaseModel):
    email: EmailStr


class MemberInviteOut(BaseModel):
    member_id: str
    email: str
    invite_code: str
    member_status: str
    # True when the email was actually delivered by a provider. False in stub
    # mode (no provider) — the UI then shows `invite_code` for manual sharing.
    email_delivered: bool = False


class MemberSubscriptionOut(BaseModel):
    """A member's current subscription joined with its plan (detail page)."""

    subscription_id: str
    plan_id: str
    plan_name: str
    plan_price: float
    price_snapshot: float
    currency: str
    billing_type: str
    status: str
    started_at: datetime
    current_period_end: datetime | None
    grace_until: datetime | None
    frozen_until: datetime | None
    cancelled_at: datetime | None
    classes_remaining: int | None


class PendingPaymentItem(BaseModel):
    """One thing a member still owes or has a pending/failed payment attempt for."""

    kind: str  # first_payment | renewal | failed_attempt | pending_attempt
    label: str
    amount: float | None = None
    currency: str | None = None
    due_at: datetime | None = None
    payment_id: str | None = None


class MemberDetailOut(BaseModel):
    member: MemberDirectoryItem
    subscription: MemberSubscriptionOut | None = None
    payments: list[PaymentOut] = []
    pending_payments: list[PendingPaymentItem] = []
    trainer_assignments: list[TrainerAssignment] = []
