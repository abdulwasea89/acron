import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { createStorage } from "./storage";

const storage = createStorage("join");

interface JoinState {
  orgCode: string;
  orgName: string;
  orgId: string;
  email: string;
  verifiedAt: string | null;
  memberId: string | null;
  selectedPlanId: string | null;
}

interface JoinActions {
  setOrg: (orgCode: string, orgName: string, orgId: string) => void;
  setEmail: (email: string) => void;
  setVerified: () => void;
  setMemberId: (id: string) => void;
  setSelectedPlan: (planId: string) => void;
  reset: () => void;
}

export const useJoinStore = create<JoinState & JoinActions>()(
  persist(
    (set) => ({
      orgCode: "",
      orgName: "",
      orgId: "",
      email: "",
      verifiedAt: null,
      memberId: null,
      selectedPlanId: null,

      setOrg: (orgCode, orgName, orgId) => set({ orgCode, orgName, orgId }),
      setEmail: (email) => set({ email }),
      setVerified: () => set({ verifiedAt: new Date().toISOString() }),
      setMemberId: (memberId) => set({ memberId }),
      setSelectedPlan: (selectedPlanId) => set({ selectedPlanId }),
      reset: () =>
        set({
          orgCode: "",
          orgName: "",
          orgId: "",
          email: "",
          verifiedAt: null,
          memberId: null,
          selectedPlanId: null,
        }),
    }),
    {
      name: "join-storage",
      storage: createJSONStorage(() => storage),
      partialize: (state) => ({
        orgCode: state.orgCode,
        orgName: state.orgName,
        orgId: state.orgId,
        email: state.email,
        verifiedAt: state.verifiedAt,
        memberId: state.memberId,
        selectedPlanId: state.selectedPlanId,
      }),
    },
  ),
);
