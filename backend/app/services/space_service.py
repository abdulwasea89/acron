"""Office vertical: desk & meeting-room slots (space_slot scheduling).

Slots reuse the shared scheduling table: a space slot is a ``ClassSession`` row
with ``category="space_slot"`` and bookings are ``ClassBooking`` rows, so the
gym/academy scheduling machinery (idempotent, capacity-gated booking) is reused
unchanged. Only office seat-holders (role=MEMBER bound to a company) may book.
"""

from __future__ import annotations

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.core.constants import MemberStatus, Role
from app.core.security import now_utc
from app.models.class_session import ClassBooking, ClassSession
from app.models.membership import OrganizationMember
from app.schemas.space import SpaceSlotCreate
from app.services import classes_service as classes
from app.services.audit_service import record_audit

CATEGORY = "space_slot"


async def _get_owned_slot(session: AsyncSession, org_id: str, slot_id: str) -> ClassSession:
    slot = await session.get(ClassSession, slot_id)
    if slot is None or slot.organization_id != org_id:
        raise HTTPException(status_code=404, detail="Space slot not found.")
    if slot.category != CATEGORY:
        raise HTTPException(status_code=409, detail="Not a space slot.")
    return slot


async def list_slots(session: AsyncSession, *, org_id: str, include_past: bool = False) -> list[ClassSession]:
    stmt = select(ClassSession).where(
        ClassSession.organization_id == org_id,
        ClassSession.category == CATEGORY,
        ClassSession.cancelled == False,  # noqa: E712
    )
    if not include_past:
        stmt = stmt.where(ClassSession.starts_at >= now_utc())
    return list((await session.execute(stmt.order_by(ClassSession.starts_at))).scalars())


async def create_slot(
    session: AsyncSession, *, org_id: str, data: SpaceSlotCreate, actor_id: str,
) -> ClassSession:
    title = data.title.strip()
    if not title:
        raise HTTPException(status_code=422, detail="Slot needs a title (e.g. 'Desk 14').")
    if data.capacity < 1:
        raise HTTPException(status_code=422, detail="Slot capacity must be at least 1.")
    if data.ends_at is not None and data.ends_at <= data.starts_at:
        raise HTTPException(status_code=422, detail="ends_at must be after starts_at.")

    slot = ClassSession(
        organization_id=org_id,
        category=CATEGORY,
        title=title,
        starts_at=data.starts_at,
        ends_at=data.ends_at,
        capacity=data.capacity,
    )
    session.add(slot)
    await session.flush()
    await record_audit(session, action="space_slot.created", organization_id=org_id,
                       actor_user_id=actor_id, entity_type="class_session", entity_id=slot.id,
                       new_values={"title": title, "starts_at": data.starts_at.isoformat(),
                                   "capacity": data.capacity})
    return slot


async def cancel_slot(session: AsyncSession, *, org_id: str, slot_id: str, actor_id: str) -> ClassSession:
    slot = await _get_owned_slot(session, org_id, slot_id)
    await classes.cancel_session(session, org_id=org_id, class_id=slot.id, actor_id=actor_id)
    await record_audit(session, action="space_slot.cancelled", organization_id=org_id,
                       actor_user_id=actor_id, entity_type="class_session", entity_id=slot.id)
    return slot


async def _seat_holder(session: AsyncSession, org_id: str, user_id: str) -> OrganizationMember:
    """The requesting user must be an ACTIVE office seat-holder (bound to a company)."""
    member = (
        await session.execute(
            select(OrganizationMember).where(
                OrganizationMember.organization_id == org_id,
                OrganizationMember.user_id == user_id,
            )
        )
    ).scalar_one_or_none()
    if member is None:
        raise HTTPException(status_code=404, detail="Membership not found.")
    if member.role != Role.MEMBER:
        raise HTTPException(status_code=403, detail="Only seat-holders can book desks and rooms.")
    if member.company_id is None:
        raise HTTPException(status_code=403, detail="Only seat-holders can book desks and rooms.")
    if member.member_status != MemberStatus.ACTIVE:
        raise HTTPException(status_code=403, detail="Active membership required to book space.")
    return member


async def book_slot(
    session: AsyncSession,
    *,
    org_id: str,
    user_id: str,
    slot_id: str,
    idempotency_key: str,
):
    """Idempotently book a space slot on behalf of an active seat-holder.

    Delegates the idempotent, capacity-gated booking to the shared classes
    machinery; the audit trail records the space flavour of the action.
    """

    member = await _seat_holder(session, org_id, user_id)
    slot = await _get_owned_slot(session, org_id, slot_id)
    booking = await classes.book_class(
        session, org_id=org_id, user_id=user_id,
        class_session_id=slot.id, idempotency_key=idempotency_key,
    )
    await record_audit(session, action="space_slot.booked", organization_id=org_id,
                       actor_user_id=user_id, entity_type="class_booking", entity_id=booking.id,
                       metadata={"member_id": member.id, "slot_id": slot.id})
    return booking


async def slot_bookings(session: AsyncSession, *, org_id: str, slot_id: str) -> list[dict]:
    await _get_owned_slot(session, org_id, slot_id)
    return await classes.list_bookings(session, org_id=org_id, class_id=slot_id)


async def my_slot_bookings(session: AsyncSession, *, org_id: str, user_id: str) -> list[dict]:
    """A seat-holder's own space-slot bookings (only category=space_slot)."""
    member = await _seat_holder(session, org_id, user_id)
    rows = (
        await session.execute(
            select(ClassBooking, ClassSession)
            .join(ClassSession, ClassSession.id == ClassBooking.class_session_id)
            .where(
                ClassBooking.organization_id == org_id,
                ClassBooking.member_id == member.id,
                ClassSession.category == CATEGORY,
            )
        )
    ).all()
    result = []
    for b, cs in rows:
        result.append({
            "booking_id": b.id,
            "status": b.status.value,
            "class_session": {
                "id": cs.id,
                "category": cs.category,
                "title": cs.title,
                "starts_at": cs.starts_at,
                "ends_at": cs.ends_at,
                "capacity": cs.capacity,
                "booked_count": cs.booked_count,
                "cancelled": cs.cancelled,
            },
        })
    return result
