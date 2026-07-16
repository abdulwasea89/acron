"""Staff management: invites, shifts, tasks, compensation (Sections 15, 16, 17).

Owners/managers generate single-use staff invite codes (Section 17.1). A new
staff member redeems a code to create their user + membership with the invited
role. Trainers/front-desk check in/out for shifts (the hours feed payroll,
Section 15.2). Tasks are simple title+assignee+deadline items (Section 16.2).
"""

from __future__ import annotations

from datetime import timedelta

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.core.constants import MemberStatus, Role, ShiftStatus
from app.core.security import hash_password, now_utc
from app.models.membership import OrganizationMember
from app.models.organization import Organization
from app.models.staff import Shift, StaffInvite, Task
from app.models.user import User
from app.schemas.staff import CompensationUpdate, StaffInviteCreate, TaskCreateIn, TaskUpdateIn
from app.services import auth_service
from app.services.audit_service import record_audit
from app.utils.org_code import _rand


# ------------------------------------------------------------------ invites
async def create_invite(
    session: AsyncSession, *, org_id: str, data: StaffInviteCreate, actor_id: str
) -> StaffInvite:
    if data.role not in {Role.TRAINER, Role.FRONT_DESK, Role.MANAGER}:
        raise HTTPException(status_code=422, detail="Invalid staff role.")
    code = f"STAFF-{_rand(4)}-{_rand(4)}"
    invite = StaffInvite(
        organization_id=org_id,
        code=code,
        role=data.role.value,
        email=data.email.lower() if data.email else None,
        expires_at=now_utc() + timedelta(days=14),
    )
    session.add(invite)
    await session.flush()
    # Inviting staff satisfies the setup checklist flag (Section 4.8).
    org = await session.get(Organization, org_id)
    if org is not None and not org.checklist_staff_invited:
        org.checklist_staff_invited = True
        session.add(org)
    await record_audit(session, action="staff.invited", organization_id=org_id, actor_user_id=actor_id,
                       entity_type="staff_invite", entity_id=invite.id,
                       metadata={"role": data.role.value})
    return invite


async def list_invites(session: AsyncSession, *, org_id: str) -> list[StaffInvite]:
    return list(
        (
            await session.execute(
                select(StaffInvite).where(StaffInvite.organization_id == org_id)
            )
        ).scalars()
    )


async def redeem_invite(
    session: AsyncSession, *, code: str, full_name: str, password: str
) -> tuple[OrganizationMember, str, str]:
    """Redeem a staff invite -> create user+membership, return (member, access, refresh)."""

    invite = (
        await session.execute(select(StaffInvite).where(StaffInvite.code == code))
    ).scalar_one_or_none()
    if invite is None or invite.used:
        raise HTTPException(status_code=404, detail="Invalid or used invite code.")
    if invite.expires_at and invite.expires_at < now_utc():
        raise HTTPException(status_code=410, detail="Invite code expired.")

    await auth_service.validate_password_or_raise(password)

    # Email: invite-bound if specified, else a placeholder must be supplied later.
    if invite.email is None:
        raise HTTPException(status_code=422, detail="This invite requires an email-bound code.")

    user = (
        await session.execute(select(User).where(User.email == invite.email))
    ).scalar_one_or_none()
    if user is None:
        user = User(email=invite.email, full_name=full_name,
                    hashed_password=hash_password(password), email_verified=True)
        session.add(user)
        await session.flush()

    existing = (
        await session.execute(
            select(OrganizationMember).where(
                OrganizationMember.organization_id == invite.organization_id,
                OrganizationMember.user_id == user.id,
            )
        )
    ).scalar_one_or_none()
    if existing is not None:
        raise HTTPException(status_code=409, detail="Already a member of this org.")

    role = Role(invite.role)
    member = OrganizationMember(
        organization_id=invite.organization_id, user_id=user.id, role=role,
        member_status=MemberStatus.ACTIVE, joined_at=now_utc(), profile_complete=True,
    )
    session.add(member)
    invite.used = True
    invite.used_by = user.id
    session.add(invite)
    await session.flush()

    await record_audit(session, action="staff.invite_redeemed", organization_id=invite.organization_id,
                       actor_user_id=user.id, entity_type="member", entity_id=member.id,
                       metadata={"role": role.value})
    access, refresh = await auth_service.create_session(
        session, user=user, org_id=invite.organization_id, role=role
    )
    return member, access, refresh


# ------------------------------------------------------------ compensation
async def set_compensation(
    session: AsyncSession, *, org_id: str, staff_member_id: str, data: CompensationUpdate, actor_id: str
) -> OrganizationMember:
    member = await session.get(OrganizationMember, staff_member_id)
    if member is None or member.organization_id != org_id:
        raise HTTPException(status_code=404, detail="Staff member not found.")
    if member.role not in {Role.TRAINER, Role.FRONT_DESK, Role.MANAGER}:
        raise HTTPException(status_code=422, detail="Member is not staff.")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(member, field, value)
    session.add(member)
    await record_audit(session, action="staff.compensation_updated", organization_id=org_id,
                       actor_user_id=actor_id, entity_type="member", entity_id=member.id,
                       new_values=data.model_dump(exclude_unset=True))
    return member


# ----------------------------------------------------------------- shifts
async def _staff_member(session: AsyncSession, org_id: str, user_id: str) -> OrganizationMember:
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
    return member


async def check_in(session: AsyncSession, *, org_id: str, user_id: str) -> Shift:
    member = await _staff_member(session, org_id, user_id)
    open_shift = (
        await session.execute(
            select(Shift).where(
                Shift.staff_member_id == member.id,
                Shift.status == ShiftStatus.CHECKED_IN,
            )
        )
    ).scalar_one_or_none()
    if open_shift is not None:
        raise HTTPException(status_code=409, detail="Already checked in.")
    now = now_utc()
    shift = Shift(
        organization_id=org_id, staff_member_id=member.id, checked_in_at=now,
        status=ShiftStatus.CHECKED_IN, is_weekend=now.weekday() >= 5,
    )
    session.add(shift)
    await session.flush()
    await record_audit(session, action="shift.check_in", organization_id=org_id, actor_user_id=user_id,
                       entity_type="shift", entity_id=shift.id)
    return shift


async def check_out(session: AsyncSession, *, org_id: str, user_id: str) -> Shift:
    member = await _staff_member(session, org_id, user_id)
    shift = (
        await session.execute(
            select(Shift).where(
                Shift.staff_member_id == member.id,
                Shift.status == ShiftStatus.CHECKED_IN,
            ).order_by(Shift.checked_in_at.desc())
        )
    ).scalars().first()
    if shift is None:
        raise HTTPException(status_code=409, detail="No open shift to check out.")
    now = now_utc()
    shift.checked_out_at = now
    shift.status = ShiftStatus.CHECKED_OUT
    hours = max(0.0, (now - shift.checked_in_at).total_seconds() / 3600.0)
    shift.hours = round(hours, 2)
    shift.is_overtime = shift.hours > 8
    session.add(shift)
    await record_audit(session, action="shift.check_out", organization_id=org_id, actor_user_id=user_id,
                       entity_type="shift", entity_id=shift.id, new_values={"hours": shift.hours})
    return shift


# ------------------------------------------------------------------ tasks
async def create_task(
    session: AsyncSession, *, org_id: str, data: TaskCreateIn, actor_user_id: str, actor_role: Role,
    actor_member_id: str,
) -> Task:
    assignee = data.assignee_member_id
    # Trainers may only assign tasks to themselves (Section 2 matrix).
    if actor_role == Role.TRAINER:
        if assignee not in (None, actor_member_id):
            raise HTTPException(status_code=403, detail="Trainers can only assign tasks to themselves.")
        assignee = actor_member_id
    task = Task(
        organization_id=org_id, title=data.title, assignee_member_id=assignee,
        created_by=actor_user_id, deadline=data.deadline,
    )
    session.add(task)
    await session.flush()
    await record_audit(session, action="task.created", organization_id=org_id,
                       actor_user_id=actor_user_id, entity_type="task", entity_id=task.id)
    return task


async def list_tasks(session: AsyncSession, *, org_id: str) -> list[Task]:
    return list(
        (
            await session.execute(select(Task).where(Task.organization_id == org_id))
        ).scalars()
    )


async def complete_task(session: AsyncSession, *, org_id: str, task_id: str) -> Task:
    task = await session.get(Task, task_id)
    if task is None or task.organization_id != org_id:
        raise HTTPException(status_code=404, detail="Task not found.")
    task.done = True
    session.add(task)
    return task


async def update_task(session: AsyncSession, *, org_id: str, task_id: str, data: TaskUpdateIn) -> Task:
    task = await session.get(Task, task_id)
    if task is None or task.organization_id != org_id:
        raise HTTPException(status_code=404, detail="Task not found.")
    if data.title is not None:
        task.title = data.title
    if data.assignee_member_id is not None:
        task.assignee_member_id = data.assignee_member_id
    if data.deadline is not None:
        task.deadline = data.deadline
    session.add(task)
    await record_audit(session, action="task.updated", organization_id=org_id,
                       entity_type="task", entity_id=task.id, new_values=data.model_dump(exclude_none=True))
    return task


async def delete_task(session: AsyncSession, *, org_id: str, task_id: str) -> None:
    task = await session.get(Task, task_id)
    if task is None or task.organization_id != org_id:
        raise HTTPException(status_code=404, detail="Task not found.")
    await session.delete(task)
    await record_audit(session, action="task.deleted", organization_id=org_id,
                       entity_type="task", entity_id=task_id)
