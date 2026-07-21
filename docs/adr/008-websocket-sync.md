# ADR 008: WebSocket Real-Time Sync

## Context
An owner creates a membership plan on their laptop and expects to see it on their phone immediately. A trainer checks in for a shift and the owner should see it without refreshing. Polling would be wasteful and slow.

## Decision
Use FastAPI's native WebSocket support for real-time bidirectional communication.

- Server publishes events to a Redis pub/sub channel per organization
- Each client maintains a single WebSocket connection scoped to their org
- Event types: `shift.*`, `payment.*`, `plan.*`, `member.*`, `audit.*`, `task.*`
- Clients subscribe to relevant event patterns and update UI in real time
- Fallback: polling every 30 seconds if WebSocket connection fails

## Consequences
- Sub-2-second sync latency for all org-scoped events
- No polling overhead — reduces server load
- More complex client code (reconnection logic, event routing)
- Redis required as pub/sub broker
- Stale data risk if client misses an event during reconnection — full reload resolves this
