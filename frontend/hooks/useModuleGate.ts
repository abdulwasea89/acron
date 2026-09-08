"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getIndustry } from "@/lib/industries";
import { useCurrentOrg } from "./useCurrentOrg";

/**
 * Gate an office admin page: if the active org's industry doesn't enable
 * `module` (e.g. a gym browsing /app/companies), redirect to /app. Returns the
 * org once loaded (ready=true) so pages can render their real shell.
 */
export function useModuleGate(module: string) {
  const router = useRouter();
  const org = useCurrentOrg();
  const enabled = org ? getIndustry(org.industry).modules.includes(module) : true;

  useEffect(() => {
    if (org && !enabled) router.replace("/app");
  }, [org, enabled, router]);

  return { org, ready: org !== null, enabled: org ? enabled : true };
}
