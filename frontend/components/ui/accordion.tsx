"use client";

import { createContext, useContext, useCallback, useState, type ReactNode } from "react";

function cx(...parts: (string | false | undefined | null)[]): string {
  return parts.filter(Boolean).join(" ");
}

/* ─────── Contexts ─────── */

interface AccordionContextValue {
  openValues: string[];
  toggle: (value: string) => void;
}

const AccordionContext = createContext<AccordionContextValue | null>(null);

function useAccordion() {
  const ctx = useContext(AccordionContext);
  if (!ctx) throw new Error("Accordion sub-components must be inside <Accordion>");
  return ctx;
}

const ItemContext = createContext<string | null>(null);

/* ─────── Accordion ─────── */

interface AccordionProps {
  defaultValue?: string[];
  multiple?: boolean;
  className?: string;
  children: ReactNode;
}

export function Accordion({ defaultValue = [], multiple = false, className, children }: AccordionProps) {
  const [openValues, setOpenValues] = useState<string[]>(defaultValue);

  const toggle = useCallback(
    (value: string) => {
      setOpenValues((prev) => {
        if (prev.includes(value)) return prev.filter((v) => v !== value);
        return multiple ? [...prev, value] : [value];
      });
    },
    [multiple],
  );

  return (
    <AccordionContext.Provider value={{ openValues, toggle }}>
      <div className={cx("divide-y divide-[var(--border)]", className)}>{children}</div>
    </AccordionContext.Provider>
  );
}

/* ─────── AccordionItem ─────── */

interface AccordionItemProps {
  value: string;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
}

export function AccordionItem({ value, disabled, className, children }: AccordionItemProps) {
  const { openValues } = useAccordion();
  const open = openValues.includes(value);

  return (
    <ItemContext.Provider value={value}>
      <div
        data-state={open ? "open" : "closed"}
        data-disabled={disabled ? "" : undefined}
        className={cx(
          "transition-colors duration-150",
          open && "bg-[var(--background)]/50",
          disabled && "opacity-40 pointer-events-none",
          className,
        )}
      >
        {children}
      </div>
    </ItemContext.Provider>
  );
}

/* ─────── AccordionTrigger ─────── */

interface AccordionTriggerProps {
  className?: string;
  children: ReactNode;
}

export function AccordionTrigger({ className, children }: AccordionTriggerProps) {
  const { openValues, toggle } = useAccordion();
  const value = useContext(ItemContext);
  if (!value) throw new Error("AccordionTrigger must be inside <AccordionItem>");

  const open = openValues.includes(value);

  return (
    <h3 className="flex">
      <button
        type="button"
        onClick={() => toggle(value)}
        aria-expanded={open}
        className={cx(
          "flex w-full items-center justify-between gap-4 px-5 py-3.5 text-sm font-medium text-[var(--foreground)]",
          "transition-all duration-150 ease-in-out",
          "hover:bg-[var(--background)] active:bg-[var(--background)]/80",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--primary)]/40",
          "cursor-pointer select-none",
          className,
        )}
      >
        <span className="flex-1 min-w-0">{children}</span>
        <svg
          className={cx(
            "h-4 w-4 shrink-0 text-[var(--muted)] transition-transform duration-200 ease-in-out",
            open && "rotate-180",
          )}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
    </h3>
  );
}

/* ─────── AccordionContent ─────── */

interface AccordionContentProps {
  className?: string;
  children: ReactNode;
}

export function AccordionContent({ className, children }: AccordionContentProps) {
  const { openValues } = useAccordion();
  const value = useContext(ItemContext);
  if (!value) throw new Error("AccordionContent must be inside <AccordionItem>");

  const open = openValues.includes(value);

  return (
    <div
      data-state={open ? "open" : "closed"}
      className={cx(
        "overflow-hidden transition-all duration-300 ease-in-out",
        "border-t border-[var(--border)]",
        open ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0",
      )}
      aria-hidden={!open}
    >
      <div className={cx("px-5 py-4 text-sm", className)}>{children}</div>
    </div>
  );
}
