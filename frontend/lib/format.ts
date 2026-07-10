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

export function statusTone(status: string): Tone {
  const s = status.toLowerCase();
  if (["active", "succeeded", "published", "paid"].includes(s)) return "success";
  if (["banned", "cancelled", "suspended", "failed", "expired", "read_only"].includes(s)) return "danger";
  if (["grace", "frozen", "past_due", "pending_payment", "pending_approval", "pending_activation", "paused", "draft"].includes(s))
    return "warning";
  return "neutral";
}
