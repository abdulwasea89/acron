"""Office vertical: company, contract & seat-holder schemas (B2B invoicing)."""

from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel


class CompanyCreate(BaseModel):
    name: str
    contact_name: str | None = None
    contact_email: str | None = None
    contact_phone: str | None = None
    billing_email: str | None = None
    tax_id: str | None = None
    address: str | None = None
    notes: str | None = None


class CompanyUpdate(BaseModel):
    name: str | None = None
    contact_name: str | None = None
    contact_email: str | None = None
    contact_phone: str | None = None
    billing_email: str | None = None
    tax_id: str | None = None
    address: str | None = None
    notes: str | None = None


class CompanyOut(BaseModel):
    id: str
    name: str
    status: str
    contact_name: str | None
    contact_email: str | None
    contact_phone: str | None
    billing_email: str | None
    tax_id: str | None
    address: str | None
    notes: str | None
    created_at: datetime


class CompanyListItem(CompanyOut):
    """Company row with live numbers for list views."""

    seat_capacity: int = 0        # seats across active contracts
    occupied_seats: int = 0       # active seat-holders bound to the company
    outstanding_total: float = 0.0  # unpaid invoice balance (currency = org currency)


class ContractCreate(BaseModel):
    plan_id: str
    seats: int
    start_date: date | None = None  # defaults to today
    notes: str | None = None


class ContractOut(BaseModel):
    id: str
    company_id: str
    plan_id: str
    plan_name: str
    seats: int
    price_per_seat: float
    currency: str
    term: str
    room_credits_remaining: int
    start_date: date
    end_date: date | None
    next_billing_at: date
    status: str
    notes: str | None


class SeatHolderInvite(BaseModel):
    email: str


class SeatHolderOut(BaseModel):
    member_id: str
    user_id: str
    email: str
    full_name: str | None
    display_name: str | None
    member_status: str
    company_id: str | None
    profile_complete: bool
    joined_at: datetime | None


class SeatHolderInviteOut(BaseModel):
    member_id: str
    email: str
    member_status: str
    email_delivered: bool
    invite_code: str = ""


class CompanyDetailOut(BaseModel):
    company: CompanyOut
    contracts: list[ContractOut]
    seat_holders: list[SeatHolderOut]
