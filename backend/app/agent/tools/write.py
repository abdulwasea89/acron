"""Guarded write tools (ADR 018).

A write never happens on the model's say-so. Each tool first clears a
deterministic gate (role capability + the org's SaaS writability), then pauses
via ``interrupt()`` with a structured proposal and executes only after a human
confirms in the thread. The proposal is JSON-serializable (it is checkpointed),
and the idempotency key is derived deterministically from stable inputs, so
LangGraph re-running the tool node on resume cannot double-execute the write
(Security Rule #2).

``interrupt()`` is never wrapped in ``try``/``except`` — it pauses by raising,
and catching it would break the pause. Results are JSON strings, matching the
read tools (see ``_serialize.as_tool_result``).
"""

from __future__ import annotations

import hashlib

from langchain_core.tools import tool
from langgraph.types import interrupt

from app.agent.context import AgentContext, current_context
from app.agent.tools._serialize import as_tool_result
from app.core.constants import PlanStatus, SaasStatus
from app.core.permissions import Capability, role_has
from app.models.organization import Organization
from app.schemas.cash import CashPaymentLog
from app.services import cash_service as cash
from app.services import members_service as members
from app.services import payments_service as payments
from app.services import payroll_service as payroll
from app.services import plans_service as plans
from app.services import receipts_service as receipts

# Mirrors app/api/deps._NON_WRITABLE_SAAS: a delinquent org is read-only.
_NON_WRITABLE = {SaasStatus.READ_ONLY, SaasStatus.SUSPENDED, SaasStatus.CANCELLED, SaasStatus.ARCHIVED}


async def _precheck(ctx: AgentContext, capability: Capability) -> dict | None:
    """The deterministic gate every write passes before it may propose.

    Returns a refusal dict to hand back to the model, or ``None`` to continue.
    Kept separate from the interrupt so a disallowed or read-only org never even
    sees a confirmation prompt.
    """

    if not role_has(ctx.role, capability):
        return {
            "status": "not_permitted",
            "detail": f"Your role cannot perform this action ({capability.value}).",
        }
    org = await ctx.session.get(Organization, ctx.org_id)
    if org is None or org.saas_status in _NON_WRITABLE:
        return {
            "status": "not_permitted",
            "detail": "The account is read-only because the subscription is past due.",
        }
    return None


def _write_key(action: str, *parts: object) -> str:
    """Deterministic idempotency key for one logical write.

    Stable across resume re-execution, unlike a fresh UUID, so a replay returns
    the first result instead of performing the write twice.
    """

    raw = "|".join([action, *(str(p) for p in parts)])
    return "agent:" + hashlib.sha256(raw.encode()).hexdigest()[:40]


def _proposal(action: str, summary: str, args: dict) -> dict:
    return {"action": action, "summary": summary, "args": args}


def _error(exc: Exception) -> dict:
    return {"status": "error", "detail": str(getattr(exc, "detail", exc))}


def _rejected() -> str:
    return as_tool_result({"status": "rejected"})


@tool
async def refund_payment(payment_id: str, amount: float = 0.0, reason: str = "") -> str:
    """Refund a member payment (full or partial). Requires confirmation.
    ``amount`` of 0 refunds the full remaining balance."""

    ctx = current_context()
    if gate := await _precheck(ctx, Capability.PROCESS_REFUNDS):
        return as_tool_result(gate)
    decision = interrupt(
        _proposal(
            "refund_payment",
            f"Refund {amount if amount else 'the full remaining balance'} on payment {payment_id}",
            {"payment_id": payment_id, "amount": amount or None, "reason": reason or None},
        )
    )
    if not decision.get("approved"):
        return _rejected()
    try:
        payment = await payments.refund(
            ctx.session,
            org_id=ctx.org_id,
            payment_id=payment_id,
            amount=amount or None,
            reason=reason or None,
            idempotency_key=_write_key("refund", payment_id, amount),
            actor_id=ctx.user_id,
        )
    except Exception as exc:  # noqa: BLE001 — the model must see the reason, not a traceback
        return as_tool_result(_error(exc))
    return as_tool_result(
        {"status": "done", "payment_id": payment.id, "refunded_amount": payment.refunded_amount}
    )


@tool
async def change_member_status(member_id: str, action: str, reason: str = "") -> str:
    """Change a member's status. ``action`` is one of: freeze, unfreeze, cancel,
    ban, unban. Requires confirmation."""

    ctx = current_context()
    if gate := await _precheck(ctx, Capability.MANAGE_MEMBERS):
        return as_tool_result(gate)
    decision = interrupt(
        _proposal(
            "change_member_status",
            f"Set member {member_id} to '{action}'",
            {"member_id": member_id, "action": action, "reason": reason or None},
        )
    )
    if not decision.get("approved"):
        return _rejected()
    try:
        member = await members.change_status(
            ctx.session,
            org_id=ctx.org_id,
            member_id=member_id,
            action=action,
            reason=reason or None,
            actor_id=ctx.user_id,
        )
    except Exception as exc:  # noqa: BLE001
        return as_tool_result(_error(exc))
    return as_tool_result(
        {"status": "done", "member_id": member.id, "new_status": member.member_status.value}
    )


@tool
async def review_receipt(receipt_id: str, action: str, reason: str = "") -> str:
    """Approve, reject, or request more info for a pending receipt. ``action``
    is one of: approve, reject, request_info. Requires confirmation."""

    ctx = current_context()
    if gate := await _precheck(ctx, Capability.APPROVE_CASH_RECEIPTS):
        return as_tool_result(gate)
    decision = interrupt(
        _proposal(
            "review_receipt",
            f"{action.title()} receipt {receipt_id}",
            {"receipt_id": receipt_id, "action": action, "reason": reason or None},
        )
    )
    if not decision.get("approved"):
        return _rejected()
    try:
        receipt = await receipts.review(
            ctx.session,
            org_id=ctx.org_id,
            receipt_id=receipt_id,
            action=action,
            reason=reason or None,
            reviewer_user_id=ctx.user_id,
        )
    except Exception as exc:  # noqa: BLE001
        return as_tool_result(_error(exc))
    return as_tool_result(
        {"status": "done", "receipt_id": receipt.id, "new_status": receipt.status.value}
    )


@tool
async def set_plan_status(plan_id: str, status: str) -> str:
    """Publish, pause, or archive a plan. ``status`` is one of: published,
    paused, archived. Requires confirmation."""

    ctx = current_context()
    if gate := await _precheck(ctx, Capability.CREATE_EDIT_PLANS):
        return as_tool_result(gate)
    try:
        target = PlanStatus(status)
    except ValueError:
        return as_tool_result({"status": "error", "detail": f"Unknown plan status '{status}'."})
    decision = interrupt(
        _proposal("set_plan_status", f"Set plan {plan_id} to '{target.value}'",
                  {"plan_id": plan_id, "status": target.value})
    )
    if not decision.get("approved"):
        return _rejected()
    try:
        plan = await plans.set_status(
            ctx.session, org_id=ctx.org_id, plan_id=plan_id, status=target, actor_id=ctx.user_id
        )
    except Exception as exc:  # noqa: BLE001
        return as_tool_result(_error(exc))
    return as_tool_result({"status": "done", "plan_id": plan.id, "new_status": plan.status.value})


@tool
async def log_cash_payment(member_id: str, plan_id: str, amount: float, note: str = "") -> str:
    """Record an offline cash payment for a member and activate them. Requires
    confirmation."""

    ctx = current_context()
    if gate := await _precheck(ctx, Capability.LOG_CASH_PAYMENT):
        return as_tool_result(gate)
    decision = interrupt(
        _proposal(
            "log_cash_payment",
            f"Log cash payment of {amount} for member {member_id}",
            {"member_id": member_id, "plan_id": plan_id, "amount": amount, "note": note or None},
        )
    )
    if not decision.get("approved"):
        return _rejected()
    try:
        payment, _member, _pdf = await cash.log_cash_payment(
            ctx.session,
            org_id=ctx.org_id,
            data=CashPaymentLog(
                member_id=member_id, plan_id=plan_id, amount=amount, note=note or None
            ),
            staff_user_id=ctx.user_id,
        )
    except Exception as exc:  # noqa: BLE001
        return as_tool_result(_error(exc))
    return as_tool_result({"status": "done", "payment_id": payment.id, "amount": payment.amount})


async def _payroll_action(run_id: str, action: str) -> str:
    """Shared shape for the three payroll transitions (owner-only)."""

    ctx = current_context()
    if gate := await _precheck(ctx, Capability.RUN_PAYROLL):
        return as_tool_result(gate)
    labels = {
        "lock": "Lock payroll run (no more edits)",
        "finalize": "Finalize payroll and email pay stubs",
        "mark_paid": "Mark payroll run as paid",
    }
    decision = interrupt(
        _proposal(f"payroll_{action}", f"{labels[action]} — run {run_id}", {"run_id": run_id})
    )
    if not decision.get("approved"):
        return _rejected()
    try:
        fn = {"lock": payroll.lock, "finalize": payroll.finalize, "mark_paid": payroll.mark_paid}[action]
        run = await fn(ctx.session, org_id=ctx.org_id, run_id=run_id, actor_id=ctx.user_id)
    except Exception as exc:  # noqa: BLE001
        return as_tool_result(_error(exc))
    return as_tool_result({"status": "done", "run_id": run.id, "new_status": run.status.value})


@tool
async def lock_payroll(run_id: str) -> str:
    """Lock a draft payroll run so it can no longer be edited. Requires
    confirmation. Owner only."""

    return await _payroll_action(run_id, "lock")


@tool
async def finalize_payroll(run_id: str) -> str:
    """Finalize a payroll run: generate and email pay stubs. Requires
    confirmation. Owner only."""

    return await _payroll_action(run_id, "finalize")


@tool
async def mark_payroll_paid(run_id: str) -> str:
    """Mark a finalized payroll run as paid. Requires confirmation. Owner
    only."""

    return await _payroll_action(run_id, "mark_paid")


WRITE_TOOLS = [
    refund_payment,
    change_member_status,
    review_receipt,
    set_plan_status,
    log_cash_payment,
    lock_payroll,
    finalize_payroll,
    mark_payroll_paid,
]
