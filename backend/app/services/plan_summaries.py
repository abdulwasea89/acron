"""AI-written plan summaries (recorded on first view).

A *workflow*, not an agent (ADR 018): the plan's own fields are read
deterministically and only the prose is model-driven, so this is one model call
with no tools and nothing to decide. The result is cached on the plan row
(``summary`` / ``summary_generated_at``) the first time someone views it — the
generation is the expensive part, the stored text is what we show thereafter.
"""

from __future__ import annotations

import json

from langchain_core.messages import HumanMessage, SystemMessage
from sqlalchemy.ext.asyncio import AsyncSession

from app.agent.model import build_chat_model
from app.models.base import utcnow
from app.models.plan import MembershipPlan
from app.services import plans_service

_SYSTEM = (
    "You write a short, factual summary of a plan for the owner of a workspace "
    "or gym. Use only the details provided — never invent numbers, members, or "
    "dates. Two or three sentences: what the plan is, who it is for, how it is "
    "priced and billed, and any inclusion that matters. Plain prose, no bullets, "
    "no preamble, no markdown."
)


def _plan_digest(plan: MembershipPlan) -> str:
    """Flatten the plan into the facts the model may use — nothing more."""

    lines = [
        f"Plan name: {plan.name}",
        f"Offer kind: {plan.offer_kind}",
        f"Price: {plan.currency} {plan.price:.2f}",
        f"Billing type: {plan.billing_type.value}",
        f"Visibility: {plan.visibility.value}",
        f"Status: {plan.status.value}",
    ]
    if plan.cycle_length and plan.cycle_unit:
        lines.append(f"Billing cycle: every {plan.cycle_length} {plan.cycle_unit}(s)")
    if plan.public_description:
        lines.append(f"Description: {plan.public_description}")
    if plan.spec_json:
        try:
            spec = json.loads(plan.spec_json)
        except ValueError:
            spec = None
        if isinstance(spec, dict):
            for key, value in spec.items():
                lines.append(f"{key.replace('_', ' ').title()}: {value}")
    return "\n".join(lines)


def _fallback_summary(plan: MembershipPlan) -> str:
    """Deterministic text used if the model is unavailable or errors."""

    cadence = {
        "recurring": "billed on a recurring cycle",
        "one_time_pack": "sold as a one-time pack",
        "drop_in": "charged per visit",
    }.get(plan.billing_type.value, "billed as configured")
    desc = f" {plan.public_description}" if plan.public_description else ""
    return (
        f"{plan.name} is a {plan.offer_kind} plan priced at "
        f"{plan.currency} {plan.price:.2f}, {cadence}.{desc}"
    )


async def generate_plan_summary(plan: MembershipPlan) -> str:
    """One model call over the plan digest."""

    model = build_chat_model()
    try:
        response = await model.ainvoke(
            [SystemMessage(content=_SYSTEM), HumanMessage(content=_plan_digest(plan))]
        )
    except Exception:  # noqa: BLE001 — a summary is never worth a 500
        return _fallback_summary(plan)
    text = str(response.content).strip()
    return text or _fallback_summary(plan)


async def ensure_plan_summary(
    session: AsyncSession, *, org_id: str, plan_id: str, refresh: bool = False
) -> MembershipPlan:
    """Return the plan with a recorded summary, generating it if absent.

    ``refresh`` forces a regeneration even when a summary already exists.
    """

    plan = await plans_service.get_owned_plan(session, org_id, plan_id)
    if plan.summary and not refresh:
        return plan

    plan.summary = await generate_plan_summary(plan)
    plan.summary_generated_at = utcnow()
    session.add(plan)
    return plan
