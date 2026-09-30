"""Read-only aggregates for the deterministic specialists (ADR 019).

Every specialist that isn't model-backed bottoms out in one of these. They are
deliberately tiny and uniform: a count, a sum, or a grouped sum, always
org-scoped. Keeping the SQL here rather than inline in the roster means a
specialist's definition reads as *what it asserts* rather than as a query.

Read-only by construction, and that is load-bearing rather than stylistic. All
forty specialists share the one ``AsyncSession`` bound to the run (see
``app.agent.context``), and an ``AsyncSession`` is not safe for concurrent use —
so anything that writes must not be here. See the risk note in the plan.
"""

from __future__ import annotations

from typing import Any

from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select


async def count(session: AsyncSession, model: Any, *where: Any) -> int:
    """How many rows of ``model`` match ``where``."""

    stmt = select(func.count()).select_from(model)
    if where:
        stmt = stmt.where(*where)
    return int((await session.execute(stmt)).scalar() or 0)


async def total(session: AsyncSession, column: Any, *where: Any) -> float:
    """Sum of ``column`` across rows matching ``where``; 0.0 when there are none."""

    stmt = select(func.coalesce(func.sum(column), 0.0))
    if where:
        stmt = stmt.where(*where)
    return round(float((await session.execute(stmt)).scalar() or 0.0), 2)


async def group_total(
    session: AsyncSession, key: Any, value: Any, *where: Any, limit: int = 10
) -> list[tuple[str, float]]:
    """``[(label, sum)]`` for each distinct ``key``, largest first."""

    stmt = select(key, func.coalesce(func.sum(value), 0.0))
    if where:
        stmt = stmt.where(*where)
    stmt = stmt.group_by(key).order_by(func.coalesce(func.sum(value), 0.0).desc()).limit(limit)
    rows = (await session.execute(stmt)).all()
    return [(_label(k), round(float(v or 0.0), 2)) for k, v in rows]


async def group_count(
    session: AsyncSession, key: Any, *where: Any, limit: int = 10
) -> list[tuple[str, int]]:
    """``[(label, count)]`` for each distinct ``key``, largest first."""

    stmt = select(key, func.count())
    if where:
        stmt = stmt.where(*where)
    stmt = stmt.group_by(key).order_by(func.count().desc()).limit(limit)
    rows = (await session.execute(stmt)).all()
    return [(_label(k), int(v or 0)) for k, v in rows]


def _label(value: Any) -> str:
    """A grouped bucket as a readable string.

    Enum columns come back as members, whose ``str()`` is ``"Role.OWNER"``;
    ``.value`` gives ``"owner"``. Nullable keys group under ``"none"`` so the
    label is never the string ``"None"``.
    """

    if value is None:
        return "none"
    return str(getattr(value, "value", value))


def render_rows(rows: list[tuple[str, Any]], unit: str = "") -> str:
    """``[("card", 12), ("cash", 3)]`` -> ``"card 12, cash 3"``, for a summary."""

    if not rows:
        return "no data"
    return ", ".join(f"{label} {value}{unit}" for label, value in rows)
