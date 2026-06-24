"""Model registry.

Importing this package imports every table module so that
``SQLModel.metadata`` is fully populated (used by ``init_db`` and Alembic).
"""

from app.models.audit_log import AuditLog
from app.models.cash import CashReconciliation
from app.models.class_session import ClassBooking, ClassSession
from app.models.idempotency_key import IdempotencyKey
from app.models.membership import OrganizationMember
from app.models.organization import Organization
from app.models.payment import Payment
from app.models.payroll import PayAdvance, PayrollEntry, PayrollRun
from app.models.plan import MembershipPlan
from app.models.receipt import ReceiptUpload
from app.models.session import AuthSession
from app.models.signup_attempt import SignupAttempt
from app.models.staff import Shift, StaffInvite, Task
from app.models.subscription import Subscription
from app.models.user import User
from app.models.verification import VerificationToken

__all__ = [
    "AuditLog",
    "AuthSession",
    "CashReconciliation",
    "ClassBooking",
    "ClassSession",
    "IdempotencyKey",
    "MembershipPlan",
    "Organization",
    "OrganizationMember",
    "PayAdvance",
    "Payment",
    "PayrollEntry",
    "PayrollRun",
    "ReceiptUpload",
    "Shift",
    "SignupAttempt",
    "StaffInvite",
    "Subscription",
    "Task",
    "User",
    "VerificationToken",
]
