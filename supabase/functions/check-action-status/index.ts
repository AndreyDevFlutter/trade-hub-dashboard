// Edge Function: check-action-status (multi-tenant)
// Lê o JWT do Supabase Auth, busca o broker_token do usuário em
// public.broker_connections e consulta o status da ordem na ActionBroker.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const BROKER_BASE = "https://api.actionbroker.app";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Status = "WIN" | "LOSS" | "DRAW" | "PENDING";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function pick<T = unknown>(obj: Record<string, unknown> | undefined, ...keys: string[]): T | undefined {
  if (!obj) return undefined;
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null && obj[k] !== "") return obj[k] as T;
  }
  return undefined;
}

function listFromPayload(payload: Record<string, unknown>): Array<Record<string, unknown>> {
  const nested = payload.data as Record<string, unknown> | Array<Record<string, unknown>> | undefined;
  const candidates = [
    payload.trades,
    payload.items,
    payload.orders,
    payload.history,
    nested,
    Array.isArray(nested) ? undefined : nested?.trades,
    Array.isArray(nested) ? undefined : nested?.items,
    Array.isArray(nested) ? undefined : nested?.orders,
    Array.isArray(nested) ? undefined : nested?.history,
    payload,
  ];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate as Array<Record<string, unknown>>;
  }
  return [];
}

function sameTrade(trade: Record<string, unknown>, tradeId: string) {
  return ["id", "orderId", "tradeId", "uuid"].some((key) => String(trade[key] ?? "") === tradeId);
}

function normalizeStatus(raw: unknown, profit: number): Status {
  const s = String(raw ?? "").toUpperCase();
  if (s === "WIN" || s === "WON") return "WIN";
  if (s === "LOSS" || s === "LOST" || s === "LOSE") return "LOSS";
  if (s === "DRAW" || s === "TIE" || s === "REFUND") return "DRAW";
  if (s === "ACTIVE" || s === "PENDING" || s === "OPEN" || s === "") {
    if (Number.isFinite(profit) && profit > 0) return "WIN";
    if (Number.isFinite(profit) && profit < 0) return "LOSS";
    return "PENDING";
  }
  return "PENDING";
}

async function brokerGet(path: string, token: string) {
  return fetch(`${BROKER_BASE}${path}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
}

async function fetchTradeById(tradeId: string, token: string): Promise<Record<string, unknown> | null> {
  for (const path of [`/api/trading/${tradeId}`, `/api/trading/order/${tradeId}`, `/api/trading/status/${tradeId}`]) {
    try {
      const r = await brokerGet(path, token);
      if (r.ok) {
        const txt = await r.text();
        const j = txt ? JSON.parse(txt) : {};
        const trade = (j.trade as Record<string, unknown>) ?? (j.order as Record<string, unknown>) ?? (j.data as Record<string, unknown>) ?? j;
        if (trade && Object.keys(trade).length) return trade;
      }
    } catch { /* fallback */ }
  }
  for (const path of [`/api/trading/history?page=1&limit=100`, `/api/trading/active`]) {
    try {
      const r = await brokerGet(path, token);
      if (r.ok) {
        const txt = await r.text();
        const j = txt ? JSON.parse(txt) : {};
        const found = listFromPayload(j).find((t) => sameTrade(t, tradeId));
        if (found) return found;
      }
    } catch { /* fallback */ }
  }
  return null;
}

async function fetchBalances(token: string): Promise<{ real: number; demo: number; accountType: "REAL" | "DEMO" }> {
  try {
    const r = await brokerGet(`/api/auth/me`, token);
    if (r.ok) {
      const j = await r.json() as Record<string, unknown>;
      const user = (j.user as Record<string, unknown>) ?? j;
      const balances = (user.balances as { real?: Record<string, unknown>; demo?: Record<string, unknown> }) ?? {};
      const real = Number(
        pick(balances.real, "available", "balance") ??
        pick(user, "balanceReal", "balance_real", "realBalance") ?? 0,
      );
      const demo = Number(
        pick(balances.demo, "available", "balance") ??
        pick(user, "balanceDemo", "balance_demo", "demoBalance") ?? 0,
      );
      const accountType = (String(pick(user, "accountType", "account_type") ?? "DEMO").toUpperCase() === "REAL")
        ? "REAL" : "DEMO";
      return { real, demo, accountType };
    }
  } catch { /* ignore */ }
  return { real: 0, demo: 0, accountType: "DEMO" };
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

  let body: { trade_id?: string };
  try { body = await req.json(); } catch {
    return json({ success: false, message: "JSON inválido" }, 400);
  }
  const tradeId = String(body.trade_id ?? "").trim();
  if (!tradeId) return json({ success: false, message: "trade_id obrigatório" }, 400);

  const trade = await fetchTradeById(tradeId, brokerToken);
  if (!trade) {
    console.warn("check-action-status: trade not found", { tradeId, userId: tokenRes.userId });
    return json({ success: true, status: "PENDING" as Status, message: "Ordem ainda não encontrada na corretora" });
  }

  const amount = Number(pick(trade, "amount") ?? 0);
  const profit = Number(pick(trade, "profit", "pnl", "payoutAmount") ?? 0);
  const payout = Number(pick(trade, "payout", "payoutPercent") ?? 0);
  const rawStatus = pick(trade, "result", "status");
  const status = normalizeStatus(rawStatus, profit);
  console.log("check-action-status: trade status", {
    tradeId,
    status,
    rawStatus,
    profit,
    keys: Object.keys(trade),
  });

  if (status === "PENDING") return json({ success: true, status, trade });

  const balances = await fetchBalances(brokerToken);

  return json({
    success: true,
    status,
    profit,
    payout,
    amount,
    new_balance_real: balances.real,
    new_balance_demo: balances.demo,
    account_type: balances.accountType,
    trade,
  });
});
