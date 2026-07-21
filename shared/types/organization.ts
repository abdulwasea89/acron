// Gym Operations Platform — organization type definitions

export interface Organization {
  id: string;
  name: string;
  org_code: string;
  saas_tier: string;
  saas_status: string;
  enrollment_mode: string;
  gym_status: string;
  member_cap: number | null;
  stripe_customer_id: string | null;
  stripe_connect_account_id: string | null;
  stripe_connect_status: string;
  accent_color: string | null;
  logo_url: string | null;
  mfa_required: boolean;
  timezone: string;
  currency: string;
  created_at: string;
}

export interface OrgSettings {
  working_hours_start: string | null;
  working_hours_end: string | null;
  default_tax_rate: number;
  default_currency: string;
  enrollment_mode: string;
  mfa_required: boolean;
}

export interface StripeConnectInfo {
  account_id: string;
  status: string;
  onboarding_url: string | null;
  charges_enabled: boolean;
  payouts_enabled: boolean;
}
