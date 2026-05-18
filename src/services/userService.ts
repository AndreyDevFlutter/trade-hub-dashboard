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

export const userService = {
  async getProfile(): Promise<Profile> {
    const { data } = await api.get<Profile>("/profile");
    return data;
  },
  async getBalance(): Promise<Balance> {
    const { data } = await api.get<Balance>("/balance");
    return data;
  },
};
