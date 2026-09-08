import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { createStorage } from "./storage";
import type { OrgSummaryResponse } from "@/types/api";

const mmkvStorage = createStorage("org");

export interface OrgSummary {
  id: string;
  name: string;
  org_code: string;
  role: string;
  member_status?: string | null;
  /** Venue vertical: gym | office | academy (default gym). */
  industry?: string;
}

/**
 * Map a `/auth/my-organizations` row (backend key: `organization_id`) onto the
 * store's canonical `OrgSummary` shape. `id` and `industry` are required by
 * every tenant-scoped request, so keep the adapter in one place.
 */
export function toOrgSummary(row: OrgSummaryResponse): OrgSummary {
  return {
    id: row.organization_id,
    name: row.name,
    org_code: row.org_code,
    role: row.role,
    member_status: row.member_status ?? null,
    industry: row.industry,
  };
}

export interface OrgState {
  orgs: OrgSummary[];
  activeOrg: OrgSummary | null;
}

export interface OrgActions {
  setOrgs: (orgs: OrgSummary[]) => void;
  setActiveOrg: (org: OrgSummary) => void;
  clearOrgs: () => void;
}

export const useOrgStore = create<OrgState & OrgActions>()(
  persist(
    (set) => ({
      orgs: [],
      activeOrg: null,

      setOrgs: (orgs) => set({ orgs }),
      setActiveOrg: (activeOrg) => set({ activeOrg }),
      clearOrgs: () => set({ orgs: [], activeOrg: null }),
    }),
    {
      name: "org-storage",
      storage: createJSONStorage(() => mmkvStorage),
      partialize: (state) => ({
        orgs: state.orgs,
        activeOrg: state.activeOrg,
      }),
    },
  ),
);
