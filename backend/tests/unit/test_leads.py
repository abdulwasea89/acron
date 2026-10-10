"""Lead profile business rules and tenant isolation."""

from __future__ import annotations

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

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
    with pytest.raises(ValidationError):
        await leads_service.update_lead(
            db, org_id=org.id, actor_id=actor.id, lead_id=lead.id,
            data=LeadUpdate(stage="unknown"),
        )


@pytest.mark.asyncio
async def test_stage_history_transitions_legacy_and_rollback(db):
    from app.services.audit_service import record_audit

    org = Organization(name="History", org_code="HISTORY")
    actor = User(email="history@example.com", hashed_password="unused")
    db.add_all([org, actor])
    await db.flush()
    lead = await leads_service.create_lead(
        db, org_id=org.id, actor_id=actor.id, data=LeadCreate(name="History Lead"),
    )
    for stage in ["contacted", "trial_booked", "visited", "joined", "lost", "new"]:
        await leads_service.update_lead(db, org_id=org.id, actor_id=actor.id,
                                       lead_id=lead.id, data=LeadUpdate(stage=stage))
    await leads_service.update_lead(db, org_id=org.id, actor_id=actor.id,
                                   lead_id=lead.id, data=LeadUpdate(stage="new", goal="Strength"))
    await record_audit(db, action="lead.updated", organization_id=org.id,
                       entity_type="lead", entity_id=lead.id, new_values={"stage": "contacted"})
    await db.flush()
    result = await leads_service.stage_history(db, org_id=org.id, lead_id=lead.id)
    assert result["total"] == 8
    assert result["items"][0]["previous_stage"] is None
    assert result["items"][0]["created"] is False
    assert result["items"][1]["previous_stage"] == "lost"
    assert result["items"][-1]["created"] is True
    paged = await leads_service.stage_history(db, org_id=org.id, lead_id=lead.id,
                                              page=2, page_size=3)
    assert len(paged["items"]) == 3
    with pytest.raises(HTTPException):
        await leads_service.stage_history(db, org_id="other", lead_id=lead.id)
    async with db.begin_nested() as transaction:
        await leads_service.change_stage(db, lead=lead, stage="joined", actor_id=actor.id)
        await db.flush()
        await transaction.rollback()
    await db.refresh(lead)
    assert lead.stage == "new"
    assert (await leads_service.stage_history(db, org_id=org.id, lead_id=lead.id))["total"] == 8


@pytest.mark.asyncio
@pytest.mark.parametrize("existing", [True, False])
async def test_referral_conversion_history(db, existing):
    from app.core.constants import MemberStatus, Role
    from app.models.membership import OrganizationMember
    from app.models.referral import Referral, ReferralCode
    from app.services.referrals_service import qualify_referral_for_member

    org = Organization(name="Referral", org_code="REF-HISTORY")
    users = [User(email=f"ref-history-{index}@example.com", hashed_password="unused")
             for index in range(2)]
    db.add_all([org, *users])
    await db.flush()
    members = [OrganizationMember(organization_id=org.id, user_id=user.id,
                                   role=Role.MEMBER, member_status=MemberStatus.ACTIVE)
               for user in users]
    db.add_all(members)
    await db.flush()
    code = ReferralCode(organization_id=org.id, member_id=members[0].id, code="REFTEST")
    db.add(code)
    await db.flush()
    db.add(Referral(organization_id=org.id, referral_code_id=code.id,
                    referrer_member_id=members[0].id, referred_member_id=members[1].id))
    if existing:
        await leads_service.create_lead(db, org_id=org.id, actor_id=users[0].id,
                                       data=LeadCreate(name="Prospect", email=users[1].email))
    await db.flush()
    await qualify_referral_for_member(db, org_id=org.id, member_id=members[1].id)
    await db.flush()
    await qualify_referral_for_member(db, org_id=org.id, member_id=members[1].id)
    lead = (await leads_service.list_leads(db, org_id=org.id))[0]
    history = await leads_service.stage_history(db, org_id=org.id, lead_id=lead.id)
    assert history["total"] == (2 if existing else 1)
    assert history["items"][0]["origin"] == "referral"
    assert history["items"][0]["stage"] == "joined"
    assert history["items"][0]["created"] is not existing
