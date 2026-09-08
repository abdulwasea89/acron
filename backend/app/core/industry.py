"""Multi-industry registry (Phase 0 of the multi-industry blueprint).

The product serves three venue verticals on one shared core:

    gym     - Gyms & fitness (existing behavior is the reference)
    office  - Corporate offices / serviced + coworking space (desks, rooms,
              private offices sold to companies; B2B invoicing)
    academy - Education academies (courses -> cohorts/batches, term tuition,
              guardians pay for students)

An ``Industry`` is a frozen, declarative description of everything that differs
between verticals: the money mode, the "offer/plan" kind + its JSON Schema,
which feature modules are enabled, the ordered onboarding checklist, role
labels, and member/payer nouns. The REST of the platform reads this registry
instead of hard-coding gym vocabulary.

Design rule: adding a new industry = adding one ``Industry`` entry + one offer
schema + (later) one vertical module slice. Never a fork.

See docs/architecture/multi-industry.md §1-§2 for the full specification.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from enum import Enum
from pathlib import Path

from app.core.constants import Role

# The app package directory: .../backend/app. Static schemas live alongside it.
_APP_DIR = Path(__file__).resolve().parents[1]
SCHEMA_DIR = _APP_DIR / "static" / "industry-schemas"


class IndustryKind(str, Enum):
    """Canonical industry keys. Stored on ``organizations.industry``.

    The legacy value ``"gym_fitness"`` was the pre-industry default; it is
    backfilled to ``gym`` by migration (see app/db/migrations).
    """

    GYM = "gym"
    OFFICE = "office"
    ACADEMY = "academy"


class OfferKind(str, Enum):
    """What an owner-defined offer/plan represents (``membership_plans.offer_kind``)."""

    MEMBERSHIP = "membership"  # gym: recurring / one_time_pack / drop_in
    SPACE = "space"            # office: desks/rooms per company contract
    COURSE = "course"          # academy: term tuition for a course batch


class MoneyMode(str, Enum):
    """How money moves between the venue and its payers."""

    CONSUMER_CONNECT = "consumer_connect"  # gym/academy: Stripe Connect + cash + receipts
    B2B_INVOICE = "b2b_invoice"            # office: invoices to companies


class ScheduleKind(str, Enum):
    """The vertical's booking/attendance object."""

    CLASSES = "classes"  # gym group classes
    SPACE = "space"      # office desk/room slots
    COHORTS = "cohorts"  # academy batches + per-lesson attendance


# Ordered onboarding checklist step codes (labels resolved via CHECKLIST_LABELS).
CHECKLIST_LABELS: dict[str, str] = {
    "stripe": "Connect your payout account",
    "offer": "Create your first plan",
    "enroll": "Set how people join",
    "staff": "Invite your team",
    "companies": "Add your first company",
    "courses": "Create a course & batch",
    "invoices": "Set your invoice details",
    "done": "Go live",
}


def _roles(*, trainer: str, front_desk: str, member: str) -> dict[Role, str]:
    """Build a full 5-role label map from the industry-specific rows."""
    return {
        Role.OWNER: "Owner",
        Role.MANAGER: "Manager",
        Role.TRAINER: trainer,
        Role.FRONT_DESK: front_desk,
        Role.MEMBER: member,
    }


@dataclass(frozen=True)
class Industry:
    """Everything that differs between venue verticals. Immutable."""

    key: IndustryKind
    label: str
    tagline: str
    money: MoneyMode
    offer_kind: OfferKind
    schedule: ScheduleKind
    requires_connect: bool
    org_code_fallback_prefix: str  # used when a venue name yields no usable words
    default_currency: str
    default_accent: str            # brand-hue hint shown during onboarding
    checklist: tuple[str, ...]     # ordered subset of CHECKLIST_LABELS keys
    modules: frozenset[str]        # enabled feature modules (feature catalog)
    roles_labels: dict[Role, str]
    member_noun: str
    payer_noun: str
    offer_schema_name: str         # file name under SCHEMA_DIR
    analytics_headline: tuple[str, ...]  # dashboard KPI keys for this vertical

    # convenience
    @property
    def key_value(self) -> str:
        return self.key.value

    @property
    def offer_schema_path(self) -> Path:
        return SCHEMA_DIR / self.offer_schema_name

    def load_offer_schema(self) -> dict:
        """Return the offer JSON Schema (draft-07) for plan-builder validation."""
        with self.offer_schema_path.open("r", encoding="utf-8") as fh:
            return json.load(fh)


INDUSTRIES: dict[IndustryKind, Industry] = {
    IndustryKind.GYM: Industry(
        key=IndustryKind.GYM,
        label="Gym & fitness",
        tagline="Gyms, studios and fitness clubs",
        money=MoneyMode.CONSUMER_CONNECT,
        offer_kind=OfferKind.MEMBERSHIP,
        schedule=ScheduleKind.CLASSES,
        requires_connect=True,
        org_code_fallback_prefix="GYM",
        default_currency="USD",
        default_accent="brand",
        checklist=("stripe", "offer", "enroll", "staff", "done"),
        modules=frozenset({
            "dashboard", "analytics", "offers", "members", "payments", "cash",
            "receipts", "tasks", "classes", "staff", "audit", "approvals",
            "payroll", "billing", "account", "settings",
        }),
        roles_labels=_roles(trainer="Trainer", front_desk="Front desk", member="Member"),
        member_noun="member",
        payer_noun="member",
        offer_schema_name="gym-offer.json",
        analytics_headline=("active_members", "today_revenue", "today_checkins", "pending_approvals"),
    ),
    IndustryKind.OFFICE: Industry(
        key=IndustryKind.OFFICE,
        label="Corporate offices",
        tagline="Serviced offices & coworking space for companies",
        money=MoneyMode.B2B_INVOICE,
        offer_kind=OfferKind.SPACE,
        schedule=ScheduleKind.SPACE,
        requires_connect=False,
        org_code_fallback_prefix="OFF",
        default_currency="USD",
        default_accent="brand",
        checklist=("companies", "offer", "invoices", "staff", "done"),
        modules=frozenset({
            "dashboard", "analytics", "offers", "companies", "invoices",
            "space", "members", "payments", "cash", "tasks", "staff",
            "audit", "approvals", "payroll", "billing", "account", "settings",
        }),
        roles_labels=_roles(trainer="Space manager", front_desk="Reception / Concierge", member="Seat-holder"),
        member_noun="seat-holder",
        payer_noun="company",
        offer_schema_name="office-offer.json",
        analytics_headline=("occupied_seats", "occupancy_pct", "space_mrr", "outstanding_invoices"),
    ),
    IndustryKind.ACADEMY: Industry(
        key=IndustryKind.ACADEMY,
        label="Education academy",
        tagline="Tutoring centres, skill academies & coaching institutes",
        money=MoneyMode.CONSUMER_CONNECT,
        offer_kind=OfferKind.COURSE,
        schedule=ScheduleKind.COHORTS,
        requires_connect=True,
        org_code_fallback_prefix="ACAD",
        default_currency="USD",
        default_accent="brand",
        checklist=("courses", "offer", "enroll", "staff", "done"),
        modules=frozenset({
            "dashboard", "analytics", "offers", "courses", "attendance",
            "members", "payments", "cash", "receipts", "tasks", "staff",
            "audit", "approvals", "payroll", "billing", "account", "settings",
        }),
        roles_labels=_roles(trainer="Teacher", front_desk="Registrar", member="Student"),
        member_noun="student",
        payer_noun="guardian",
        offer_schema_name="academy-offer.json",
        analytics_headline=("enrolled_students", "term_fee_collected", "attendance_rate", "pending_enrollments"),
    ),
}

# Back-compat: legacy rows used the pre-industry value.
_LEGACY_GYM_VALUES = {"gym_fitness"}


def normalize_industry(value: str | IndustryKind) -> IndustryKind:
    """Coerce a stored/legacy string into a canonical IndustryKind."""
    if isinstance(value, IndustryKind):
        return value
    v = (value or "").strip().lower()
    if v in _LEGACY_GYM_VALUES:
        return IndustryKind.GYM
    return IndustryKind(v)


def get_industry(value: str | IndustryKind) -> Industry:
    """Resolve an Industry by key; raises ``KeyError`` for unknown values."""
    try:
        return INDUSTRIES[normalize_industry(value)]
    except (KeyError, ValueError) as exc:
        raise KeyError(f"Unknown industry: {value!r}") from exc


def valid_industry_keys() -> list[str]:
    """Ordered canonical keys for catalog endpoints / pickers."""
    return [k.value for k in IndustryKind]


def public_industry_listing() -> list[dict]:
    """Public catalog payload for the registration industry picker."""
    return [
        {
            "key": ind.key_value,
            "label": ind.label,
            "tagline": ind.tagline,
            "requires_connect": ind.requires_connect,
            "default_currency": ind.default_currency,
        }
        for ind in INDUSTRIES.values()
    ]


def public_industry_detail(value: str | IndustryKind) -> dict:
    """Public metadata for one industry (safe subset, no secrets)."""
    ind = get_industry(value)
    return {
        "key": ind.key_value,
        "label": ind.label,
        "tagline": ind.tagline,
        "money": ind.money.value,
        "offer_kind": ind.offer_kind.value,
        "schedule": ind.schedule.value,
        "requires_connect": ind.requires_connect,
        "default_currency": ind.default_currency,
        "roles_labels": {r.value: label for r, label in ind.roles_labels.items()},
        "member_noun": ind.member_noun,
        "payer_noun": ind.payer_noun,
        "checklist": [
            {"code": code, "label": CHECKLIST_LABELS[code]}
            for code in ind.checklist
            if code in CHECKLIST_LABELS
        ],
        "modules": sorted(ind.modules),
        "analytics_headline": list(ind.analytics_headline),
        "offer_schema_name": ind.offer_schema_name,
    }
