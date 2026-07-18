"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Dialog } from "@/components/Dialog";
import { PageHeader } from "@/components/PageHeader";
import { Alert, Avatar, Badge, Button, Card, CardHeader, EmptyState, Input, Select, Spinner, Textarea } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import type { TaskOut, MemberDirectoryItem } from "@/lib/types";

export default function TasksPage() {
  const [tasks, setTasks] = useState<TaskOut[] | null>(null);
  const [members, setMembers] = useState<MemberDirectoryItem[]>([]);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "completed">("all");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<TaskOut | null>(null);
  const [deleting, setDeleting] = useState<TaskOut | null>(null);
  const [viewing, setViewing] = useState<TaskOut | null>(null);
  const [menuTask, setMenuTask] = useState<TaskOut | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);

  // Create form state
  const [formTitle, setFormTitle] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formAssignee, setFormAssignee] = useState("");
  const [formDeadline, setFormDeadline] = useState("");
  const [formError, setFormError] = useState("");
  const [formLoading, setFormLoading] = useState(false);

  async function load() {
    setError("");
    try {
      const t = await api.get<TaskOut[]>("/staff/tasks");
      setTasks(t);
    } catch (e) {
      setError((e as ApiError).message);
      setTasks([]);
    }
    try {
      const m = await api.get<MemberDirectoryItem[]>("/members");
      setMembers(m);
    } catch {
      // Members fetch is best-effort for the assignee dropdown
    }
  }

  useEffect(() => {
    queueMicrotask(() => void load());
  }, []);

  const memberById = Object.fromEntries(
    members.map((m) => [m.member_id, m.full_name || m.email]),
  );

  const filtered = (tasks ?? []).filter((t) => {
    if (filter === "active") return !t.done;
    if (filter === "completed") return t.done;
    return true;
  });

  // Create task
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    setFormLoading(true);
    try {
      await api.post("/staff/tasks", {
        title: formTitle,
        description: formDesc || null,
        assignee_member_id: formAssignee || null,
        deadline: formDeadline || null,
      });
      resetForm();
      load();
    } catch (e) {
      setFormError((e as ApiError).message);
    } finally {
      setFormLoading(false);
    }
  }

  // Update task
  async function update(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setFormError("");
    setFormLoading(true);
    try {
      await api.patch(`/staff/tasks/${editing.id}`, {
        title: formTitle,
        description: formDesc || null,
        assignee_member_id: formAssignee || null,
        deadline: formDeadline || null,
      });
      setEditing(null);
      resetForm();
      load();
    } catch (e) {
      setFormError((e as ApiError).message);
    } finally {
      setFormLoading(false);
    }
  }

  // Delete task
  async function confirmDelete() {
    if (!deleting) return;
    setError("");
    try {
      await api.del(`/staff/tasks/${deleting.id}`);
      setDeleting(null);
      load();
    } catch (e) {
      setError((e as ApiError).message);
    }
  }

  function resetForm() {
    setFormTitle("");
    setFormDesc("");
    setFormAssignee("");
    setFormDeadline("");
    setShowForm(false);
    setEditing(null);
    setFormError("");
  }

  function openEdit(task: TaskOut) {
    setEditing(task);
    setFormTitle(task.title);
    setFormDesc(task.description || "");
    setFormAssignee(task.assignee_member_id || "");
    setFormDeadline(task.deadline ? task.deadline.slice(0, 10) : "");
    setShowForm(true);
  }

  useEffect(() => {
    if (!menuTask) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") closeMenu(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [menuTask]);

  function closeMenu() { setMenuTask(null); setMenuPos(null); }

  function openMenu(task: TaskOut, e: React.MouseEvent) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setMenuPos({ top: rect.bottom + 4, right: document.documentElement.clientWidth - rect.right });
    setMenuTask(task);
  }

  async function markDone(task: TaskOut) {
    if (task.done) return;
    setError("");
    const prev = tasks;
    setTasks((t) => (t ?? []).map((x) => (x.id === task.id ? { ...x, done: true } : x)));
    try {
      await api.post(`/staff/tasks/${task.id}/complete`);
    } catch (e) {
      setTasks(prev);
      setError((e as ApiError).message);
    }
  }

  const tabs = [
    { value: "all" as const, label: "All" },
    { value: "active" as const, label: "Active" },
    { value: "completed" as const, label: "Completed" },
  ];

  return (
    <>
      <PageHeader
        title="Tasks"
        subtitle="Simple task management for your team"
        action={
          <Button onClick={() => { resetForm(); setShowForm(true); }}>
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            New task
          </Button>
        }
      />

      {error && <div className="mb-4"><Alert>{error}</Alert></div>}

      <div className="mb-4 flex w-fit gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-1">
        {tabs.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setFilter(t.value)}
            className={`rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors ${
              filter === t.value
                ? "bg-[var(--primary)] text-[var(--primary-foreground)] shadow-sm"
                : "text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Create / Edit dialog */}
      <Dialog
        open={showForm}
        onClose={resetForm}
        title={editing ? "Edit task" : "New task"}
        subtitle={editing ? "Update task details" : "Assign a task to a team member"}
      >
        <form onSubmit={editing ? update : submit} className="space-y-4">
          {formError && <Alert>{formError}</Alert>}
          <Input
            label="Title"
            required
            value={formTitle}
            onChange={(e) => setFormTitle(e.target.value)}
            placeholder="What needs to be done?"
          />
          <Select label="Assignee" value={formAssignee} onChange={(e) => setFormAssignee(e.target.value)}>
            <option value="">Unassigned</option>
            {members.map((m) => (
              <option key={m.member_id} value={m.member_id}>
                {m.full_name || m.email}
              </option>
            ))}
          </Select>
          <Input label="Deadline" type="date" value={formDeadline} onChange={(e) => setFormDeadline(e.target.value)} />
          <Textarea label="Description" value={formDesc} onChange={(e) => setFormDesc(e.target.value)} placeholder="Optional details, notes, or instructions" rows={3} />
          <div className="flex gap-2 pt-2">
            <Button type="submit" loading={formLoading}>{editing ? "Save changes" : "Create task"}</Button>
            <Button type="button" variant="ghost" onClick={resetForm}>Cancel</Button>
          </div>
        </form>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title=""
        subtitle=""
        hideTitle
      >
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 dark:bg-red-900/20">
            <svg className="h-6 w-6 text-[var(--danger)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </div>
          <h3 className="mb-1 text-lg font-semibold text-[var(--foreground)]">Delete task</h3>
          <p className="mb-6 text-sm leading-relaxed text-[var(--foreground-muted)]">
            Are you sure you want to delete <span className="font-medium text-[var(--foreground)]">&ldquo;{deleting?.title}&rdquo;</span>? This action cannot be undone.
          </p>
          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => setDeleting(null)} className="flex-1">Cancel</Button>
            <Button variant="danger" onClick={confirmDelete} className="flex-1">Delete</Button>
          </div>
        </div>
      </Dialog>

      {/* Detail view dialog */}
      <Dialog open={!!viewing} onClose={() => setViewing(null)} title={viewing?.title ?? ""} subtitle="Task details">
        {viewing && (
          <div className="space-y-5">
            {viewing.description && (
              <div>
                <span className="mb-1.5 block text-[13px] font-medium text-[var(--foreground)]">Description</span>
                <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-[var(--foreground-muted)]">{viewing.description}</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="mb-1 block text-[13px] font-medium text-[var(--foreground)]">Assignee</span>
                <span className="text-sm text-[var(--foreground-muted)]">
                  {viewing.assignee_member_id ? (memberById[viewing.assignee_member_id] || "—") : "Unassigned"}
                </span>
              </div>
              <div>
                <span className="mb-1 block text-[13px] font-medium text-[var(--foreground)]">Deadline</span>
                <span className="text-sm text-[var(--foreground-muted)]">
                  {viewing.deadline ? formatDate(viewing.deadline) : "No deadline"}
                </span>
              </div>
            </div>
            <div>
              <span className="mb-1 block text-[13px] font-medium text-[var(--foreground)]">Status</span>
              <Badge tone={viewing.done ? "success" : "neutral"}>{viewing.done ? "Done" : "Active"}</Badge>
            </div>
            <div className="flex justify-end gap-2 border-t border-[var(--border)] pt-4">
              <Button variant="secondary" onClick={() => { setViewing(null); openEdit(viewing); }}>Edit</Button>
              <Button variant="ghost" onClick={() => setViewing(null)}>Close</Button>
            </div>
          </div>
        )}
      </Dialog>

      <Card>
        <CardHeader
          title="Tasks"
          subtitle={tasks ? `${filtered.length} task${filtered.length === 1 ? "" : "s"}` : undefined}
        />
        {tasks === null ? (
          <Spinner label="Loading tasks..." />
        ) : filtered.length === 0 ? (
          <EmptyState
            title="No tasks found"
            hint={filter !== "all" ? "Try a different filter." : "Create your first task to get started."}
            action={filter === "all" ? <Button onClick={() => { resetForm(); setShowForm(true); }}>+ New task</Button> : undefined}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                <tr className="border-b border-[var(--border)]">
                  <th className="w-12 px-4 py-3" />
                  <th className="px-4 py-3">Title</th>
                  <th className="px-4 py-3">Assignee</th>
                  <th className="px-4 py-3">Deadline</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {filtered.map((task) => {
                  const overdue = task.deadline && !task.done && new Date(task.deadline) < new Date();
                  return (
                    <tr
                      key={task.id}
                      className={`transition-colors hover:bg-[var(--background)] ${task.done ? "opacity-50" : ""}`}
                    >
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          disabled={task.done}
                          onClick={() => markDone(task)}
                          className={`flex h-5 w-5 items-center justify-center rounded border-2 transition-colors ${
                            task.done
                              ? "border-[var(--success)] bg-[var(--success)] text-white"
                              : "border-[var(--border-strong)] hover:border-[var(--primary)] hover:bg-[var(--primary-light)] cursor-pointer"
                          }`}
                          title={task.done ? "Completed" : "Mark as done"}
                        >
                          {task.done && (
                            <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M4.5 12.75l6 6 9-13.5" />
                            </svg>
                          )}
                        </button>
                      </td>
                      <td className={`max-w-[260px] px-4 py-3 font-medium ${task.done ? "text-[var(--muted)] line-through" : "text-[var(--foreground)]"}`}>
                        <button type="button" onClick={() => setViewing(task)} className="block w-full truncate text-left hover:underline">
                          {task.title}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        {task.assignee_member_id ? (
                          <div className="flex items-center gap-2">
                            <Avatar name={memberById[task.assignee_member_id] || "?"} size="sm" />
                            <span className="text-[var(--foreground-muted)]">
                              {memberById[task.assignee_member_id] || "—"}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[var(--muted)]">Unassigned</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {task.deadline ? (
                          <span className={`tabular-nums ${overdue ? "font-medium text-[var(--danger)]" : "text-[var(--foreground-muted)]"}`}>
                            {formatDate(task.deadline)}
                          </span>
                        ) : (
                          <span className="text-[var(--muted)]">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={task.done ? "success" : "neutral"}>{task.done ? "Done" : "Active"}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={(e) => openMenu(task, e)}
                            className="flex h-8 w-8 items-center justify-center rounded-md text-[var(--muted)] transition-colors hover:bg-[var(--background)] hover:text-[var(--foreground)]"
                          >
                            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                              <circle cx="12" cy="5" r="1.5" />
                              <circle cx="12" cy="12" r="1.5" />
                              <circle cx="12" cy="19" r="1.5" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Portal-based kebab menu */}
      {menuTask && menuPos && createPortal(
        <>
          <div className="fixed inset-0 z-40" onClick={closeMenu} />
          <div
            className="fixed z-50 min-w-[140px] overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)] py-1 shadow-lg animate-fade-in"
            style={{ top: menuPos.top, right: menuPos.right }}
          >
              <button
                type="button"
                onClick={() => { closeMenu(); setViewing(menuTask); }}
                className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm text-[var(--foreground)] transition-colors hover:bg-[var(--background)]"
              >
                <svg className="h-3.5 w-3.5 text-[var(--muted)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                View
              </button>
              <button
                type="button"
                onClick={() => { closeMenu(); openEdit(menuTask); }}
                className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm text-[var(--foreground)] transition-colors hover:bg-[var(--background)]"
              >
                <svg className="h-3.5 w-3.5 text-[var(--muted)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                </svg>
                Edit
              </button>
              <button
                type="button"
                onClick={() => { closeMenu(); setDeleting(menuTask); }}
              className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm text-[var(--danger)] transition-colors hover:bg-[var(--background)]"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
              </svg>
              Delete
            </button>
          </div>
        </>,
        document.body,
      )}
    </>
  );
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === tomorrow.toDateString()) return "Tomorrow";

  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date);
}
