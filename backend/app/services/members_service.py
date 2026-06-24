"""Admin member directory & lifecycle management (Sections 8.3, 9.3, 7.6).

Admins (owner/manager) view the member directory, change member status
(ban/unban/freeze/cancel), work the approved-enrollment approval queue, and send
invite-only invitations tied to a single-use code. All actions are audited.
"""

from __future__ import annotations

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.core.constants import (
    MemberStatus,
    Role,
    VerificationPurpose,
)
from app.integrations.email import send_email
from app.models.membership import OrganizationMember
from app.models.organization import Organization
from app.models.user import User
from app.services import verification_service as verif
from app.services.audit_service import record_audit


async def directory(
    session: AsyncSession, *, org_id: str, status: MemberStatus | None = None,
    role: Role | None = None,
) -> list[tuple[OrganizationMember, User]]:
    stmt = (
        select(OrganizationMember, User)
        .join(User, User.id == OrganizationMember.user_id)
        .where(OrganizationMember.organization_id == org_id)
    )
    if status is not None:
        stmt = stmt.where(OrganizationMember.member_status == status)
    if role is not None:
        stmt = stmt.where(OrganizationMember.role == role)
    rows = (await session.execute(stmt.order_by(OrganizationMember.created_at))).all()
    return [(m, u) for m, u in rows]


async def _get_member(session: AsyncSession, org_id: str, member_id: str) -> OrganizationMember:
    member = await session.get(OrganizationMember, member_id)
    if member is None or member.organization_id != org_id:
        raise HTTPException(status_code=404, detail="Member not found.")
    return member


async def change_status(
    session: AsyncSession, *, org_id: str, member_id: str, action: str, reason: str | None,
    actor_id: str,
) -> OrganizationMember:
    member = await _get_member(session, org_id, member_id)
    if member.role == Role.OWNER:
        raise HTTPException(status_code=403, detail="Cannot change the owner's status.")

    action = action.lower()
    if action == "ban":
        member.banned = True
        member.member_status = MemberStatus.BANNED
    elif action == "unban":
        member.banned = False
        member.member_status = MemberStatus.EXPIRED
    elif action == "freeze":
        member.member_status = MemberStatus.FROZEN
    elif action == "unfreeze":
        member.member_status = MemberStatus.ACTIVE
    elif action == "cancel":
        member.member_status = MemberStatus.CANCELLED
    else:
        raise HTTPException(status_code=422, detail="Invalid status action.")

    session.add(member)
    await record_audit(session, action=f"member.{action}", organization_id=org_id, actor_user_id=actor_id,
                       entity_type="member", entity_id=member.id, metadata={"reason": reason})
    return member


# ------------------------------------------------------- approval queue
async def approval_queue(session: AsyncSession, *, org_id: str) -> list[tuple[OrganizationMember, User]]:
    return await directory(session, org_id=org_id, status=MemberStatus.PENDING_APPROVAL)


async def decide_approval(
    session: AsyncSession, *, org_id: str, member_id: str, approve: bool, reason: str | None,
    actor_id: str,
) -> OrganizationMember:
    """Approve -> member proceeds to payment; reject -> notified with reason (Section 8.3)."""

    member = await _get_member(session, org_id, member_id)
    if member.member_status != MemberStatus.PENDING_APPROVAL:
        raise HTTPException(status_code=409, detail="Member is not awaiting approval.")
    user = await session.get(User, member.user_id)

    if approve:
        member.member_status = MemberStatus.PENDING_PAYMENT
        if user is not None:
            await send_email(user.email, "Application approved",
                             "Your application was approved. You can now proceed to payment.")
    else:
        member.member_status = MemberStatus.CANCELLED
        if user is not None:
            await send_email(user.email, "Application declined",
                             f"Your application was declined. Reason: {reason or 'not specified'}.")
    session.add(member)
    await record_audit(session, action=f"member.approval_{'approved' if approve else 'rejected'}",
                       organization_id=org_id, actor_user_id=actor_id, entity_type="member",
                       entity_id=member.id, metadata={"reason": reason})
    return member


# ------------------------------------------------------- invite-only invite
async def invite_member(
    session: AsyncSession, *, org_id: str, email: str, actor_id: str
) -> tuple[OrganizationMember, str]:
    """Create a pending member + single-use invite code tied to the email (Section 8.4)."""

    org = await session.get(Organization, org_id)
    if org is None:
        raise HTTPException(status_code=404, detail="Organization not found.")

    user = (
        await session.execute(select(User).where(User.email == email.lower()))
    ).scalar_one_or_none()
    if user is not None:
        existing = (
            await session.execute(
                select(OrganizationMember).where(
                    OrganizationMember.organization_id == org_id,
                    OrganizationMember.user_id == user.id,
                )
            )
        ).scalar_one_or_none()
        if existing is not None:
            raise HTTPException(status_code=409, detail="Already a member of this org.")

    if user is None:
        # Create a shell user; password set when they claim the invite.
        from app.core.security import hash_password
        import secrets

        user = User(email=email.lower(), hashed_password=hash_password(secrets.token_urlsafe(16)),
                    email_verified=False)
        session.add(user)
        await session.flush()

    member = OrganizationMember(
        organization_id=org_id, user_id=user.id, role=Role.MEMBER,
        member_status=MemberStatus.PENDING_ACTIVATION,
    )
    session.add(member)
    await session.flush()

    code = await verif.issue_link_token(
        session, email=email, purpose=VerificationPurpose.MEMBER_INVITE,
        organization_id=org_id, user_id=user.id,
    )
    await send_email(email, f"You're invited to {org.name}",
                     f"You've been invited to join {org.name}. Use this code to join: {code}")
    await record_audit(session, action="member.invited", organization_id=org_id, actor_user_id=actor_id,
                       entity_type="member", entity_id=member.id)
    return member, code
