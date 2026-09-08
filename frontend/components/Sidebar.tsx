"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { GymStatusToggle } from "./GymStatusToggle";
import { LiveIndicator } from "./Realtime";
import { OrgSwitcher } from "./OrgSwitcher";
import { ThemeToggle } from "./ThemeToggle";
import type { GymStatus } from "@/lib/types";
import {
  NAV_LABEL_OVERRIDES,
  NAV_MODULE_BY_HREF,
  getIndustry,
} from "@/lib/industries";

function cx(...parts: (string | false | undefined | null)[]): string {
  return parts.filter(Boolean).join(" ");
}

type NavItem = { href: string; label: string; icon: string };

// The gym-reference navigation, in order. Each route is gated by the registry
// module it belongs to; venue verticals filter this list and swap labels.
const NAV: NavItem[] = [
  { href: "/app", label: "Dashboard", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1" },
  { href: "/app/analytics", label: "Analytics", icon: "M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" },
  { href: "/app/plans", label: "Plans", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" },
  { href: "/app/members", label: "Members", icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" },
  { href: "/app/payments", label: "Payments", icon: "M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" },
  { href: "/app/cash", label: "Cash", icon: "M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
  { href: "/app/receipts", label: "Receipts", icon: "M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" },
  { href: "/app/tasks", label: "Tasks", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2M9 12l2 2 4-4" },
  { href: "/app/classes", label: "Classes", icon: "M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5m-9-6h.008v.008H12v-.008zM12 15h.008v.008H12V15zm0 2.25h.008v.008H12v-.008zM9.75 15h.008v.008H9.75V15zm0 2.25h.008v.008H9.75v-.008zM7.5 15h.008v.008H7.5V15zm0 2.25h.008v.008H7.5v-.008zm6.75-4.5h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V15zm0 2.25h.008v.008h-.008v-.008zm2.25-4.5h.008v.008H16.5v-.008zm0 2.25h.008v.008H16.5V15z" },
  { href: "/app/staff", label: "Staff", icon: "M12 4.5a3.75 3.75 0 1 0 0 7.5 3.75 3.75 0 0 0 0-7.5ZM6.75 20.25v-1.5a3.75 3.75 0 0 1 3.75-3.75h3a3.75 3.75 0 0 1 3.75 3.75v1.5" },
  { href: "/app/audit", label: "Audit", icon: "M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15a2.25 2.25 0 012.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" },
  { href: "/app/approvals", label: "Approvals", icon: "M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" },
  { href: "/app/payroll", label: "Payroll", icon: "M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0" },
  { href: "/app/billing", label: "Billing", icon: "M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" },
  { href: "/app/account", label: "Account", icon: "M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" },
  { href: "/app/settings", label: "Settings", icon: "M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z M15 12a3 3 0 11-6 0 3 3 0 016 0z" },
];

/** Registry-driven nav for an org's industry. gym (the reference) is returned
 *  byte-for-byte unchanged; office/academy drop routes whose module is off and
 *  relabel venue-specific pages. */
function navFor(industry?: string): NavItem[] {
  const meta = getIndustry(industry);
  const overrides = NAV_LABEL_OVERRIDES[meta.key] ?? {};
  return NAV.filter((item) => meta.modules.includes(NAV_MODULE_BY_HREF[item.href])).map(
    (item) => ({ ...item, label: overrides[item.href] ?? item.label }),
  );
}

interface SidebarProps {
  orgName: string;
  orgCode: string;
  orgId?: string;
  gymStatus: GymStatus;
  /** Venue vertical (gym | office | academy). Drives which nav modules show. */
  industry?: string;
}

export function Sidebar({ orgName, orgCode, orgId, gymStatus, industry }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const items = navFor(industry);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <>
      <MobileNavigation orgName={orgName} orgCode={orgCode} items={items} />
      <aside className="hidden lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-64 lg:shrink-0 lg:flex-col border-r border-foreground/10 bg-background/70 backdrop-blur">
        {/* Brand lockup — dot + serif wordmark (§10.2) */}
        <div className="flex h-16 shrink-0 items-center gap-2.5 border-b border-foreground/10 px-6">
          <span className="h-2 w-2 rounded-full bg-brand" aria-hidden="true" />
          <Link
            href="/app"
            className="font-heading text-[17px] leading-none tracking-tight text-foreground"
          >
            Gym Ops
          </Link>
        </div>

        {/* Org context + live status */}
        <div className="space-y-2 border-b border-foreground/10 px-4 py-4">
          <OrgSwitcher currentOrgName={orgName} currentOrgCode={orgCode} currentOrgId={orgId} />
          <GymStatusToggle initialStatus={gymStatus} />
        </div>

        {/* Navigation — active state is a solid brand pill (§10.3) */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {items.map((item) => {
            const active = item.href === "/app" ? pathname === "/app" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "group flex h-10 items-center gap-3 rounded-lg px-3.5 text-sm transition-colors duration-150",
                  active
                    ? "bg-brand font-medium text-brand-foreground"
                    : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground",
                )}
              >
                <svg
                  className={cx(
                    "h-4 w-4 shrink-0 transition-colors",
                    active ? "text-brand-foreground" : "text-foreground/45 group-hover:text-foreground/80",
                  )}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d={item.icon} />
                </svg>
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Account strip + theme + sign out (§10.2) */}
        <div className="shrink-0 border-t border-foreground/10 px-6 py-4">
          <p className="mb-3 truncate font-mono text-xs text-muted-foreground">{orgCode}</p>
          <div className="mb-2 flex items-center justify-between">
            <LiveIndicator />
            <ThemeToggle />
          </div>
          <button
            onClick={logout}
            className="flex w-full items-center gap-2.5 rounded-md px-1 py-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
          >
            <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
            </svg>
            Sign out
          </button>
        </div>
      </aside>
    </>
  );
}

function MobileNavigation({
  orgName,
  orgCode,
  items,
}: {
  orgName: string;
  orgCode: string;
  items: NavItem[];
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Always close after navigating — a route change means the menu's job is done.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Lock the page scroll while the sheet is open so a long list doesn't scroll
  // the body underneath.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-foreground/10 bg-background/80 px-4 backdrop-blur lg:hidden">
        <Link href="/app" className="flex shrink-0 items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-brand" aria-hidden="true" />
          <span className="font-heading text-lg leading-none tracking-tight text-foreground">Gym Ops</span>
        </Link>
        <p className="min-w-0 flex-1 truncate text-right font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
          {orgName} · {orgCode}
        </p>
        <ThemeToggle />
        <button
          type="button"
          aria-expanded={open}
          aria-controls="mobile-nav-panel"
          onClick={() => setOpen((v) => !v)}
          className="flex h-9 shrink-0 cursor-pointer list-none items-center gap-2 rounded-full border border-foreground/20 px-4 text-xs font-mono uppercase tracking-widest text-foreground transition-colors hover:border-foreground/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring-accent)]/50"
        >
          Menu
          <svg
            className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
          </svg>
        </button>
      </header>

      {open && (
        <>
          {/* Tap-anywhere backdrop to dismiss */}
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-30 bg-background/50 lg:hidden"
          />
          <nav
            id="mobile-nav-panel"
            aria-label="Mobile navigation"
            className="fixed right-4 top-[calc(3.5rem+0.5rem)] z-40 max-h-[calc(100dvh-4.5rem)] w-[min(19rem,calc(100vw-2rem))] overflow-y-auto overscroll-contain rounded-lg border border-foreground/10 bg-surface p-2 shadow-lg lg:hidden"
          >
            {items.map((item) => {
              const active = item.href === "/app" ? pathname === "/app" : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={cx(
                    "flex min-h-11 items-center gap-3 rounded-md px-3 text-sm transition-colors",
                    active ? "bg-brand font-medium text-brand-foreground" : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground",
                  )}
                >
                  <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={item.icon} /></svg>
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </>
      )}
    </>
  );
}
