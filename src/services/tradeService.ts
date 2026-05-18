import { api } from "@/lib/api";

export type Direction = "CALL" | "PUT";
export type AccountType = "DEMO" | "REAL";

export interface OrderPayload {
  asset: string;
  direction: Direction;
  amount: number;
  account_type: AccountType;
}

export interface OrderResponse {
  success: boolean;
  order_id: string;
  message: string;
  new_balance: number;
  account_type: AccountType;
}

interface ABOrderResp {
  success?: boolean;
  message?: string;
  orderId?: string;
  id?: string;
  data?: { id?: string; orderId?: string; balance?: number };
  balance?: number;
}

export const tradeService = {
  async sendOrder(order: OrderPayload): Promise<OrderResponse> {
    const path = order.direction === "CALL" ? "/trading/buy" : "/trading/sell";
    const payload = {
      symbol: order.asset,
      amount: order.amount,
      accountType: order.account_type, // "DEMO" | "REAL"
      direction: order.direction,
      duration: 60,
    };
    const { data } = await api.post<ABOrderResp>(path, payload);
    return {
      success: data.success ?? true,
      order_id: data.orderId ?? data.id ?? data.data?.orderId ?? data.data?.id ?? "",
      message: data.message ?? "Ordem enviada",
      new_balance: Number(data.balance ?? data.data?.balance ?? 0),
      account_type: order.account_type,
    };
  },
};
