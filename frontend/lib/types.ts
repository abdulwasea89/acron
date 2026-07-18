// TypeScript mirrors of the backend Pydantic schemas (backend/app/schemas).
// Kept intentionally small — only the fields the admin UI consumes.

export type SaasTier = "starter" | "pro" | "enterprise";

export type GymStatus = "open" | "closed" | "half_day";

export interface OrganizationBrief {
  organization_id: string;
  name: string;
  org_code: string;
  role: string;
  member_status: string | null;
}

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
  gym_status: GymStatus;
  member_cap: number | null;
  stripe_connect_status: string;
  accent_color: string | null;
  logo_url: string | null;
  mfa_required: boolean;
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
  retry_count: number;
  state_changed_at: string | null;
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

// ---------------------------------------------------------------- payroll
export interface PayrollEntry {
  id: string;
  staff_member_id: string;
  fixed: number;
  hourly_amount: number;
  hours_worked: number;
  class_amount: number;
  classes_taught: number;
  commission_amount: number;
  bonus: number;
  deductions: number;
  advance_repayment: number;
  net: number;
  payout_method: string;
  pay_stub_url: string | null;
  notes: string | null;
}

export interface PayrollRun {
  id: string;
  period_start: string;
  period_end: string;
  status: string;
  total_gross: number;
  total_deductions: number;
  total_net: number;
  entries: PayrollEntry[];
}

// --------------------------------------------------------------- receipts
export interface ReceiptReviewItem {
  id: string;
  member_id: string;
  plan_id: string | null;
  status: string;
  confidence_score: number | null;
  extracted_amount: number | null;
  extracted_date: string | null;
  extracted_payer: string | null;
  extracted_payee: string | null;
  is_duplicate: boolean;
  flags: string[];
  original_image_url: string | null;
}

// -------------------------------------------------------------------- cash
export interface CashPaymentOut {
  payment_id: string;
  member_id: string;
  amount: number;
  method: string;
  member_status: string;
  receipt_pdf_url: string | null;
}

export interface ReconciliationOut {
  id: string;
  business_date: string;
  system_total: number;
  counted_total: number;
  discrepancy: number;
  performed_by: string;
  alert_triggered: boolean;
}

// --------------------------------------------------------------- payments
export interface PaymentOut {
  id: string;
  member_id: string | null;
  plan_id: string | null;
  kind: string;
  method: string;
  status: string;
  amount: number;
  tax_amount: number;
  currency: string;
  refunded_amount: number;
  paid_at: string | null;
  created_at: string;
}

// ------------------------------------------------------------------ tasks
export interface TaskOut {
  id: string;
  title: string;
  description: string | null;
  assignee_member_id: string | null;
  deadline: string | null;
  done: boolean;
}

export interface TaskCreate {
  title: string;
  description?: string | null;
  assignee_member_id?: string | null;
  deadline?: string | null;
}

// --------------------------------------------------------------------- mfa
export interface MfaStatus {
  mfa_enabled: boolean;
}

export interface MfaEnrollResponse {
  secret: string;
  otpauth_uri: string;
  current_code: string;
}

export interface ProfileOut {
  full_name: string | null;
  email: string;
  phone: string | null;
  address: string | null;
  city: string | null;
  occupation: string | null;
  education: string | null;
  emergency_contact: string | null;
  date_of_birth: string | null;
  gender: string | null;
  photo_url: string | null;
}
