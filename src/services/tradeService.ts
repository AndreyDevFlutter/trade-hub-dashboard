import { api } from "@/lib/api";

export type Direction = "CALL" | "PUT";
export type AccountType = "DEMO" | "REAL";

export interface OrderPayload {
  assetId: string;
  accountId: string;
  direction: Direction;
  amount: number;
  account_type: AccountType;
  duration?: number;
}

export interface OrderResponse {
  success: boolean;
  order_id: string;
  message: string;
  new_balance: number;
  account_type: AccountType;
}

export interface ActiveTrade {
  id: string;
  status?: string;
  type?: AccountType;
  accountId?: string;
  endTime?: string;
}

interface ABOrderResp {
  success?: boolean;
  message?: string;
  orderId?: string;
  id?: string;
  trade?: { id?: string; accountId?: string; balance?: number | string };
  data?: { id?: string; orderId?: string; balance?: number };
  balance?: number;
}

export const tradeService = {
  async cancelTrade(tradeId: string): Promise<void> {
    await api.post(`/trading/${tradeId}/cancel`);
  },

  async getActiveTrades(): Promise<ActiveTrade[]> {
    const { data } = await api.get<{ trades?: ActiveTrade[]; data?: ActiveTrade[] }>(
      "/trading/active",
    );
    const now = Date.now();
    return (data.trades ?? data.data ?? []).filter((trade) => {
      const status = trade.status?.toUpperCase();
      const endAt = trade.endTime ? Date.parse(trade.endTime) : Number.NaN;
      const stillRunning = Number.isNaN(endAt) || endAt > now;
      return stillRunning && (!status || ["PENDING", "OPEN", "ACTIVE"].includes(status));
    });
  },

  async sendOrder(order: OrderPayload): Promise<OrderResponse> {
    // 1) Garante que a conta ativa do usuário é a desejada (DEMO/REAL)
    try {
      await api.put("/users/profile", { accountType: order.account_type });
    } catch {
      /* segue mesmo que falhe */
    }

    // 2) Cria a operação
    const payload = {
      assetId: order.assetId,
      accountId: order.accountId,
      direction: order.direction, // CALL | PUT
      amount: order.amount,
      duration: order.duration ?? 60,
      type: order.account_type,
      settlementMode: "BINARY",
    };
    const { data } = await api.post<ABOrderResp>("/trading/create", payload);

    if (data.success === false) {
      throw new Error(data.message || "Falha ao criar ordem");
    }

    return {
      success: data.success ?? true,
      order_id:
        data.orderId ??
        data.id ??
        data.trade?.id ??
        data.data?.orderId ??
        data.data?.id ??
        "",
      message: data.message ?? "Ordem enviada",
      new_balance: Number(data.balance ?? data.data?.balance ?? data.trade?.balance ?? 0),
      account_type: order.account_type,
    };
  },
};
