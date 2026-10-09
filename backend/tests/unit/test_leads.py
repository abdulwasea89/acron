"""Lead profile business rules and tenant isolation."""

from __future__ import annotations

import pytest
from fastapi import HTTPException

from app.models.organization import Organization
from app.models.user import User
from app.schemas.leads import LeadCreate, LeadUpdate
from app.services import leads_service


@pytest.mark.asyncio
async def test_profile_fields_provenance_and_tenant_isolation(db):
    org = Organization(name="Lead Gym", org_code="LEAD-GYM-1")
    other_org = Organization(name="Other Gym", org_code="OTHER-GYM-1")
    actor = User(email="lead-owner@example.com", full_name="Lead Owner", hashed_password="not-used")
    db.add_all([org, other_org, actor])
    await db.flush()

    lead = await leads_service.create_lead(
        db,
        org_id=org.id,
        actor_id=actor.id,
        data=LeadCreate(name="  Sam Prospect ", email="SAM@example.com", goal="Build strength"),
    )
    assert lead.name == "Sam Prospect"
    assert lead.email == "sam@example.com"
    assert lead.profile_sources == {"goal": "staff_entered"}

    updated = await leads_service.update_lead(
        db, org_id=org.id, actor_id=actor.id, lead_id=lead.id,
        data=LeadUpdate(stage="trial_booked", budget="$125/month"),
    )
    assert updated.stage == "trial_booked"
    assert updated.budget == "$125/month"
    assert updated.profile_sources["budget"] == "staff_entered"
    assert await leads_service.list_leads(db, org_id=other_org.id) == []
    with pytest.raises(HTTPException) as error:
        await leads_service.get_lead(db, org_id=other_org.id, lead_id=lead.id)
    assert error.value.status_code == 404


@pytest.mark.asyncio
async def test_invalid_pipeline_stage_is_rejected(db):
    org = Organization(name="Stage Gym", org_code="STAGE-GYM-1")
    actor = User(email="stage-owner@example.com", full_name="Stage Owner", hashed_password="not-used")
    db.add_all([org, actor])
    await db.flush()
    lead = await leads_service.create_lead(
        db, org_id=org.id, actor_id=actor.id, data=LeadCreate(name="Jamie"),
    )
    with pytest.raises(HTTPException) as error:
        await leads_service.update_lead(
            db, org_id=org.id, actor_id=actor.id, lead_id=lead.id,
            data=LeadUpdate(stage="unknown"),
        )
    assert error.value.status_code == 422
