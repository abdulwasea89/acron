"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const NAV = [
  { href: "/app", label: "Dashboard", icon: "◉" },
  { href: "/app/plans", label: "Plans", icon: "▤" },
  { href: "/app/members", label: "Members", icon: "☺" },
  { href: "/app/billing", label: "Billing", icon: "$" },
  { href: "/app/settings", label: "Settings", icon: "⚙" },
];

export function Sidebar({ orgName, orgCode }: { orgName: string; orgCode: string }) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-[var(--border)] bg-white">
      <div className="border-b border-[var(--border)] px-5 py-4">
        <div className="text-sm font-semibold">{orgName}</div>
        <div className="mt-0.5 font-mono text-xs text-[var(--muted)]">{orgCode}</div>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {NAV.map((item) => {
          const active =
            item.href === "/app" ? pathname === "/app" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
                active
                  ? "bg-indigo-50 text-[var(--primary)]"
                  : "text-[var(--muted)] hover:bg-gray-50 hover:text-[var(--foreground)]",
              ].join(" ")}
            >
              <span className="w-4 text-center">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-[var(--border)] p-3">
        <button
          onClick={logout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-[var(--muted)] transition hover:bg-gray-50 hover:text-[var(--danger)]"
        >
          <span className="w-4 text-center">⏻</span>
          Sign out
        </button>
      </div>
    </aside>
  );
}
