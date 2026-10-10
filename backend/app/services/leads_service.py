"""Tenant-scoped lead profile operations."""

from __future__ import annotations

import json

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.models.lead import Lead
from app.models.audit_log import AuditLog
from app.models.user import User
from app.core.security import now_utc
from app.schemas.leads import LeadCreate, LeadUpdate
from app.services.audit_service import record_audit

_PROFILE_FIELDS = {"goal", "budget", "preferred_times", "preferences"}
_STAGES = {"new", "contacted", "trial_booked", "visited", "joined", "lost"}


async def change_stage(session: AsyncSession, *, lead: Lead, stage: str,
                       actor_id: str | None, origin: str = "manual", created: bool = False) -> None:
    if stage not in _STAGES:
        raise HTTPException(status_code=422, detail="Invalid lead stage.")
    previous = None if created else lead.stage
    if previous == stage:
        return
    lead.stage = stage
    lead.updated_at = now_utc()
    session.add(lead)
    await record_audit(
        session, action="lead.stage_changed", organization_id=lead.organization_id,
        actor_user_id=actor_id, entity_type="lead", entity_id=lead.id,
        old_values={"stage": previous}, new_values={"stage": stage},
        metadata={"origin": origin, "created": created},
    )


async def stage_history(session: AsyncSession, *, org_id: str, lead_id: str,
                        page: int = 1, page_size: int = 20) -> dict:
    await get_lead(session, org_id=org_id, lead_id=lead_id)
    rows = (await session.execute(
        select(AuditLog, User.full_name).outerjoin(User, User.id == AuditLog.actor_user_id)
        .where(AuditLog.organization_id == org_id, AuditLog.entity_type == "lead",
               AuditLog.entity_id == lead_id,
               AuditLog.action.in_(["lead.stage_changed", "lead.updated"]))
        .order_by(AuditLog.created_at.desc(), AuditLog.id.desc())
    )).all()
    items = []
    for entry, actor_name in rows:
        new = json.loads(entry.new_values_json or "{}")
        old = json.loads(entry.old_values_json or "{}")
        metadata = json.loads(entry.metadata_json or "{}")
        if new.get("stage") not in _STAGES:
            continue
        items.append({
            "id": entry.id, "previous_stage": old.get("stage"), "stage": new["stage"],
            "actor_name": actor_name, "actor_user_id": entry.actor_user_id,
            "created_at": entry.created_at,
            "origin": metadata.get("origin", "manual"),
            "created": metadata.get("created", False),
        })
    offset = (page - 1) * page_size
    return {"items": items[offset:offset + page_size], "total": len(items),
            "page": page, "page_size": page_size}


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
    await change_stage(session, lead=lead, stage="new", actor_id=actor_id, created=True)
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
    if "stage" in changes:
        await change_stage(session, lead=lead, stage=changes.pop("stage"), actor_id=actor_id)
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
