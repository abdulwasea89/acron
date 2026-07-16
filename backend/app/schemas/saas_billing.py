"""SaaS subscription billing schemas (Section 3)."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel

from app.core.constants import SaasTier


class TierChangeRequest(BaseModel):
    tier: SaasTier


class SaasStatusOut(BaseModel):
    saas_tier: str
    saas_status: str
    member_cap: int | None
    current_member_count: int
    current_period_end: datetime | None
    grace_until: datetime | None
    read_only: bool
    retry_count: int = 0
    state_changed_at: datetime | None = None


class InvoiceOut(BaseModel):
    id: str
    amount: float
    currency: str
    status: str
    created_at: datetime
