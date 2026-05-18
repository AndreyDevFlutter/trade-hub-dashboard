import { createFileRoute } from "@tanstack/react-router";
import { getCookie } from "@tanstack/react-start/server";
import { brokerFetch, SESSION_COOKIE } from "@/lib/broker.server";

async function fetchMe() {
  const cookieHeader = getCookie(SESSION_COOKIE);
  if (!cookieHeader) return null;
  const upstream = await brokerFetch("/api/auth/me", {
    method: "GET",
    cookieHeader,
  });
  if (!upstream.ok) return null;
  return (await upstream.json().catch(() => null)) as {
    user?: {
      firstName?: string;
      lastName?: string;
      username?: string;
      avatar?: string;
      balances?: {
        real?: { balance?: number; available?: number; currency?: string };
        demo?: { balance?: number; available?: number; currency?: string };
      };
    };
  } | null;
}

export const Route = createFileRoute("/api/profile")({
  server: {
    handlers: {
      GET: async () => {
        const data = await fetchMe();
        if (!data?.user) return new Response("Unauthorized", { status: 401 });
        const u = data.user;
        const name =
          [u.firstName, u.lastName].filter(Boolean).join(" ") || u.username || "Trader";
        return Response.json({
          name,
          avatar: u.avatar ?? null,
          balance_real: u.balances?.real?.available ?? u.balances?.real?.balance ?? 0,
          balance_demo: u.balances?.demo?.available ?? u.balances?.demo?.balance ?? 0,
        });
      },
    },
  },
});
