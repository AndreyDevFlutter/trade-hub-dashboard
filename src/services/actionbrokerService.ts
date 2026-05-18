// Cliente para a API pública da ActionBroker (via proxy /api/ab/*)

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

export type ABActivity = {
  id?: string;
  user?: string;
  asset?: string;
  profit?: number;
  ts?: number;
  [k: string]: unknown;
};

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`/api/ab/${path.replace(/^\//, "")}`);
  if (!res.ok) throw new Error(`ActionBroker ${path} -> ${res.status}`);
  return res.json();
}

export const actionbrokerService = {
  async listAssets(): Promise<ABAsset[]> {
    // O endpoint capturado retorna { assets: [...] } — tentamos algumas variações comuns
    const candidates = [
      "public/assets",
      "assets",
      "trading/assets",
    ];
    for (const p of candidates) {
      try {
        const data = await get<{ assets?: ABAsset[]; data?: ABAsset[] }>(p);
        const list = data.assets ?? data.data;
        if (Array.isArray(list) && list.length) return list;
      } catch {
        /* try next */
      }
    }
    return [];
  },

  async onlineUsers(): Promise<number> {
    const data = await get<{ data?: { count?: number } }>(
      "public/social-proof/online-users"
    );
    return data?.data?.count ?? 0;
  },

  async activities(limit = 20, minProfit = 1): Promise<ABActivity[]> {
    const data = await get<{ data?: ABActivity[] }>(
      `public/social-proof/activities?limit=${limit}&minProfit=${minProfit}`
    );
    return data?.data ?? [];
  },
};
