"""Auth request/response schemas (Sections 4, 5, 8, 9)."""

from __future__ import annotations

from pydantic import BaseModel, EmailStr, Field

from app.schemas.common import TokenPair


class OwnerRegisterStart(BaseModel):
    """Step 1 — owner account (Section 4.2)."""

    full_name: str
    email: EmailStr
    password: str
    confirm_password: str


class EmailVerifyRequest(BaseModel):
    email: EmailStr
    code: str = Field(min_length=6, max_length=6)


class ResendCodeRequest(BaseModel):
    email: EmailStr


class LoginRequest(BaseModel):
    """Web/mobile login. org_code optional for owners, required for members."""

    email: EmailStr
    password: str
    org_code: str | None = None
    organization_id: str | None = None
    remember: bool = False
    mfa_code: str | None = None


class MemberLoginRequest(BaseModel):
    """Returning member login validates all three together (Section 9.1)."""

    org_code: str
    email: EmailStr
    password: str
    remember: bool = False
    mfa_code: str | None = None


class MfaConfirm(BaseModel):
    code: str = Field(min_length=6, max_length=6)


class MfaDisable(BaseModel):
    password: str


class MfaEnrollResponse(BaseModel):
    secret: str
    otpauth_uri: str
    current_code: str


class MfaStatus(BaseModel):
    mfa_enabled: bool


class RefreshRequest(BaseModel):
    refresh_token: str
    organization_id: str | None = None


class PasswordResetRequest(BaseModel):
    email: EmailStr


class PasswordResetConfirm(BaseModel):
    email: EmailStr
    token: str
    new_password: str


class LoginResponse(TokenPair):
    member_status: str | None = None
    requires_mfa: bool = False
    organizations: list[dict] | None = None


class SessionInfo(BaseModel):
    id: str
    device_type: str | None = None
    os: str | None = None
    ip_address: str | None = None
    last_activity_at: str | None = None
    revoked: bool = False
    current: bool = False
