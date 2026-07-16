// Small formatting + status-mapping helpers shared across pages.

export function money(amount: number, currency = "USD"): string {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

export function titleCase(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export type Tone = "neutral" | "success" | "danger" | "warning";

const GYM_STATUS_LABELS: Record<string, string> = {
  open: "Open",
  closed: "Closed",
  half_day: "Half day",
};

export function gymStatusLabel(status: string): string {
  return GYM_STATUS_LABELS[status] ?? titleCase(status);
}

export function gymStatusTone(status: string): Tone {
  if (status === "open") return "success";
  if (status === "closed") return "danger";
  return "warning"; // half_day
}

export function statusTone(status: string): Tone {
  const s = status.toLowerCase();
  if (["active", "succeeded", "published", "paid"].includes(s)) return "success";
  if (["banned", "cancelled", "suspended", "failed", "expired", "read_only"].includes(s)) return "danger";
  if (["grace", "frozen", "past_due", "pending_payment", "pending_approval", "pending_activation", "paused", "draft"].includes(s))
    return "warning";
  return "neutral";
}
