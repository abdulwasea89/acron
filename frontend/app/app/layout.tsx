import { redirect } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { OfflineBanner, RealtimeProvider } from "@/components/Realtime";
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
    <RealtimeProvider>
      <div className="min-h-screen bg-background text-foreground noise-overlay">
        <div className="relative lg:flex lg:min-h-screen">
          <Sidebar
            orgName={org.name}
            orgCode={org.org_code}
            orgId={org.id}
            gymStatus={org.gym_status}
            industry={org.industry}
          />
          <div className="relative flex min-w-0 flex-1 flex-col">
            <OfflineBanner />
            {/* Content column: centered, capped at 1240 (DESIGN §10.2). */}
            <main className="w-full flex-1 self-center px-5 py-8 sm:px-8 lg:max-w-[1240px] lg:py-10">
              {children}
            </main>
          </div>
        </div>
      </div>
    </RealtimeProvider>
  );
}
