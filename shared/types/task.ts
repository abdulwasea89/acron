export interface Task {
  id: string;
  organization_id: string;
  title: string;
  description: string | null;
  assignee_member_id: string | null;
  deadline: string | null;
  done: boolean;
  created_at: string;
}

export interface TaskCreate {
  title: string;
  description?: string | null;
  assignee_member_id?: string | null;
  deadline?: string | null;
}

export type TaskStatus = "pending" | "in_progress" | "completed";
