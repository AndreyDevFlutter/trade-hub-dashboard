import { createFileRoute } from "@tanstack/react-router";
import { getCookie } from "@tanstack/react-start/server";
import { brokerFetch, SESSION_COOKIE } from "@/lib/broker.server";

export const Route = createFileRoute("/api/balance")({
  server: {
    handlers: {
      GET: async () => {
        const cookieHeader = getCookie(SESSION_COOKIE);
        if (!cookieHeader) return new Response("Unauthorized", { status: 401 });
        const upstream = await brokerFetch("/api/auth/me", {
          method: "GET",
          cookieHeader,
        });
        if (!upstream.ok) return new Response("Unauthorized", { status: 401 });
        const data = (await upstream.json().catch(() => null)) as
          | {
              user?: {
                balances?: {
                  real?: { balance?: number; available?: number };
                  demo?: { balance?: number; available?: number };
                };
              };
            }
          | null;
        const b = data?.user?.balances;
        return Response.json({
          balance_real: b?.real?.balance ?? b?.real?.available ?? 0,
          balance_demo: b?.demo?.balance ?? b?.demo?.available ?? 0,
        });
      },
    },
  },
});
