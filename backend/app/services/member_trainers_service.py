"""Trainer-to-member assignment service.

Links a trainer (staff member) to a member they coach. A member may have several
active trainers; only one active row exists per (member, trainer) pair.
Unassigning is a soft flip (``active=False``) so the full history is preserved
for audit (Security Rule #10).
"""

from __future__ import annotations

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.core.constants import Role
from app.models.member_trainer import MemberTrainer
from app.models.membership import OrganizationMember
from app.models.user import User
from app.services.audit_service import record_audit


async def _get_member(session: AsyncSession, org_id: str, member_id: str) -> OrganizationMember:
    member = await session.get(OrganizationMember, member_id)
    if member is None or member.organization_id != org_id:
        raise HTTPException(status_code=404, detail="Member not found.")
    return member


async def _get_trainer(session: AsyncSession, org_id: str, trainer_member_id: str) -> OrganizationMember:
    trainer = await session.get(OrganizationMember, trainer_member_id)
    if trainer is None or trainer.organization_id != org_id:
        raise HTTPException(status_code=404, detail="Trainer not found.")
    if trainer.role != Role.TRAINER:
        raise HTTPException(status_code=422, detail="Selected member is not a trainer.")
    return trainer


async def assign(
    session: AsyncSession, *, org_id: str, member_id: str, trainer_member_id: str, actor_user_id: str,
) -> MemberTrainer:
    """Link a trainer to a member. Idempotent per (member, trainer) pair."""

    member = await _get_member(session, org_id, member_id)
    if member.role != Role.MEMBER:
        raise HTTPException(status_code=422, detail="Trainers can only be assigned to members.")
    await _get_trainer(session, org_id, trainer_member_id)
    if trainer_member_id == member.id:
        raise HTTPException(status_code=422, detail="A trainer cannot be assigned to themselves.")

    existing = (
        await session.execute(
            select(MemberTrainer).where(
                MemberTrainer.organization_id == org_id,
                MemberTrainer.member_id == member_id,
                MemberTrainer.trainer_member_id == trainer_member_id,
                MemberTrainer.active == True,  # noqa: E712
            )
        )
    ).scalar_one_or_none()
    if existing is not None:
        raise HTTPException(status_code=409, detail="This trainer is already assigned to the member.")

    assignment = MemberTrainer(
        organization_id=org_id,
        member_id=member_id,
        trainer_member_id=trainer_member_id,
        assigned_by=actor_user_id,
    )
    session.add(assignment)
    await session.flush()
    await record_audit(session, action="member.trainer_assigned", organization_id=org_id,
                       actor_user_id=actor_user_id, entity_type="member", entity_id=member_id,
                       metadata={"trainer_member_id": trainer_member_id})
    return assignment


async def unassign(
    session: AsyncSession, *, org_id: str, member_id: str, trainer_member_id: str, actor_user_id: str,
) -> None:
    """Soft-unassign: flips the active row off, keeping history."""

    await _get_member(session, org_id, member_id)
    await _get_trainer(session, org_id, trainer_member_id)
    assignment = (
        await session.execute(
            select(MemberTrainer).where(
                MemberTrainer.organization_id == org_id,
                MemberTrainer.member_id == member_id,
                MemberTrainer.trainer_member_id == trainer_member_id,
                MemberTrainer.active == True,  # noqa: E712
            )
        )
    ).scalar_one_or_none()
    if assignment is None:
        raise HTTPException(status_code=404, detail="Trainer is not assigned to this member.")
    assignment.active = False
    session.add(assignment)
    await record_audit(session, action="member.trainer_unassigned", organization_id=org_id,
                       actor_user_id=actor_user_id, entity_type="member", entity_id=member_id,
                       metadata={"trainer_member_id": trainer_member_id})


async def list_for_member(
    session: AsyncSession, *, org_id: str, member_id: str,
) -> list[tuple[MemberTrainer, OrganizationMember, User]]:
    """Active trainer assignments for one member, with trainer display names."""

    await _get_member(session, org_id, member_id)
    return await _active_assignments(session, org_id=org_id, member_id=member_id)


async def _active_assignments(
    session: AsyncSession, *, org_id: str, member_id: str | None = None,
    trainer_member_id: str | None = None,
) -> list[tuple[MemberTrainer, OrganizationMember, User]]:
    """Active assignments in the org in one query (joins trainer + user)."""

    stmt = (
        select(MemberTrainer, OrganizationMember, User)
        .join(OrganizationMember, OrganizationMember.id == MemberTrainer.trainer_member_id)
        .join(User, User.id == OrganizationMember.user_id)
        .where(MemberTrainer.organization_id == org_id, MemberTrainer.active == True)  # noqa: E712
    )
    if member_id is not None:
        stmt = stmt.where(MemberTrainer.member_id == member_id)
    if trainer_member_id is not None:
        stmt = stmt.where(MemberTrainer.trainer_member_id == trainer_member_id)
    return list((await session.execute(stmt)).all())


async def org_assignments(
    session: AsyncSession, *, org_id: str,
) -> list[tuple[MemberTrainer, OrganizationMember, User]]:
    return await _active_assignments(session, org_id=org_id)


async def clients_for_trainer(
    session: AsyncSession, *, org_id: str, trainer_member_id: str,
) -> list[tuple[MemberTrainer, OrganizationMember, User]]:
    """Active members assigned to one trainer (trainer's own client list)."""

    return await _member_assignments(session, org_id=org_id, trainer_member_id=trainer_member_id)


async def all_clients(
    session: AsyncSession, *, org_id: str,
) -> list[tuple[MemberTrainer, OrganizationMember, User]]:
    """Every active member assignment in the org, with member details."""

    return await _member_assignments(session, org_id=org_id)


async def _member_assignments(
    session: AsyncSession, *, org_id: str, trainer_member_id: str | None = None,
) -> list[tuple[MemberTrainer, OrganizationMember, User]]:
    """Active assignments joined to the *assigned member* (client side)."""

    stmt = (
        select(MemberTrainer, OrganizationMember, User)
        .join(OrganizationMember, OrganizationMember.id == MemberTrainer.member_id)
        .join(User, User.id == OrganizationMember.user_id)
        .where(MemberTrainer.organization_id == org_id, MemberTrainer.active == True)  # noqa: E712
    )
    if trainer_member_id is not None:
        stmt = stmt.where(MemberTrainer.trainer_member_id == trainer_member_id)
    return list((await session.execute(stmt)).all())
