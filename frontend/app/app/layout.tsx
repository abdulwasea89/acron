import { redirect } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { backend } from "@/lib/backend";
import { isAuthenticated } from "@/lib/session";
import type { OrganizationOut } from "@/lib/types";

// Server-rendered shell for all authenticated admin pages. Fetches the current
// org once (server-side, cookie-authed) and renders the sidebar around it.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (!(await isAuthenticated())) redirect("/login");

  let org: OrganizationOut | null = null;
  try {
    org = await backend<OrganizationOut>("/organizations/me");
  } catch {
    redirect("/login");
  }

  return (
    <div className="flex h-screen">
      <Sidebar orgName={org.name} orgCode={org.org_code} />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl px-6 py-8">{children}</div>
      </main>
    </div>
  );
}
