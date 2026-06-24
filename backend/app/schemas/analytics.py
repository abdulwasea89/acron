"""Analytics schemas (Section 16 web analytics + mobile headline metrics)."""

from __future__ import annotations

from pydantic import BaseModel


class HeadlineMetrics(BaseModel):
    """Mobile headline analytics (Section 16): today's snapshot."""

    today_check_ins: int
    today_revenue: float
    pending_receipts: int
    pending_approvals: int
    active_members: int


class RevenueAnalytics(BaseModel):
    """Web revenue analytics (Section 16, view_revenue_analytics capability)."""

    total_revenue: float
    revenue_by_method: dict[str, float]
    member_count_by_status: dict[str, int]
    active_members: int
    churn_count: int
    currency: str
