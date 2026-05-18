import { api } from "@/lib/api";

export interface Profile {
  name: string;
  avatar: string;
  balance_real: number;
  balance_demo: number;
}

export interface Balance {
  balance_real: number;
  balance_demo: number;
}

interface ABUser {
  name?: string;
  fullName?: string;
  username?: string;
  email?: string;
  avatar?: string;
  avatarUrl?: string;
  photo?: string;
  balanceReal?: number;
  balanceDemo?: number;
  realBalance?: number;
  demoBalance?: number;
  balance?: { real?: number; demo?: number };
}
interface ABEnvelope<T> { data?: T; user?: T; success?: boolean }

function toProfile(raw: ABUser & ABEnvelope<ABUser>): Profile {
  const u: ABUser = raw.user ?? raw.data ?? raw;
  return {
    name: u.name ?? u.fullName ?? u.username ?? u.email ?? "Usuário",
    avatar: u.avatar ?? u.avatarUrl ?? u.photo ?? "",
    balance_real:
      Number(u.balanceReal ?? u.realBalance ?? u.balance?.real ?? 0),
    balance_demo:
      Number(u.balanceDemo ?? u.demoBalance ?? u.balance?.demo ?? 0),
  };
}

function toBalance(raw: ABUser & ABEnvelope<ABUser>): Balance {
  const p = toProfile(raw);
  return { balance_real: p.balance_real, balance_demo: p.balance_demo };
}

export const userService = {
  async getProfile(): Promise<Profile> {
    const { data } = await api.get("/users/profile");
    return toProfile(data);
  },
  async getBalance(): Promise<Balance> {
    try {
      const { data } = await api.get("/trading/balance");
      return toBalance(data);
    } catch {
      const { data } = await api.get("/users/profile");
      return toBalance(data);
    }
  },
};
