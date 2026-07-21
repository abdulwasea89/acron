// Gym Operations Platform — plan type definitions

export interface Plan {
  id: string;
  organization_id: string;
  name: string;
  public_description: string | null;
  price: number;
  currency: string;
  tax_mode: string;
  tax_rate: number;
  billing_type: string;
  visibility: string;
  status: string;
  featured: boolean;
  cycle_unit: string | null;
  cycle_length: number | null;
  pack_size: number | null;
  validity_days: number | null;
  created_at: string;
}

export interface Subscription {
  id: string;
  member_id: string;
  plan_id: string;
  organization_id: string;
  status: string;
  amount_paid: number;
  tax_amount: number;
  currency: string;
  current_period_start: string;
  current_period_end: string;
  cancelled_at: string | null;
  created_at: string;
}

export type PlanVisibility = "public" | "members_only" | "invite_only";
export type PlanStatus = "draft" | "published" | "paused" | "archived";
export type SubscriptionStatus = "active" | "grace" | "expired" | "cancelled";
