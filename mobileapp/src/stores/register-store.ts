import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { createStorage } from "./storage";
import type { GymDetails } from "@/types/api";

const storage = createStorage("register");

/**
 * The owner account form, split across three screens.
 *
 * The backend wants all of these in one request (`OwnerRegisterStart`), so the
 * draft accumulates here until the last step submits it. Held as one flat
 * object rather than three typed chunks so each screen writes only its own keys
 * and stepping backwards leaves the rest untouched.
 */
export type OwnerDraft = {
  full_name: string;
  email: string;
  password: string;
  confirm_password: string;
  date_of_birth: string;
  gender: string;
  phone: string;
  cnic: string;
  occupation: string;
  education: string;
  address: string;
  city: string;
  emergency_contact: string;
};

const EMPTY_DRAFT: OwnerDraft = {
  full_name: "",
  email: "",
  password: "",
  confirm_password: "",
  date_of_birth: "",
  gender: "",
  phone: "",
  cnic: "",
  occupation: "",
  education: "",
  address: "",
  city: "",
  emergency_contact: "",
};

interface RegisterState {
  email: string;
  fullName: string;
  verifiedAt: string | null;
  gymDetails: GymDetails | null;
  selectedTier: "starter" | "pro" | "enterprise" | null;
  draft: OwnerDraft;
}

interface RegisterActions {
  setAccount: (email: string, fullName: string) => void;
  /** Merge one screen's fields into the in-progress owner form. */
  patchDraft: (patch: Partial<OwnerDraft>) => void;
  setVerified: () => void;
  setGymDetails: (details: GymDetails) => void;
  setTier: (tier: "starter" | "pro" | "enterprise") => void;
  reset: () => void;
}

export const useRegisterStore = create<RegisterState & RegisterActions>()(
  persist(
    (set) => ({
      email: "",
      fullName: "",
      verifiedAt: null,
      gymDetails: null,
      selectedTier: null,
      draft: EMPTY_DRAFT,

      setAccount: (email, fullName) => set({ email, fullName }),
      patchDraft: (patch) => set((s) => ({ draft: { ...s.draft, ...patch } })),
      setVerified: () => set({ verifiedAt: new Date().toISOString() }),
      setGymDetails: (gymDetails) => set({ gymDetails }),
      setTier: (selectedTier) => set({ selectedTier }),
      reset: () =>
        set({
          email: "",
          fullName: "",
          verifiedAt: null,
          gymDetails: null,
          selectedTier: null,
          draft: EMPTY_DRAFT,
        }),
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
        /*
          `draft` is deliberately absent: it carries a plaintext password
          between screens, and persisting it would write that password to disk
          for the life of the flow. It stays in memory instead — someone who
          backgrounds the app mid-signup retypes it, which is the right trade.
        */
      }),
    },
  ),
);
