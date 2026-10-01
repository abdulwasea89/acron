"use client";

import { PlanFields } from "@/components/plans/PlanFields";
import { titleCase } from "@/lib/format";
import { planStatusLabel } from "@/lib/plans";
import type { AssistantRecord } from "./AssistantDock";

/* ── AssistantRecordPanel ─────────────────────────────────────────────────
   The record the assistant was opened *about*, docked to the right edge like
   the app's own sidebar — full height, flush, no rounding. It carries the same
   rows the plan's sheet renders, so the two never drift. Frontend only: the
   record rides the dock's handoff state, so it exists only for a conversation
   opened from a record in this browser.

   No close button: the panel is dismissed by sending your own message (the
   handoff is spent at that point), so a second affordance would be noise. */

export function AssistantRecordPanel({ record }: { record: AssistantRecord }) {
  const { plan } = record;
  return (
    <aside
      aria-label="Record"
      className="fixed inset-y-0 right-0 z-30 hidden w-80 flex-col overflow-hidden border-l border-foreground/10 bg-card md:flex lg:w-96"
    >
      <header className="shrink-0 border-b border-foreground/[0.08] px-4 py-3">
        <p className="truncate text-[13px] font-semibold text-foreground">{plan.name}</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          {titleCase(plan.offer_kind ?? "membership")} · {planStatusLabel(plan.status)}
        </p>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        <PlanFields plan={plan} />
      </div>
    </aside>
  );
}
