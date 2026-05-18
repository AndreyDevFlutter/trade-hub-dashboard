import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { getUserByToken, applyOrder } from "@/lib/mockStore.server";

const schema = z.object({
  asset: z.string().min(1).max(20),
  direction: z.enum(["CALL", "PUT"]),
  amount: z.number().positive().max(1_000_000),
  account_type: z.enum(["DEMO", "REAL"]),
});

export const Route = createFileRoute("/api/order")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const user = getUserByToken(request.headers.get("authorization"));
        if (!user) return new Response("Unauthorized", { status: 401 });
        const body = await request.json().catch(() => null);
        const parsed = schema.safeParse(body);
        if (!parsed.success) {
          return Response.json({ message: "Invalid order" }, { status: 400 });
        }
        const { amount, account_type, direction, asset } = parsed.data;
        const balance =
          account_type === "REAL" ? user.balance_real : user.balance_demo;
        if (amount > balance) {
          return Response.json(
            { message: "Saldo insuficiente" },
            { status: 400 },
          );
        }
        const { win, new_balance } = applyOrder(user, amount, account_type);
        return Response.json({
          success: true,
          order_id: `ORD-${Date.now()}`,
          message: win
            ? `Ordem ${direction} ${asset} executada com lucro`
            : `Ordem ${direction} ${asset} executada com perda`,
          new_balance,
          account_type,
        });
      },
    },
  },
});
