import type { ReactNode } from "react";

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
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)] sm:text-xl">{title}</h1>
        {subtitle && <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--foreground-muted)]">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
