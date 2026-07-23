import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { createStorage } from "./storage";
import type { GymDetails } from "@/types/api";

const storage = createStorage("register");

interface RegisterState {
  email: string;
  fullName: string;
  verifiedAt: string | null;
  gymDetails: GymDetails | null;
  selectedTier: "starter" | "pro" | "enterprise" | null;
}

interface RegisterActions {
  setAccount: (email: string, fullName: string) => void;
  setVerified: () => void;
  setGymDetails: (details: GymDetails) => void;
  setTier: (tier: "starter" | "pro" | "enterprise") => void;
  reset: () => void;
}

export const useRegisterStore = create<RegisterState & RegisterActions>()(
  persist(
    (set, get) => ({
      email: "",
      fullName: "",
      verifiedAt: null,
      gymDetails: null,
      selectedTier: null,

      setAccount: (email, fullName) => set({ email, fullName }),
      setVerified: () => set({ verifiedAt: new Date().toISOString() }),
      setGymDetails: (gymDetails) => set({ gymDetails }),
      setTier: (selectedTier) => set({ selectedTier }),
      reset: () =>
        set({ email: "", fullName: "", verifiedAt: null, gymDetails: null, selectedTier: null }),
    }),
    {
      name: "register-storage",
      storage: createJSONStorage(() => storage),
      partialize: (state) => ({
        email: state.email,
        fullName: state.fullName,
        verifiedAt: state.verifiedAt,
        gymDetails: state.gymDetails,
        selectedTier: state.selectedTier,
      }),
    },
  ),
);
