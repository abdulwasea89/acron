"""Office vertical: company/tenant CRUD + seat contracts + seat-holder invites.

All endpoints require the office ``MANAGE_COMPANIES`` capability (owner/manager
only). A gym/academy org can never satisfy it, so the routes 403 automatically —
no extra industry guard is needed. Contract signing auto-drafts the first B2B
invoice (see companies_service).
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_session, require_capability, require_writable_org
from app.core.permissions import Capability
from app.core.tenancy import TenantContext
from app.models.company import Company
from app.models.organization import Organization
from app.models.plan import MembershipPlan
from app.models.user import User
from app.schemas.companies import (
    CompanyCreate,
    CompanyDetailOut,
    CompanyListItem,
    CompanyOut,
    CompanyUpdate,
    ContractCreate,
    ContractOut,
    SeatHolderInvite,
    SeatHolderInviteOut,
    SeatHolderOut,
)
from app.services import companies_service as companies

router = APIRouter()


def _company_out(c: Company) -> CompanyOut:
    return CompanyOut(
        id=c.id, name=c.name, status=c.status,
        contact_name=c.contact_name, contact_email=c.contact_email,
        contact_phone=c.contact_phone, billing_email=c.billing_email,
        tax_id=c.tax_id, address=c.address, notes=c.notes,
        created_at=c.created_at,
    )


def _seat_holder_out(m, u: User) -> SeatHolderOut:
    return SeatHolderOut(
        member_id=m.id, user_id=u.id, email=u.email,
        full_name=u.full_name, display_name=m.display_name,
        member_status=m.member_status.value, company_id=m.company_id,
        profile_complete=m.profile_complete, joined_at=m.joined_at,
    )


async def _contract_out(session: AsyncSession, c) -> ContractOut:
    plan = await session.get(MembershipPlan, c.plan_id) if c.plan_id else None
    return ContractOut(
        id=c.id, company_id=c.company_id, plan_id=c.plan_id,
        plan_name=plan.name if plan else "Archived space plan",
        seats=c.seats, price_per_seat=c.price_per_seat, currency=c.currency,
        term=c.term, room_credits_remaining=c.room_credits_remaining,
        start_date=c.start_date, end_date=c.end_date,
        next_billing_at=c.next_billing_at, status=c.status, notes=c.notes,
    )


async def _contract_outs(session: AsyncSession, rows) -> list[ContractOut]:
    return [await _contract_out(session, c) for c in rows]


def _invite_out(member, email: str, code: str) -> SeatHolderInviteOut:
    from app.core.config import settings

    delivered = settings.email_active
    return SeatHolderInviteOut(
        member_id=member.id, email=email,
        member_status=member.member_status.value,
        email_delivered=delivered,
        invite_code="" if delivered else code,
    )


@router.get("", response_model=list[CompanyListItem])
async def list_companies(
    ctx: TenantContext = Depends(require_capability(Capability.MANAGE_COMPANIES)),
    session: AsyncSession = Depends(get_session),
):
    return [CompanyListItem(**row) for row in await companies.list_companies(session, org_id=ctx.org_id)]


@router.post("", response_model=CompanyOut, status_code=201)
async def create_company(
    data: CompanyCreate,
    ctx: TenantContext = Depends(require_capability(Capability.MANAGE_COMPANIES)),
    org: Organization = Depends(require_writable_org),
    session: AsyncSession = Depends(get_session),
):
    company = await companies.create_company(session, org=org, data=data, actor_id=ctx.user_id)
    return _company_out(company)


@router.get("/{company_id}", response_model=CompanyDetailOut)
async def company_detail(
    company_id: str,
    ctx: TenantContext = Depends(require_capability(Capability.MANAGE_COMPANIES)),
    session: AsyncSession = Depends(get_session),
):
    data = await companies.company_detail(session, org_id=ctx.org_id, company_id=company_id)
    company = data["company"]
    contracts = await _contract_outs(session, data["contracts"])
    holders = [_seat_holder_out(m, u) for m, u in data["seat_holders"]]
    return CompanyDetailOut(company=_company_out(company), contracts=contracts, seat_holders=holders)


@router.patch("/{company_id}", response_model=CompanyOut)
async def update_company(
    company_id: str,
    data: CompanyUpdate,
    ctx: TenantContext = Depends(require_capability(Capability.MANAGE_COMPANIES)),
    session: AsyncSession = Depends(get_session),
):
    company = await companies.update_company(session, org_id=ctx.org_id, company_id=company_id,
                                             data=data, actor_id=ctx.user_id)
    return _company_out(company)


@router.post("/{company_id}/deactivate", response_model=CompanyOut)
async def deactivate_company(
    company_id: str,
    ctx: TenantContext = Depends(require_capability(Capability.MANAGE_COMPANIES)),
    org: Organization = Depends(require_writable_org),
    session: AsyncSession = Depends(get_session),
):
    company = await companies.deactivate_company(session, org_id=ctx.org_id, company_id=company_id,
                                                 actor_id=ctx.user_id)
    return _company_out(company)


# ------------------------------------------------------------------ contracts
@router.get("/{company_id}/contracts", response_model=list[ContractOut])
async def list_contracts(
    company_id: str,
    ctx: TenantContext = Depends(require_capability(Capability.MANAGE_COMPANIES)),
    session: AsyncSession = Depends(get_session),
):
    return await _contract_outs(session, await companies.list_contracts(
        session, org_id=ctx.org_id, company_id=company_id))


@router.post("/{company_id}/contracts", response_model=ContractOut, status_code=201)
async def create_contract(
    company_id: str,
    data: ContractCreate,
    ctx: TenantContext = Depends(require_capability(Capability.MANAGE_COMPANIES)),
    org: Organization = Depends(require_writable_org),
    session: AsyncSession = Depends(get_session),
):
    """Sign a company onto a published space plan; auto-drafts the first invoice."""
    contract = await companies.create_contract(
        session, org=org, company_id=company_id, data=data, actor_id=ctx.user_id)
    return await _contract_out(session, contract)


@router.post("/{company_id}/contracts/{contract_id}/end", response_model=ContractOut)
async def end_contract(
    company_id: str,
    contract_id: str,
    ctx: TenantContext = Depends(require_capability(Capability.MANAGE_COMPANIES)),
    org: Organization = Depends(require_writable_org),
    session: AsyncSession = Depends(get_session),
):
    contract = await companies.end_contract(session, org_id=ctx.org_id, contract_id=contract_id,
                                            actor_id=ctx.user_id)
    return await _contract_out(session, contract)


# ------------------------------------------------------------ seat-holder invites
@router.post("/{company_id}/seat-holders", response_model=SeatHolderInviteOut, status_code=201)
async def invite_seat_holder(
    company_id: str,
    data: SeatHolderInvite,
    ctx: TenantContext = Depends(require_capability(Capability.MANAGE_COMPANIES)),
    org: Organization = Depends(require_writable_org),
    session: AsyncSession = Depends(get_session),
):
    """Invite someone as a seat-holder under this company (invite-only, capped by seats)."""
    member, code = await companies.invite_seat_holder(
        session, org_id=ctx.org_id, company_id=company_id, email=data.email, actor_id=ctx.user_id)
    return _invite_out(member, data.email, code)


@router.post("/{company_id}/seat-holders/{member_id}/resend", response_model=SeatHolderInviteOut)
async def resend_seat_holder_invite(
    company_id: str,
    member_id: str,
    ctx: TenantContext = Depends(require_capability(Capability.MANAGE_COMPANIES)),
    org: Organization = Depends(require_writable_org),
    session: AsyncSession = Depends(get_session),
):
    from app.models.membership import OrganizationMember
    from app.services import members_service as members

    member = await session.get(OrganizationMember, member_id)
    if member is None or member.organization_id != ctx.org_id or member.company_id != company_id:
        raise HTTPException(status_code=404, detail="Seat-holder not found in this company.")
    member, code = await members.resend_invite(session, org_id=ctx.org_id, member_id=member_id,
                                               actor_id=ctx.user_id)
    user = await session.get(User, member.user_id)
    return _invite_out(member, user.email if user else "", code)
