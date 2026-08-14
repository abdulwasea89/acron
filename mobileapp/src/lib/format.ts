/**
 * Formatting helpers for dashboard copy. Hermes supports the Intl API, so
 * money and dates use the device locale rather than hardcoded strings.
 */

const moneyCache = new Map<string, Intl.NumberFormat>();

function moneyFormat(currency: string): Intl.NumberFormat {
  const key = currency || "USD";
  let fmt = moneyCache.get(key);
  if (!fmt) {
    fmt = new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: key,
      maximumFractionDigits: 2,
    });
    moneyCache.set(key, fmt);
  }
  return fmt;
}

/** Currency-formatted amount, e.g. `$149.00`. Falls back to a bare `$` prefix. */
export function money(amount: number, currency?: string | null): string {
  try {
    return moneyFormat(currency ?? "USD").format(amount);
  } catch {
    return `$${amount.toFixed(2)}`;
  }
}

/** Time like `9:30 AM` from an ISO string or epoch ms. */
export function formatTime(input: string | Date | number): string {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

/** Short date like `Mon, Apr 5`. */
export function formatDay(input: string | Date | number): string {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

/** Full short date+time for things like shift start. */
export function formatDateTime(input: string | Date | number): string {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return "";
  return `${formatDay(date)} · ${formatTime(date)}`;
}

/**
 * Time-of-day greeting, used as the home header.
 * 5–12 morning · 12–17 afternoon · 17–22 evening · otherwise night.
 */
export function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 5) return "Good evening";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  if (hour < 22) return "Good evening";
  return "Good night";
}

/** Days between now and an ISO date, rounded up; negative when past. */
export function daysUntil(input: string | Date | number): number {
  const now = Date.now();
  const then = new Date(input).getTime();
  if (Number.isNaN(then)) return 0;
  return Math.ceil((then - now) / 86_400_000);
}

/** Short relative deadline like `in 3d` / `tomorrow` / `today`. */
export function relativeDeadline(input: string | Date | number): string {
  const days = daysUntil(input);
  if (days <= 0) return days === 0 ? "today" : `overdue`;
  if (days === 1) return "tomorrow";
  if (days < 7) return `in ${days}d`;
  return formatDay(input);
}

/** `MiddleName` → first given name or fallback when absent. */
export function firstName(fullName?: string | null, fallback = "there"): string {
  if (!fullName) return fallback;
  return fullName.trim().split(/\s+/)[0];
}

/** Relative time like `just now` / `5m ago` / `3h ago` / `2d ago`. */
export function timeAgo(input: string | Date | number): string {
  const then = new Date(input).getTime();
  if (Number.isNaN(then)) return "";
  const secs = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDay(input);
}