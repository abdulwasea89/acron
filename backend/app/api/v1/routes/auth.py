"""Auth API routes (Sections 4, 5, 9)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_client_ip, get_current_user, get_session
from app.models.user import User
from app.schemas.auth import (
    EmailVerifyRequest,
    LoginRequest,
    LoginResponse,
    MemberLoginRequest,
    OwnerRegisterStart,
    PasswordResetConfirm,
    PasswordResetRequest,
    RefreshRequest,
    ResendCodeRequest,
    SessionInfo,
)
from app.schemas.common import Message
from app.services import auth_service

router = APIRouter()


@router.post("/register", response_model=Message, status_code=status.HTTP_201_CREATED)
async def register_owner(data: OwnerRegisterStart, session: AsyncSession = Depends(get_session)):
    """Step 1 — owner account. Sends a 6-digit email verification code."""

    await auth_service.register_owner_start(session, data)
    return Message(message="Verification code sent to your email.")


@router.post("/verify-email", response_model=Message)
async def verify_email(data: EmailVerifyRequest, session: AsyncSession = Depends(get_session)):
    await auth_service.verify_email(session, data.email, data.code)
    return Message(message="Email verified.")


@router.post("/resend-code", response_model=Message)
async def resend_code(data: ResendCodeRequest, session: AsyncSession = Depends(get_session)):
    await auth_service.resend_email_code(session, data.email)
    return Message(message="If the account exists, a code was sent.")


@router.post("/login", response_model=LoginResponse)
async def login(data: LoginRequest, request: Request, session: AsyncSession = Depends(get_session)):
    return await auth_service.login(
        session,
        email=data.email,
        password=data.password,
        org_code=data.org_code,
        organization_id=data.organization_id,
        remember=data.remember,
        ip=get_client_ip(request),
        user_agent=request.headers.get("user-agent"),
    )


@router.post("/member-login", response_model=LoginResponse)
async def member_login(
    data: MemberLoginRequest, request: Request, session: AsyncSession = Depends(get_session)
):
    """Returning member login — validates org_code + email + password together."""

    return await auth_service.login(
        session,
        email=data.email,
        password=data.password,
        org_code=data.org_code,
        remember=data.remember,
        ip=get_client_ip(request),
        user_agent=request.headers.get("user-agent"),
    )


@router.post("/refresh", response_model=LoginResponse)
async def refresh(data: RefreshRequest, session: AsyncSession = Depends(get_session)):
    return await auth_service.refresh_tokens(session, refresh_token=data.refresh_token)


@router.post("/password-reset/request", response_model=Message)
async def password_reset_request(
    data: PasswordResetRequest, session: AsyncSession = Depends(get_session)
):
    await auth_service.request_password_reset(session, data.email)
    return Message(message="If the account exists, a reset link was sent.")


@router.post("/password-reset/confirm", response_model=Message)
async def password_reset_confirm(
    data: PasswordResetConfirm, session: AsyncSession = Depends(get_session)
):
    await auth_service.confirm_password_reset(
        session, email=data.email, token=data.token, new_password=data.new_password
    )
    return Message(message="Password updated.")


@router.get("/sessions", response_model=list[SessionInfo])
async def list_sessions(
    user: User = Depends(get_current_user), session: AsyncSession = Depends(get_session)
):
    sessions = await auth_service.list_sessions(session, user_id=user.id)
    return [
        SessionInfo(
            id=s.id,
            device_type=s.device_type,
            os=s.os,
            ip_address=s.ip_address,
            last_activity_at=s.last_activity_at.isoformat() if s.last_activity_at else None,
            revoked=s.revoked,
        )
        for s in sessions
    ]


@router.delete("/sessions/{session_id}", response_model=Message)
async def revoke_session(
    session_id: str,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    await auth_service.revoke_session(session, user_id=user.id, session_id=session_id)
    return Message(message="Session revoked.")
