"use client";

import { forwardRef } from "react";
import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
  ReactNode,
} from "react";

function cx(...parts: (string | false | undefined | null)[]): string {
  return parts.filter(Boolean).join(" ");
}

/* Button */
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
  size = "md",
  children,
  ...rest
}: ButtonProps) {
  const variants: Record<string, string> = {
    primary:
      "bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] shadow-sm active:brightness-95",
    secondary:
      "bg-white text-[var(--foreground)] border border-[var(--border)] hover:bg-gray-50 hover:border-gray-300 shadow-xs",
    danger:
      "bg-[var(--danger)] text-white hover:bg-[var(--danger-hover)] shadow-sm",
    ghost:
      "text-[var(--foreground-muted)] hover:bg-gray-100 hover:text-[var(--foreground)]",
    accent:
      "bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] shadow-sm",
  };
  const sizes: Record<string, string> = {
    sm: "h-8 px-3 text-xs gap-1.5 rounded-lg",
    md: "h-11 px-4 text-sm gap-2 rounded-lg",
    lg: "h-12 px-6 text-sm gap-2 rounded-lg",
  };
  return (
    <button
      className={cx(
        "inline-flex cursor-pointer items-center justify-center font-semibold",
        "transition duration-150",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2",
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

/* Input */
type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  hint?: string;
  error?: string;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, className, id, ...rest },
  ref,
) {
  return (
    <label className="block">
      {label && (
        <span className="mb-1.5 block text-[13px] font-medium text-[var(--foreground)]">
          {label}
        </span>
      )}
      <input
        ref={ref}
        id={id}
        className={cx(
          "h-11 w-full rounded-xl border bg-white px-3.5 text-base sm:text-sm text-[var(--foreground)]",
          "transition duration-150",
          "placeholder:text-gray-400",
          error
            ? "border-[var(--danger)] focus:border-[var(--danger)] focus:ring-2 focus:ring-red-100"
            : "border-[var(--border)] focus:border-[var(--primary)] focus:ring-2 focus:ring-indigo-50",
          "focus:outline-none",
          "disabled:opacity-40 disabled:cursor-not-allowed disabled:bg-gray-50",
          className,
        )}
        {...rest}
      />
      {hint && !error && (
        <span className="mt-1.5 block text-xs text-[var(--muted)]">{hint}</span>
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

/* Select */
type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & { label?: string; error?: string };

export function Select({ label, error, className, children, ...rest }: SelectProps) {
  return (
    <label className="block">
      {label && (
        <span className="mb-1.5 block text-[13px] font-medium text-[var(--foreground)]">{label}</span>
      )}
      <div className="relative">
        <select
          className={cx(
            "h-11 w-full appearance-none rounded-xl border bg-white px-3.5 pr-10 text-base sm:text-sm text-[var(--foreground)]",
            "transition duration-150",
            error
              ? "border-[var(--danger)] focus:border-[var(--danger)] focus:ring-2 focus:ring-red-100"
              : "border-[var(--border)] focus:border-[var(--primary)] focus:ring-2 focus:ring-indigo-50",
            "focus:outline-none",
            className,
          )}
          {...rest}
        >
          {children}
        </select>
        <svg className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
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

/* Textarea */
type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string; error?: string };

export function Textarea({ label, error, className, ...rest }: TextareaProps) {
  return (
    <label className="block">
      {label && (
        <span className="mb-1.5 block text-[13px] font-medium text-[var(--foreground)]">{label}</span>
      )}
      <textarea
        className={cx(
          "w-full rounded-lg border bg-white px-3 py-2.5 text-sm text-[var(--foreground)]",
          "transition-all duration-150",
          error
            ? "border-[var(--danger)] focus:border-[var(--danger)] focus:ring-2 focus:ring-red-100"
            : "border-[var(--border)] focus:border-[var(--primary)] focus:ring-2 focus:ring-indigo-50",
          "placeholder:text-gray-400 focus:outline-none",
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

/* Card */
export function Card({ children, className, hover = false }: { children: ReactNode; className?: string; hover?: boolean }) {
  return (
    <div
      className={cx(
        "rounded-xl border border-[var(--border)] bg-white",
        "shadow-xs",
        hover && "transition-all duration-150 hover:shadow-md hover:border-gray-300",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] px-5 py-4">
      <div className="min-w-0">
        <h3 className="text-[15px] font-semibold text-[var(--foreground)]">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-[var(--muted)]">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

/* Badge */
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
    neutral: "bg-gray-100 text-gray-600",
    success: "bg-emerald-50 text-emerald-700",
    danger: "bg-red-50 text-red-700",
    warning: "bg-amber-50 text-amber-700",
    info: "bg-sky-50 text-sky-700",
  };
  const sizes: Record<string, string> = {
    sm: "px-2 py-0.5 text-[11px]",
    md: "px-2.5 py-0.5 text-[11px]",
  };
  return (
    <span className={cx("inline-flex items-center gap-1 rounded-full font-semibold leading-tight", sizes[size], tones[tone])}>
      {children}
    </span>
  );
}

/* Alert */
export function Alert({ tone = "danger", children, onDismiss }: { tone?: "danger" | "success" | "warning" | "info"; children: ReactNode; onDismiss?: () => void }) {
  if (!children) return null;
  const tones: Record<string, string> = {
    danger: "bg-red-50 text-red-700 border-red-200",
    success: "bg-emerald-50 text-emerald-700 border-emerald-200",
    warning: "bg-amber-50 text-amber-700 border-amber-200",
    info: "bg-sky-50 text-sky-700 border-sky-200",
  };
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cx("flex items-start gap-3 rounded-lg border px-4 py-3 text-sm", tones[tone])}>
      <span className="flex-1">{children}</span>
      {onDismiss && (
        <button onClick={onDismiss} className="shrink-0 rounded p-0.5 opacity-60 hover:opacity-100 transition-opacity" aria-label="Dismiss">
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
        </button>
      )}
    </div>
  );
}

/* Spinner */
export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16">
      <div className="h-8 w-8 rounded-full border-[3px] border-gray-200 border-t-[var(--primary)] animate-spin" />
      {label && <p className="text-sm text-[var(--muted)]">{label}</p>}
    </div>
  );
}

/* EmptyState */
export function EmptyState({ title, hint, icon, action }: { title: string; hint?: string; icon?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      {icon ? (
        <div className="mb-4 text-gray-300">{icon}</div>
      ) : (
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100">
          <svg className="h-8 w-8 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
        </div>
      )}
      <p className="text-sm font-semibold text-[var(--foreground)]">{title}</p>
      {hint && <p className="mt-1 max-w-xs text-sm text-[var(--muted)]">{hint}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/* Separator */
export function Separator({ className }: { className?: string }) {
  return <hr className={cx("border-0 border-t border-[var(--border)]", className)} />;
}

/* Avatar */
export function Avatar({ name, size = "md", className }: { name: string; size?: "sm" | "md" | "lg"; className?: string }) {
  const initials = name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  const sizes: Record<string, string> = {
    sm: "h-8 w-8 text-xs",
    md: "h-10 w-10 text-sm",
    lg: "h-12 w-12 text-base",
  };
  return (
    <div
      className={cx(
        "inline-flex items-center justify-center rounded-full bg-indigo-100 font-semibold text-[var(--primary)]",
        sizes[size],
        className,
      )}
      title={name}
    >
      {initials}
    </div>
  );
}

/* Stat Card */
export function StatCard({
  label,
  value,
  icon,
  trend,
  trendValue,
  className,
}: {
  label: string;
  value: string;
  icon?: ReactNode;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  className?: string;
}) {
  return (
    <Card hover className={cx("p-5", className)}>
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] text-[var(--muted)]">{label}</p>
          <p className="mt-1.5 text-2xl font-bold tabular-nums tracking-tight text-[var(--foreground)]">{value}</p>
          {trendValue && (
            <div className="mt-2 flex items-center gap-1 text-xs font-medium">
              {trend === "up" && <span className="text-[var(--success)]">↑</span>}
              {trend === "down" && <span className="text-[var(--danger)]">↓</span>}
              <span className={cx(
                trend === "up" && "text-[var(--success)]",
                trend === "down" && "text-[var(--danger)]",
                trend === "neutral" && "text-[var(--muted)]",
              )}>{trendValue}</span>
            </div>
          )}
        </div>
        {icon && (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-[var(--primary)]">
            {icon}
          </div>
        )}
      </div>
    </Card>
  );
}
