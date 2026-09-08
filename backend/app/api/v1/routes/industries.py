"""Industry catalog routes (multi-industry Phase 0).

Public endpoints power the registration industry picker and the schema-driven
plan builder; the org-scoped industry metadata (``/organizations/me/industry``)
lives in ``organizations.py`` because it needs tenant context.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.core.industry import (
    get_industry,
    public_industry_detail,
    public_industry_listing,
)

router = APIRouter()


@router.get("/industries")
async def list_industries() -> list[dict]:
    """Public catalog for the registration "What kind of place is this?" picker."""

    return public_industry_listing()


@router.get("/industries/{key}")
async def industry_detail(key: str) -> dict:
    """Public metadata for one industry (labels, modules, checklist, nouns)."""

    try:
        return public_industry_detail(key)
    except KeyError:
        raise HTTPException(status_code=404, detail="Unknown industry.")


@router.get("/industries/{key}/offer-schema")
async def industry_offer_schema(key: str) -> dict:
    """The JSON Schema (draft-07) an industry's offer spec must validate against.

    The schema-driven plan builder fetches this to render the right fields for
    the org's industry. Served unauthenticated — it contains no tenant data.
    """

    try:
        return get_industry(key).load_offer_schema()
    except KeyError:
        raise HTTPException(status_code=404, detail="Unknown industry.")
