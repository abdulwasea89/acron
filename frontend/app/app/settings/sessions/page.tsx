"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card, Button, Alert, Spinner, Badge } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import type { AdminSessionInfo } from "@/lib/types";

export default function SessionsPage() {
  const [sessions, setSessions] = useState<AdminSessionInfo[] | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [ownerView, setOwnerView] = useState(true);

  const load = useCallback(async () => {
    setError("");
    try {
      const data = await api.get<AdminSessionInfo[]>("/auth/admin/sessions");
      setSessions(data);
      setOwnerView(true);
    } catch (e) {
      if ((e as ApiError).status === 403) {
        try {
          const data = await api.get<AdminSessionInfo[]>("/auth/sessions");
          setSessions(data);
          setOwnerView(false);
        } catch {
          setSessions([]);
        }
      } else {
        setSessions([]);
      }
    }
  }, []);

  useEffect(() => { queueMicrotask(() => void load()); }, [load]);

  async function revoke(id: string) {
    setRevokingId(id);
    setError("");
    setSuccess("");
    try {
      await api.del(`/auth/admin/sessions/${id}`);
      setSessions((prev) => prev?.map((s) => s.id === id ? { ...s, revoked: true } : s) ?? null);
      setSuccess("Session revoked.");
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setRevokingId(null);
    }
  }

  function timeAgo(iso: string | null): string {
    if (!iso) return "—";
    const diff = Date.now() - new Date(iso).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  }

  function formatUA(ua: string | null): string {
    if (!ua) return "Unknown";
    if (ua.includes("Electron")) return "Desktop App";
    if (ua.includes("Expo")) return "Mobile App";
    if (ua.includes("Chrome/")) return "Chrome";
    if (ua.includes("Firefox/")) return "Firefox";
    if (ua.includes("Safari/") && !ua.includes("Chrome")) return "Safari";
    if (ua.includes("Edge/")) return "Edge";
    return ua.slice(0, 40);
  }

  return (
    <>
      <PageHeader
        title="Sessions"
        subtitle={ownerView ? "Active sessions across your organization" : "Your active sessions"}
      />

      {error && <div className="mb-4"><Alert>{error}</Alert></div>}
      {success && <div className="mb-4 animate-slide-down"><Alert tone="success" onDismiss={() => setSuccess("")}>{success}</Alert></div>}

      {!sessions ? (
        <Spinner label="Loading sessions..." />
      ) : sessions.length === 0 ? (
        <Card>
          <div className="p-6 text-center text-sm text-[var(--foreground-muted)]">
            No active sessions found.
          </div>
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
                {ownerView && <th className="px-5 py-3">User</th>}
                <th className="px-5 py-3">Device</th>
                <th className="px-5 py-3">IP</th>
                <th className="px-5 py-3">Active</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--background)]/50">
                  {ownerView && (
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-[var(--foreground)]">{s.user_email}</span>
                        {s.user_name && <span className="text-[var(--foreground-muted)]">({s.user_name})</span>}
                        {s.current && <Badge tone="info" size="sm">You</Badge>}
                      </div>
                    </td>
                  )}
                  <td className="px-5 py-3 text-[var(--foreground)]">
                    {formatUA(s.user_agent)}
                  </td>
                  <td className="px-5 py-3 text-[var(--foreground-muted)] font-mono text-xs">
                    {s.ip_address ?? "—"}
                  </td>
                  <td className="px-5 py-3 text-[var(--foreground-muted)] whitespace-nowrap">
                    {timeAgo(s.last_activity_at)}
                  </td>
                  <td className="px-5 py-3">
                    <Badge tone={s.revoked ? "danger" : "success"} size="sm">
                      {s.revoked ? "Revoked" : "Active"}
                    </Badge>
                  </td>
                  <td className="px-5 py-3 text-right">
                    {!s.revoked && !s.current && (
                      <Button
                        variant="danger"
                        size="sm"
                        loading={revokingId === s.id}
                        onClick={() => revoke(s.id)}
                      >
                        Revoke
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}
