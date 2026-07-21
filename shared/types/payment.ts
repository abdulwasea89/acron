// Gym Operations Platform — payment type definitions

export interface Payment {
  id: string;
  organization_id: string;
  member_id: string;
  plan_id: string | null;
  subscription_id: string | null;
  kind: "subscription" | "one_time" | "cash" | "refund";
  method: string;
  status: string;
  amount: number;
  tax_amount: number;
  currency: string;
  refunded_amount: number;
  stripe_payment_intent_id: string | null;
  idempotency_key: string | null;
  paid_at: string | null;
  created_at: string;
}

export interface ReceiptUpload {
  id: string;
  organization_id: string;
  member_id: string;
  plan_id: string | null;
  original_image_url: string;
  processed_image_url: string | null;
  status: string;
  confidence_score: number | null;
  extracted_amount: number | null;
  extracted_date: string | null;
  extracted_payer: string | null;
  extracted_payee: string | null;
  is_duplicate: boolean;
  flags: string[];
  admin_action: string | null;
  admin_acted_by: string | null;
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
  alert_triggered: boolean;
  notes: string | null;
  created_at: string;
}
