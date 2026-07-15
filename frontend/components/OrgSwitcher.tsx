"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { OrganizationBrief } from "@/lib/types";

interface OrgSwitcherProps {
  currentOrgName: string;
  currentOrgCode: string;
  currentOrgId?: string;
}

export function OrgSwitcher({ currentOrgName, currentOrgCode, currentOrgId }: OrgSwitcherProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [orgs, setOrgs] = useState<OrganizationBrief[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const data = await api.get<OrganizationBrief[]>("/auth/my-organizations");
      setOrgs(data);
      setOpen(true);
    } catch {
      setError("Could not load organizations");
    } finally {
      setLoading(false);
    }
  }

  async function switchOrg(orgId: string) {
    setOpen(false);
    try {
      const res = await fetch("/api/auth/switch-org", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organization_id: orgId }),
      });
      if (!res.ok) throw new Error("Switch failed");
      router.push("/app");
      router.refresh();
    } catch {
      setError("Failed to switch organization");
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={toggle}
        className="flex w-full items-center gap-3 rounded-lg px-1 py-1 text-left transition-colors hover:bg-gray-50"
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-neutral-950">
          <svg className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-bold text-[var(--foreground)]">{currentOrgName}</div>
          <div className="mt-0.5 font-mono text-[11px] text-[var(--muted)] tracking-wide">{currentOrgCode}</div>
        </div>
        <svg className={`h-4 w-4 shrink-0 text-[var(--muted)] transition-transform ${open ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-xl border border-[var(--border)] bg-white p-1.5 shadow-lg">
          {loading && (
            <div className="px-3 py-2.5 text-[13px] text-[var(--muted)]">Loading...</div>
          )}
          {error && (
            <div className="px-3 py-2.5 text-[13px] text-[var(--danger)]">{error}</div>
          )}
          {!loading && !error && (
            <>
              {orgs.map((org) => {
                const isCurrent = org.organization_id === currentOrgId;
                return (
                  <button
                    key={org.organization_id}
                    onClick={() => switchOrg(org.organization_id)}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[13px] transition-colors ${
                      isCurrent
                        ? "bg-neutral-100 text-neutral-950 font-semibold"
                        : "text-[var(--foreground)] hover:bg-gray-50"
                    }`}
                  >
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-gray-100 text-[11px] font-bold text-gray-500">
                      {org.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate">{org.name}</div>
                      <div className="mt-0.5 font-mono text-[11px] text-[var(--muted)]">
                        {org.org_code} · {org.role}
                      </div>
                    </div>
                    {isCurrent && (
                      <svg className="h-4 w-4 shrink-0 text-neutral-950" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="m5 13 4 4L19 7" />
                      </svg>
                    )}
                  </button>
                );
              })}

              <div className="mt-1 border-t border-[var(--border)] pt-1">
                <button
                  onClick={() => {
                    setOpen(false);
                    router.push("/app/create-gym");
                  }}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[13px] font-medium text-neutral-950 transition-colors hover:bg-neutral-100"
                >
                  <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                  Create New Gym
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
