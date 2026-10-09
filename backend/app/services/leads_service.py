"""Tenant-scoped lead profile operations."""

from __future__ import annotations

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.models.lead import Lead
from app.core.security import now_utc
from app.schemas.leads import LeadCreate, LeadUpdate
from app.services.audit_service import record_audit

_PROFILE_FIELDS = {"goal", "budget", "preferred_times", "preferences"}
_STAGES = {"new", "contacted", "trial_booked", "visited", "joined", "lost"}


async def list_leads(session: AsyncSession, *, org_id: str) -> list[Lead]:
    return list((await session.execute(
        select(Lead).where(Lead.organization_id == org_id).order_by(Lead.updated_at.desc())
    )).scalars())


async def get_lead(session: AsyncSession, *, org_id: str, lead_id: str) -> Lead:
    lead = await session.get(Lead, lead_id)
    if lead is None or lead.organization_id != org_id:
        raise HTTPException(status_code=404, detail="Lead not found.")
    return lead


async def create_lead(session: AsyncSession, *, org_id: str, actor_id: str, data: LeadCreate) -> Lead:
    values = data.model_dump()
    values["name"] = values["name"].strip()
    values["email"] = values["email"].strip().lower() if values["email"] else None
    values["profile_sources"] = {key: "staff_entered" for key in _PROFILE_FIELDS if values[key]}
    lead = Lead(organization_id=org_id, created_by=actor_id, **values)
    session.add(lead)
    await session.flush()
    await record_audit(session, action="lead.created", organization_id=org_id, actor_user_id=actor_id,
                       entity_type="lead", entity_id=lead.id, new_values={"name": lead.name, "source": lead.source})
    return lead


async def update_lead(session: AsyncSession, *, org_id: str, actor_id: str,
                      lead_id: str, data: LeadUpdate) -> Lead:
    lead = await get_lead(session, org_id=org_id, lead_id=lead_id)
    changes = data.model_dump(exclude_unset=True)
    if "stage" in changes and changes["stage"] not in _STAGES:
        raise HTTPException(status_code=422, detail="Invalid lead stage.")
    changes = {key: value.strip() if isinstance(value, str) else value for key, value in changes.items()}
    if "email" in changes and changes["email"]:
        changes["email"] = changes["email"].lower()
    provenance = dict(lead.profile_sources or {})
    for key in _PROFILE_FIELDS.intersection(changes):
        provenance[key] = "staff_entered" if changes[key] else ""
    lead.profile_sources = provenance
    lead.updated_at = now_utc()
    for key, value in changes.items():
        setattr(lead, key, value)
    session.add(lead)
    await record_audit(session, action="lead.updated", organization_id=org_id, actor_user_id=actor_id,
                       entity_type="lead", entity_id=lead.id, new_values=changes)
    return lead
