import { api } from "@/lib/api";

export interface Profile {
  name: string;
  avatar: string;
  balance_real: number;
  balance_demo: number;
  account_type: "DEMO" | "REAL";
}

export interface Balance {
  balance_real: number;
  balance_demo: number;
}

interface ABAccount {
  currency?: string;
  balance?: string | number;
  available?: string | number;
  bonusBalance?: string | number;
  isDemo?: boolean;
  isTournament?: boolean;
}

interface ABUser {
  firstName?: string;
  lastName?: string;
  username?: string;
  email?: string;
  avatar?: string;
  accountType?: string; // conta ativa
  accounts?: ABAccount[];
  balances?: {
    real?: ABAccount;
    demo?: ABAccount;
  };
}

function asMoney(v: string | number | undefined): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function pickBalance(accounts: ABAccount[] | undefined, kind: "REAL" | "DEMO"): number {
  if (!accounts?.length) return 0;
  const match = accounts.find((a) => {
    if (a.isTournament) return false;
    return kind === "DEMO" ? a.isDemo === true : !a.isDemo;
  });
  if (!match) return 0;
  return asMoney(match.available ?? match.balance ?? 0);
}

function toProfile(raw: { user?: ABUser } & ABUser): Profile {
  const u: ABUser = raw.user ?? raw;
  const name =
    [u.firstName, u.lastName].filter(Boolean).join(" ").trim() ||
    u.username ||
    u.email ||
    "Usuário";
  return {
    name,
    avatar: u.avatar ?? "",
    balance_real:
      asMoney(u.balances?.real?.available ?? u.balances?.real?.balance) ||
      pickBalance(u.accounts, "REAL"),
    balance_demo:
      asMoney(u.balances?.demo?.available ?? u.balances?.demo?.balance) ||
      pickBalance(u.accounts, "DEMO"),
    account_type: u.accountType === "REAL" ? "REAL" : "DEMO",
  };
}

export const userService = {
  async getProfile(): Promise<Profile> {
    const { data } = await api.get("/auth/me");
    return toProfile(data);
  },
  async getBalance(): Promise<Balance> {
    const { data } = await api.get("/auth/me");
    const p = toProfile(data);
    return { balance_real: p.balance_real, balance_demo: p.balance_demo };
  },
};
