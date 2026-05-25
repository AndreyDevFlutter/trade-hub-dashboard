// Edge Function: check-action-status
// Consulta o resultado final de uma ordem na ActionBroker.
// Token da corretora SEMPRE vem do ambiente seguro (Deno.env), nunca do client.

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
    if (obj[k] !== undefined && obj[k] !== null) return obj[k] as T;
  }
  return undefined;
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
  try {
    const r = await brokerGet(`/api/trading/${tradeId}`, token);
    if (r.ok) {
      const txt = await r.text();
      const j = txt ? JSON.parse(txt) : {};
      const trade = (j.trade as Record<string, unknown>) ?? (j.data as Record<string, unknown>) ?? j;
      if (trade && (trade as { id?: string }).id) return trade;
    }
  } catch { /* fallback */ }

  try {
    const r = await brokerGet(`/api/trading/history?page=1&limit=50`, token);
    if (r.ok) {
      const txt = await r.text();
      const j = txt ? JSON.parse(txt) : {};
      const list: Array<Record<string, unknown>> =
        (j.trades as Array<Record<string, unknown>>) ??
        (j.data as Array<Record<string, unknown>>) ??
        (Array.isArray(j) ? j : []);
      const found = list.find((t) => String(t.id) === tradeId);
      if (found) return found;
    }
  } catch { /* fallback */ }

  try {
    const r = await brokerGet(`/api/trading/active`, token);
    if (r.ok) {
      const txt = await r.text();
      const j = txt ? JSON.parse(txt) : {};
      const list: Array<Record<string, unknown>> =
        (j.trades as Array<Record<string, unknown>>) ??
        (j.data as Array<Record<string, unknown>>) ??
        (Array.isArray(j) ? j : []);
      const found = list.find((t) => String(t.id) === tradeId);
      if (found) return found;
    }
  } catch { /* fallback */ }

  return null;
}

async function fetchBalances(token: string): Promise<{ real: number; demo: number; accountType: "REAL" | "DEMO" }> {
  try {
    const r = await brokerGet(`/api/auth/me`, token);
    if (r.ok) {
      const j = await r.json() as Record<string, unknown>;
      const user = (j.user as Record<string, unknown>) ?? j;
      const real = Number(pick(user, "balanceReal", "balance_real", "realBalance") ?? 0);
      const demo = Number(pick(user, "balanceDemo", "balance_demo", "demoBalance") ?? 0);
      const accountType = (String(pick(user, "accountType", "account_type") ?? "DEMO").toUpperCase() === "REAL")
        ? "REAL"
        : "DEMO";
      return { real, demo, accountType };
    }
  } catch { /* ignore */ }
  return { real: 0, demo: 0, accountType: "DEMO" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, message: "Method not allowed" }, 405);

  const brokerToken = Deno.env.get("ACTION_BROKER_TOKEN");
  if (!brokerToken) {
    return json(
      { success: false, message: "ACTION_BROKER_TOKEN ausente no servidor" },
      500,
    );
  }

  let body: { trade_id?: string };
  try {
    body = await req.json();
  } catch {
    return json({ success: false, message: "JSON inválido" }, 400);
  }
  const tradeId = String(body.trade_id ?? "").trim();
  if (!tradeId) return json({ success: false, message: "trade_id obrigatório" }, 400);

  const trade = await fetchTradeById(tradeId, brokerToken);
  if (!trade) {
    return json({ success: true, status: "PENDING" as Status });
  }

  const amount = Number(pick(trade, "amount") ?? 0);
  const profit = Number(pick(trade, "profit", "pnl", "payoutAmount") ?? 0);
  const payout = Number(pick(trade, "payout", "payoutPercent") ?? 0);
  const rawStatus = pick(trade, "result", "status");
  const status = normalizeStatus(rawStatus, profit);

  if (status === "PENDING") {
    return json({ success: true, status, trade });
  }

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
