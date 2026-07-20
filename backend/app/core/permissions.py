"""Role capability matrix and permission checks (Section 2 of the plan).

The matrix is the single source of truth for "who can do what". Route handlers
call ``require_capability`` (via a dependency) instead of hard-coding role lists.
"""

from __future__ import annotations

from enum import Enum

from app.core.constants import Role


class Capability(str, Enum):
    REGISTER_GYM = "register_gym"
    CREATE_EDIT_PLANS = "create_edit_plans"
    ARCHIVE_PLANS = "archive_plans"
    APPROVE_CASH_RECEIPTS = "approve_cash_receipts"
    PROCESS_REFUNDS = "process_refunds"
    INVITE_MEMBERS = "invite_members"
    RUN_PAYROLL = "run_payroll"
    TOGGLE_GYM_STATUS = "toggle_gym_status"
    ASSIGN_TASKS = "assign_tasks"
    LOG_CASH_PAYMENT = "log_cash_payment"
    UPLOAD_RECEIPT = "upload_receipt"
    BOOK_CLASSES = "book_classes"
    CHECK_IN_SHIFT = "check_in_shift"
    VIEW_REVENUE_ANALYTICS = "view_revenue_analytics"
    MANAGE_SETTINGS = "manage_settings"
    MANAGE_MEMBERS = "manage_members"
    VIEW_AUDIT_LOG = "view_audit_log"


# Capability -> set of roles allowed. Mirrors the Section 2 table.
_MATRIX: dict[Capability, set[Role]] = {
    Capability.REGISTER_GYM: {Role.OWNER},
    Capability.CREATE_EDIT_PLANS: {Role.OWNER, Role.MANAGER},
    Capability.ARCHIVE_PLANS: {Role.OWNER, Role.MANAGER},  # manager = confirm only
    Capability.APPROVE_CASH_RECEIPTS: {Role.OWNER, Role.MANAGER, Role.FRONT_DESK},
    Capability.PROCESS_REFUNDS: {Role.OWNER, Role.MANAGER},  # manager limited
    Capability.INVITE_MEMBERS: {Role.OWNER, Role.MANAGER, Role.FRONT_DESK},
    Capability.RUN_PAYROLL: {Role.OWNER},
    Capability.TOGGLE_GYM_STATUS: {Role.OWNER, Role.MANAGER, Role.FRONT_DESK},
    Capability.ASSIGN_TASKS: {Role.OWNER, Role.MANAGER, Role.TRAINER},  # trainer=self
    Capability.LOG_CASH_PAYMENT: {Role.OWNER, Role.MANAGER, Role.FRONT_DESK},
    Capability.UPLOAD_RECEIPT: {Role.MEMBER},
    Capability.BOOK_CLASSES: {Role.MEMBER},
    Capability.CHECK_IN_SHIFT: {Role.TRAINER, Role.FRONT_DESK, Role.MANAGER},
    Capability.VIEW_REVENUE_ANALYTICS: {Role.OWNER, Role.MANAGER},
    Capability.MANAGE_SETTINGS: {Role.OWNER},
    Capability.MANAGE_MEMBERS: {Role.OWNER, Role.MANAGER},
    Capability.VIEW_AUDIT_LOG: {Role.OWNER, Role.MANAGER},
}


def role_has(role: Role, capability: Capability) -> bool:
    return role in _MATRIX.get(capability, set())
