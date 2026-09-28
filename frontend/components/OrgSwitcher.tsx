"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { OrganizationBrief } from "@/lib/types";

function cx(...parts: (string | false | undefined | null)[]): string {
  return parts.filter(Boolean).join(" ");
}

interface OrgSwitcherProps {
  currentOrgName: string;
  currentOrgId?: string;
  /** Render just the workspace tile (collapsed sidebar rail). */
  compact?: boolean;
}

export function OrgSwitcher({ currentOrgName, currentOrgId, compact }: OrgSwitcherProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [orgs, setOrgs] = useState<OrganizationBrief[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Escape closes the menu.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  async function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    // Open immediately so the loading/error state is visible inside the menu.
    setOpen(true);
    setLoading(true);
    setError("");
    try {
      setOrgs(await api.get<OrganizationBrief[]>("/auth/my-organizations"));
    } catch {
      setError("Could not load workspaces.");
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
      setError("Failed to switch workspace.");
    }
  }

  function go(path: string) {
    setOpen(false);
    router.push(path);
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={toggle}
        title={currentOrgName}
        aria-expanded={open}
        aria-haspopup="menu"
        className={
          compact
            ? "mx-auto flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-foreground/5"
            : "flex h-9 w-full items-center gap-2 rounded-md px-2 text-left transition-colors hover:bg-foreground/5"
        }
      >
        <Tile name={currentOrgName} />
        {!compact && (
          <>
            <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-foreground">
              {currentOrgName}
            </span>
            <Icon
              d="M8.25 15L12 18.75 15.75 15m-7.5-6L12 5.25 15.75 9"
              className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
            />
          </>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute left-0 top-full z-50 mt-1 w-64 animate-fade-in rounded-lg border border-[var(--border)] bg-[var(--surface)] p-1 shadow-lg shadow-black/10"
        >
          {/* Current workspace header + quick settings. */}
          <div className="flex items-center gap-2.5 rounded-md px-2 py-1.5">
            <Tile name={currentOrgName} />
            <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-foreground">
              {currentOrgName}
            </span>
            <button
              type="button"
              aria-label="Settings"
              onClick={() => go("/app/settings")}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
            >
              <Icon
                d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z"
                className="h-4 w-4"
              />
            </button>
          </div>

          <Divider />

          {loading && (
            <p className="px-2 py-2 text-[13px] text-muted-foreground">Loading…</p>
          )}
          {error && <p className="px-2 py-2 text-[13px] text-[var(--danger)]">{error}</p>}
          {!loading && !error && (
            <div className="max-h-64 overflow-y-auto">
              {orgs.map((org) => {
                const isCurrent = org.organization_id === currentOrgId;
                return (
                  <button
                    key={org.organization_id}
                    role="menuitem"
                    onClick={() => switchOrg(org.organization_id)}
                    className={cx(
                      "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors",
                      isCurrent ? "bg-foreground/[0.06]" : "hover:bg-foreground/5",
                    )}
                  >
                    <Tile name={org.name} muted={!isCurrent} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] text-foreground">{org.name}</span>
                      <span className="block truncate text-[11px] text-muted-foreground">
                        {org.org_code} · {org.role}
                      </span>
                    </span>
                    {isCurrent && (
                      <Icon d="M4.5 12.75l6 6 9-13.5" className="h-4 w-4 shrink-0 text-foreground" />
                    )}
                  </button>
                );
              })}
            </div>
          )}

          <Divider />

          <button
            role="menuitem"
            onClick={() => go("/app/create-gym")}
            className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-[13px] text-foreground transition-colors hover:bg-foreground/5"
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center text-muted-foreground">
              <Icon d="M12 4.5v15m7.5-7.5h-15" className="h-[18px] w-[18px]" />
            </span>
            Create new workspace
          </button>
        </div>
      )}
    </div>
  );
}

/** Workspace tile: rounded square with the workspace initial. */
function Tile({ name, muted }: { name: string; muted?: boolean }) {
  return (
    <span
      className={cx(
        "flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[11px] font-semibold",
        muted
          ? "bg-foreground/[0.08] text-foreground/70"
          : "bg-[var(--primary)] text-[var(--primary-foreground)]",
      )}
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

function Divider() {
  return <div className="my-1 h-px bg-[var(--border)]" />;
}

function Icon({ d, className }: { d: string; className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}
