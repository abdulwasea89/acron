"""Tenant isolation primitives (Security Rule #1).

Every authenticated request carries a JWT scoped to exactly one
``organization_id``. The ``X-Organization-Id`` request header MUST match the
JWT's org. This module holds the small helpers; the actual enforcement happens
in ``app.api.deps`` where request context is available.
"""

from __future__ import annotations

from dataclasses import dataclass

from app.core.constants import Role


@dataclass(frozen=True)
class TenantContext:
    """The resolved identity + tenant scope for the current request."""

    user_id: str
    org_id: str
    role: Role

    @property
    def is_admin(self) -> bool:
        return self.role in {Role.OWNER, Role.MANAGER}

    @property
    def is_owner(self) -> bool:
        return self.role is Role.OWNER

    @property
    def is_staff(self) -> bool:
        return self.role in {Role.OWNER, Role.MANAGER, Role.TRAINER, Role.FRONT_DESK}


ORG_HEADER = "X-Organization-Id"
IDEMPOTENCY_HEADER = "Idempotency-Key"
