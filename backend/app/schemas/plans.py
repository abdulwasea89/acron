"""Membership plan schemas (Section 6, multi-industry Phase 0)."""

from __future__ import annotations

from pydantic import BaseModel

from app.core.constants import PlanBillingType, PlanVisibility, TaxMode
from app.core.industry import OfferKind


class PlanCreate(BaseModel):
    name: str
    public_description: str | None = None
    internal_notes: str | None = None
    price: float = 0.0
    currency: str | None = None  # defaults to org currency
    tax_mode: TaxMode = TaxMode.INCLUSIVE
    tax_rate: float = 0.0
    billing_type: PlanBillingType = PlanBillingType.RECURRING
    cycle_length: int | None = None
    cycle_unit: str | None = None
    auto_renew: bool = True
    trial_days: int = 0
    pack_size: int | None = None
    validity_days: int | None = None
    inclusions_json: str | None = None
    rules_json: str | None = None
    visibility: PlanVisibility = PlanVisibility.PUBLIC
    featured: bool = False
    # Multi-industry offer shape. Defaults to the org's industry offer kind
    # (membership for gym, space for office, course for academy). The industry
    # spec object is validated server-side against the industry JSON Schema.
    offer_kind: OfferKind | None = None
    spec: dict | None = None


class PlanUpdate(BaseModel):
    name: str | None = None
    public_description: str | None = None
    internal_notes: str | None = None
    price: float | None = None
    tax_mode: TaxMode | None = None
    tax_rate: float | None = None
    cycle_length: int | None = None
    cycle_unit: str | None = None
    auto_renew: bool | None = None
    trial_days: int | None = None
    pack_size: int | None = None
    validity_days: int | None = None
    inclusions_json: str | None = None
    rules_json: str | None = None
    visibility: PlanVisibility | None = None
    featured: bool | None = None


class ArchiveRequest(BaseModel):
    replacement_plan_id: str | None = None


class PlanOut(BaseModel):
    id: str
    name: str
    public_description: str | None
    price: float
    currency: str
    tax_mode: str
    tax_rate: float
    billing_type: str
    visibility: str
    status: str
    featured: bool
    offer_kind: str = "membership"
    spec: dict | None = None
