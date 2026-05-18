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

export const tradeService = {
  async sendOrder(order: OrderPayload): Promise<OrderResponse> {
    const { data } = await api.post<OrderResponse>("/order", order);
    return data;
  },
};
