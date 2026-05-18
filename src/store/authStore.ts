import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Profile } from "@/services/userService";
import type { AccountType } from "@/services/tradeService";

interface AuthState {
  token: string | null;
  profile: Profile | null;
  accountType: AccountType;
  setToken: (t: string | null) => void;
  setProfile: (p: Profile | null) => void;
  setAccountType: (t: AccountType) => void;
  updateBalance: (real: number, demo: number) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      profile: null,
      accountType: "DEMO",
      setToken: (token) => set({ token }),
      setProfile: (profile) => set({ profile }),
      setAccountType: (accountType) => set({ accountType }),
      updateBalance: (balance_real, balance_demo) =>
        set((s) => ({
          profile: s.profile ? { ...s.profile, balance_real, balance_demo } : s.profile,
        })),
      logout: () => set({ token: null, profile: null }),
    }),
    { name: "trader-auth" },
  ),
);
