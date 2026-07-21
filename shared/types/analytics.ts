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

export interface MemberCountByStatus {
  active: number;
  grace: number;
  expired: number;
  frozen: number;
  cancelled: number;
  pending_approval: number;
  pending_payment: number;
}

export interface RevenueByPeriod {
  period: string;
  amount: number;
  method: string;
  count: number;
}
