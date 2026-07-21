export interface AuditLog {
  id: string;
  action: string;
  actor_user_id: string | null;
  actor_email: string | null;
  actor_name: string | null;
  entity_type: string | null;
  entity_id: string | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}

export interface AuditLogPage {
  items: AuditLog[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface AuditActionGroup {
  domain: string;
  actions: string[];
}

export interface AuditFilter {
  search?: string;
  action?: string;
  entity_type?: string;
  page?: number;
  page_size?: number;
}
