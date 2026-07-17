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
  size = "sm",
  children,
  ...rest
}: ButtonProps) {
  const variants: Record<string, string> = {
    primary:
      "bg-[var(--primary)] text-[var(--primary-foreground)] hover:bg-[var(--primary-hover)] shadow-sm active:brightness-95",
    secondary:
      "bg-[var(--surface)] text-[var(--foreground)] border border-[var(--border)] hover:bg-[var(--background)] hover:border-[var(--border-strong)] shadow-xs",
    danger:
      "bg-[var(--danger)] text-white hover:bg-[var(--danger-hover)] shadow-sm",
    ghost:
      "text-[var(--foreground-muted)] hover:bg-[var(--background)] hover:text-[var(--foreground)]",
    accent:
      "bg-[var(--accent)] text-[var(--accent-foreground)] hover:bg-[var(--accent-hover)] shadow-sm",
  };
  const sizes: Record<string, string> = {
    sm: "h-9 px-3.5 text-xs gap-1.5 rounded-[10px]",
    md: "h-10 px-4 text-sm gap-2 rounded-[10px]",
    lg: "h-11 px-6 text-sm gap-2 rounded-[10px]",
  };
  return (
    <button
      className={cx(
        "inline-flex cursor-pointer items-center justify-center font-semibold",
        "transition duration-150",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 focus-visible:ring-offset-2",
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
          "h-11 w-full rounded-xl border bg-[#f6f7f9] px-3.5 text-base sm:text-sm text-[var(--foreground)] dark:bg-[var(--background)]",
          "transition duration-150",
          "placeholder:text-[var(--muted)]",
          error
            ? "border-[var(--danger)] focus:border-[var(--danger)] focus:ring-2 focus:ring-[var(--danger)]/20"
            : "border-[#edf0f5] focus:border-neutral-950 focus:ring-2 focus:ring-neutral-950/10 dark:border-[var(--border)] dark:focus:border-[var(--primary)] dark:focus:ring-[var(--primary)]/20",
          "focus:outline-none",
          "disabled:opacity-40 disabled:cursor-not-allowed disabled:bg-gray-100 dark:disabled:bg-[var(--surface)]",
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
            "h-11 w-full appearance-none rounded-xl border bg-[#f6f7f9] px-3.5 pr-10 text-base sm:text-sm text-[var(--foreground)] dark:bg-[var(--background)]",
            "transition duration-150",
            error
              ? "border-[var(--danger)] focus:border-[var(--danger)] focus:ring-2 focus:ring-[var(--danger)]/20"
              : "border-[#edf0f5] focus:border-neutral-950 focus:ring-2 focus:ring-neutral-950/10 dark:border-[var(--border)] dark:focus:border-[var(--primary)] dark:focus:ring-[var(--primary)]/20",
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
            "w-full rounded-xl border bg-[#f6f7f9] px-3.5 py-2.5 text-base sm:text-sm text-[var(--foreground)] dark:bg-[var(--background)]",
            "transition-all duration-150",
            error
              ? "border-[var(--danger)] focus:border-[var(--danger)] focus:ring-2 focus:ring-[var(--danger)]/20"
              : "border-[#edf0f5] focus:border-neutral-950 focus:ring-2 focus:ring-neutral-950/10 dark:border-[var(--border)] dark:focus:border-[var(--primary)] dark:focus:ring-[var(--primary)]/20",
            "placeholder:text-[var(--muted)] focus:outline-none",
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
        "rounded-xl border border-[var(--border)] bg-[var(--surface)]",
        "shadow-xs",
        hover && "transition-all duration-150 hover:shadow-md hover:border-[var(--border-strong)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--border)] px-5 py-4">
      <div className="min-w-0">
        <h3 className="font-heading text-[19px] leading-tight text-[var(--foreground)]">{title}</h3>
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
    neutral: "bg-[var(--background)] text-[var(--foreground-muted)]",
    success: "bg-[var(--success-bg)] text-[var(--success)]",
    danger: "bg-[var(--danger-bg)] text-[var(--danger)]",
    warning: "bg-[var(--warning-bg)] text-[var(--warning)]",
    info: "bg-[var(--info-bg)] text-[var(--info)]",
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
    danger: "bg-[var(--danger-bg)] text-[var(--danger)] border-[var(--danger-border)]",
    success: "bg-[var(--success-bg)] text-[var(--success)] border-[var(--success-border)]",
    warning: "bg-[var(--warning-bg)] text-[var(--warning)] border-[var(--warning-border)]",
    info: "bg-[var(--info-bg)] text-[var(--info)] border-[var(--info-border)]",
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
      <div className="h-8 w-8 rounded-full border-[3px] border-[var(--border)] border-t-[var(--foreground)] animate-spin" />
      {label && <p className="text-sm text-[var(--muted)]">{label}</p>}
    </div>
  );
}

/* EmptyState */
export function EmptyState({ title, hint, icon, action }: { title: string; hint?: string; icon?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      {icon ? (
        <div className="mb-4 text-[var(--border-strong)]">{icon}</div>
      ) : (
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--background)]">
          <svg className="h-8 w-8 text-[var(--muted)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
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
        "inline-flex items-center justify-center rounded-full bg-[var(--primary-light)] font-semibold text-[var(--primary)]",
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
          <p className="mt-1.5 font-heading text-[30px] leading-none tabular-nums text-[var(--foreground)]">{value}</p>
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
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--primary-light)] text-[var(--primary)]">
            {icon}
          </div>
        )}
      </div>
    </Card>
  );
}
