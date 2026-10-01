import { redirect } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { AssistantChatsProvider } from "@/components/assistant/AssistantChats";
import { AssistantShell } from "@/components/assistant/AssistantShell";
import { RealtimeProvider } from "@/components/Realtime";
import { SettingsProvider } from "@/components/settings/SettingsProvider";
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
      <SettingsProvider>
        <div className="min-h-screen bg-background text-foreground noise-overlay">
          {/* The chat list sits above both the sidebar and the pages: the
              sidebar lists recent chats and /app/assistant opens them, and the
              two are siblings here — neither contains the other. Keyed by org
              so switching tenants drops the previous org's chats. */}
          <AssistantChatsProvider key={org.id}>
            <div className="relative lg:flex lg:min-h-screen">
              <Sidebar
                orgName={org.name}
                orgCode={org.org_code}
                orgId={org.id}
                industry={org.industry}
                tier={org.saas_tier}
              />
              <div className="relative flex min-w-0 flex-1 flex-col">
                {/* Content column: centered, capped at 1240 (DESIGN §10.2). */}
                <main className="w-full flex-1 self-center px-5 py-8 sm:px-8 lg:max-w-[1240px] lg:py-10">
                  {/* The assistant dock wraps every page here, so the prompt bar
                      is one mount for the whole shell. It stays mounted on
                      /app/assistant too — that is where it hands a prompt over. */}
                  <AssistantShell orgId={org.id}>{children}</AssistantShell>
                </main>
              </div>
            </div>
          </AssistantChatsProvider>
        </div>
      </SettingsProvider>
    </RealtimeProvider>
  );
}
