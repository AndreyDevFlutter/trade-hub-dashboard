// Cliente para a API da ActionBroker (via proxy /api/ab/* e /api/prices/*)
import { api } from "@/lib/api";

export type ABAsset = {
  id: string;
  symbol: string;
  name: string;
  category: string;
  type: "FOREX" | "CRYPTO" | string;
  image: string | null;
  isActive: boolean;
  isOpen: boolean;
  payout: string;
  lastPrice: number;
};

export type ABTab = {
  id: string;
  assetId: string;
  asset: ABAsset;
};

export type ABTrade = {
  id: string;
  accountId: string;
  assetId: string;
  asset?: { symbol?: string; name?: string };
  direction: "CALL" | "PUT";
  amount: number | string;
  duration: number;
  entryPrice?: string | number;
  exitPrice?: string | number | null;
  startTime?: string;
  endTime?: string;
  status?: string;
  result?: string | null;
  profit?: number | null;
  payout?: string | number;
  type?: "REAL" | "DEMO";
  settlementMode?: string;
};

export type ABActivity = {
  id?: string;
  user?: string;
  asset?: string;
  profit?: number;
  ts?: number;
  [k: string]: unknown;
};

async function getPublic<T>(path: string): Promise<T> {
  const res = await fetch(`/api/ab/${path.replace(/^\//, "")}`);
  if (!res.ok) throw new Error(`ActionBroker ${path} -> ${res.status}`);
  return res.json();
}

export const actionbrokerService = {
  async listAssets(): Promise<ABAsset[]> {
    try {
      const { data } = await api.get<{ assets?: ABAsset[] }>("/assets");
      return data.assets ?? [];
    } catch {
      return [];
    }
  },

  async listTabs(): Promise<ABTab[]> {
    try {
      const { data } = await api.get<{ data?: ABTab[] }>("/tabs");
      return data.data ?? [];
    } catch {
      return [];
    }
  },

  async addTab(assetId: string): Promise<void> {
    await api.post("/tabs", { assetId });
  },

  async switchAccount(accountType: "REAL" | "DEMO"): Promise<void> {
    await api.post("/users/change-account-type", { accountType });
  },

  async activeTrades(): Promise<ABTrade[]> {
    try {
      const { data } = await api.get<{ trades?: ABTrade[] }>("/trading/active");
      return data.trades ?? [];
    } catch {
      return [];
    }
  },

  async tradeHistory(limit = 20): Promise<ABTrade[]> {
    try {
      const { data } = await api.get<{ trades?: ABTrade[] }>(
        `/trading/history?page=1&limit=${limit}`,
      );
      return data.trades ?? [];
    } catch {
      return [];
    }
  },

  async onlineUsers(): Promise<number> {
    const data = await getPublic<{ data?: { count?: number } }>(
      "public/social-proof/online-users",
    );
    return data?.data?.count ?? 0;
  },

  async activities(limit = 20, minProfit = 1): Promise<ABActivity[]> {
    const data = await getPublic<{ data?: ABActivity[] }>(
      `public/social-proof/activities?limit=${limit}&minProfit=${minProfit}`,
    );
    return data?.data ?? [];
  },

  async lastPrice(symbol: string): Promise<number | null> {
    try {
      const now = Math.floor(Date.now() / 1000);
      const from = now - 120;
      const res = await fetch(
        `/api/prices/history?symbol=${encodeURIComponent(symbol.toLowerCase())}&resolution=1&from=${from}&to=${now}`,
      );
      if (!res.ok) return null;
      const json = (await res.json()) as { c?: number[] };
      const arr = json.c ?? [];
      return arr.length ? Number(arr[arr.length - 1]) : null;
    } catch {
      return null;
    }
  },
};
