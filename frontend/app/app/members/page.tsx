"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Alert, Badge, Button, Card, CardHeader, EmptyState, Input, Spinner } from "@/components/ui";
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

// Which status actions apply given the member's current status.
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
      return [
        { action: "approve", label: "Approve", variant: "secondary", endpoint: "approval" },
        { action: "reject", label: "Reject", variant: "danger", endpoint: "approval" },
      ];
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
      return <Badge tone="warning">Trainer</Badge>;
    case "front_desk":
      return <Badge>Front Desk</Badge>;
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
  // When email delivery is off, the backend returns the raw code to share by
  // hand. Hold it here so we can render a proper copyable panel (not inline).
  const [inviteShare, setInviteShare] = useState<{ email: string; code: string } | null>(null);
  const [copied, setCopied] = useState(false);

  async function copyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked (e.g. non-HTTPS) — the code is still visible to copy.
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
    load();
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
      load();
    } catch (e) {
      setError((e as ApiError).message);
    }
  }

  const filtered = (members ?? []).filter((m) => {
    const q = query.toLowerCase();
    return !q || m.email.toLowerCase().includes(q) || (m.full_name ?? "").toLowerCase().includes(q);
  });

  return (
    <>
      <PageHeader title="Members" subtitle="Directory & status management" />

      {error && <div className="mb-4"><Alert>{error}</Alert></div>}
      {inviteMsg && (
        <div className="mb-4 rounded-lg border border-[var(--border)] bg-[var(--success-bg)] px-4 py-3 text-sm text-[var(--success)]">
          {inviteMsg}
        </div>
      )}
      {inviteShare && (
        <div className="mb-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-medium">Invite code for {inviteShare.email}</div>
              <div className="mt-0.5 text-xs text-[var(--muted)]">
                Email delivery is off — share this single-use code with them. They redeem it at
                the member app with your org code.
              </div>
            </div>
            <button
              type="button"
              onClick={() => setInviteShare(null)}
              className="text-[var(--muted)] hover:text-[var(--foreground)]"
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <code className="flex-1 overflow-x-auto whitespace-nowrap rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 font-mono text-sm">
              {inviteShare.code}
            </code>
            <Button variant="secondary" onClick={() => copyCode(inviteShare.code)}>
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        </div>
      )}

      <div className="mb-6">
        <Card>
          <CardHeader title="Invite a member" subtitle="Sends a single-use invite tied to their email" />
          <form onSubmit={invite} className="flex flex-wrap items-end gap-3 p-5">
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
            <Button type="submit">Send invite</Button>
          </form>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Member directory"
          subtitle={members ? `${members.length} member${members.length === 1 ? "" : "s"}` : undefined}
          action={
            <div className="w-56">
              <Input placeholder="Search name or email…" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
          }
        />
        {members === null ? (
          <Spinner />
        ) : filtered.length === 0 ? (
          <EmptyState title="No members found" hint={query ? "Try a different search." : "Members appear here after they sign up."} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-[var(--muted)]">
                <tr className="border-b border-[var(--border)]">
                  <th className="px-5 py-3 font-medium">Name</th>
                  <th className="px-5 py-3 font-medium">Email</th>
                  <th className="px-5 py-3 font-medium">Role</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {filtered.map((m) => {
                  const isCurrentUser = m.member_id === currentUser?.member_id;
                  const isOwner = m.role === "owner";
                  const canAct = !isOwner && !isCurrentUser;
                  return (
                    <tr key={m.member_id} className="hover:bg-gray-50/60">
                      <td className="px-5 py-3 font-medium">
                        {m.full_name || "—"}
                        {isCurrentUser && <span className="ml-1.5 text-xs text-[var(--muted)]">(you)</span>}
                      </td>
                      <td className="px-5 py-3 text-[var(--muted)]">{m.email}</td>
                      <td className="px-5 py-3">{roleBadge(m.role)}</td>
                      <td className="px-5 py-3">
                        <Badge tone={statusTone(m.member_status)}>{titleCase(m.member_status)}</Badge>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex justify-end gap-2">
                          {canAct && actionsFor(m.member_status).map((a) => (
                            <Button key={a.action} variant={a.variant} onClick={() => act(m.member_id, a.action, a.endpoint)}>
                              {a.label}
                            </Button>
                          ))}
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
