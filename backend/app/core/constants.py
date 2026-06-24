"""Shared enums and domain constants used across models, schemas, and services.

These encode the vocabulary of the product plan: roles, statuses, billing types,
payment methods, etc. Keeping them in one place keeps the API contract and the
database in agreement.
"""

from __future__ import annotations

from enum import Enum


class Role(str, Enum):
    """Tenant-scoped role of a user within one organization (Section 2)."""

    OWNER = "owner"
    MANAGER = "manager"
    TRAINER = "trainer"
    FRONT_DESK = "front_desk"
    MEMBER = "member"


# Roles considered "staff/admin" for capability checks.
STAFF_ROLES = {Role.OWNER, Role.MANAGER, Role.TRAINER, Role.FRONT_DESK}
ADMIN_ROLES = {Role.OWNER, Role.MANAGER}


class SaasTier(str, Enum):
    """Platform subscription tier the gym owner pays for (Section 3.1)."""

    STARTER = "starter"
    PRO = "pro"
    ENTERPRISE = "enterprise"


class SaasStatus(str, Enum):
    """Lifecycle state of the org's SaaS subscription (Section 3.2.4)."""

    TRIALING = "trialing"
    ACTIVE = "active"
    PAST_DUE = "past_due"      # failed charge, retries in progress
    READ_ONLY = "read_only"    # grace ended (day 6)
    SUSPENDED = "suspended"    # day 30, members locked out
    CANCELLED = "cancelled"
    ARCHIVED = "archived"


class EnrollmentMode(str, Enum):
    """How members may join the org (Section 7.1)."""

    OPEN = "open"
    APPROVED = "approved"
    INVITE_ONLY = "invite_only"


class ConnectStatus(str, Enum):
    """Stripe Connect onboarding state for receiving member payments."""

    NONE = "none"
    PENDING = "pending"
    ACTIVE = "active"
    RESTRICTED = "restricted"


class MemberStatus(str, Enum):
    """Membership status of a member within an org (Section 9.3)."""

    PENDING_PAYMENT = "pending_payment"
    PENDING_APPROVAL = "pending_approval"
    PENDING_ACTIVATION = "pending_activation"  # CSV-imported, not yet claimed
    ACTIVE = "active"
    GRACE = "grace"
    EXPIRED = "expired"
    FROZEN = "frozen"
    CANCELLED = "cancelled"
    BANNED = "banned"


class PlanBillingType(str, Enum):
    """Membership plan billing model (Section 6.3)."""

    RECURRING = "recurring"
    ONE_TIME_PACK = "one_time_pack"
    DROP_IN = "drop_in"


class PlanVisibility(str, Enum):
    """Who can see/select a plan (Section 6.6)."""

    PUBLIC = "public"
    MEMBERS_ONLY = "members_only"
    INVITE_ONLY = "invite_only"


class PlanStatus(str, Enum):
    """Lifecycle of a membership plan (Section 6.7)."""

    DRAFT = "draft"
    PUBLISHED = "published"
    PAUSED = "paused"
    ARCHIVED = "archived"


class TaxMode(str, Enum):
    INCLUSIVE = "inclusive"
    ADDED = "added"


class SubscriptionStatus(str, Enum):
    ACTIVE = "active"
    GRACE = "grace"
    EXPIRED = "expired"
    FROZEN = "frozen"
    CANCELLED = "cancelled"


class PaymentMethod(str, Enum):
    CARD = "card"
    CASH = "cash"
    BANK_TRANSFER = "bank_transfer"
    MOBILE_WALLET = "mobile_wallet"


class PaymentStatus(str, Enum):
    PENDING = "pending"
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    REFUNDED = "refunded"
    PARTIALLY_REFUNDED = "partially_refunded"


class PaymentKind(str, Enum):
    """What the payment is for."""

    SAAS_SUBSCRIPTION = "saas_subscription"   # owner -> platform
    MEMBER_FEE = "member_fee"                 # member -> gym (Connect)
    TRAINER_PAYOUT = "trainer_payout"         # gym -> trainer


class IdempotencyStatus(str, Enum):
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"


class ReceiptStatus(str, Enum):
    """AI receipt pipeline outcome (Section 10)."""

    UPLOADED = "uploaded"
    PROCESSING = "processing"
    AUTO_APPROVED = "auto_approved"
    PENDING_REVIEW = "pending_review"
    APPROVED = "approved"        # admin-approved
    REJECTED = "rejected"
    REVERSED = "reversed"        # auto-approval reversed on audit


class PayrollStatus(str, Enum):
    DRAFT = "draft"
    LOCKED = "locked"
    FINALIZED = "finalized"
    PAID = "paid"


class PayoutMethod(str, Enum):
    BANK_TRANSFER = "bank_transfer"
    CASH = "cash"
    MOBILE_WALLET = "mobile_wallet"


class AdvanceStatus(str, Enum):
    REQUESTED = "requested"
    APPROVED = "approved"
    REJECTED = "rejected"
    REPAID = "repaid"


class ShiftStatus(str, Enum):
    CHECKED_IN = "checked_in"
    CHECKED_OUT = "checked_out"


class GymStatus(str, Enum):
    OPEN = "open"
    CLOSED = "closed"
    HALF_DAY = "half_day"


class BookingStatus(str, Enum):
    BOOKED = "booked"
    ATTENDED = "attended"
    CANCELLED = "cancelled"
    NO_SHOW = "no_show"


class VerificationPurpose(str, Enum):
    EMAIL_VERIFY = "email_verify"
    PASSWORD_RESET = "password_reset"
    MAGIC_LINK = "magic_link"
    MEMBER_INVITE = "member_invite"
    MEMBER_ACTIVATION = "member_activation"


# SaaS tier -> member cap (None = unlimited). Mirrors Section 3.1.
TIER_MEMBER_CAP: dict[SaasTier, int | None] = {
    SaasTier.STARTER: 25,
    SaasTier.PRO: 100,
    SaasTier.ENTERPRISE: None,
}

TIER_PRICE_USD: dict[SaasTier, int | None] = {
    SaasTier.STARTER: 29,
    SaasTier.PRO: 79,
    SaasTier.ENTERPRISE: None,  # custom
}
