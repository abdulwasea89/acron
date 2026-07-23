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

// --- Auth Shared -------------------------------------------------------
export interface Message {
  message: string;
}

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type?: string;
}

export interface MfaStatus {
  mfa_enabled: boolean;
}

export interface MfaEnrollResponse {
  secret: string;
  otpauth_uri: string;
  current_code: string;
}

// --- Owner Registration (Register Gym) --------------------------------
export interface OwnerRegisterStartRequest {
  full_name: string;
  email: string;
  password: string;
  confirm_password: string;
  cnic: string;
  phone: string;
  occupation: string;
  education: string;
  address: string;
  date_of_birth: string;
  gender: "male" | "female" | "other";
  city: string;
  emergency_contact: string;
}

export interface EmailVerifyRequest {
  email: string;
  code: string;
}

export interface ResendCodeRequest {
  email: string;
}

export interface GymDetails {
  name: string;
  country?: string;
  timezone?: string;
  default_currency?: string;
  address?: string | null;
  logo_url?: string | null;
  accent_color?: string | null;
  working_hours?: string | null;
}

export interface RegisterGymRequest {
  owner_email: string;
  details: GymDetails;
  tier: "starter" | "pro" | "enterprise";
  payment_token?: string;
}

export interface RegisterGymResponse {
  organization: OrganizationOut;
  access_token: string;
  refresh_token: string;
  token_type?: string;
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

// --- Member Signup (Join Gym) -----------------------------------------
export interface SignupStartRequest {
  org_code: string;
  captcha_token?: string | null;
}

export interface SignupStartOut {
  organization_id: string;
  organization_name: string;
  enrollment_mode: string;
  accepting_signups: boolean;
}

export interface SignupEmailRequest {
  org_code: string;
  email: string;
  captcha_token?: string | null;
}

export interface SignupVerifyRequest {
  org_code: string;
  email: string;
  code: string;
}

export interface SignupSetPasswordRequest {
  org_code: string;
  email: string;
  password: string;
}

export interface SignupSetPasswordOut {
  member_id: string;
  organization_id: string;
  member_status: string;
}

export interface PublicPlanOut {
  id: string;
  name: string;
  public_description?: string | null;
  price: number;
  currency: string;
  billing_type: string;
  featured: boolean;
}

export interface SignupPayRequest {
  org_code: string;
  email: string;
  plan_id: string;
  payment_token?: string;
}

export interface ProfileCompleteRequest {
  full_name: string;
  photo_url?: string | null;
  phone?: string | null;
  emergency_contact?: string | null;
}

// --- Login ------------------------------------------------------------
export interface LoginRequest {
  email: string;
  password: string;
  org_code?: string | null;
  organization_id?: string | null;
  remember?: boolean;
  mfa_code?: string | null;
}

export interface MemberLoginRequest {
  org_code: string;
  email: string;
  password: string;
  remember?: boolean;
  mfa_code?: string | null;
}

// --- Magic Link -------------------------------------------------------
export interface MagicLinkRequest {
  org_code: string;
  email: string;
}

export interface MagicLinkVerifyRequest {
  org_code: string;
  email: string;
  token: string;
  remember?: boolean;
  mfa_code?: string | null;
}

// --- Password Reset ---------------------------------------------------
export interface PasswordResetRequest {
  email: string;
}

export interface PasswordResetConfirm {
  email: string;
  token: string;
  new_password: string;
}

// --- Invite -----------------------------------------------------------
export interface RedeemInviteRequest {
  org_code: string;
  email: string;
  code: string;
  password: string;
}

// --- Recovery ---------------------------------------------------------
export interface RecoverCodesRequest {
  email: string;
}

// --- MFA --------------------------------------------------------------
export interface MfaConfirmRequest {
  code: string;
}

export interface MfaDisableRequest {
  password: string;
}

// --- Session ----------------------------------------------------------
export interface SessionInfo {
  id: string;
  device_type?: string | null;
  os?: string | null;
  ip_address?: string | null;
  last_activity_at?: string | null;
  revoked?: boolean;
  current?: boolean;
}
