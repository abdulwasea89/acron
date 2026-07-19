"""Admin member directory & management API routes (Sections 8, 9, 7.6)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_session, require_capability
from app.core.constants import MemberStatus, Role
from app.core.permissions import Capability
from app.core.tenancy import TenantContext
from app.schemas.members import (
    ApprovalDecision,
    MemberDirectoryItem,
    MemberInvite,
    MemberInviteOut,
    MemberStatusChange,
    RoleChange,
)
from app.schemas.organizations import BulkImportResult
from app.services import members_service as members

router = APIRouter()


def _item(m, u) -> MemberDirectoryItem:
    return MemberDirectoryItem(
        member_id=m.id, user_id=u.id, email=u.email, full_name=u.full_name,
        role=m.role.value, member_status=m.member_status.value, phone=m.phone,
        profile_complete=m.profile_complete,
    )


@router.get("", response_model=list[MemberDirectoryItem])
async def list_directory(
    status: MemberStatus | None = None,
    role: Role | None = None,
    ctx: TenantContext = Depends(require_capability(Capability.MANAGE_MEMBERS)),
    session: AsyncSession = Depends(get_session),
):
    rows = await members.directory(session, org_id=ctx.org_id, status=status, role=role)
    return [_item(m, u) for m, u in rows]


@router.get("/approval-queue", response_model=list[MemberDirectoryItem])
async def approval_queue(
    ctx: TenantContext = Depends(require_capability(Capability.MANAGE_MEMBERS)),
    session: AsyncSession = Depends(get_session),
):
    rows = await members.approval_queue(session, org_id=ctx.org_id)
    return [_item(m, u) for m, u in rows]


@router.post("/{member_id}/approval", response_model=MemberDirectoryItem)
async def decide_approval(
    member_id: str,
    data: ApprovalDecision,
    ctx: TenantContext = Depends(require_capability(Capability.MANAGE_MEMBERS)),
    session: AsyncSession = Depends(get_session),
):
    member = await members.decide_approval(session, org_id=ctx.org_id, member_id=member_id,
                                            approve=data.approve, reason=data.reason, actor_id=ctx.user_id)
    from app.models.user import User

    user = await session.get(User, member.user_id)
    return _item(member, user)


@router.post("/{member_id}/status", response_model=MemberDirectoryItem)
async def change_status(
    member_id: str,
    data: MemberStatusChange,
    ctx: TenantContext = Depends(require_capability(Capability.MANAGE_MEMBERS)),
    session: AsyncSession = Depends(get_session),
):
    member = await members.change_status(session, org_id=ctx.org_id, member_id=member_id,
                                          action=data.action, reason=data.reason, actor_id=ctx.user_id)
    from app.models.user import User

    user = await session.get(User, member.user_id)
    return _item(member, user)


@router.patch("/{member_id}/role", response_model=MemberDirectoryItem)
async def change_role(
    member_id: str,
    data: RoleChange,
    ctx: TenantContext = Depends(require_capability(Capability.MANAGE_MEMBERS)),
    session: AsyncSession = Depends(get_session),
):
    member = await members.change_role(session, org_id=ctx.org_id, member_id=member_id,
                                        new_role=data.role, actor_id=ctx.user_id, actor_role=ctx.role)
    from app.models.user import User

    user = await session.get(User, member.user_id)
    return _item(member, user)


def _invite_out(member, email: str, code: str) -> MemberInviteOut:
    """Only expose the raw invite code when email delivery is off (stub mode);
    with a real provider the code goes out by email and must stay secret."""

    from app.core.config import settings

    delivered = settings.email_active
    return MemberInviteOut(
        member_id=member.id, email=email, member_status=member.member_status.value,
        email_delivered=delivered,
        invite_code="" if delivered else code,
    )


@router.post("/invite", response_model=MemberInviteOut, status_code=201)
async def invite_member(
    data: MemberInvite,
    ctx: TenantContext = Depends(require_capability(Capability.INVITE_MEMBERS)),
    session: AsyncSession = Depends(get_session),
):
    member, code = await members.invite_member(session, org_id=ctx.org_id, email=data.email,
                                                actor_id=ctx.user_id)
    return _invite_out(member, data.email, code)


@router.post("/{member_id}/resend-invite", response_model=MemberInviteOut)
async def resend_invite(
    member_id: str,
    ctx: TenantContext = Depends(require_capability(Capability.INVITE_MEMBERS)),
    session: AsyncSession = Depends(get_session),
):
    from app.models.user import User

    member, code = await members.resend_invite(session, org_id=ctx.org_id, member_id=member_id,
                                               actor_id=ctx.user_id)
    user = await session.get(User, member.user_id)
    return _invite_out(member, user.email, code)


@router.post("/import", response_model=BulkImportResult, status_code=201)
async def bulk_import(
    file: UploadFile = File(...),
    ctx: TenantContext = Depends(require_capability(Capability.MANAGE_MEMBERS)),
    session: AsyncSession = Depends(get_session),
):
    """Bulk-import members from a CSV (web-only, Section 9.9, 16)."""

    content = await file.read()
    if not content:
        raise HTTPException(status_code=422, detail="Uploaded file is empty.")
    result = await members.bulk_import_csv(session, org_id=ctx.org_id, csv_bytes=content,
                                           actor_id=ctx.user_id)
    return BulkImportResult(**result)
