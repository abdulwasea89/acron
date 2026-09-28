"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

function humanize(seg: string): string {
  if (!seg) return "";
  return seg
    .split("-")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

/**
 * Admin page header: a small muted label above a sans-semibold title.
 *
 * The label is derived from the current route: `/app/payroll` → "Payroll",
 * `/app` → "Overview".
 */
export function PageHeader({
  title,
  subtitle,
  action,
  eyebrow,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  eyebrow?: string;
}) {
  const pathname = usePathname();

  // Everything after the leading "/app" — derive a human label from the first
  // meaningful segment (member detail routes stay under their section name).
  const crumbs = pathname.replace(/^\/app\/?/, "").split("/").filter(Boolean);
  const crumbLabel = crumbs.length === 0 ? "Overview" : humanize(crumbs[0]);

  return (
    <div className="mb-6 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <p className="mb-1.5 text-[13px] font-medium text-muted-foreground">
          {eyebrow ?? crumbLabel}
        </p>
        <h1 className="font-heading text-[26px] leading-tight tracking-tight text-foreground sm:text-3xl">
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
