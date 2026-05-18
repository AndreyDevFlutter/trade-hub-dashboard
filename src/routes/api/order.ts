import { createFileRoute } from "@tanstack/react-router";
import { getCookie } from "@tanstack/react-start/server";
import { z } from "zod";
import { SESSION_COOKIE } from "@/lib/broker.server";

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
        const cookieHeader = getCookie(SESSION_COOKIE);
        if (!cookieHeader) return new Response("Unauthorized", { status: 401 });
        const body = await request.json().catch(() => null);
        const parsed = schema.safeParse(body);
        if (!parsed.success) {
          return Response.json({ message: "Invalid order" }, { status: 400 });
        }
        // TODO: real endpoint not yet known.
        // Capture the POST request when placing a CALL/PUT in the broker UI
        // (DevTools → Network → Payload) and wire it here, e.g.:
        //
        //   const upstream = await brokerFetch("/api/<trade-endpoint>", {
        //     method: "POST",
        //     cookieHeader,
        //     body: JSON.stringify({
        //       assetId: <id from /api/active>,
        //       accountId: <id from /api/auth/me accounts[]>,
        //       direction: parsed.data.direction,
        //       amount: parsed.data.amount,
        //       duration: <seconds>,
        //       type: "BINARY",
        //     }),
        //   });
        return Response.json(
          {
            message:
              "Endpoint de ordem ainda não configurado. Capture o POST de uma operação (CALL/PUT) no DevTools e me envie URL + payload.",
          },
          { status: 501 },
        );
      },
    },
  },
});
