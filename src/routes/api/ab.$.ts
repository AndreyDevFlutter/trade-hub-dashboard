import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

// Proxy multi-tenant para a API da ActionBroker.
// Recebe Authorization: Bearer <SUPABASE_JWT> do client, valida o usuário,
// busca o broker_token desse usuário em public.broker_connections e
// reenvia a requisição para https://api.actionbroker.app/api/... com o
// token correto. O frontend NUNCA conhece o broker_token.
const UPSTREAM = "https://api.actionbroker.app/api";

function getSupabaseEnv() {
  return {
    url: process.env.SUPABASE_URL!,
    anon: process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY!,
  };
}

async function brokerTokenForRequest(request: Request): Promise<
  { token: string } | { error: string; status: number }
> {
  const authHeader = request.headers.get("authorization") ?? "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return { error: "Unauthorized", status: 401 };
  }
  const { url, anon } = getSupabaseEnv();
  const supabase = createClient(url, anon, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) return { error: "Unauthorized", status: 401 };
  const { data, error } = await supabase
    .from("broker_connections")
    .select("broker_token")
    .eq("user_id", userData.user.id)
    .maybeSingle();
  if (error) return { error: error.message, status: 500 };
  if (!data?.broker_token) {
    return { error: "Conecte sua corretora primeiro", status: 401 };
  }
  return { token: data.broker_token as string };
}

async function proxy(request: Request, splat: string) {
  const tokenRes = await brokerTokenForRequest(request);
  if ("error" in tokenRes) {
    return new Response(JSON.stringify({ message: tokenRes.error }), {
      status: tokenRes.status,
      headers: { "Content-Type": "application/json" },
    });
  }

  const url = new URL(request.url);
  const target = `${UPSTREAM}/${splat}${url.search}`;

  const headers = new Headers();
  const ct = request.headers.get("content-type");
  if (ct) headers.set("content-type", ct);
  headers.set("accept", "application/json");
  headers.set("authorization", `Bearer ${tokenRes.token}`);

  const init: RequestInit = { method: request.method, headers };
  if (!["GET", "HEAD"].includes(request.method)) {
    init.body = await request.arrayBuffer();
  }

  const res = await fetch(target, init);
  const body = await res.arrayBuffer();
  return new Response(body, {
    status: res.status,
    headers: {
      "Content-Type": res.headers.get("content-type") ?? "application/json",
      "Cache-Control": "no-store",
    },
  });
}

export const Route = createFileRoute("/api/ab/$")({
  server: {
    handlers: {
      GET: async ({ params, request }) => proxy(request, params._splat ?? ""),
      POST: async ({ params, request }) => proxy(request, params._splat ?? ""),
      PUT: async ({ params, request }) => proxy(request, params._splat ?? ""),
      PATCH: async ({ params, request }) => proxy(request, params._splat ?? ""),
      DELETE: async ({ params, request }) => proxy(request, params._splat ?? ""),
    },
  },
});
