"use client";

import { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
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

  // Invite form
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("manager");
  const [inviteFormError, setInviteFormError] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);

  // Kebab menu
  const [menuMember, setMenuMember] = useState<MemberDirectoryItem | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);

  // Role change
  const [changingRole, setChangingRole] = useState<MemberDirectoryItem | null>(null);
  const [newRole, setNewRole] = useState("");
  const [roleChangeError, setRoleChangeError] = useState("");
  const [roleChangeLoading, setRoleChangeLoading] = useState(false);

  // Edit email
  const [editingEmail, setEditingEmail] = useState<MemberDirectoryItem | null>(null);
  const [newEmail, setNewEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);

  // Remove
  const [removing, setRemoving] = useState<MemberDirectoryItem | null>(null);
  const [removeError, setRemoveError] = useState("");
  const [removeLoading, setRemoveLoading] = useState(false);

  // Revoke invite
  const [revoking, setRevoking] = useState<StaffInviteOut | null>(null);
  const [revokeLoading, setRevokeLoading] = useState(false);

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

  useEffect(() => {
    if (!menuMember) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") closeMenu(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [menuMember]);

  function closeMenu() { setMenuMember(null); setMenuPos(null); }

  function openMenu(member: MemberDirectoryItem, e: React.MouseEvent) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setMenuPos({ top: rect.bottom + 4, right: document.documentElement.clientWidth - rect.right });
    setMenuMember(member);
  }

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

  async function submitEmailChange() {
    if (!editingEmail || !newEmail.trim()) return;
    setEmailError("");
    setEmailLoading(true);
    try {
      await api.patch(`/members/${editingEmail.member_id}/email`, { email: newEmail.trim() });
      setEditingEmail(null);
      setNewEmail("");
      load();
    } catch (e) {
      setEmailError((e as ApiError).message);
    } finally {
      setEmailLoading(false);
    }
  }

  async function confirmRemove() {
    if (!removing) return;
    setRemoveError("");
    setRemoveLoading(true);
    try {
      await api.post(`/members/${removing.member_id}/status`, { action: "cancel" });
      setRemoving(null);
      load();
    } catch (e) {
      setRemoveError((e as ApiError).message);
    } finally {
      setRemoveLoading(false);
    }
  }

  async function confirmRevoke() {
    if (!revoking) return;
    setRevokeLoading(true);
    try {
      await api.del(`/staff/invites/${revoking.id}`);
      setRevoking(null);
      load();
    } catch {
      // best-effort
    } finally {
      setRevokeLoading(false);
    }
  }

  function closeInviteResult() {
    setInviteResult(null);
    setShowInviteForm(false);
  }

  function maskCode(code: string): string {
    if (code.length <= 10) return code;
    return code.slice(0, 10) + "-••••";
  }

  const roleBadgeTone = (role: string): "info" | "success" | "neutral" | "warning" => {
    switch (role) {
      case "manager": return "info";
      case "trainer": return "success";
      case "front_desk": return "warning";
      default: return "neutral";
    }
  };

  const roleLabel = (role: string) =>
    role === "front_desk" ? "Front Desk" : role.charAt(0).toUpperCase() + role.slice(1);

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
              <Button onClick={() => { navigator.clipboard.writeText(inviteResult.code); }} className="flex-1">Copy code</Button>
              <Button variant="secondary" onClick={closeInviteResult} className="flex-1">Done</Button>
            </div>
          </div>
        ) : (
          <form onSubmit={createInvite} className="space-y-4">
            {inviteFormError && <Alert>{inviteFormError}</Alert>}
            <Input label="Email" type="email" required value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="staff@example.com" />
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

      {/* Edit email dialog */}
      <Dialog
        open={!!editingEmail}
        onClose={() => setEditingEmail(null)}
        title="Edit email"
        subtitle={`Change email for ${editingEmail?.full_name || editingEmail?.email}`}
      >
        <div className="space-y-4">
          {emailError && <Alert>{emailError}</Alert>}
          <Input
            label="New email"
            type="email"
            required
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="newemail@example.com"
          />
          <div className="flex gap-2 pt-2">
            <Button onClick={submitEmailChange} loading={emailLoading}>Save</Button>
            <Button variant="ghost" onClick={() => setEditingEmail(null)}>Cancel</Button>
          </div>
        </div>
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
                : `This will grant ${roleLabel(newRole)} permissions.`
              }
            </p>
          )}
          <div className="flex gap-2 pt-2">
            <Button onClick={submitRoleChange} loading={roleChangeLoading} variant={newRole === "member" ? "danger" : "primary"}>Save</Button>
            <Button variant="ghost" onClick={() => setChangingRole(null)}>Cancel</Button>
          </div>
        </div>
      </Dialog>

      {/* Remove confirmation dialog */}
      <Dialog
        open={!!removing}
        onClose={() => setRemoving(null)}
        title=""
        subtitle=""
        hideTitle
      >
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--danger-bg)]">
            <svg className="h-6 w-6 text-[var(--danger)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </div>
          <h3 className="mb-1 text-lg font-semibold text-[var(--foreground)]">Remove staff member</h3>
          <p className="mb-6 text-sm leading-relaxed text-[var(--foreground-muted)]">
            Are you sure you want to remove <span className="font-medium text-[var(--foreground)]">{removing?.full_name || removing?.email}</span> from staff? Their membership will be cancelled.
          </p>
          {removeError && <div className="mb-4"><Alert>{removeError}</Alert></div>}
          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => setRemoving(null)} className="flex-1">Keep staff</Button>
            <Button variant="danger" onClick={confirmRemove} loading={removeLoading} className="flex-1">Remove</Button>
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
                  {isOwner && <th className="w-12 px-4 py-3" />}
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
                      <Badge tone={roleBadgeTone(s.role)}>{roleLabel(s.role)}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={s.member_status === "active" ? "success" : "neutral"}>{s.member_status}</Badge>
                    </td>
                    {isOwner && (
                      <td className="px-4 py-3">
                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={(e) => openMenu(s, e)}
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
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Kebab menu portal */}
      {menuMember && menuPos && createPortal(
        <>
          <div className="fixed inset-0 z-40" onClick={closeMenu} />
          <div
            className="fixed z-50 min-w-[160px] overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)] py-1 shadow-lg animate-fade-in"
            style={{ top: menuPos.top, right: menuPos.right }}
          >
            <button
              type="button"
              onClick={() => { closeMenu(); setChangingRole(menuMember); setNewRole(menuMember.role); setRoleChangeError(""); }}
              className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm text-[var(--foreground)] transition-colors hover:bg-[var(--background)]"
            >
              <svg className="h-3.5 w-3.5 text-[var(--muted)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
              </svg>
              Change role
            </button>
            <button
              type="button"
              onClick={() => { closeMenu(); setEditingEmail(menuMember); setNewEmail(menuMember.email); setEmailError(""); }}
              className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm text-[var(--foreground)] transition-colors hover:bg-[var(--background)]"
            >
              <svg className="h-3.5 w-3.5 text-[var(--muted)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
              </svg>
              Edit email
            </button>
            <hr className="border-t border-[var(--border)]" />
            <button
              type="button"
              onClick={() => { closeMenu(); setRemoving(menuMember); setRemoveError(""); }}
              className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm text-[var(--danger)] transition-colors hover:bg-[var(--background)]"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
              </svg>
              Remove
            </button>
          </div>
        </>,
        document.body,
      )}

      {/* Revoke invite confirmation */}
      <Dialog
        open={!!revoking}
        onClose={() => setRevoking(null)}
        title=""
        subtitle=""
        hideTitle
      >
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--warning-bg)]">
            <svg className="h-6 w-6 text-[var(--warning)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </div>
          <h3 className="mb-1 text-lg font-semibold text-[var(--foreground)]">Revoke invite</h3>
          <p className="mb-6 text-sm leading-relaxed text-[var(--foreground-muted)]">
            This invite for <span className="font-medium text-[var(--foreground)]">{revoking?.email || "this person"}</span> will be cancelled. The invite code will no longer work.
          </p>
          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => setRevoking(null)} className="flex-1">Keep invite</Button>
            <Button variant="danger" onClick={confirmRevoke} loading={revokeLoading} className="flex-1">Revoke</Button>
          </div>
        </div>
      </Dialog>

      {/* Pending invites (owner only) */}
      {isOwner && pendingInvites.length > 0 && (
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
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {pendingInvites.map((inv) => (
                  <tr key={inv.id} className="transition-colors hover:bg-[var(--background)]">
                    <td className="px-4 py-3 text-[var(--foreground-muted)]">{inv.email || "—"}</td>
                    <td className="px-4 py-3"><Badge tone={roleBadgeTone(inv.role)}>{roleLabel(inv.role)}</Badge></td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-[var(--muted)]" title={inv.code}>{maskCode(inv.code)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <Button variant="ghost" size="sm" onClick={() => setRevoking(inv)}>Revoke</Button>
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
