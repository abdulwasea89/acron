"""Aggregate v1 API router.

One aggregator keeps ``main.py`` clean and makes the full API surface easy to
read. Every domain module is mounted here.
"""

from __future__ import annotations

from fastapi import APIRouter

from app.api.v1.routes import (
    analytics,
    audit,
    auth,
    cash,
    classes,
    members,
    memberships,
    organizations,
    payments,
    payroll,
    plans,
    receipts,
    saas_billing,
    staff,
    webhooks,
    ws,
)

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(organizations.router, prefix="/organizations", tags=["organizations"])
api_router.include_router(saas_billing.router, prefix="/saas-billing", tags=["saas-billing"])
api_router.include_router(plans.router, prefix="/plans", tags=["plans"])
api_router.include_router(memberships.router, prefix="/memberships", tags=["memberships"])
api_router.include_router(members.router, prefix="/members", tags=["members"])
api_router.include_router(payments.router, prefix="/payments", tags=["payments"])
api_router.include_router(cash.router, prefix="/cash", tags=["cash"])
api_router.include_router(receipts.router, prefix="/receipts", tags=["receipts"])
api_router.include_router(classes.router, prefix="/classes", tags=["classes"])
api_router.include_router(staff.router, prefix="/staff", tags=["staff"])
api_router.include_router(payroll.router, prefix="/payroll", tags=["payroll"])
api_router.include_router(analytics.router, prefix="/analytics", tags=["analytics"])
api_router.include_router(audit.router, prefix="/audit", tags=["audit"])
api_router.include_router(webhooks.router, prefix="/webhooks", tags=["webhooks"])
api_router.include_router(ws.router, tags=["realtime"])
