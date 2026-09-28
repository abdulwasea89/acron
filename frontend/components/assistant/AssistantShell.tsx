"use client";

import { AssistantDock } from "./AssistantDock";

/* ── AssistantShell ───────────────────────────────────────────────────────
   Mounts the assistant dock once, around every authenticated admin page, so
   the prompt bar is available everywhere without each page wiring it up.

   Deliberately *not* excluded on /app/assistant, even though the bar is
   hidden there. The dock is what carries a prompt across the navigation to
   that page, so the provider has to stay mounted through it; hiding the bar
   is the dock's own business.

   Keyed by org id: switching orgs refreshes the layout without remounting it,
   so without the key the dock would keep the previous tenant's pending
   prompt. The key drops that state and reloads against the new org. */

export function AssistantShell({
  orgId,
  children,
}: {
  orgId: string;
  children: React.ReactNode;
}) {
  return <AssistantDock key={orgId}>{children}</AssistantDock>;
}
