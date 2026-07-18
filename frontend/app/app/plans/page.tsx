"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { Dialog } from "@/components/Dialog";
import { useRealtimeEvent } from "@/components/Realtime";
import { PageHeader } from "@/components/PageHeader";
import { Alert, Badge, Button, Card, CardHeader, EmptyState, Input, Select, Spinner, Textarea } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { money, statusTone, titleCase } from "@/lib/format";
import type { PlanOut } from "@/lib/types";

function KebabIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="5" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="12" cy="19" r="1" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

type MenuAction = { label: string; icon: string; onClick: () => void; danger?: boolean };

function KebabMenu({ actions }: { actions: MenuAction[] }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ left: 0, top: 0 });
  const menuRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  function toggle() {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const flipUp = spaceBelow < 140;
      setPos({
        left: Math.max(8, rect.right - 130),
        top: flipUp ? rect.top - 4 : rect.bottom + 4,
      });
    }
    setOpen((s) => !s);
  }

  return (
    <div ref={menuRef} className="relative inline-block">
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--muted)] transition-colors hover:bg-[var(--background)] hover:text-[var(--foreground)]"
      >
        <KebabIcon />
      </button>
      {open && (
        <div
          style={{ left: pos.left, top: pos.top, position: "fixed" }}
          className="z-50 min-w-[130px] overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)] py-1 shadow-lg"
        >
          {actions.map((a) => (
            <button
              key={a.label}
              type="button"
              onClick={() => { setOpen(false); a.onClick(); }}
              className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors ${
                a.danger
                  ? "text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"
                  : "text-[var(--foreground)] hover:bg-[var(--background)]"
              }`}
            >
              {a.icon === "publish" && (
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 0 1 4-4h14" /><polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 0 1-4 4H3" />
                </svg>
              )}
              {a.icon === "pause" && (
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="14" y="4" width="4" height="16" rx="1" /><rect x="6" y="4" width="4" height="16" rx="1" />
                </svg>
              )}
              {a.icon === "play" && (
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
              )}
              {a.icon === "edit" && (
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 16.604a4.5 4.5 0 01-1.897 1.13L4 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                </svg>
              )}
              {a.icon === "view" && (
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              )}
              {a.icon === "copy" && (
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
              )}
              {a.icon === "archive" && (
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="3" width="20" height="5" rx="1" /><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" /><path d="M10 12h4" />
                </svg>
              )}
              {a.icon === "unarchive" && (
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="3" width="20" height="5" rx="1" /><path d="M8 8v11a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V8" /><path d="M10 12h4" /><path d="M12 2l-3 3h6l-3-3z" />
                </svg>
              )}
              {a.icon === "trash" && (
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" />
                </svg>
              )}
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function BillingIcon({ type }: { type: string }) {
  if (type === "recurring") {
    return (
      <svg className="h-3.5 w-3.5 text-[var(--info)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
      </svg>
    );
  }
  if (type === "one_time_pack") {
    return (
      <svg className="h-3.5 w-3.5 text-[var(--success)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z" /><path d="M7 7h.01" />
      </svg>
    );
  }
  return (
    <svg className="h-3.5 w-3.5 text-[var(--warning)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20" />
    </svg>
  );
}

function VisibilityIcon({ type }: { type: string }) {
  if (type === "public") {
    return (
      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="4" /><line x1="21.17" y1="8" x2="12" y2="8" /><line x1="3.95" y1="6.06" x2="8.54" y2="14" /><line x1="10.88" y1="21.94" x2="15.46" y2="14" />
      </svg>
    );
  }
  if (type === "members_only") {
    return (
      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="19" y1="8" x2="19" y2="14" /><line x1="22" y1="11" x2="16" y2="11" />
      </svg>
    );
  }
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

export default function PlansPage() {
  const [plans, setPlans] = useState<PlanOut[] | null>(null);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<PlanOut | null>(null);
  const [filter, setFilter] = useState<"active" | "archived">("active");
  const [search, setSearch] = useState("");
  const [viewing, setViewing] = useState<PlanOut | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  async function load() {
    setError("");
    try {
      setPlans(await api.get<PlanOut[]>("/plans"));
    } catch (e) {
      setError((e as ApiError).message);
      setPlans([]);
    }
  }

  useEffect(() => {
    queueMicrotask(() => void load());
  }, []);

  useRealtimeEvent(["plan.changed"], () => void load());

  async function act(id: string, action: string) {
    setError("");
    try {
      await api.post(`/plans/${id}/${action}`);
      await load();
    } catch (e) {
      setError((e as ApiError).message);
    }
  }

  async function confirmDelete() {
    if (!deleteId) return;
    setError("");
    try {
      await api.del(`/plans/${deleteId}`);
      setDeleteId(null);
      await load();
    } catch (e) {
      setError((e as ApiError).message);
      setDeleteId(null);
    }
  }

  const deleting = deleteId ? plans?.find((p) => p.id === deleteId) : null;

  const statusFiltered = plans === null ? null : plans.filter(
    (p) => filter === "active" ? p.status !== "archived" : p.status === "archived"
  );

  const filtered = useMemo(() => {
    if (statusFiltered === null) return null;
    if (!search.trim()) return statusFiltered;
    const q = search.toLowerCase();
    return statusFiltered.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.billing_type.toLowerCase().includes(q) ||
        p.visibility.toLowerCase().includes(q) ||
        p.status.toLowerCase().includes(q)
    );
  }, [statusFiltered, search]);

  return (
    <>
      <PageHeader
        title="Membership plans"
        subtitle="Owner-defined plans shown to members at signup"
        action={
          <Button onClick={() => setShowForm((s) => !s)} variant={showForm ? "secondary" : "primary"}>
            {showForm ? "Close" : "+ New plan"}
          </Button>
        }
      />

      {error && <div className="mb-5"><Alert>{error}</Alert></div>}

      <Dialog open={showForm} onClose={() => { setShowForm(false); setEditing(null); }} title={editing ? "Edit plan" : "Create plan"} subtitle={editing ? "Update plan details" : "Saved as a draft — publish it when ready"} className="max-w-xl">
        <PlanForm plan={editing} onCreated={() => { setShowForm(false); setEditing(null); load(); }} />
      </Dialog>

      <Dialog open={deleteId !== null} onClose={() => setDeleteId(null)} title="Delete plan" className="max-w-sm">
        <p className="text-sm text-[var(--foreground-muted)] mb-6">
          Are you sure you want to delete <strong className="text-[var(--foreground)]">{deleting?.name}</strong>?
          {deleting && plans?.some((p) => p.status === "archived") && (
            <span className="block mt-2">This action cannot be undone.</span>
          )}
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setDeleteId(null)}>Cancel</Button>
          <Button variant="danger" onClick={confirmDelete}>Delete plan</Button>
        </div>
      </Dialog>

      {/* Detail view dialog */}
      <Dialog open={!!viewing} onClose={() => setViewing(null)} title={viewing?.name ?? ""} subtitle="Plan details">
        {viewing && (
          <div className="space-y-5">
            {viewing.public_description && (
              <div>
                <span className="mb-1.5 block text-[13px] font-medium text-[var(--foreground)]">Description</span>
                <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-[var(--foreground-muted)]">{viewing.public_description}</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="mb-1 block text-[13px] font-medium text-[var(--foreground)]">Price</span>
                <span className="text-sm font-semibold text-[var(--foreground)]">{money(viewing.price, viewing.currency)}</span>
              </div>
              <div>
                <span className="mb-1 block text-[13px] font-medium text-[var(--foreground)]">Billing</span>
                <span className="text-sm text-[var(--foreground-muted)]">{titleCase(viewing.billing_type)}</span>
              </div>
              <div>
                <span className="mb-1 block text-[13px] font-medium text-[var(--foreground)]">Visibility</span>
                <span className="text-sm text-[var(--foreground-muted)]">{titleCase(viewing.visibility)}</span>
              </div>
              <div>
                <span className="mb-1 block text-[13px] font-medium text-[var(--foreground)]">Status</span>
                <Badge tone={statusTone(viewing.status)}>{titleCase(viewing.status)}</Badge>
              </div>
            </div>
            {viewing.featured && (
              <div className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-600 dark:bg-amber-500/10 dark:text-amber-400">
                <StarIcon /> Featured
              </div>
            )}
            <div className="flex justify-end gap-2 border-t border-[var(--border)] pt-4">
              <Button variant="secondary" onClick={() => { setViewing(null); setEditing(viewing); setShowForm(true); }}>Edit</Button>
              <Button variant="ghost" onClick={() => setViewing(null)}>Close</Button>
            </div>
          </div>
        )}
      </Dialog>

      <Card>
        <CardHeader
          title="Plans"
          subtitle={plans ? `${filtered?.length ?? 0} ${filter}` : undefined}
        />

        <div className="flex items-center justify-between gap-4 px-5 pb-5 pt-2">
          <div className="flex gap-1 rounded-xl bg-[var(--background)] p-0.5">
            <button
              type="button"
              onClick={() => setFilter("active")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                filter === "active"
                  ? "bg-[var(--surface)] text-[var(--foreground)] shadow-xs"
                  : "text-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
            >
              Active
              {plans !== null && (
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] tabular-nums ${
                  filter === "active"
                    ? "bg-[var(--primary)]/10 text-[var(--primary)]"
                    : "bg-[var(--background)] text-[var(--muted)]"
                }`}>
                  {plans.filter((p) => p.status !== "archived").length}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setFilter("archived")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                filter === "archived"
                  ? "bg-[var(--surface)] text-[var(--foreground)] shadow-xs"
                  : "text-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
            >
              Archived
              {plans !== null && (
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] tabular-nums ${
                  filter === "archived"
                    ? "bg-[var(--primary)]/10 text-[var(--primary)]"
                    : "bg-[var(--background)] text-[var(--muted)]"
                }`}>
                  {plans.filter((p) => p.status === "archived").length}
                </span>
              )}
            </button>
          </div>

          <div className="relative flex-1 max-w-xs">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5 text-[var(--muted)]">
              <SearchIcon />
            </div>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search plans..."
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] py-1.5 pl-8 pr-3 text-xs text-[var(--foreground)] placeholder-[var(--muted)] outline-none transition-colors focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]/20"
            />
          </div>
        </div>

        {filtered === null ? (
          <Spinner label="Loading plans..." />
        ) : filtered.length === 0 && filter === "active" && plans?.length === 0 ? (
          <div className="px-5 pb-10">
            <EmptyState
              title="No plans yet"
              hint="Create your first plan — members can't sign up until one is published."
              icon={<span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--primary)]/10 text-[var(--primary)]"><svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg></span>}
              action={
                <Button onClick={() => setShowForm(true)} size="lg">
                  + Create your first plan
                </Button>
              }
            />
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-5 pb-10">
            <EmptyState
              title={search ? `No plans matching "${search}"` : `No ${filter} plans`}
              hint={search ? "Try a different name." : filter === "archived" ? "Archive a plan to see it here." : undefined}
              icon={<span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--background)] text-[var(--muted)]"><SearchIcon /></span>}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
                <tr className="border-b border-[var(--border)]">
                  <th className="px-5 py-3 font-medium">Name</th>
                  <th className="px-5 py-3 font-medium">Price</th>
                  <th className="px-5 py-3 font-medium">Billing</th>
                  <th className="px-5 py-3 font-medium">Visibility</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {filtered.map((p) => (
                  <tr key={p.id} className="group transition-colors hover:bg-[var(--background)]/50">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <button type="button" onClick={() => setViewing(p)} className="max-w-[260px] truncate font-medium text-[var(--foreground)] hover:underline">{p.name}</button>
                            {p.featured && (
                              <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-600 dark:bg-amber-500/10 dark:text-amber-400">
                                <StarIcon /> Featured
                              </span>
                            )}
                          </div>

                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="tabular-nums font-semibold text-[var(--foreground)]">{money(p.price, p.currency)}</div>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1.5 text-xs text-[var(--foreground-muted)]">
                        <BillingIcon type={p.billing_type} />
                        <span>{titleCase(p.billing_type)}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1.5 text-xs text-[var(--foreground-muted)]">
                        <VisibilityIcon type={p.visibility} />
                        <span>{titleCase(p.visibility)}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge tone={statusTone(p.status)}>
                        {p.status === "draft" ? "Draft" : p.status === "published" ? "Published" : titleCase(p.status)}
                      </Badge>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <KebabMenu
                        actions={[
                          ...(p.status !== "archived"
                            ? [
                                ...(p.status === "draft"
                                  ? [{ label: "Publish", icon: "publish", onClick: () => act(p.id, "publish") }]
                                  : []),
                                ...(p.status === "published"
                                  ? [{ label: "Pause", icon: "pause", onClick: () => act(p.id, "pause") }]
                                  : []),
                                ...(p.status === "paused"
                                  ? [{ label: "Resume", icon: "play", onClick: () => act(p.id, "resume") }]
                                  : []),
                              ]
                            : []),
                          { label: "View", icon: "view", onClick: () => setViewing(p) },
                          { label: "Edit", icon: "edit", onClick: () => { setEditing(p); setShowForm(true); } },
                          { label: "Duplicate", icon: "copy", onClick: () => act(p.id, "duplicate") },
                          ...(p.status !== "archived"
                            ? [{ label: "Archive", icon: "archive", onClick: () => act(p.id, "archive"), danger: true }]
                            : [{ label: "Unarchive", icon: "unarchive", onClick: () => act(p.id, "unarchive") }]),
                          { label: "Delete", icon: "trash", onClick: () => setDeleteId(p.id), danger: true },
                        ]}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}

function PlanForm({ plan, onCreated }: { plan?: PlanOut | null; onCreated: () => void }) {
  const [name, setName] = useState(plan?.name ?? "");
  const [price, setPrice] = useState(plan ? String(plan.price) : "0");
  const [billing, setBilling] = useState(plan?.billing_type ?? "recurring");
  const [visibility, setVisibility] = useState(plan?.visibility ?? "public");
  const [desc, setDesc] = useState(plan?.public_description ?? "");
  const [featured, setFeatured] = useState(plan?.featured ?? false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const body = {
        name,
        price: parseFloat(price) || 0,
        billing_type: billing,
        visibility,
        public_description: desc || null,
        featured: featured || undefined,
        ...(billing === "recurring" ? { cycle_unit: "month", cycle_length: 1 } : {}),
      };
      if (plan) {
        await api.patch(`/plans/${plan.id}`, body);
      } else {
        await api.post("/plans", body);
      }
      onCreated();
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-5 sm:grid-cols-2">
      {error && <div className="sm:col-span-2"><Alert>{error}</Alert></div>}

      <Input label="Plan name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Monthly Unlimited" />

      <Input label="Price" type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />

      <Select label="Billing type" value={billing} onChange={(e) => setBilling(e.target.value)}>
        <option value="recurring">Recurring</option>
        <option value="one_time_pack">One-time pack</option>
        <option value="drop_in">Drop-in</option>
      </Select>

      <Select label="Visibility" value={visibility} onChange={(e) => setVisibility(e.target.value)}>
        <option value="public">Public</option>
        <option value="members_only">Members only</option>
        <option value="invite_only">Invite only</option>
      </Select>

      <div className="sm:col-span-2">
        <Textarea label="Public description" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="What members see on the signup screen" rows={3} />
      </div>

      <div className="sm:col-span-2 flex items-center gap-2">
        <input
          id="featured"
          type="checkbox"
          checked={featured}
          onChange={(e) => setFeatured(e.target.checked)}
          className="h-4 w-4 rounded border-[var(--border)] bg-[var(--surface)] text-[var(--primary)] accent-[var(--primary)]"
        />
        <label htmlFor="featured" className="text-sm text-[var(--foreground)] cursor-pointer">Featured plan</label>
      </div>

      <div className="sm:col-span-2 flex justify-end gap-2 border-t border-[var(--border)] pt-5">
        <Button type="submit" loading={loading} size="lg">{plan ? "Save changes" : "Save draft"}</Button>
      </div>
    </form>
  );
}
