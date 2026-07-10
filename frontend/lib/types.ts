// TypeScript mirrors of the backend Pydantic schemas (backend/app/schemas).
// Kept intentionally small — only the fields the admin UI consumes.

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  organization_id: string | null;
  role: string | null;
  member_status: string | null;
  requires_mfa: boolean;
  organizations: { id: string; name: string; role: string }[] | null;
}

export interface OrganizationOut {
  id: string;
  name: string;
  org_code: string;
  saas_tier: string;
  saas_status: string;
  enrollment_mode: string;
  gym_status: string;
  member_cap: number | null;
  stripe_connect_status: string;
  accent_color: string | null;
  logo_url: string | null;
}

export interface SetupChecklist {
  gym_registered: boolean;
  saas_active: boolean;
  stripe_connected: boolean;
  plan_published: boolean;
  enrollment_configured: boolean;
  staff_invited: boolean;
  office_configured: boolean;
  member_signup_unblocked: boolean;
}

export interface PlanOut {
  id: string;
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
}

export interface PlanCreate {
  name: string;
  public_description?: string | null;
  price: number;
  billing_type: string;
  visibility?: string;
  cycle_unit?: string | null;
  cycle_length?: number | null;
  pack_size?: number | null;
  validity_days?: number | null;
  featured?: boolean;
}

export interface MemberDirectoryItem {
  member_id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  role: string;
  member_status: string;
  phone: string | null;
  profile_complete: boolean;
}

export interface HeadlineMetrics {
  today_check_ins: number;
  today_revenue: number;
  pending_receipts: number;
  pending_approvals: number;
  active_members: number;
}

export interface RevenueAnalytics {
  total_revenue: number;
  revenue_by_method: Record<string, number>;
  member_count_by_status: Record<string, number>;
  active_members: number;
  churn_count: number;
  currency: string;
}

export interface SaasStatusOut {
  saas_tier: string;
  saas_status: string;
  member_cap: number | null;
  current_member_count: number;
  current_period_end: string | null;
  grace_until: string | null;
  read_only: boolean;
}

export interface InvoiceOut {
  id: string;
  amount: number;
  currency: string;
  status: string;
  created_at: string;
}

export interface ApiError {
  detail: string | { msg: string }[];
}
