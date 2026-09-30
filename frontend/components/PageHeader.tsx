"use client";

import type { ReactNode } from "react";

/**
 * Admin page header: a sans-semibold title with an optional subtitle and a
 * right-aligned action. The old route-derived eyebrow was removed — the page
 * title carries the context on its own.
 *
 * The action is aligned to the *top* of the text block, not its bottom: with a
 * subtitle present, `items-end` parked the button level with the second line
 * of prose, so it read as belonging to the subtitle rather than the heading.
 * Top-aligned it sits on the title's own line — and since every header action
 * is the default h-8 against a ~35px title line box, that also reads as
 * vertically centred on the title.
 */
export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-[22px] font-semibold leading-tight tracking-tight text-foreground sm:text-[28px]">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{subtitle}</p>
        )}
      </div>
      {action}
    </div>
  );
}
