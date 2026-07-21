# ADR 017: Push Notifications

**Status:** Accepted

## Context
Members need to receive push notifications for payment confirmations, class reminders, and approval updates. Staff need notifications for new pending receipts and tasks.

## Decision
Use Expo Push Notifications for the mobile app with Firebase Cloud Messaging as the underlying transport:

- Expo's push service handles device token registration and message routing
- Tokens are stored per member per device in the backend
- Notifications are sent from backend workers after relevant events
- Categories: payment confirmations, class reminders, approval updates, task assignments, receipt reviews
- Android and iOS handled through a single Expo API

## Consequences
- No native platform push code needed — Expo abstracts FCM and APNs
- Token management adds complexity (refresh, invalidate on reinstall)
- Notifications are best-effort — no delivery guarantees
- Silent notifications can trigger in-app data refresh
- Future: in-app notification center for missed notifications
