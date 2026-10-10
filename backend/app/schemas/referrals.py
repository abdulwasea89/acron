"""Referral program and reward API schemas."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class ReferralProgramUpdate(BaseModel):
    enabled: bool
    reward_description: str = Field(min_length=3, max_length=200)


class ReferralProgramOut(BaseModel):
    enabled: bool
    reward_description: str


class ReferralAdminItem(BaseModel):
    id: str
    referrer_name: str
    referrer_email: str
    referred_name: str
    referred_email: str
    status: str
    reward_description: str
    qualified_at: datetime | None
    rewards: list[dict]


class ReferralAdminOverview(BaseModel):
    program: ReferralProgramOut
    referrals: list[ReferralAdminItem]
    pending_rewards: int
    qualified_count: int


class MemberReferralItem(BaseModel):
    id: str
    referred_name: str | None
    status: str
    reward_description: str
    created_at: datetime


class MemberReferralOverview(BaseModel):
    enabled: bool
    code: str | None
    organization_code: str
    reward_description: str
    referrals: list[MemberReferralItem]
    earned_rewards: list[dict]


class ReferralRewardOut(BaseModel):
    id: str
    description: str
    status: str
    earned_at: datetime
    fulfilled_at: datetime | None
