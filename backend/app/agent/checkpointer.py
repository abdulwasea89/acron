"""Checkpointer selection (ADR 018).

Dev and tests use the in-memory saver: it is exactly as durable as a single
process, which is all the local setup needs. Production uses the Postgres saver
so an interrupt survives a restart. The Postgres path is built lazily and falls
back to memory with a warning rather than blocking startup — an assistant that
cannot checkpoint is still more useful than an app that will not boot.

For real Postgres, the DSN is derived from ``settings.database_url`` by dropping
the asyncpg driver suffix, because the Postgres saver speaks psycopg.
"""

from __future__ import annotations

import asyncio
import logging
from contextlib import AsyncExitStack

from langgraph.checkpoint.memory import InMemorySaver

from app.core.config import settings

logger = logging.getLogger(__name__)

_checkpointer: object | None = None
_stack: AsyncExitStack | None = None
_lock = asyncio.Lock()


async def get_checkpointer() -> object:
    """Return the process-wide checkpointer, creating it once."""

    global _checkpointer, _stack
    if _checkpointer is not None:
        return _checkpointer

    async with _lock:
        if _checkpointer is not None:
            return _checkpointer
        if settings.is_sqlite:
            _checkpointer = InMemorySaver()
            return _checkpointer
        try:
            from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver

            dsn = settings.database_url.replace("+asyncpg", "")
            stack = AsyncExitStack()
            saver = await stack.enter_async_context(AsyncPostgresSaver.from_conn_string(dsn))
            await saver.setup()
            _stack = stack
            _checkpointer = saver
            logger.info("Assistant checkpointer: Postgres")
        except Exception:  # noqa: BLE001 — see module docstring
            logger.warning(
                "Assistant checkpointer fell back to memory; interrupts will not "
                "survive a restart.",
                exc_info=True,
            )
            _checkpointer = InMemorySaver()
        return _checkpointer


async def close_checkpointer() -> None:
    """Release the Postgres pool on shutdown. No-op for the memory saver."""

    global _checkpointer, _stack
    if _stack is not None:
        await _stack.aclose()
    _checkpointer = None
    _stack = None


def reset_checkpointer_for_tests() -> None:
    """Drop the cached saver so a test can start from a clean slate."""

    global _checkpointer, _stack
    _checkpointer = InMemorySaver()
    _stack = None
