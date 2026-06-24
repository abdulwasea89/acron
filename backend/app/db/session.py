"""Async database engine and session management (SQLModel + SQLAlchemy async).

The engine is created from ``settings.database_url``. It works against both
async SQLite (local dev default) and async PostgreSQL (production) without code
changes. ``get_session`` is the FastAPI dependency that yields a transactional
``AsyncSession``.
"""

from __future__ import annotations

from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlmodel import SQLModel

from app.core.config import settings

# SQLite needs check_same_thread disabled for async usage.
_connect_args = {"check_same_thread": False} if settings.is_sqlite else {}

engine = create_async_engine(
    settings.database_url,
    echo=settings.db_echo,
    future=True,
    connect_args=_connect_args,
    # pool_pre_ping is harmless on sqlite and useful on postgres.
    pool_pre_ping=not settings.is_sqlite,
)

async_session_maker = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


async def init_db() -> None:
    """Create all tables. Used for local dev / tests when not using Alembic.

    Importing ``app.db.base`` guarantees every model is registered on
    ``SQLModel.metadata`` before ``create_all`` runs.
    """

    import app.db.base  # noqa: F401  (registers models)

    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency: yield a session, commit on success, rollback on error."""

    async with async_session_maker() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
