// Small, dependency-free UI primitives styled with Tailwind. Kept in one file
// so the whole design system is easy to scan and reuse.
"use client";

import { forwardRef } from "react";
import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
  ReactNode,
} from "react";

function cx(...parts: (string | false | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

/* --------------------------------------------------------------- Button */
type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  loading?: boolean;
};

export function Button({
  variant = "primary",
  loading,
  disabled,
  className,
  children,
  ...rest
}: ButtonProps) {
  const styles: Record<string, string> = {
    primary: "bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)]",
    secondary: "bg-white text-[var(--foreground)] border border-[var(--border)] hover:bg-gray-50",
    danger: "bg-[var(--danger)] text-white hover:opacity-90",
    ghost: "bg-transparent text-[var(--muted)] hover:bg-gray-100",
  };
  return (
    <button
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition",
        "focus:outline-none focus-visible:ring-4 focus-visible:ring-[var(--ring)]",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        styles[variant],
        className,
      )}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
      )}
      {children}
    </button>
  );
}

/* --------------------------------------------------------------- Input */
type InputProps = InputHTMLAttributes<HTMLInputElement> & { label?: string; hint?: string };

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, className, id, ...rest },
  ref,
) {
  return (
    <label className="block">
      {label && <span className="mb-1.5 block text-sm font-medium text-[var(--foreground)]">{label}</span>}
      <input
        ref={ref}
        id={id}
        className={cx(
          "w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm",
          "placeholder:text-gray-400 focus:border-[var(--primary)] focus:outline-none",
          "focus-visible:ring-4 focus-visible:ring-[var(--ring)]",
          className,
        )}
        {...rest}
      />
      {hint && <span className="mt-1 block text-xs text-[var(--muted)]">{hint}</span>}
    </label>
  );
});

/* --------------------------------------------------------------- Select */
type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & { label?: string };

export function Select({ label, className, children, ...rest }: SelectProps) {
  return (
    <label className="block">
      {label && <span className="mb-1.5 block text-sm font-medium">{label}</span>}
      <select
        className={cx(
          "w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm",
          "focus:border-[var(--primary)] focus:outline-none focus-visible:ring-4 focus-visible:ring-[var(--ring)]",
          className,
        )}
        {...rest}
      >
        {children}
      </select>
    </label>
  );
}

/* --------------------------------------------------------------- Textarea */
type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string };

export function Textarea({ label, className, ...rest }: TextareaProps) {
  return (
    <label className="block">
      {label && <span className="mb-1.5 block text-sm font-medium">{label}</span>}
      <textarea
        className={cx(
          "w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm",
          "focus:border-[var(--primary)] focus:outline-none focus-visible:ring-4 focus-visible:ring-[var(--ring)]",
          className,
        )}
        {...rest}
      />
    </label>
  );
}

/* --------------------------------------------------------------- Card */
export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx("rounded-xl border border-[var(--border)] bg-white shadow-sm", className)}>
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] px-5 py-4">
      <div>
        <h3 className="text-base font-semibold">{title}</h3>
        {subtitle && <p className="mt-0.5 text-sm text-[var(--muted)]">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

/* --------------------------------------------------------------- Badge */
export function Badge({ tone = "neutral", children }: { tone?: "neutral" | "success" | "danger" | "warning"; children: ReactNode }) {
  const tones: Record<string, string> = {
    neutral: "bg-gray-100 text-gray-700",
    success: "bg-[var(--success-bg)] text-[var(--success)]",
    danger: "bg-[var(--danger-bg)] text-[var(--danger)]",
    warning: "bg-[var(--warning-bg)] text-[var(--warning)]",
  };
  return (
    <span className={cx("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", tones[tone])}>
      {children}
    </span>
  );
}

/* --------------------------------------------------------------- Alert */
export function Alert({ tone = "danger", children }: { tone?: "danger" | "success" | "warning"; children: ReactNode }) {
  if (!children) return null;
  const tones: Record<string, string> = {
    danger: "bg-[var(--danger-bg)] text-[var(--danger)] border-red-200",
    success: "bg-[var(--success-bg)] text-[var(--success)] border-green-200",
    warning: "bg-[var(--warning-bg)] text-[var(--warning)] border-amber-200",
  };
  return <div className={cx("rounded-lg border px-4 py-3 text-sm", tones[tone])}>{children}</div>;
}

/* --------------------------------------------------------------- Spinner */
export function Spinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <span className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-[var(--primary)]" />
    </div>
  );
}

/* --------------------------------------------------------------- EmptyState */
export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="px-5 py-12 text-center">
      <p className="font-medium text-[var(--foreground)]">{title}</p>
      {hint && <p className="mt-1 text-sm text-[var(--muted)]">{hint}</p>}
    </div>
  );
}
