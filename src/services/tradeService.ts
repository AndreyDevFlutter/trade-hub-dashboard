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

  async sendOrder(
    order: OrderPayload & { asset?: string; timeFrame?: "M1" | "M5" | "M15"; entryPrice?: number },
  ): Promise<OrderResponse> {
    // 1) Garante conta ativa (DEMO/REAL) via endpoint correto
    try {
      await api.post("/users/change-account-type", { accountType: order.account_type });
    } catch {
      /* segue mesmo que falhe */
    }

    const timeFrame =
      order.timeFrame ??
      (order.duration && order.duration >= 900
        ? "M15"
        : order.duration && order.duration >= 300
          ? "M5"
          : "M1");
    const duration = order.duration ?? (timeFrame === "M15" ? 900 : timeFrame === "M5" ? 300 : 60);

    const payload: Record<string, unknown> = {
      assetId: order.assetId,
      amount: order.amount,
      direction: order.direction,
      duration,
      settlementMode: "BINARY",
      type: order.account_type,
      leverage: "1",
      usedBonusAmount: "0",
    };
    if (order.accountId) payload.accountId = order.accountId;
    if (order.entryPrice != null) payload.entry_price = order.entryPrice;

    const { data } = await api.post<ABOrderResp>("/trading/create", payload);

    if (data.success === false) {
      throw new Error(data.message || "Falha ao criar ordem");
    }

    return {
      success: data.success ?? true,
      order_id:
        data.orderId ?? data.id ?? data.trade?.id ?? data.data?.orderId ?? data.data?.id ?? "",
      message: data.message ?? "Ordem enviada",
      new_balance: Number(data.balance ?? data.data?.balance ?? data.trade?.balance ?? 0),
      account_type: order.account_type,
    };
  },
};
