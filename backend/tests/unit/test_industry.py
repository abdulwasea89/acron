"""Unit tests for the multi-industry registry (Phase 0).

Covers the three canonical industries, structural invariants every Industry must
satisfy (labels for all five roles, a loadable offer JSON Schema, checklist
subset of known codes, valid module slugs), and the legacy gym value mapping.
"""

from __future__ import annotations

import json

import pytest

from app.core.constants import Role
from app.core.industry import (
    CHECKLIST_LABELS,
    INDUSTRIES,
    IndustryKind,
    OfferKind,
    MoneyMode,
    ScheduleKind,
    get_industry,
    normalize_industry,
    public_industry_listing,
    valid_industry_keys,
)

CANONICAL_KEYS = {IndustryKind.GYM, IndustryKind.OFFICE, IndustryKind.ACADEMY}
ALL_ROLES = {Role.OWNER, Role.MANAGER, Role.TRAINER, Role.FRONT_DESK, Role.MEMBER}


def test_exactly_three_industries():
    assert set(INDUSTRIES) == CANONICAL_KEYS
    assert valid_industry_keys() == ["gym", "office", "academy"]


@pytest.mark.parametrize("key", sorted(CANONICAL_KEYS, key=lambda k: k.value))
def test_industry_invariants(key):
    ind = INDUSTRIES[key]

    assert isinstance(ind.key, IndustryKind)
    assert ind.label
    assert ind.money in MoneyMode
    assert ind.offer_kind in OfferKind
    assert ind.schedule in ScheduleKind

    # Every industry maps all five roles to a non-empty label.
    assert set(ind.roles_labels) == ALL_ROLES
    assert all(label.strip() for label in ind.roles_labels.values())

    # Offer kind matches the vertical.
    expected_offer = {
        IndustryKind.GYM: OfferKind.MEMBERSHIP,
        IndustryKind.OFFICE: OfferKind.SPACE,
        IndustryKind.ACADEMY: OfferKind.COURSE,
    }[key]
    assert ind.offer_kind is expected_offer

    # Connect requirement follows the money mode.
    assert ind.requires_connect is (ind.money is MoneyMode.CONSUMER_CONNECT)

    # Checklist is a non-empty ordered subset of known step codes, ends in done.
    assert ind.checklist
    assert set(ind.checklist) <= set(CHECKLIST_LABELS)
    assert ind.checklist[-1] == "done"

    # Enabled modules are non-empty lower-snake-case slugs.
    assert ind.modules
    assert all(m.replace("_", "").isalnum() and m.islower() for m in ind.modules)
    assert "dashboard" in ind.modules


def test_offer_kinds_distinct_per_industry():
    assert len({ind.offer_kind for ind in INDUSTRIES.values()}) == 3


@pytest.mark.parametrize("key", sorted(CANONICAL_KEYS, key=lambda k: k.value))
def test_offer_schema_files_load_as_draft07_json(key):
    schema = INDUSTRIES[key].load_offer_schema()
    assert schema["$schema"].endswith("draft-07/schema#")
    assert schema["type"] == "object"
    assert "properties" in schema
    # Each vertical's spec must name at least its mandatory attribute.
    assert "required" in schema and schema["required"]


def test_legacy_gym_value_normalizes_to_gym():
    assert normalize_industry("gym_fitness") is IndustryKind.GYM
    assert normalize_industry("GYM") is IndustryKind.GYM
    assert get_industry("gym_fitness").key_value == "gym"


def test_get_industry_unknown_raises():
    with pytest.raises(KeyError):
        get_industry("salon")


def test_public_listing_is_safe_and_ordered():
    listing = public_industry_listing()
    assert [item["key"] for item in listing] == ["gym", "office", "academy"]
    for item in listing:
        # No internal-only fields leak to the unauthenticated catalog.
        assert set(item) == {
            "key", "label", "tagline", "requires_connect", "default_currency",
        }
        assert isinstance(item["label"], str) and item["label"]


def test_offer_schema_json_files_are_valid_json():
    for key in CANONICAL_KEYS:
        path = INDUSTRIES[key].offer_schema_path
        assert path.is_file()
        # json.load raises on malformed content.
        json.loads(path.read_text(encoding="utf-8"))
