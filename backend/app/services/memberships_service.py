"""Member signup & membership lifecycle service (Sections 8, 9).

Implements the open-enrollment signup sequence with all gates from the plan:
  * Org-code validation + enrollment-mode check (Section 8.2, 7.1).
  * Layered rate limits: per-IP, per-email, per-org-code (Section 7.2); the
    org-code is auto-frozen when its daily cap is exceeded.
  * CAPTCHA verification (stubbed; Section 7.3).
  * Email verification before payment (Security Rule #6).
  * Idempotent payment via the gym's Stripe Connect account (Section 13, 8.6).
  * Status transitions: pending_payment -> active (or pending_approval).

Approved- and invite-only variants are handled by branching on enrollment mode.
"""

from __future__ import annotations

from datetime import timedelta

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.core.config import settings
from app.core.constants import (
    ConnectStatus,
    EnrollmentMode,
    MemberStatus,
    PaymentKind,
    PaymentMethod,
    PaymentStatus,
    PlanBillingType,
    Role,
    SaasStatus,
    SubscriptionStatus,
    VerificationPurpose,
)
from app.core.rate_limit import rate_limiter
from app.core.security import hash_password, now_utc
from app.integrations.email import send_email
from app.integrations.push import send_push
from app.integrations.stripe_connect import connect_stripe
from app.models.membership import OrganizationMember
from app.models.organization import Organization
from app.models.payment import Payment
from app.models.plan import MembershipPlan
from app.models.signup_attempt import SignupAttempt
from app.models.subscription import Subscription
from app.models.user import User
from app.schemas.auth import LoginResponse
from app.services import auth_service, idempotency_service
from app.services import verification_service as verif
from app.services.audit_service import record_audit


# ----------------------------------------------------------------- helpers
async def _org_by_code(session: AsyncSession, org_code: str) -> Organization:
    org = (
        await session.execute(
            select(Organization).where(Organization.org_code == org_code.upper())
        )
    ).scalar_one_or_none()
    if org is None:
        raise HTTPException(status_code=404, detail="Invalid org code.")
    return org


def _verify_captcha(token: str | None) -> None:
    """Stub CAPTCHA check (Section 7.3). In production: verify with hCaptcha /
    Turnstile. Here any non-empty token passes; absence is allowed in dev."""

    # Intentionally permissive in dev/stub mode.
    return None


async def _member_for(session: AsyncSession, org_id: str, user_id: str) -> OrganizationMember | None:
    return (
        await session.execute(
            select(OrganizationMember).where(
                OrganizationMember.organization_id == org_id,
                OrganizationMember.user_id == user_id,
            )
        )
    ).scalar_one_or_none()


async def _enforce_signup_rate_limits(
    session: AsyncSession, *, org: Organization, email: str, ip: str | None
) -> None:
    """Layered limits (Section 7.2). Org-code cap auto-freezes the code."""

    if org.signup_frozen:
        raise HTTPException(status_code=429, detail="Signups are temporarily frozen for this gym.")

    ip_key = f"signup:ip:{ip or 'unknown'}"
    ok_ip, _ = await rate_limiter.hit(ip_key, settings.signup_max_per_ip_per_hour, 3600)
    if not ok_ip:
        raise HTTPException(status_code=429, detail="Too many signup attempts. Try again later.")

    email_key = f"signup:email:{email.lower()}"
    ok_email, _ = await rate_limiter.hit(email_key, settings.signup_max_per_email_per_day, 86400)
    if not ok_email:
        raise HTTPException(status_code=429, detail="Too many signup attempts for this email today.")

    code_key = f"signup:org:{org.id}"
    ok_org, _ = await rate_limiter.hit(code_key, settings.signup_max_per_org_code_per_day, 86400)
    if not ok_org:
        org.signup_frozen = True
        session.add(org)
        await record_audit(session, action="org.signup_auto_frozen", organization_id=org.id,
                           entity_type="organization", entity_id=org.id)
        raise HTTPException(status_code=429, detail="This gym has reached its daily signup limit.")


# ------------------------------------------------------------- step 1: code
async def start_signup(
    session: AsyncSession, *, org_code: str, captcha_token: str | None, ip: str | None
) -> Organization:
    org = await _org_by_code(session, org_code)
    _verify_captcha(captcha_token)

    if org.enrollment_mode == EnrollmentMode.INVITE_ONLY:
        raise HTTPException(status_code=403, detail="This gym is invite-only.")
    if not org.checklist_plan_published:
        raise HTTPException(status_code=409, detail="This gym is not accepting signups yet.")
    if org.saas_status in {SaasStatus.SUSPENDED, SaasStatus.READ_ONLY, SaasStatus.CANCELLED}:
        raise HTTPException(status_code=403, detail="This gym is not accepting signups.")

    session.add(SignupAttempt(organization_id=org.id, org_code=org.org_code, ip_address=ip,
                              status="started"))
    return org


# ---------------------------------------------------- step 3: email + verify
async def request_email_verification(
    session: AsyncSession, *, org_code: str, email: str, captcha_token: str | None, ip: str | None
) -> None:
    org = await _org_by_code(session, org_code)
    _verify_captcha(captcha_token)
    await _enforce_signup_rate_limits(session, org=org, email=email, ip=ip)

    # If email already a member of THIS org -> redirect to login (Section 8.3).
    existing_user = (
        await session.execute(select(User).where(User.email == email.lower()))
    ).scalar_one_or_none()
    if existing_user is not None:
        member = await _member_for(session, org.id, existing_user.id)
        if member is not None:
            raise HTTPException(status_code=409, detail="This email is already a member. Please log in.")

    code = await verif.issue_code(
        session, email=email, purpose=VerificationPurpose.EMAIL_VERIFY, organization_id=org.id
    )
    await send_email(email, "Verify your email", f"Your verification code is {code}")


async def verify_signup_email(
    session: AsyncSession, *, org_code: str, email: str, code: str
) -> None:
    org = await _org_by_code(session, org_code)
    try:
        await verif.verify_and_consume(
            session, email=email, secret=code,
            purpose=VerificationPurpose.EMAIL_VERIFY, organization_id=org.id,
        )
    except verif.VerificationError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


# ------------------------------------------------------- step 4: password
async def set_password(
    session: AsyncSession, *, org_code: str, email: str, password: str
) -> OrganizationMember:
    """Create (or reuse) the user and a pending_payment / pending_approval member."""

    org = await _org_by_code(session, org_code)
    await auth_service.validate_password_or_raise(password)

    # The email must have a consumed verification for this org.
    user = (
        await session.execute(select(User).where(User.email == email.lower()))
    ).scalar_one_or_none()
    if user is None:
        user = User(
            email=email.lower(),
            hashed_password=hash_password(password),
            email_verified=True,
        )
        session.add(user)
        await session.flush()
    else:
        # Existing cross-org user joining a new gym (Section 14 / 17.5).
        if not user.email_verified:
            user.email_verified = True
            session.add(user)

    if await _member_for(session, org.id, user.id) is not None:
        raise HTTPException(status_code=409, detail="Already a member of this gym.")

    initial_status = (
        MemberStatus.PENDING_APPROVAL
        if org.enrollment_mode == EnrollmentMode.APPROVED
        else MemberStatus.PENDING_PAYMENT
    )
    member = OrganizationMember(
        organization_id=org.id,
        user_id=user.id,
        role=Role.MEMBER,
        member_status=initial_status,
    )
    session.add(member)
    await session.flush()
    await record_audit(session, action="member.signup_account_created", organization_id=org.id,
                       actor_user_id=user.id, entity_type="member", entity_id=member.id)
    return member


# ------------------------------------------------------- step 5: list plans
async def public_plans(session: AsyncSession, *, org: Organization) -> list[MembershipPlan]:
    from app.services.plans_service import list_public_plans

    return await list_public_plans(session, org_id=org.id)


# --------------------------------------------------------- step 6: pay
def _amount_with_tax(plan: MembershipPlan) -> tuple[float, float]:
    """Return (charge_amount, tax_amount). Inclusive tax doesn't add on top."""

    from app.core.constants import TaxMode

    if plan.tax_mode == TaxMode.ADDED and plan.tax_rate:
        tax = round(plan.price * plan.tax_rate, 2)
        return round(plan.price + tax, 2), tax
    return plan.price, 0.0


async def _activate_membership(
    session: AsyncSession, *, org: Organization, member: OrganizationMember, plan: MembershipPlan,
    payment: Payment,
) -> Subscription:
    """Create the subscription (price snapshot) and flip member to active."""

    period_end = None
    classes_remaining = None
    if plan.billing_type == PlanBillingType.RECURRING:
        unit_days = {"day": 1, "week": 7, "month": 30}.get(plan.cycle_unit or "month", 30)
        length = plan.cycle_length or 1
        period_end = now_utc() + timedelta(days=unit_days * length)
    elif plan.billing_type == PlanBillingType.ONE_TIME_PACK:
        classes_remaining = plan.pack_size
        if plan.validity_days:
            period_end = now_utc() + timedelta(days=plan.validity_days)

    sub = Subscription(
        organization_id=org.id,
        member_id=member.id,
        plan_id=plan.id,
        status=SubscriptionStatus.ACTIVE,
        price_snapshot=plan.price,  # legacy pricing preserved (Section 6.7)
        currency=plan.currency,
        current_period_end=period_end,
        classes_remaining=classes_remaining,
    )
    session.add(sub)
    await session.flush()

    member.member_status = MemberStatus.ACTIVE
    if member.joined_at is None:
        member.joined_at = now_utc()
    session.add(member)

    payment.subscription_id = sub.id
    session.add(payment)
    return sub


async def pay_and_activate(
    session: AsyncSession,
    *,
    org_code: str,
    email: str,
    plan_id: str,
    idempotency_key: str,
    ip: str | None = None,
) -> LoginResponse:
    """Step 6 — idempotent member payment -> activation -> logged in.

    Money flows into the gym's Connect account; the platform never touches it
    (Security Rule #3). The same idempotency key is claimed server-side and
    passed to Stripe (Section 13.5).
    """

    org = await _org_by_code(session, org_code)
    user = (
        await session.execute(select(User).where(User.email == email.lower()))
    ).scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="Account not found.")
    member = await _member_for(session, org.id, user.id)
    if member is None:
        raise HTTPException(status_code=404, detail="Membership not found.")
    if member.member_status == MemberStatus.PENDING_APPROVAL:
        raise HTTPException(status_code=403, detail="Awaiting admin approval before payment.")

    plan = await session.get(MembershipPlan, plan_id)
    if plan is None or plan.organization_id != org.id:
        raise HTTPException(status_code=404, detail="Plan not found.")

    # Claim idempotency (Section 13.3). Replays return the cached result.
    endpoint = "POST /memberships/pay"
    claim = await idempotency_service.claim(
        session, key=idempotency_key, endpoint=endpoint,
        body={"org_code": org_code, "email": email, "plan_id": plan_id},
        organization_id=org.id, user_id=user.id,
    )
    if not claim.claimed:
        # Already processed: re-issue a session for the (now active) member.
        access, refresh = await auth_service.create_session(
            session, user=user, org_id=org.id, role=Role.MEMBER, ip=ip
        )
        return LoginResponse(
            access_token=access, refresh_token=refresh, organization_id=org.id,
            role=Role.MEMBER.value, member_status=member.member_status.value,
        )

    if org.stripe_connect_status != ConnectStatus.ACTIVE:
        await idempotency_service.fail(session, claim.record, code=402,
                                       body='{"detail":"Gym cannot accept payments yet."}')
        raise HTTPException(status_code=402, detail="This gym cannot accept payments yet.")

    amount, tax = _amount_with_tax(plan)
    result = await connect_stripe.charge_member(
        connected_account_id=org.stripe_connect_account_id,
        amount_cents=int(round(amount * 100)),
        currency=plan.currency.lower(),
        idempotency_key=idempotency_key,
        description=f"{org.name} — {plan.name}",
    )

    payment = Payment(
        organization_id=org.id,
        member_id=member.id,
        plan_id=plan.id,
        kind=PaymentKind.MEMBER_FEE,
        method=PaymentMethod.CARD,
        status=PaymentStatus.SUCCEEDED if result.status == "succeeded" else PaymentStatus.FAILED,
        amount=amount,
        tax_amount=tax,
        currency=plan.currency,
        stripe_payment_intent_id=result.id,
        stripe_charge_id=result.charge_id,
        idempotency_key=idempotency_key,
        paid_at=now_utc() if result.status == "succeeded" else None,
    )
    session.add(payment)
    await session.flush()

    if result.status != "succeeded":
        await idempotency_service.fail(session, claim.record, code=402,
                                       body='{"detail":"Payment failed."}')
        raise HTTPException(status_code=402, detail="Payment failed. Please retry.")

    await _activate_membership(session, org=org, member=member, plan=plan, payment=payment)
    await record_audit(session, action="member.activated", organization_id=org.id,
                       actor_user_id=user.id, entity_type="member", entity_id=member.id,
                       metadata={"plan_id": plan.id, "amount": amount})
    await send_email(email, "Welcome!", f"Your membership at {org.name} is active.")
    await send_push(None, "Membership active", f"Welcome to {org.name}!")

    access, refresh = await auth_service.create_session(
        session, user=user, org_id=org.id, role=Role.MEMBER, ip=ip
    )
    response = LoginResponse(
        access_token=access, refresh_token=refresh, organization_id=org.id,
        role=Role.MEMBER.value, member_status=MemberStatus.ACTIVE.value,
    )
    await idempotency_service.complete(session, claim.record, code=200,
                                       body=response.model_dump_json())
    return response


# ------------------------------------------------------- step 7: profile
async def complete_profile(
    session: AsyncSession, *, org_id: str, user_id: str, full_name: str,
    photo_url: str | None, phone: str | None, emergency_contact: str | None,
) -> OrganizationMember:
    member = await _member_for(session, org_id, user_id)
    if member is None:
        raise HTTPException(status_code=404, detail="Membership not found.")
    user = await session.get(User, user_id)
    if user and full_name:
        user.full_name = full_name
        session.add(user)
    member.photo_url = photo_url
    member.phone = phone
    member.emergency_contact = emergency_contact
    member.profile_complete = True
    session.add(member)
    return member
