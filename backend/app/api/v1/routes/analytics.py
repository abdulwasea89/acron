"""Analytics API routes (Section 16).

Headline metrics are available to any staff member (mobile dashboard); full
revenue analytics require the view_revenue_analytics capability (owner/manager).
"""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_session, get_tenant, require_capability
from app.core.permissions import Capability
from app.core.tenancy import TenantContext
from app.schemas.analytics import HeadlineMetrics, RevenueAnalytics
from app.services import analytics_service as analytics

router = APIRouter()


@router.get("/headline", response_model=HeadlineMetrics)
async def headline(
    ctx: TenantContext = Depends(get_tenant),
    session: AsyncSession = Depends(get_session),
):
    if not ctx.is_staff:
        from fastapi import HTTPException

        raise HTTPException(status_code=403, detail="Staff only.")
    data = await analytics.headline_metrics(session, org_id=ctx.org_id)
    return HeadlineMetrics(**data)


@router.get("/revenue", response_model=RevenueAnalytics)
async def revenue(
    ctx: TenantContext = Depends(require_capability(Capability.VIEW_REVENUE_ANALYTICS)),
    session: AsyncSession = Depends(get_session),
):
    data = await analytics.revenue_analytics(session, org_id=ctx.org_id)
    return RevenueAnalytics(**data)
