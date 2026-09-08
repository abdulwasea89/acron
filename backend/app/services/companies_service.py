"""Office companies service: tenant companies, seat contracts, seat-holder invites.

A company holds one or more active seat contracts (signed against a published
space plan). Each contract auto-drafts its first B2B invoice at signing. Adding a
seat-holder is invite-only and bounded by the company's active seat capacity.
"""

from __future__ import annotations

import json

from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.core.constants import MemberStatus, PlanStatus, Role
from app.core.industry import OfferKind
from app.core.security import now_utc
from app.models.company import Company
from app.models.company_contract import CompanyContract
from app.models.invoice import Invoice
from app.models.membership import OrganizationMember
from app.models.organization import Organization
from app.models.payment import Payment
from app.models.plan import MembershipPlan
from app.models.user import User
from app.schemas.companies import CompanyCreate, CompanyUpdate, ContractCreate
from app.services import invoices_service, members_service
from app.services.audit_service import record_audit

_OPEN = ["sent", "partial"]


async def _get_owned_company(session: AsyncSession, org_id: str, company_id: str) -> Company:
    company = await session.get(Company, company_id)
    if company is None or company.organization_id != org_id:
        raise HTTPException(status_code=404, detail="Company not found.")
    return company


async def list_companies(session: AsyncSession, *, org_id: str) -> list[dict]:
    companies = list(
        (await session.execute(
            select(Company).where(Company.organization_id == org_id)
            .order_by(Company.created_at)
        )).scalars()
    )

    capacity_rows = (
        await session.execute(
            select(CompanyContract.company_id, CompanyContract.seats)
            .where(
                CompanyContract.organization_id == org_id,
                CompanyContract.status == "active",
            )
        )
    ).all()
    capacity: dict[str, int] = {}
    for cid, seats in capacity_rows:
        capacity[cid] = capacity.get(cid, 0) + int(seats)

    occupied_rows = (
        await session.execute(
            select(OrganizationMember.company_id)
            .where(
                OrganizationMember.organization_id == org_id,
                OrganizationMember.role == Role.MEMBER,
                OrganizationMember.member_status == MemberStatus.ACTIVE,
                OrganizationMember.company_id.is_not(None),
            )
        )
    ).scalars().all()
    occupied: dict[str, int] = {}
    for cid in occupied_rows:
        occupied[cid] = occupied.get(cid, 0) + 1

    result = []
    for c in companies:
        outstanding = await _outstanding_total(session, org_id=org_id, company_id=c.id)
        result.append({
            "id": c.id, "name": c.name, "status": c.status,
            "contact_name": c.contact_name, "contact_email": c.contact_email,
            "contact_phone": c.contact_phone, "billing_email": c.billing_email,
            "tax_id": c.tax_id, "address": c.address, "notes": c.notes,
            "created_at": c.created_at,
            "seat_capacity": capacity.get(c.id, 0),
            "occupied_seats": occupied.get(c.id, 0),
            "outstanding_total": outstanding,
        })
    return result


async def _outstanding_total(session: AsyncSession, *, org_id: str, company_id: str) -> float:
    invoices = (
        await session.execute(
            select(Invoice).where(
                Invoice.organization_id == org_id,
                Invoice.company_id == company_id,
                Invoice.status.in_(_OPEN),
            )
        )
    ).scalars().all()
    if not invoices:
        return 0.0
    gross = round(sum(i.total for i in invoices), 2)
    paid = (
        await session.execute(
            select(Payment.amount).where(
                Payment.organization_id == org_id,
                Payment.invoice_id.in_([i.id for i in invoices]),
                Payment.status == "succeeded",
            )
        )
    ).scalars().all()
    return round(gross - sum(paid or []), 2)


async def create_company(
    session: AsyncSession, *, org: Organization, data: CompanyCreate, actor_id: str,
) -> Company:
    company = Company(
        organization_id=org.id,
        name=data.name.strip(),
        contact_name=data.contact_name,
        contact_email=data.contact_email,
        contact_phone=data.contact_phone,
        billing_email=data.billing_email,
        tax_id=data.tax_id,
        address=data.address,
        notes=data.notes,
    )
    session.add(company)
    await session.flush()

    if not org.checklist_companies_added:
        org.checklist_companies_added = True
        session.add(org)

    await record_audit(session, action="company.created", organization_id=org.id, actor_user_id=actor_id,
                       entity_type="company", entity_id=company.id,
                       new_values={"name": company.name})
    return company


async def update_company(
    session: AsyncSession, *, org_id: str, company_id: str, data: CompanyUpdate, actor_id: str,
) -> Company:
    company = await _get_owned_company(session, org_id, company_id)
    old_name = company.name
    for field, value in data.model_dump(exclude_unset=True).items():
        if value is not None or field == "notes":
            setattr(company, field, value.strip() if isinstance(value, str) else value)
    session.add(company)
    await record_audit(session, action="company.updated", organization_id=org_id, actor_user_id=actor_id,
                       entity_type="company", entity_id=company.id,
                       old_values={"name": old_name}, new_values={"name": company.name})
    return company


async def deactivate_company(
    session: AsyncSession, *, org_id: str, company_id: str, actor_id: str,
) -> Company:
    company = await _get_owned_company(session, org_id, company_id)
    if company.status != "active":
        raise HTTPException(status_code=409, detail="Company is already deactivated.")
    active = (
        await session.execute(
            select(CompanyContract).where(
                CompanyContract.organization_id == org_id,
                CompanyContract.company_id == company_id,
                CompanyContract.status == "active",
            )
        )
    ).scalars().first()
    if active is not None:
        raise HTTPException(
            status_code=409,
            detail="End the company's active contract before deactivating it.",
        )
    company.status = "deactivated"
    session.add(company)
    await record_audit(session, action="company.deactivated", organization_id=org_id, actor_user_id=actor_id,
                       entity_type="company", entity_id=company.id)
    return company


async def company_detail(session: AsyncSession, *, org_id: str, company_id: str) -> dict:
    company = await _get_owned_company(session, org_id, company_id)
    contracts = list(
        (await session.execute(
            select(CompanyContract)
            .where(CompanyContract.organization_id == org_id, CompanyContract.company_id == company_id)
            .order_by(CompanyContract.created_at.desc())
        )).scalars()
    )
    seat_holders = (
        await session.execute(
            select(OrganizationMember, User)
            .join(User, User.id == OrganizationMember.user_id)
            .where(
                OrganizationMember.organization_id == org_id,
                OrganizationMember.company_id == company_id,
            )
            .order_by(OrganizationMember.created_at)
        )
    ).all()
    return {"company": company, "contracts": contracts,
            "seat_holders": [(m, u) for m, u in seat_holders]}


async def list_contracts(session: AsyncSession, *, org_id: str, company_id: str) -> list[CompanyContract]:
    return list(
        (await session.execute(
            select(CompanyContract).where(
                CompanyContract.organization_id == org_id,
                CompanyContract.company_id == company_id,
            ).order_by(CompanyContract.created_at.desc())
        )).scalars()
    )


async def create_contract(
    session: AsyncSession, *, org: Organization, company_id: str, data: ContractCreate, actor_id: str,
) -> CompanyContract:
    """Sign a company onto a published space plan for a block of seats.

    Snapshots per-seat price + term from the plan and its spec, then auto-drafts
    the first invoice for the term."""

    company = await _get_owned_company(session, org.id, company_id)
    if company.status != "active":
        raise HTTPException(status_code=409, detail="Company is deactivated.")

    plan = await session.get(MembershipPlan, data.plan_id)
    if plan is None or plan.organization_id != org.id:
        raise HTTPException(status_code=404, detail="Space plan not found.")
    if plan.status != PlanStatus.PUBLISHED or plan.offer_kind != OfferKind.SPACE.value:
        raise HTTPException(status_code=409, detail="Only published space plans can be signed.")
    if data.seats < 1:
        raise HTTPException(status_code=422, detail="Seats must be at least 1.")

    spec = {}
    if plan.spec_json:
        try:
            spec = json.loads(plan.spec_json)
        except ValueError:
            spec = {}
    term = spec.get("term", "monthly")
    if term not in {"monthly", "quarterly", "annual"}:
        raise HTTPException(status_code=422, detail="Plan term must be monthly, quarterly or annual.")

    # A company cannot hold two active contracts on the same plan.
    existing = (
        await session.execute(
            select(CompanyContract).where(
                CompanyContract.organization_id == org.id,
                CompanyContract.company_id == company_id,
                CompanyContract.plan_id == plan.id,
                CompanyContract.status == "active",
            )
        )
    ).scalars().first()
    if existing is not None:
        raise HTTPException(status_code=409, detail="Company already holds this space plan.")

    start = data.start_date or now_utc().date()
    contract = CompanyContract(
        organization_id=org.id,
        company_id=company_id,
        plan_id=plan.id,
        seats=data.seats,
        price_per_seat=plan.price,  # snapshot — plan edits never reprice a signed contract
        currency=plan.currency or org.default_currency,
        term=term,
        room_credits_remaining=int(spec.get("room_credits") or 0),
        start_date=start,
        next_billing_at=invoices_service._add_months(
            start, invoices_service.term_months(term)),
        status="active",
        notes=data.notes,
    )
    session.add(contract)
    await session.flush()

    await invoices_service.create_for_contract(
        session, org=org, contract=contract, plan=plan, actor_id=actor_id,
    )
    await record_audit(session, action="contract.created", organization_id=org.id, actor_user_id=actor_id,
                       entity_type="company_contract", entity_id=contract.id,
                       new_values={"company_id": company_id, "plan_id": plan.id,
                                   "seats": data.seats, "term": term,
                                   "price_per_seat": plan.price})
    return contract


async def end_contract(
    session: AsyncSession, *, org_id: str, contract_id: str, actor_id: str,
) -> CompanyContract:
    contract = await session.get(CompanyContract, contract_id)
    if contract is None or contract.organization_id != org_id:
        raise HTTPException(status_code=404, detail="Contract not found.")
    if contract.status != "active":
        raise HTTPException(status_code=409, detail="Contract is already ended.")
    contract.status = "ended"
    contract.end_date = now_utc().date()
    session.add(contract)
    await record_audit(session, action="contract.ended", organization_id=org_id, actor_user_id=actor_id,
                       entity_type="company_contract", entity_id=contract.id)
    return contract


async def _seat_capacity(session: AsyncSession, *, org_id: str, company_id: str) -> int:
    rows = (
        await session.execute(
            select(CompanyContract.seats).where(
                CompanyContract.organization_id == org_id,
                CompanyContract.company_id == company_id,
                CompanyContract.status == "active",
            )
        )
    ).scalars().all()
    return sum(int(s) for s in rows)


async def _occupied_seats(session: AsyncSession, *, org_id: str, company_id: str) -> int:
    return int(
        (
            await session.execute(
                select(func.count()).select_from(OrganizationMember).where(
                    OrganizationMember.organization_id == org_id,
                    OrganizationMember.company_id == company_id,
                    OrganizationMember.role == Role.MEMBER,
                    OrganizationMember.member_status == MemberStatus.ACTIVE,
                )
            )
        ).scalar()
        or 0
    )


async def invite_seat_holder(
    session: AsyncSession, *, org_id: str, company_id: str, email: str, actor_id: str,
) -> tuple[OrganizationMember, str]:
    """Invite someone to sit under this company (invite-only office onboarding).

    Refuses when the company's active seat capacity is already fully occupied so
    admins can't oversell a signed contract."""

    company = await _get_owned_company(session, org_id, company_id)
    if company.status != "active":
        raise HTTPException(status_code=409, detail="Company is deactivated.")
    capacity = await _seat_capacity(session, org_id=org_id, company_id=company_id)
    occupied = await _occupied_seats(session, org_id=org_id, company_id=company_id)
    if capacity > 0 and occupied >= capacity:
        raise HTTPException(
            status_code=409,
            detail="Company has no remaining seats on its active contract(s). "
                   "Add seats to a contract to invite more people.",
        )

    member, code = await members_service.invite_member(
        session, org_id=org_id, email=email, actor_id=actor_id, company_id=company_id,
    )
    return member, code
