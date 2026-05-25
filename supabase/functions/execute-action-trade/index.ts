// Edge Function: execute-action-trade (multi-tenant)
// Lê o JWT do Supabase Auth no header, busca o broker_token do usuário em
// public.broker_connections e despacha a ordem para a ActionBroker.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const BROKER_BASE = "https://api.actionbroker.app";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Direction = "CALL" | "PUT";
type TimeFrame = "M1" | "M5" | "M15";
type AccountType = "DEMO" | "REAL";

interface TradeBody {
  asset?: string;
  assetId?: string;
  amount?: number;
  direction?: Direction;
  timeframe?: TimeFrame;
  account_type?: AccountType;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function durationFor(tf: TimeFrame): number {
  if (tf === "M15") return 900;
  if (tf === "M5") return 300;
  return 60;
}

async function getBrokerTokenForCaller(req: Request): Promise<
  { token: string; userId: string } | { error: string; status: number }
> {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return { error: "Unauthorized", status: 401 };
  }
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_ANON = Deno.env.get("SUPABASE_ANON_KEY") ??
    Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) {
    return { error: "Unauthorized", status: 401 };
  }
  const userId = userData.user.id;
  const { data, error } = await supabase
    .from("broker_connections")
    .select("broker_token")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) return { error: error.message, status: 500 };
  if (!data?.broker_token) {
    return { error: "Conecte sua corretora primeiro", status: 401 };
  }
  return { token: data.broker_token as string, userId };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, message: "Method not allowed" }, 405);

  const tokenRes = await getBrokerTokenForCaller(req);
  if ("error" in tokenRes) {
    return json({ success: false, message: tokenRes.error }, tokenRes.status);
  }
  const brokerToken = tokenRes.token;

  let body: TradeBody;
  try {
    body = (await req.json()) as TradeBody;
  } catch {
    return json({ success: false, message: "JSON inválido" }, 400);
  }

  const assetId = body.assetId ?? body.asset ?? "";
  const amount = Number(body.amount);
  const direction = body.direction;
  const timeframe: TimeFrame = body.timeframe ?? "M1";
  const accountType: AccountType = body.account_type ?? "DEMO";

  if (!assetId || !Number.isFinite(amount) || amount <= 0) {
    return json({ success: false, message: "Ativo ou valor inválido" }, 400);
  }
  if (direction !== "CALL" && direction !== "PUT") {
    return json({ success: false, message: "Direção inválida" }, 400);
  }
  if (!["M1", "M5", "M15"].includes(timeframe)) {
    return json({ success: false, message: "Timeframe inválido" }, 400);
  }

  try {
    await fetch(`${BROKER_BASE}/api/users/change-account-type`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${brokerToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ accountType }),
    });
  } catch { /* best-effort */ }

  const payload = {
    assetId,
    amount,
    direction,
    duration: durationFor(timeframe),
    settlementMode: "BINARY",
    type: accountType,
    leverage: "1",
    usedBonusAmount: "0",
  };

  let upstream: Response;
  try {
    upstream = await fetch(`${BROKER_BASE}/api/trading/create`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${brokerToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    return json(
      { success: false, message: `Falha de rede com a corretora: ${(err as Error).message}` },
      502,
    );
  }

  const text = await upstream.text();
  let data: Record<string, unknown> = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }

  if (!upstream.ok) {
    const message =
      (data.message as string) ?? (data.error as string) ?? `Erro ${upstream.status} na corretora`;
    return json({ success: false, message, broker_status: upstream.status }, upstream.status);
  }

  const trade = (data.trade as Record<string, unknown> | undefined) ?? undefined;
  const dataNested = (data.data as Record<string, unknown> | undefined) ?? undefined;
  const trade_id =
    (data.orderId as string) ??
    (data.id as string) ??
    (trade?.id as string) ??
    (dataNested?.orderId as string) ??
    (dataNested?.id as string) ?? "";
  const new_balance = Number(
    (data.balance as number | string | undefined) ??
    (dataNested?.balance as number | string | undefined) ??
    (trade?.balance as number | string | undefined) ?? 0,
  );

  return json({
    success: true,
    trade_id,
    message: (data.message as string) ?? "Ordem enviada",
    new_balance,
    account_type: accountType,
  });
});
