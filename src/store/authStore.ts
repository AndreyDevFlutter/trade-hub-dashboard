import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Profile } from "@/services/userService";
import type { AccountType } from "@/services/tradeService";

interface AppState {
  profile: Profile | null;
  accountType: AccountType;
  brokerConnected: boolean;
  setProfile: (p: Profile | null) => void;
  setAccountType: (t: AccountType) => void;
  setBrokerConnected: (v: boolean) => void;
  updateBalance: (real: number, demo: number) => void;
  reset: () => void;
}

export const useAuthStore = create<AppState>()(
  persist(
    (set) => ({
      profile: null,
      accountType: "DEMO",
      brokerConnected: false,
      setProfile: (profile) => set({ profile }),
      setAccountType: (accountType) => set({ accountType }),
      setBrokerConnected: (brokerConnected) => set({ brokerConnected }),
      updateBalance: (balance_real, balance_demo) =>
        set((s) => ({
          profile: s.profile ? { ...s.profile, balance_real, balance_demo } : s.profile,
        })),
      reset: () => set({ profile: null, brokerConnected: false }),
    }),
    { name: "trader-app" },
  ),
);
