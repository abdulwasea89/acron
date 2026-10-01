import type { ReactNode } from "react";

/* The settings vocabulary, shared by every tab so the rail, the rows and the
   embedded pages (account, subscription, audit) all read as one surface.

   A Section is a heading + subtitle over hairline-separated rows. A Row pairs a
   label/description on the left with a control pinned to the far right, so
   every control lines up in one column, flush with the Save bar below. */

export function Section({
  id,
  title,
  description,
  hidden = false,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  hidden?: boolean;
  children: ReactNode;
}) {
  if (hidden) return null;
  return (
    <section id={`settings-${id}`} className="scroll-mt-8">
      <h2 className="text-[18px] font-semibold tracking-tight text-foreground">{title}</h2>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      <div className="mt-5 divide-y divide-[var(--border)] border-t border-[var(--border)]">{children}</div>
    </section>
  );
}

export function Row({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-8">
      <div className="min-w-0">
        <p className="text-sm text-foreground">{label}</p>
        {description && <p className="mt-0.5 text-[12px] leading-5 text-muted-foreground">{description}</p>}
      </div>
      <div className="w-full shrink-0 sm:w-72">{children}</div>
    </div>
  );
}

/** Read-only value in a row. */
export function ReadValue({ children }: { children: ReactNode }) {
  return <span className="block truncate text-sm text-muted-foreground sm:text-right">{children}</span>;
}

/** A lighter heading for grouping rows inside a Section (e.g. Change plan,
 *  Invoices, Events) where the other tabs need no such break. */
export function SubHeading({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <p className={`text-[13px] font-medium text-foreground ${className}`}>{children}</p>;
}

/** The body of a Section — the hairline-topped, row-divided list, without the
 *  heading. For embedded pages that own their heading elsewhere. */
export function SectionBody({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`mt-5 divide-y divide-[var(--border)] border-t border-[var(--border)] ${className}`}>
      {children}
    </div>
  );
}
