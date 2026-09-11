"use client";

import { forwardRef, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Children, isValidElement } from "react";
import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  KeyboardEvent as ReactKeyboardEvent,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
  ReactNode,
} from "react";

function cx(...parts: (string | false | undefined | null)[]): string {
  return parts.filter(Boolean).join(" ");
}

/* Field-label voice: mono caps, letterspaced, muted (DESIGN §6.6). */
const LABEL = "mb-1.5 block font-mono text-[11px] uppercase tracking-widest text-muted-foreground";

/* Shared focus ring — brand hairline, no heavy box-shadow. */
const FOCUS =
  "focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand/60";

/* ── Button ───────────────────────────────────────────────────────────────
   Dashboard flavor (DESIGN §10.8): only CTAs/filters are pills; square marks
   data and destructive/neutral actions. Primary = the brand pill CTA. */
type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost" | "accent";
  loading?: boolean;
  size?: "sm" | "md" | "lg";
};

export function Button({
  variant = "primary",
  loading,
  disabled,
  className,
  size = "sm",
  children,
  ...rest
}: ButtonProps) {
  const variants: Record<string, string> = {
    primary:
      "rounded-full bg-brand text-brand-foreground hover:bg-brand/90 active:brightness-95",
    secondary:
      "rounded-full border border-foreground/20 bg-transparent text-foreground hover:bg-foreground/5 hover:border-foreground/40",
    danger:
      "rounded-full bg-danger text-white hover:bg-danger-hover active:brightness-95",
    ghost:
      "rounded-full text-muted-foreground hover:bg-foreground/5 hover:text-foreground",
    accent:
      "rounded-full bg-accent text-accent-foreground hover:bg-accent-hover",
  };
  const sizes: Record<string, string> = {
    sm: "h-9 px-4 text-xs gap-1.5",
    md: "h-10 px-5 text-sm gap-2",
    lg: "h-11 px-6 text-sm gap-2",
  };
  return (
    <button
      className={cx(
        "inline-flex cursor-pointer items-center justify-center font-semibold",
        "transition duration-150",
        FOCUS,
        "disabled:opacity-40 disabled:cursor-not-allowed select-none",
        sizes[size],
        variants[variant],
        className,
      )}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && (
        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {children}
    </button>
  );
}

/* ── CategoryTabs ─────────────────────────────────────────────────────────
   The category switcher: a row of floating pills — no outer track. Active
   tab is the solid brand pill (§10.3), same language as the mobile top-nav
   chips. Counts ride along as sub-pills. Arrow keys move between tabs; the
   row scrolls horizontally on overflow instead of wrapping. */
export type CategoryTab<T extends string> = {
  value: T;
  label: string;
  count?: number;
};

type CategoryTabsProps<T extends string> = {
  tabs: CategoryTab<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
};

export function CategoryTabs<T extends string>({
  tabs,
  value,
  onChange,
  className,
}: CategoryTabsProps<T>) {
  const index = tabs.findIndex((t) => t.value === value);

  function move(next: number) {
    const t = tabs[Math.min(tabs.length - 1, Math.max(0, next))];
    if (t) onChange(t.value);
  }

  function onKeyDown(e: ReactKeyboardEvent<HTMLDivElement>) {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      move(index + 1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      move(index - 1);
    } else if (e.key === "Home") {
      e.preventDefault();
      move(0);
    } else if (e.key === "End") {
      e.preventDefault();
      move(tabs.length - 1);
    }
  }

  return (
    <div
      role="tablist"
      onKeyDown={onKeyDown}
      className={cx(
        "no-scrollbar flex w-fit max-w-full items-center gap-0.5 overflow-x-auto rounded-full border border-foreground/15 bg-transparent p-1",
        className,
      )}
    >
      {tabs.map((t) => {
        const active = t.value === value;
        return (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={active}
            tabIndex={active || index === -1 ? 0 : -1}
            onClick={() => onChange(t.value)}
            className={cx(
              "flex h-7 shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 font-mono text-xs uppercase tracking-widest transition-colors duration-150",
              FOCUS,
              active
                ? "bg-brand font-medium text-brand-foreground"
                : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground",
            )}
          >
            {t.label}
            {t.count !== undefined && (
              <span
                className={cx(
                  "inline-flex h-[17px] min-w-[17px] items-center justify-center rounded-full px-1 text-[10px] tabular-nums",
                  active
                    ? "bg-brand-foreground/20 text-brand-foreground"
                    : "bg-foreground/10 text-muted-foreground",
                )}
              >
                {t.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ── Input ────────────────────────────────────────────────────────────────
   Hairline field: `border-foreground/20`, focus swaps to brand. Fills read
   flat (bg-card) so the hairline does the work. */
type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "size"> & {
  label?: string;
  hint?: string;
  error?: string;
  prefix?: string;
  suffix?: string;
  /** `sm` matches the CategoryTabs track height (38px) for filter rows. */
  size?: "md" | "sm";
  /** Interactive control inside the field, right-aligned (e.g. Show/Hide).
   *  Unlike `suffix` this stays clickable and is anchored to the input itself,
   *  so it never drifts when a hint or error appears below. */
  trailing?: ReactNode;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, className, id, prefix, suffix, trailing, size = "md", ...rest },
  ref,
) {
  return (
    <label className="block">
      {label && <span className={LABEL}>{label}</span>}
      <div className="relative">
        {prefix && (
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{prefix}</span>
        )}
        <input
          ref={ref}
          id={id}
          className={cx(
            size === "sm"
              ? "h-[38px] w-full rounded-full border bg-transparent text-xs text-foreground"
              : "h-11 w-full rounded-full border bg-card text-sm text-foreground",
            "transition duration-150",
            "placeholder:text-muted-foreground",
            prefix && "pl-7",
            suffix && "pr-9",
            !!trailing && "pr-14",
            !prefix && !suffix && !trailing && (size === "sm" ? "px-4" : "px-3.5"),
            // A trailing control reserves the right side; the free left side
            // keeps its default padding.
            !!trailing && !prefix && !suffix && (size === "sm" ? "pl-4" : "pl-3.5"),
            error
              ? "border-danger focus:border-danger focus:ring-2 focus:ring-danger/20"
              : "border-foreground/20 hover:border-foreground/35 focus:border-brand focus:ring-2 focus:ring-brand/20",
            "focus:outline-none",
            "disabled:opacity-40 disabled:cursor-not-allowed disabled:bg-foreground/[0.04]",
            className,
          )}
          {...rest}
        />
        {suffix && (
          <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{suffix}</span>
        )}
        {trailing && (
          <span className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center">{trailing}</span>
        )}
      </div>
      {hint && !error && (
        <span className="mt-1.5 block truncate text-xs text-muted-foreground">{hint}</span>
      )}
      {error && (
        <span className="auth-field-error">
          <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          {error}
        </span>
      )}
    </label>
  );
});

/* ── Select ───────────────────────────────────────────────────────────────
   Custom listbox, not a native <select>: the OS menu can't be themed, so the
   open state looked generic HTML. Same props API as before (children are
   <option>s, onChange receives e.target.value) — call sites unchanged. The
   popup portals to <body> so scrolling dialogs and cards never clip it. */
type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, "size" | "onChange"> & {
  label?: string;
  error?: string;
  /** `sm` matches the CategoryTabs track height (38px) for filter rows. */
  size?: "md" | "sm";
  onChange?: (e: { target: { value: string } }) => void;
};

type SelectOption = { value: string; label: string; disabled?: boolean };

export function Select({
  label,
  error,
  className,
  size = "md",
  children,
  value,
  onChange,
  disabled,
  id,
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [rect, setRect] = useState<{ left: number; top?: number; bottom?: number; width: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listboxId = useId();

  // Options arrive as <option> children — parse them once per render.
  const options: SelectOption[] = useMemo(() => {
    const out: SelectOption[] = [];
    Children.toArray(children).forEach((child) => {
      if (!isValidElement(child)) return;
      const p = child.props as { value?: string | number; children?: ReactNode; disabled?: boolean };
      const text = typeof p.children === "string" ? p.children : String(p.value ?? "");
      out.push({ value: String(p.value ?? ""), label: text, disabled: p.disabled });
    });
    return out;
  }, [children]);

  const selected = options.find((o) => o.value === String(value ?? ""));
  const selectedLabel = selected?.label ?? "Select…";

  // Keep the popup glued to the trigger through scrolls and resizes. When
  // there's no room below (select near the bottom of the viewport), flip it
  // open above the trigger instead.
  function syncRect() {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const POPUP_MAX = 288; // max-h-72
    const flip = r.bottom + POPUP_MAX > window.innerHeight && r.top > r.bottom;
    setRect(
      flip
        ? { left: r.left, bottom: window.innerHeight - r.top + 6, width: r.width }
        : { left: r.left, top: r.bottom + 6, width: r.width },
    );
  }

  useEffect(() => {
    if (!open) return;
    syncRect();
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("resize", syncRect);
    window.addEventListener("scroll", syncRect, true);
    document.addEventListener("mousedown", onDoc);
    return () => {
      window.removeEventListener("resize", syncRect);
      window.removeEventListener("scroll", syncRect, true);
      document.removeEventListener("mousedown", onDoc);
    };
  }, [open]);

  // Highlight the current selection when opening; scroll it into view.
  function openMenu() {
    setActive(Math.max(0, options.findIndex((o) => o.value === String(value ?? ""))));
    setOpen(true);
    requestAnimationFrame(() => {
      const i = Math.max(0, options.findIndex((o) => o.value === String(value ?? "")));
      listRef.current?.children[i]?.scrollIntoView({ block: "nearest" });
    });
  }

  function choose(o: SelectOption) {
    if (o.disabled) return;
    onChange?.({ target: { value: o.value } });
    setOpen(false);
    triggerRef.current?.focus();
  }

  function onKeyDown(e: ReactKeyboardEvent<HTMLButtonElement>) {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openMenu();
      }
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(options.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === "Home") {
      e.preventDefault();
      setActive(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setActive(options.length - 1);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      choose(options[active]);
    }
  }

  const triggerBase =
    size === "sm"
      ? "h-[38px] w-full rounded-full border border-foreground/20 bg-transparent pl-4 pr-9 text-[13px] text-foreground hover:border-foreground/35"
      : "h-11 w-full rounded-full border border-foreground/20 bg-card pl-3.5 pr-10 text-sm text-foreground hover:border-foreground/35";

  return (
    <label className="block" htmlFor={id}>
      {label && <span className={LABEL}>{label}</span>}
      <div ref={rootRef} className="relative">
        <button
          ref={triggerRef}
          type="button"
          id={id}
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listboxId}
          disabled={disabled}
          onClick={() => (open ? setOpen(false) : openMenu())}
          onKeyDown={onKeyDown}
          className={cx(
            "relative flex cursor-pointer items-center text-left",
            "transition duration-150",
            triggerBase,
            error
              ? "border-danger focus-visible:border-danger"
              : "focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/20",
            "focus-visible:outline-none",
            "disabled:opacity-40 disabled:cursor-not-allowed",
            className,
          )}
        >
          <span className="min-w-0 truncate">{selectedLabel}</span>
          <svg
            className={`pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-transform duration-150 ${open ? "rotate-180" : ""}`}
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {open &&
          rect &&
          createPortal(
            <ul
              ref={listRef}
              id={listboxId}
              role="listbox"
              aria-label={label}
              style={{ left: rect.left, top: rect.top, bottom: rect.bottom, width: rect.width }}
              className="fixed z-[60] max-h-72 animate-fade-in overflow-y-auto overscroll-contain rounded-xl border border-foreground/15 bg-surface p-1.5 shadow-xl shadow-black/10"
            >
              {options.map((o, i) => {
                const isSelected = o.value === String(value ?? "");
                const isActive = i === active;
                return (
                  <li
                    key={o.value}
                    role="option"
                    aria-selected={isSelected}
                    aria-disabled={o.disabled}
                    onClick={() => choose(o)}
                    onMouseEnter={() => setActive(i)}
                    className={cx(
                      "flex min-h-10 cursor-pointer items-center justify-between gap-2.5 rounded-lg px-3 text-sm",
                      o.disabled && "cursor-not-allowed opacity-40",
                      isSelected
                        ? "bg-brand/10 font-medium text-brand"
                        : isActive
                          ? "bg-foreground/5 text-foreground"
                          : "text-foreground",
                    )}
                  >
                    <span className="min-w-0 truncate">{o.label}</span>
                    {isSelected && (
                      <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </li>
                );
              })}
            </ul>,
            document.body,
          )}
      </div>
      {error && (
        <span className="auth-field-error">
          <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
          {error}
        </span>
      )}
    </label>
  );
}

/* ── Textarea ───────────────────────────────────────────────────────────── */
type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string; error?: string };

export function Textarea({ label, error, className, ...rest }: TextareaProps) {
  return (
    <label className="block">
      {label && <span className={LABEL}>{label}</span>}
      <textarea
        className={cx(
          "w-full rounded-xl border border-foreground/20 bg-card px-3.5 py-2.5 text-sm text-foreground hover:border-foreground/35",
          "transition-all duration-150",
          error
            ? "border-danger focus:border-danger focus:ring-2 focus:ring-danger/20"
            : "focus:border-brand focus:ring-2 focus:ring-brand/20",
          "placeholder:text-muted-foreground focus:outline-none",
          className,
        )}
        {...rest}
      />
      {error && (
        <span className="auth-field-error">
          <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
          {error}
        </span>
      )}
    </label>
  );
}

/* ── Card (hairline panel, square-ish via the global radius scale) ─────── */
export function Card({ children, className, hover = false }: { children: ReactNode; className?: string; hover?: boolean }) {
  return (
    <div
      className={cx(
        "rounded-xl border border-foreground/10 bg-card",
        hover && "transition-colors duration-150 hover:border-foreground/25",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 border-b border-foreground/10 px-5 py-4">
      <div className="min-w-0">
        <h3 className="font-heading text-[19px] leading-tight text-foreground">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

/* ── Badge (bordered mono capsule — DESIGN §6.4 cell status) ───────────── */
export function Badge({
  tone = "neutral",
  children,
  size = "md",
}: {
  tone?: "neutral" | "success" | "danger" | "warning" | "info";
  children: ReactNode;
  size?: "sm" | "md";
}) {
  const tones: Record<string, string> = {
    neutral: "border-foreground/20 text-muted-foreground",
    success: "border-brand/50 text-brand",
    danger: "border-danger/40 text-danger",
    warning: "border-warning/45 text-warning",
    info: "border-info/45 text-info",
  };
  const sizes: Record<string, string> = {
    sm: "px-2 py-0.5 text-[10px]",
    md: "px-2.5 py-1 text-[10px]",
  };
  return (
    <span className={cx("inline-flex items-center gap-1 whitespace-nowrap rounded-full border font-mono uppercase tracking-widest leading-tight", sizes[size], tones[tone])}>
      {children}
    </span>
  );
}

/* ── Alert ──────────────────────────────────────────────────────────────── */
export function Alert({ tone = "danger", children, onDismiss }: { tone?: "danger" | "success" | "warning" | "info"; children: ReactNode; onDismiss?: () => void }) {
  if (!children) return null;
  const tones: Record<string, string> = {
    danger: "bg-danger-bg text-danger border-danger-border",
    success: "bg-success-bg text-success border-success-border",
    warning: "bg-warning-bg text-warning border-warning-border",
    info: "bg-info-bg text-info border-info-border",
  };
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cx("flex items-start gap-3 rounded-md border px-4 py-3 text-sm", tones[tone])}>
      <span className="flex-1">{children}</span>
      {onDismiss && (
        <button onClick={onDismiss} className="shrink-0 rounded p-0.5 opacity-60 hover:opacity-100 transition-opacity" aria-label="Dismiss">
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
        </button>
      )}
    </div>
  );
}

/* ── Spinner ────────────────────────────────────────────────────────────── */
export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16">
      <div className="h-8 w-8 rounded-full border-[3px] border-foreground/15 border-t-foreground animate-spin" />
      {label && <p className="text-sm text-muted-foreground">{label}</p>}
    </div>
  );
}

/* ── EmptyState (dashed hairline callout — DESIGN §6.7) ────────────────── */
export function EmptyState({ title, hint, icon, action }: { title: string; hint?: string; icon?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center border border-dashed border-foreground/15 px-6 py-16 text-center">
      {icon ? (
        <div className="mb-4 text-foreground/40">{icon}</div>
      ) : (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-foreground/15">
          <svg className="h-5 w-5 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
        </div>
      )}
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {hint && <p className="mt-1 max-w-xs text-sm text-muted-foreground">{hint}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/* ── Separator ──────────────────────────────────────────────────────────── */
export function Separator({ className }: { className?: string }) {
  return <hr className={cx("border-0 border-t border-foreground/10", className)} />;
}

/* ── Avatar (neutral hairline tile — names stay in the sans column) ────── */
export function Avatar({ name, size = "md", className }: { name: string; size?: "sm" | "md" | "lg"; className?: string }) {
  const initials = name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  const sizes: Record<string, string> = {
    sm: "h-8 w-8 text-[11px]",
    md: "h-10 w-10 text-xs",
    lg: "h-12 w-12 text-sm",
  };
  return (
    <div
      className={cx(
        "inline-flex items-center justify-center rounded-full border border-foreground/10 bg-foreground/[0.05] font-medium tracking-wide text-foreground",
        sizes[size],
        className,
      )}
      title={name}
    >
      {initials}
    </div>
  );
}

/* ── StatCard (DESIGN §6.5 — border tile, mono label, serif value) ─────── */
export function StatCard({
  label,
  value,
  icon,
  trend,
  trendValue,
  accent = false,
  hint,
  className,
}: {
  label: string;
  value: string;
  icon?: ReactNode;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  accent?: boolean;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={cx("border p-5 sm:p-6", accent ? "border-brand/40 bg-brand/[0.04]" : "border-foreground/10", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="mb-3 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">{label}</p>
          <p className="font-heading text-3xl leading-none tracking-tight tabular-nums text-foreground lg:text-4xl">{value}</p>
          {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
          {trendValue && (
            <div className="mt-2.5 flex items-center gap-1 text-xs font-mono">
              {trend === "up" && <span className="text-success">↑</span>}
              {trend === "down" && <span className="text-danger">↓</span>}
              <span className={cx(
                trend === "up" && "text-success",
                trend === "down" && "text-danger",
                trend === "neutral" && "text-muted-foreground",
              )}>{trendValue}</span>
            </div>
          )}
        </div>
        {icon && (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-foreground/15 text-foreground">
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
