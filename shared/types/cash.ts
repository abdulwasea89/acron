export interface CashPayment {
  payment_id: string;
  organization_id: string;
  member_id: string;
  member_email: string;
  member_name: string | null;
  plan_id: string | null;
  amount: number;
  method: string;
  logged_by: string;
  logged_by_name: string | null;
  member_status: string;
  receipt_pdf_url: string | null;
  created_at: string;
}

export interface CashReconciliation {
  id: string;
  organization_id: string;
  business_date: string;
  system_total: number;
  counted_total: number;
  discrepancy: number;
  performed_by: string;
  performed_by_name: string | null;
  alert_triggered: boolean;
  notes: string | null;
  created_at: string;
}

export interface CashLogEntry {
  id: string;
  organization_id: string;
  member_id: string;
  amount: number;
  method: string;
  note: string | null;
  staff_member_id: string;
  created_at: string;
}
