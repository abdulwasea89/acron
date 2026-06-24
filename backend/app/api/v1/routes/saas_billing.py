"""SaaS subscription billing API routes (Section 3). Owner-only, web-only."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_org, get_session, require_capability
from app.core.permissions import Capability
from app.core.tenancy import TenantContext
from app.models.organization import Organization
from app.schemas.common import Message
from app.schemas.saas_billing import InvoiceOut, SaasStatusOut, TierChangeRequest
from app.services import saas_billing_service as billing

router = APIRouter()


@router.get("/status", response_model=SaasStatusOut)
async def saas_status(
    ctx: TenantContext = Depends(require_capability(Capability.MANAGE_SETTINGS)),
    org: Organization = Depends(get_org),
    session: AsyncSession = Depends(get_session),
):
    data = await billing.status(session, org=org)
    return SaasStatusOut(**data)


@router.post("/upgrade", response_model=SaasStatusOut)
async def upgrade(
    data: TierChangeRequest,
    ctx: TenantContext = Depends(require_capability(Capability.MANAGE_SETTINGS)),
    org: Organization = Depends(get_org),
    session: AsyncSession = Depends(get_session),
):
    org = await billing.upgrade(session, org=org, tier=data.tier, actor_id=ctx.user_id)
    return SaasStatusOut(**await billing.status(session, org=org))


@router.post("/downgrade", response_model=SaasStatusOut)
async def downgrade(
    data: TierChangeRequest,
    ctx: TenantContext = Depends(require_capability(Capability.MANAGE_SETTINGS)),
    org: Organization = Depends(get_org),
    session: AsyncSession = Depends(get_session),
):
    org = await billing.downgrade(session, org=org, tier=data.tier, actor_id=ctx.user_id)
    return SaasStatusOut(**await billing.status(session, org=org))


@router.post("/cancel", response_model=Message)
async def cancel(
    ctx: TenantContext = Depends(require_capability(Capability.MANAGE_SETTINGS)),
    org: Organization = Depends(get_org),
    session: AsyncSession = Depends(get_session),
):
    await billing.cancel(session, org=org, actor_id=ctx.user_id)
    return Message(message="Subscription cancelled. Active until end of paid period.")


@router.get("/invoices", response_model=list[InvoiceOut])
async def invoices(
    ctx: TenantContext = Depends(require_capability(Capability.MANAGE_SETTINGS)),
    session: AsyncSession = Depends(get_session),
):
    return [
        InvoiceOut(id=p.id, amount=p.amount, currency=p.currency, status=p.status.value,
                   created_at=p.created_at)
        for p in await billing.list_invoices(session, org_id=ctx.org_id)
    ]
