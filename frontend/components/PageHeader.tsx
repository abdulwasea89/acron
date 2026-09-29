"use client";

import type { ReactNode } from "react";

/**
 * Admin page header: a sans-semibold title with an optional subtitle and a
 * right-aligned action. The old route-derived eyebrow was removed — the page
 * title carries the context on its own.
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
    <div className="mb-6 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
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
