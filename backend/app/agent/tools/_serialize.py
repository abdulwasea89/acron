"""Serializers: ORM rows -> compact dicts for tool results.

Tool output is the model's whole world, so it stays small and explicit rather
than dumping every column. Only a handful of fields are needed to answer, and
truncating keeps a wide org from blowing the context window. Dates are ISO
strings so the model never sees an object repr.
"""

from __future__ import annotations

import json
from datetime import datetime
from typing import Any

from app.models.class_session import ClassSession
from app.models.membership import OrganizationMember
from app.models.payment import Payment
from app.models.payroll import PayrollEntry, PayrollRun
from app.models.plan import MembershipPlan
from app.models.receipt import ReceiptUpload
from app.models.user import User


def as_tool_result(value: Any) -> str:
    """Serialize a tool's return value to a JSON string.

    Tools must return a string: LangChain passes a bare ``list``/``dict`` through
    as message content, and an empty list becomes ``content == []``, which
    providers (Groq included) reject as "must be a string or at least one item".
    A JSON string is also the protocol the model expects, so this is the fix and
    not a workaround. ``default=str`` keeps a stray datetime from raising.
    """

    return json.dumps(value, default=str)


def _iso(value: datetime | None) -> str | None:
    return value.isoformat() if value is not None else None


def _value(enum_or_str: Any) -> Any:
    return getattr(enum_or_str, "value", enum_or_str)


def member_row(member: OrganizationMember, user: User | None = None) -> dict:
    return {
        "member_id": member.id,
        "name": (member.display_name or (user.full_name if user else None)),
        "email": user.email if user else None,
        "role": _value(member.role),
        "status": _value(member.member_status),
        "phone": member.phone or (user.phone if user else None),
        "joined_at": _iso(member.joined_at),
        "banned": member.banned,
    }


def payment_row(payment: Payment) -> dict:
    return {
        "payment_id": payment.id,
        "member_id": payment.member_id,
        "kind": _value(payment.kind),
        "method": _value(payment.method),
        "status": _value(payment.status),
        "amount": payment.amount,
        "refunded_amount": payment.refunded_amount,
        "currency": payment.currency,
        "paid_at": _iso(payment.paid_at),
        "note": payment.note,
    }


def plan_row(plan: MembershipPlan) -> dict:
    return {
        "plan_id": plan.id,
        "name": plan.name,
        "price": plan.price,
        "currency": plan.currency,
        "status": _value(plan.status),
        "visibility": _value(plan.visibility),
    }


def receipt_row(receipt: ReceiptUpload) -> dict:
    return {
        "receipt_id": receipt.id,
        "member_id": receipt.member_id,
        "status": _value(receipt.status),
        "extracted_amount": receipt.extracted_amount,
        "extracted_date": receipt.extracted_date,
        "confidence_score": receipt.confidence_score,
        "is_duplicate": receipt.is_duplicate,
        "auto_approved": receipt.auto_approved,
    }


def payroll_run_row(run: PayrollRun) -> dict:
    return {
        "run_id": run.id,
        "status": _value(run.status),
        "total_gross": run.total_gross,
        "total_deductions": run.total_deductions,
        "total_net": run.total_net,
        "created_at": _iso(run.created_at),
    }


def payroll_entry_row(entry: PayrollEntry) -> dict:
    return {
        "entry_id": entry.id,
        "staff_member_id": entry.staff_member_id,
        "net": entry.net,
        "fixed": entry.fixed,
        "hourly_amount": entry.hourly_amount,
        "class_amount": entry.class_amount,
        "commission_amount": entry.commission_amount,
        "bonus": entry.bonus,
        "deductions": entry.deductions,
        "payout_method": _value(entry.payout_method),
    }


def session_row(session: ClassSession) -> dict:
    return {
        "session_id": session.id,
        "title": session.title,
        "category": session.category,
        "starts_at": _iso(session.starts_at),
        "ends_at": _iso(session.ends_at),
        "capacity": session.capacity,
        "booked_count": session.booked_count,
        "cancelled": session.cancelled,
    }
