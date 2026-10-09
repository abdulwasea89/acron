"""Sales lead directory and qualification profiles."""

from __future__ import annotations

import json

from fastapi import APIRouter, Depends, Header
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_session, require_capability, require_writable_org
from app.core.permissions import Capability
from app.core.tenancy import TenantContext
from app.models.organization import Organization
from app.schemas.leads import LeadCreate, LeadOut, LeadUpdate
from app.services import idempotency_service, leads_service

router = APIRouter()


@router.get("", response_model=list[LeadOut])
async def list_leads(ctx: TenantContext = Depends(require_capability(Capability.MANAGE_MEMBERS)),
                     session: AsyncSession = Depends(get_session)):
    return await leads_service.list_leads(session, org_id=ctx.org_id)


@router.post("", response_model=LeadOut, status_code=201)
async def create_lead(data: LeadCreate, ctx: TenantContext = Depends(require_capability(Capability.MANAGE_MEMBERS)),
                      org: Organization = Depends(require_writable_org),
                      session: AsyncSession = Depends(get_session),
                      idempotency_key: str | None = Header(default=None, alias="Idempotency-Key")):
    claim = await idempotency_service.claim(session, key=idempotency_key or "", endpoint="leads.create",
                                            body=data.model_dump(), organization_id=ctx.org_id, user_id=ctx.user_id)
    if not claim.claimed:
        return LeadOut.model_validate(json.loads(claim.cached_response or "{}"))
    lead = await leads_service.create_lead(session, org_id=ctx.org_id, actor_id=ctx.user_id, data=data)
    output = LeadOut.model_validate(lead)
    await idempotency_service.complete(session, claim.record, code=201, body=output.model_dump_json())
    return output


@router.get("/{lead_id}", response_model=LeadOut)
async def get_lead(lead_id: str, ctx: TenantContext = Depends(require_capability(Capability.MANAGE_MEMBERS)),
                   session: AsyncSession = Depends(get_session)):
    return await leads_service.get_lead(session, org_id=ctx.org_id, lead_id=lead_id)


@router.patch("/{lead_id}", response_model=LeadOut)
async def update_lead(lead_id: str, data: LeadUpdate,
                      ctx: TenantContext = Depends(require_capability(Capability.MANAGE_MEMBERS)),
                      org: Organization = Depends(require_writable_org),
                      session: AsyncSession = Depends(get_session),
                      idempotency_key: str | None = Header(default=None, alias="Idempotency-Key")):
    claim = await idempotency_service.claim(session, key=idempotency_key or "", endpoint=f"leads.update:{lead_id}",
                                            body=data.model_dump(exclude_unset=True),
                                            organization_id=ctx.org_id, user_id=ctx.user_id)
    if not claim.claimed:
        return LeadOut.model_validate(json.loads(claim.cached_response or "{}"))
    lead = await leads_service.update_lead(session, org_id=ctx.org_id, actor_id=ctx.user_id,
                                           lead_id=lead_id, data=data)
    output = LeadOut.model_validate(lead)
    await idempotency_service.complete(session, claim.record, code=200, body=output.model_dump_json())
    return output
