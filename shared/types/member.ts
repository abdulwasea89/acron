// Gym Operations Platform — member type definitions

export interface Member {
  member_id: string;
  user_id: string;
  organization_id: string;
  role: string;
  member_status: string;
  display_name: string | null;
  phone: string | null;
  profile_complete: boolean;
  created_at: string;
  fixed_monthly_salary: number;
  hourly_rate: number;
  per_class_rate: number;
  commission_rate: number;
}

export interface MemberProfile {
  full_name: string | null;
  email: string;
  phone: string | null;
  address: string | null;
  city: string | null;
  date_of_birth: string | null;
  gender: string | null;
  photo_url: string | null;
  emergency_contact: string | null;
}

export interface MemberDirectoryItem {
  member_id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  display_name: string | null;
  role: string;
  member_status: string;
  phone: string | null;
  profile_complete: boolean;
  created_at: string;
  fixed_monthly_salary: number;
  hourly_rate: number;
  per_class_rate: number;
  commission_rate: number;
}
