import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

// POST /api/connect-broker
// Auth: Bearer <SUPABASE_JWT> (Supabase Auth user)
// Body: { email, password, account_type? }
// Faz login na ActionBroker com as credenciais do usuário e faz upsert do
// token retornado em public.broker_connections. O token nunca volta ao client.

const BROKER_BASE = "https://api.actionbroker.app";

const schema = z.object({
  email: z.string().min(1).max(255),
  password: z.string().min(1).max(255),
  account_type: z.enum(["REAL", "DEMO"]).optional(),
});

function getSupabaseEnv() {
  return {
    url: process.env.SUPABASE_URL!,
    anon: process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY!,
  };
}

export const Route = createFileRoute("/api/connect-broker")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authHeader = request.headers.get("authorization") ?? "";
        if (!authHeader.toLowerCase().startsWith("bearer ")) {
          return Response.json({ message: "Unauthorized" }, { status: 401 });
        }

        const { url, anon } = getSupabaseEnv();
        const supabase = createClient(url, anon, {
          global: { headers: { Authorization: authHeader } },
        });
        const { data: userData, error: userErr } = await supabase.auth.getUser();
        if (userErr || !userData.user) {
          return Response.json({ message: "Unauthorized" }, { status: 401 });
        }

        let body: unknown;
        try { body = await request.json(); } catch {
          return Response.json({ message: "Bad request" }, { status: 400 });
        }
        const parsed = schema.safeParse(body);
        if (!parsed.success) {
          return Response.json({ message: "Dados inválidos" }, { status: 400 });
        }

        const upstream = await fetch(`${BROKER_BASE}/api/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({
            email: parsed.data.email,
            password: parsed.data.password,
          }),
        });
        const data = (await upstream.json().catch(() => ({}))) as {
          message?: string;
          token?: string;
          accessToken?: string;
          data?: { token?: string; accessToken?: string };
          user?: { id?: string; username?: string; accountType?: string };
        };

        if (!upstream.ok) {
          return Response.json(
            { message: data.message ?? "Credenciais inválidas na corretora" },
            { status: upstream.status },
          );
        }

        const brokerToken =
          data.token ?? data.accessToken ?? data.data?.token ?? data.data?.accessToken;
        if (!brokerToken) {
          return Response.json(
            { message: "Resposta da corretora sem token" },
            { status: 502 },
          );
        }

        const brokerUserId = data.user?.id ?? data.user?.username ?? null;
        const accountType =
          parsed.data.account_type ??
          (data.user?.accountType?.toUpperCase() === "REAL" ? "REAL" : "DEMO");

        const { error: upsertErr } = await supabase
          .from("broker_connections")
          .upsert(
            {
              user_id: userData.user.id,
              broker: "actionbroker",
              broker_token: brokerToken,
              broker_user_id: brokerUserId,
              account_type: accountType,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id" },
          );

        if (upsertErr) {
          return Response.json({ message: upsertErr.message }, { status: 500 });
        }

        return Response.json({ success: true, account_type: accountType });
      },
    },
  },
});
