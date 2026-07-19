"use client";

import { useEffect, useState, useCallback } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Dialog } from "@/components/Dialog";
import { Alert, Badge, Button, Card, CardHeader, EmptyState, Input, Select, Spinner } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useRealtimeEvent } from "@/components/Realtime";
import type { StaffInviteOut, MemberDirectoryItem } from "@/lib/types";

const STAFF_ROLES = ["manager", "trainer", "front_desk"];

export default function StaffPage() {
  const currentUser = useCurrentUser();
  const [members, setMembers] = useState<MemberDirectoryItem[] | null>(null);
  const [invites, setInvites] = useState<StaffInviteOut[]>([]);
  const [error, setError] = useState("");
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteResult, setInviteResult] = useState<StaffInviteOut | null>(null);

  // Invite form state
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("manager");
  const [inviteFormError, setInviteFormError] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);

  // Role change state
  const [changingRole, setChangingRole] = useState<MemberDirectoryItem | null>(null);
  const [newRole, setNewRole] = useState("");
  const [roleChangeError, setRoleChangeError] = useState("");
  const [roleChangeLoading, setRoleChangeLoading] = useState(false);

  const isOwner = currentUser?.role === "owner";

  const load = useCallback(async () => {
    setError("");
    try {
      const m = await api.get<MemberDirectoryItem[]>("/members");
      setMembers(m);
    } catch (e) {
      setError((e as ApiError).message);
      setMembers([]);
    }
    try {
      const i = await api.get<StaffInviteOut[]>("/staff/invites");
      setInvites(i);
    } catch {
      // best-effort
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  useRealtimeEvent(["staff.changed", "member.status_changed"], load);

  const staff = (members ?? []).filter((m) => STAFF_ROLES.includes(m.role));
  const pendingInvites = invites.filter((i) => !i.used);

  async function createInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviteFormError("");
    if (!inviteEmail.trim()) { setInviteFormError("Email is required."); return; }
    setInviteLoading(true);
    try {
      const result = await api.post<StaffInviteOut>("/staff/invites", {
        role: inviteRole,
        email: inviteEmail.trim(),
      });
      setInviteResult(result);
      setInviteEmail("");
      load();
    } catch (e) {
      setInviteFormError((e as ApiError).message);
    } finally {
      setInviteLoading(false);
    }
  }

  async function submitRoleChange() {
    if (!changingRole || !newRole) return;
    setRoleChangeError("");
    setRoleChangeLoading(true);
    try {
      await api.patch(`/members/${changingRole.member_id}/role`, { role: newRole });
      setChangingRole(null);
      setNewRole("");
      load();
    } catch (e) {
      setRoleChangeError((e as ApiError).message);
    } finally {
      setRoleChangeLoading(false);
    }
  }

  function closeInviteResult() {
    setInviteResult(null);
    setShowInviteForm(false);
  }

  const roleBadgeTone = (role: string): "info" | "success" | "neutral" | "warning" => {
    switch (role) {
      case "manager": return "info";
      case "trainer": return "success";
      case "front_desk": return "warning";
      default: return "neutral";
    }
  };

  return (
    <>
      <PageHeader
        title="Staff"
        subtitle="Manage your team members and invites"
        action={
          <Button onClick={() => { setInviteResult(null); setShowInviteForm(true); }}>
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Invite staff
          </Button>
        }
      />

      {error && <div className="mb-4"><Alert>{error}</Alert></div>}

      {/* Invite dialog */}
      <Dialog
        open={showInviteForm}
        onClose={() => { setShowInviteForm(false); setInviteResult(null); }}
        title={inviteResult ? "Invite created" : "Invite a staff member"}
        subtitle={inviteResult ? "Share this code with the staff member" : "Choose a role and enter their email"}
      >
        {inviteResult ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-[var(--success-border)] bg-[var(--success-bg)] p-4 text-center">
              <p className="mb-1 text-sm font-medium text-[var(--success)]">Invite code</p>
              <p className="font-mono text-lg font-bold tracking-wider text-[var(--foreground)] select-all">{inviteResult.code}</p>
            </div>
            <p className="text-sm text-[var(--foreground-muted)]">
              Share this code with the staff member. They can redeem it at <strong className="text-[var(--foreground)]">/redeem</strong> to create their account.
            </p>
            <div className="flex gap-2">
              <Button
                onClick={() => { navigator.clipboard.writeText(inviteResult.code); }}
                className="flex-1"
              >
                Copy code
              </Button>
              <Button variant="secondary" onClick={closeInviteResult} className="flex-1">Done</Button>
            </div>
          </div>
        ) : (
          <form onSubmit={createInvite} className="space-y-4">
            {inviteFormError && <Alert>{inviteFormError}</Alert>}
            <Input
              label="Email"
              type="email"
              required
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="staff@example.com"
            />
            <Select label="Role" value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}>
              <option value="manager">Manager</option>
              <option value="trainer">Trainer</option>
              <option value="front_desk">Front Desk</option>
            </Select>
            <div className="flex gap-2 pt-2">
              <Button type="submit" loading={inviteLoading}>Generate invite</Button>
              <Button type="button" variant="ghost" onClick={() => setShowInviteForm(false)}>Cancel</Button>
            </div>
          </form>
        )}
      </Dialog>

      {/* Role change dialog */}
      <Dialog
        open={!!changingRole}
        onClose={() => setChangingRole(null)}
        title="Change role"
        subtitle={`Change role for ${changingRole?.full_name || changingRole?.email}`}
      >
        <div className="space-y-4">
          {roleChangeError && <Alert>{roleChangeError}</Alert>}
          <Select label="New role" value={newRole || changingRole?.role || ""} onChange={(e) => setNewRole(e.target.value)}>
            <option value="manager">Manager</option>
            <option value="trainer">Trainer</option>
            <option value="front_desk">Front Desk</option>
            <option value="member">Member</option>
          </Select>
          {newRole && newRole !== changingRole?.role && (
            <p className="text-xs text-[var(--warning)]">
              {newRole === "member"
                ? "This will remove all staff privileges."
                : `This will grant ${newRole} permissions.`
              }
            </p>
          )}
          <div className="flex gap-2 pt-2">
            <Button onClick={submitRoleChange} loading={roleChangeLoading} variant={newRole === "member" ? "danger" : "primary"}>
              Save
            </Button>
            <Button variant="ghost" onClick={() => setChangingRole(null)}>Cancel</Button>
          </div>
        </div>
      </Dialog>

      {/* Staff directory */}
      <Card>
        <CardHeader
          title="Active staff"
          subtitle={staff ? `${staff.length} staff member${staff.length === 1 ? "" : "s"}` : undefined}
        />
        {members === null ? (
          <Spinner label="Loading staff..." />
        ) : staff.length === 0 ? (
          <EmptyState
            title="No staff yet"
            hint="Invite managers, trainers, or front desk staff to help run your gym."
            action={<Button onClick={() => { setInviteResult(null); setShowInviteForm(true); }}>+ Invite staff</Button>}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                <tr className="border-b border-[var(--border)]">
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Status</th>
                  {isOwner && <th className="px-4 py-3 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {staff.map((s) => (
                  <tr key={s.member_id} className="transition-colors hover:bg-[var(--background)]">
                    <td className="px-4 py-3">
                      <p className="font-medium text-[var(--foreground)]">{s.full_name || "—"}</p>
                    </td>
                    <td className="px-4 py-3 text-[var(--foreground-muted)]">{s.email}</td>
                    <td className="px-4 py-3">
                      <Badge tone={roleBadgeTone(s.role)}>
                        {s.role === "front_desk" ? "Front Desk" : s.role.charAt(0).toUpperCase() + s.role.slice(1)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={s.member_status === "active" ? "success" : "neutral"}>
                        {s.member_status}
                      </Badge>
                    </td>
                    {isOwner && (
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => { setChangingRole(s); setNewRole(s.role); setRoleChangeError(""); }}
                        >
                          Change role
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Pending invites */}
      {pendingInvites.length > 0 && (
        <Card className="mt-4">
          <CardHeader
            title="Pending invites"
            subtitle={`${pendingInvites.length} unredeemed invite${pendingInvites.length === 1 ? "" : "s"}`}
          />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                <tr className="border-b border-[var(--border)]">
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Code</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {pendingInvites.map((inv) => (
                  <tr key={inv.id} className="transition-colors hover:bg-[var(--background)]">
                    <td className="px-4 py-3 text-[var(--foreground-muted)]">{inv.email || "—"}</td>
                    <td className="px-4 py-3">
                      <Badge tone={roleBadgeTone(inv.role)}>
                        {inv.role === "front_desk" ? "Front Desk" : inv.role.charAt(0).toUpperCase() + inv.role.slice(1)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-[var(--muted)]">{inv.code}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}
