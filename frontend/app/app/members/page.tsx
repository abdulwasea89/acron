"use client";

import { useEffect, useRef, useState } from "react";
import { Dialog } from "@/components/Dialog";
import { PageHeader } from "@/components/PageHeader";
import { Alert, Avatar, Badge, Button, Card, CardHeader, EmptyState, Input, Spinner } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { statusTone, titleCase } from "@/lib/format";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import type { MemberDirectoryItem } from "@/lib/types";

interface InviteResult {
  member_id: string;
  email: string;
  invite_code: string;
  member_status: string;
  email_delivered: boolean;
}

function KebabIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="5" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="12" cy="19" r="1" />
    </svg>
  );
}

type MenuAction = { label: string; onClick: () => void; danger?: boolean };

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
    <div ref={menuRef} className="relative inline-flex items-center">
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
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function actionsFor(status: string): { action: string; label: string; variant: "secondary" | "danger"; endpoint?: string }[] {
  switch (status) {
    case "active":
    case "grace":
      return [
        { action: "freeze", label: "Freeze", variant: "secondary" },
        { action: "ban", label: "Ban", variant: "danger" },
      ];
    case "frozen":
      return [{ action: "unfreeze", label: "Unfreeze", variant: "secondary" }];
    case "banned":
      return [{ action: "unban", label: "Unban", variant: "secondary" }];
    case "pending_activation":
      return [
        { action: "resend_invite", label: "Resend invite", variant: "secondary" },
        { action: "cancel", label: "Cancel", variant: "danger" },
      ];
    case "pending_approval":
      return [];
    case "expired":
      return [
        { action: "resend_invite", label: "Resend invite", variant: "secondary" },
        { action: "cancel", label: "Remove", variant: "danger" },
      ];
    case "cancelled":
      return [
        { action: "resend_invite", label: "Resend invite", variant: "secondary" },
      ];
    default:
      return [];
  }
}

function roleBadge(role: string) {
  switch (role) {
    case "owner":
      return <Badge tone="warning">Owner</Badge>;
    case "manager":
      return <Badge tone="success">Manager</Badge>;
    case "trainer":
      return <Badge tone="info">Trainer</Badge>;
    case "front_desk":
      return <Badge tone="neutral">Front Desk</Badge>;
    default:
      return null;
  }
}

export default function MembersPage() {
  const currentUser = useCurrentUser();
  const [members, setMembers] = useState<MemberDirectoryItem[] | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteMsg, setInviteMsg] = useState("");
  const [inviteShare, setInviteShare] = useState<{ email: string; code: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [tab, setTab] = useState<"all" | "approvals">("all");

  async function copyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked
    }
  }

  async function load() {
    setError("");
    try {
      setMembers(await api.get<MemberDirectoryItem[]>("/members"));
    } catch (e) {
      setError((e as ApiError).message);
      setMembers([]);
    }
  }

  useEffect(() => {
    queueMicrotask(() => void load());
  }, []);

  function handleInviteResult(res: InviteResult, email: string, sentVerb: string) {
    if (res.email_delivered) {
      setInviteMsg(`Invite ${sentVerb} to ${email}.`);
      setInviteShare(null);
    } else {
      setInviteMsg("");
      setInviteShare({ email, code: res.invite_code });
    }
  }

  async function act(id: string, action: string, endpoint?: string) {
    setError("");
    setInviteMsg("");
    setInviteShare(null);
    try {
      if (endpoint === "approval") {
        await api.post(`/members/${id}/approval`, { approve: action === "approve" });
      } else if (action === "resend_invite") {
        const res = await api.post<InviteResult>(`/members/${id}/resend-invite`);
        handleInviteResult(res, res.email, "re-sent");
      } else {
        await api.post(`/members/${id}/status`, { action });
      }
      await load();
    } catch (e) {
      setError((e as ApiError).message);
    }
  }

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setInviteMsg("");
    setInviteShare(null);
    try {
      const res = await api.post<InviteResult>("/members/invite", { email: inviteEmail });
      handleInviteResult(res, inviteEmail, "sent");
      setInviteEmail("");
      setShowInvite(false);
      load();
    } catch (e) {
      setError((e as ApiError).message);
    }
  }

  const pending = (members ?? []).filter((m) => m.member_status === "pending_approval");

  const filtered = ((tab === "approvals" ? pending : members ?? [])).filter((m) => {
    const q = query.toLowerCase();
    return !q || m.email.toLowerCase().includes(q) || (m.full_name ?? "").toLowerCase().includes(q);
  });

  function tabBtn(t: "all" | "approvals", label: string, count: number) {
    const active = tab === t;
    return (
      <button
        onClick={() => setTab(t)}
        className={`inline-flex h-7 items-center gap-1.5 px-4 text-sm font-medium transition-colors ${
          active
            ? "text-[var(--foreground)]"
            : "text-[var(--muted)] hover:text-[var(--foreground)]"
        }`}
      >
        {label}
        <span className={`inline-flex items-center justify-center min-w-[4px] h-4 px-1 text-[11px] font-semibold rounded-full ${
          active
            ? "bg-[var(--foreground)] text-[var(--background)]"
            : "bg-[var(--border)] text-[var(--muted)]"
        }`}>
          {count}
        </span>
      </button>
    );
  }

  return (
    <>
      <PageHeader
        title="Members"
        subtitle="Directory & status management"
        action={
          <Button onClick={() => setShowInvite((s) => !s)} >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z" /></svg>
            Invite member
          </Button>
        }
      />

      {error && <div className="mb-4"><Alert>{error}</Alert></div>}
      {inviteMsg && (
        <div className="mb-4 animate-slide-down">
          <Alert tone="success">{inviteMsg}</Alert>
        </div>
      )}
      {inviteShare && (
        <div className="mb-4 animate-slide-down rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] shadow-xs p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-[var(--foreground)]">Invite code for {inviteShare.email}</div>
              <div className="mt-0.5 text-xs text-[var(--muted)]">
                Email delivery is off — share this single-use code with them.
              </div>
            </div>
            <button
              type="button"
              onClick={() => setInviteShare(null)}
              className="rounded-[var(--radius-sm)] p-1 text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--background)] transition-colors"
              aria-label="Dismiss"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <code className="flex-1 overflow-x-auto whitespace-nowrap rounded-[var(--radius)] border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 font-mono text-sm">
              {inviteShare.code}
            </code>
            <Button variant="secondary" onClick={() => copyCode(inviteShare.code)}>
              {copied ? (
                <>
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                  Copied
                </>
              ) : (
                <>
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" /></svg>
                  Copy
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      <Dialog open={showInvite} onClose={() => setShowInvite(false)} title="Invite a member" subtitle="Sends a single-use invite tied to their email">
        <form onSubmit={invite} className="flex flex-wrap items-end gap-3">
          <div className="min-w-[240px] flex-1">
            <Input
              label="Email"
              type="email"
              required
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="member@email.com"
            />
          </div>
          <Button type="submit" >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" /></svg>
            Send invite
          </Button>
        </form>
      </Dialog>

      <Card>
        <CardHeader
          title="Member directory"
          subtitle={
            tab === "approvals"
              ? `${filtered.length} pending approval`
              : members
                ? `${members.length} member${members.length === 1 ? "" : "s"}`
                : undefined
          }
          action={
            <div className="flex items-center gap-1.5">
              <Input
                placeholder="Search..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="!h-[32px] w-[70px]"
              />
              <div className="flex items-center border border-[var(--border)] rounded-[var(--radius)] shrink-0">
                {tabBtn("all", "All", members?.length ?? 0)}
                {tabBtn("approvals", "Approvals", pending.length)}
              </div>
            </div>
          }
        />
        {members === null ? (
          <Spinner label="Loading members..." />
        ) : filtered.length === 0 ? (
          <EmptyState
            title="No members found"
            hint={
              tab === "approvals"
                ? "No members are waiting for approval."
                : query
                  ? "Try a different search."
                  : "Members appear here after they sign up."
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                <tr className="border-b border-[var(--border)]">
                  <th className="px-6 py-3.5">Name</th>
                  <th className="px-6 py-3.5">Email</th>
                  <th className="px-6 py-3.5">Role</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {filtered.map((m) => {
                  const isCurrentUser = m.member_id === currentUser?.member_id;
                  const isOwner = m.role === "owner";
                  const canAct = !isOwner && !isCurrentUser;
                  return (
                    <tr key={m.member_id} className="transition-colors hover:bg-[var(--background)]">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <Avatar name={m.full_name || m.email} size="sm" />
                          <div>
                            <div className="font-medium text-[var(--foreground)]">
                              {m.full_name || "—"}
                              {isCurrentUser && <span className="ml-1.5 text-xs text-[var(--muted)]">(you)</span>}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-[var(--foreground-muted)]">{m.email}</td>
                      <td className="px-6 py-4">{roleBadge(m.role)}</td>
                      <td className="px-6 py-4">
                        <Badge tone={statusTone(m.member_status)}>{titleCase(m.member_status)}</Badge>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-end gap-2">
                          {canAct && m.member_status === "pending_approval" ? (
                            <KebabMenu
                              actions={[
                                { label: "Approve", onClick: () => act(m.member_id, "approve", "approval") },
                                { label: "Reject", onClick: () => act(m.member_id, "reject", "approval"), danger: true },
                              ]}
                            />
                          ) : canAct ? (
                            actionsFor(m.member_status).map((a) => (
                              <Button key={a.action} variant={a.variant} size="sm" onClick={() => act(m.member_id, a.action, a.endpoint)}>
                                {a.label}
                              </Button>
                            ))
                          ) : null}
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
    </>
  );
}
