export interface OrganizationOut {
  id: string;
  name: string;
  org_code: string;
  saas_tier: string;
  saas_status: string;
  stripe_connect_status?: string;
  gym_status?: string;
  enrollment_mode?: string;
  mfa_required?: boolean;
  timezone?: string;
  currency?: string;
  accent_color?: string;
  logo_url?: string;
  address?: string;
  country?: string;
}

export interface AuthUserResponse {
  user_id: string;
  email: string;
  full_name?: string;
  role: string;
  org_id: string;
  member_id?: string | null;
  member_status?: string | null;
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  user: AuthUserResponse;
  mfa_required?: boolean;
}

export interface OrgSummaryResponse {
  id: string;
  name: string;
  org_code: string;
  role: string;
  member_status?: string | null;
}

export interface HeadlineMetrics {
  active_members: number;
  today_revenue: number;
  today_check_ins: number;
  pending_approvals: number;
}

export interface PlanOut {
  id: string;
  name: string;
  description?: string;
  price: number;
  billing_type: string;
  visibility: string;
  status: string;
  featured?: boolean;
}

export interface ClassSession {
  id: string;
  title: string;
  trainer_id?: string;
  trainer_name?: string;
  start_time: string;
  end_time: string;
  capacity: number;
  booked_count: number;
  status: string;
}

export interface PaymentOut {
  id: string;
  member_id: string;
  member_name?: string;
  amount: number;
  method: string;
  status: string;
  created_at: string;
}

export interface ReceiptReviewItem {
  id: string;
  member_id: string;
  member_name: string;
  amount: number;
  confidence: number;
  extracted_fields?: Record<string, unknown>;
  image_url?: string;
  status: string;
  flags?: string[];
  created_at: string;
}

export interface StaffShiftCurrent {
  is_checked_in: boolean;
  checked_in_at?: string;
  shift_id?: string;
}

export interface TaskOut {
  id: string;
  title: string;
  description?: string;
  assignee_id?: string;
  assignee_name?: string;
  due_date?: string;
  status: string;
  created_at: string;
}

export interface MemberDirectoryItem {
  id: string;
  email: string;
  full_name?: string;
  role: string;
  member_status: string;
  phone?: string;
  created_at: string;
}

export interface ProfileOut {
  full_name?: string;
  email: string;
  phone?: string;
  address?: string;
  city?: string;
  emergency_contact?: string;
}

export interface CashLogPayload {
  member_id: string;
  plan_id: string;
  amount: number;
  method: "cash" | "bank_transfer" | "mobile_wallet";
  notes?: string;
}

export interface ReceiptUploadResult {
  receipt_id: string;
  status: string;
  confidence?: number;
}
