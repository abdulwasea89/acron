export interface ClassSession {
  id: string;
  organization_id: string;
  title: string;
  trainer_member_id: string | null;
  starts_at: string;
  ends_at: string | null;
  capacity: number;
  booked_count: number;
  trainer_checked_in: boolean;
  cancelled: boolean;
  created_at: string;
}

export interface Booking {
  booking_id: string;
  class_session_id: string;
  member_id: string;
  member_name: string | null;
  member_email: string;
  status: string;
}

export type ClassStatus = "scheduled" | "in_progress" | "completed" | "cancelled";
