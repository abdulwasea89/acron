"""Office vertical: desk & meeting-room slot API.

Slots are ``space_slot`` sessions on the shared scheduling table. Admins create
and cancel slots (office ``MANAGE_MEMBERS``); active seat-holders book them
(``BOOK_SPACE``, idempotent — money actions stay web-only).
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Header

from app.api.deps import get_session, get_tenant, require_capability, require_writable_org
from app.core.permissions import Capability
from app.core.tenancy import IDEMPOTENCY_HEADER, TenantContext
from app.models.class_session import ClassSession
from app.models.organization import Organization
from app.schemas.classes import BookingWithMember
from app.schemas.common import Message
from app.schemas.space import (
    SpaceBookingCreate,
    SpaceBookingOut,
    SpaceSlotCreate,
    SpaceSlotOut,
)
from app.services import space_service as space
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()


def _slot_out(cs: ClassSession) -> SpaceSlotOut:
    return SpaceSlotOut(
        id=cs.id, category=cs.category, title=cs.title,
        starts_at=cs.starts_at, ends_at=cs.ends_at,
        capacity=cs.capacity, booked_count=cs.booked_count, cancelled=cs.cancelled,
    )


@router.get("/available", response_model=list[SpaceSlotOut])
async def available_slots(
    ctx: TenantContext = Depends(get_tenant),
    session: AsyncSession = Depends(get_session),
):
    """Upcoming, not-cancelled space slots (member booking surface)."""
    return [_slot_out(s) for s in await space.list_slots(session, org_id=ctx.org_id)]


@router.get("", response_model=list[SpaceSlotOut])
async def list_slots(
    include_past: bool = False,
    ctx: TenantContext = Depends(require_capability(Capability.MANAGE_MEMBERS)),
    session: AsyncSession = Depends(get_session),
):
    """Admin schedule view of desks/rooms (staff list)."""
    return [_slot_out(s) for s in await space.list_slots(session, org_id=ctx.org_id,
                                                         include_past=include_past)]


@router.post("", response_model=SpaceSlotOut, status_code=201)
async def create_slot(
    data: SpaceSlotCreate,
    ctx: TenantContext = Depends(require_capability(Capability.MANAGE_MEMBERS)),
    org: Organization = Depends(require_writable_org),
    session: AsyncSession = Depends(get_session),
):
    slot = await space.create_slot(session, org_id=ctx.org_id, data=data, actor_id=ctx.user_id)
    return _slot_out(slot)


@router.post("/{slot_id}/cancel", response_model=SpaceSlotOut)
async def cancel_slot(
    slot_id: str,
    ctx: TenantContext = Depends(require_capability(Capability.MANAGE_MEMBERS)),
    org: Organization = Depends(require_writable_org),
    session: AsyncSession = Depends(get_session),
):
    slot = await space.cancel_slot(session, org_id=ctx.org_id, slot_id=slot_id, actor_id=ctx.user_id)
    return _slot_out(slot)


@router.post("/book", response_model=SpaceBookingOut)
async def book_slot(
    data: SpaceBookingCreate,
    idempotency_key: str = Header(default="", alias=IDEMPOTENCY_HEADER),
    ctx: TenantContext = Depends(require_capability(Capability.BOOK_SPACE)),
    session: AsyncSession = Depends(get_session),
):
    booking = await space.book_slot(
        session, org_id=ctx.org_id, user_id=ctx.user_id,
        slot_id=data.slot_id, idempotency_key=idempotency_key,
    )
    slot = await session.get(ClassSession, booking.class_session_id)
    return SpaceBookingOut(
        booking_id=booking.id, status=booking.status.value, slot=_slot_out(slot),
    )


@router.get("/my-bookings", response_model=list[SpaceBookingOut])
async def my_bookings(
    ctx: TenantContext = Depends(require_capability(Capability.BOOK_SPACE)),
    session: AsyncSession = Depends(get_session),
):
    """A seat-holder's own desk/room bookings (self-service)."""
    result = []
    for row in await space.my_slot_bookings(session, org_id=ctx.org_id, user_id=ctx.user_id):
        result.append(SpaceBookingOut(
            booking_id=row["booking_id"], status=row["status"],
            slot=SpaceSlotOut(**row["class_session"]),
        ))
    return result


@router.get("/{slot_id}/bookings", response_model=list[BookingWithMember])
async def slot_bookings(
    slot_id: str,
    ctx: TenantContext = Depends(get_tenant),
    session: AsyncSession = Depends(get_session),
):
    return await space.slot_bookings(session, org_id=ctx.org_id, slot_id=slot_id)


@router.delete("/bookings/{booking_id}", response_model=Message)
async def cancel_booking(
    booking_id: str,
    ctx: TenantContext = Depends(require_capability(Capability.BOOK_SPACE)),
    session: AsyncSession = Depends(get_session),
):
    from app.services.classes_service import cancel_booking

    await cancel_booking(session, org_id=ctx.org_id, user_id=ctx.user_id, booking_id=booking_id)
    return Message(message="Booking cancelled.")
