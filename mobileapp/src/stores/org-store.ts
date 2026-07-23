import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { createStorage } from "./storage";

const mmkvStorage = createStorage("org");

export interface OrgSummary {
  id: string;
  name: string;
  org_code: string;
  role: string;
  member_status?: string | null;
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
