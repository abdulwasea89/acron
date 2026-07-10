"""Per-organization WebSocket connection manager (Section 16 Real-Time Sync).

An owner edits a plan on the web and it appears on their phone in under ~2s: the
mutation calls ``manager.broadcast(org_id, event)`` and every socket scoped to
that org receives the JSON event. Connections are grouped by ``organization_id``
so an event for one tenant never reaches another (tenant isolation extends to the
realtime layer, Security Rule #1).

The manager holds no DB state and is a process-local singleton. In a multi-worker
deployment a Redis pub/sub fan-out would sit behind ``broadcast``; the call sites
do not change. ``broadcast`` is best-effort: a send failure just drops that dead
socket, it never breaks the request doing the mutation.
"""

from __future__ import annotations

import asyncio
from collections import defaultdict

from fastapi import WebSocket




class ConnectionManager:
    """Tracks live WebSocket connections keyed by organization."""

    def __init__(self) -> None:
        self._by_org: dict[str, set[WebSocket]] = defaultdict(set)
        self._lock = asyncio.Lock()

    async def connect(self, org_id: str, websocket: WebSocket) -> None:
        """Accept and register a socket under ``org_id``."""

        await websocket.accept()
        async with self._lock:
            self._by_org[org_id].add(websocket)

    async def disconnect(self, org_id: str, websocket: WebSocket) -> None:
        async with self._lock:
            conns = self._by_org.get(org_id)
            if conns is not None:
                conns.discard(websocket)
                if not conns:
                    self._by_org.pop(org_id, None)

    def connection_count(self, org_id: str) -> int:
        return len(self._by_org.get(org_id, ()))

    async def broadcast(self, org_id: str, event: dict) -> None:
        """Send ``event`` to every socket in ``org_id``. Best-effort.

        Dead sockets are pruned. Never raises into the caller (a failed push
        must not roll back the business mutation that triggered it).
        """

        targets = list(self._by_org.get(org_id, ()))
        if not targets:
            return
        dead: list[WebSocket] = []
        for ws in targets:
            try:
                await ws.send_json(event)
            except Exception:
                dead.append(ws)
        if dead:
            async with self._lock:
                conns = self._by_org.get(org_id)
                if conns is not None:
                    for ws in dead:
                        conns.discard(ws)
                    if not conns:
                        self._by_org.pop(org_id, None)


# Process-local singleton used by routes/services to publish events.
manager = ConnectionManager()
