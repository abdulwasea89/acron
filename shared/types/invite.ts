export interface MemberInvite {
  member_id: string;
  email: string;
  invite_code: string;
  member_status: string;
  email_delivered: boolean;
}

export interface InviteCode {
  code: string;
  email: string;
  purpose: string;
  expires_at: string;
  used: boolean;
}

export type InviteStatus = "pending" | "accepted" | "expired" | "cancelled";
