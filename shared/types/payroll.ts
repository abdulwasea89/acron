// Gym Operations Platform — payroll type definitions

export interface CompensationRates {
  fixed_monthly_salary: number;
  hourly_rate: number;
  per_class_rate: number;
  commission_rate: number;
}

export interface PayrollRun {
  id: string;
  organization_id: string;
  period_start: string;
  period_end: string;
  status: "draft" | "locked" | "finalized" | "paid";
  total_gross: number;
  total_deductions: number;
  total_net: number;
  entries: PayrollEntry[];
  created_at: string;
}

export interface PayrollEntry {
  id: string;
  payroll_run_id: string;
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

export interface Shift {
  id: string;
  staff_member_id: string;
  checked_in_at: string;
  checked_out_at: string | null;
  status: "active" | "completed";
  hours: number;
}
