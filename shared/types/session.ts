export interface Session {
  id: string;
  user_id: string;
  organization_id: string;
  token_hash: string;
  device_type: string | null;
  os: string | null;
  ip_address: string | null;
  user_agent: string | null;
  last_activity_at: string | null;
  revoked: boolean;
  expires_at: string;
  created_at: string;
}

export interface SessionInfo {
  id: string;
  user_email: string;
  user_name: string | null;
  device_type: string | null;
  os: string | null;
  ip_address: string | null;
  user_agent: string | null;
  last_activity_at: string | null;
  revoked: boolean;
  current: boolean;
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
