"""Admin member directory & management schemas (Sections 8, 9, 7.6)."""

from __future__ import annotations

from pydantic import BaseModel, EmailStr


class MemberDirectoryItem(BaseModel):
    member_id: str
    user_id: str
    email: str
    full_name: str | None
    role: str
    member_status: str
    phone: str | None
    profile_complete: bool


class MemberStatusChange(BaseModel):
    """Admin status action: ban / unban / freeze / unfreeze / cancel."""

    action: str
    reason: str | None = None


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
