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

class BrokerHttpError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "BrokerHttpError";
    this.status = status;
  }
}

interface TradeBody {
  asset?: string;
  assetId?: string;
  accountId?: string | null;
  amount?: number;
  direction?: Direction;
  timeframe?: TimeFrame;
  account_type?: AccountType;
}

function pick<T = unknown>(obj: Record<string, unknown> | undefined, ...keys: string[]): T | undefined {
  if (!obj) return undefined;
  for (const key of keys) {
    const value = obj[key];
    if (value !== undefined && value !== null && value !== "") return value as T;
  }
  return undefined;
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

function pickAccountId(raw: Record<string, unknown>, accountType: AccountType): string | undefined {
  const user = (raw.user as Record<string, unknown> | undefined) ?? raw;
  const balances = user.balances as Record<string, Record<string, unknown>> | undefined;
  const balanceAccount = accountType === "REAL" ? balances?.real : balances?.demo;
  const fromBalance = pick<string>(balanceAccount, "id", "accountId");
  if (fromBalance) return fromBalance;

  const accounts = user.accounts as Array<Record<string, unknown>> | undefined;
  const match = accounts?.find((account) => {
    if (account.isTournament === true) return false;
    const isDemo = account.isDemo === true || String(account.type ?? "").toUpperCase() === "DEMO";
    return accountType === "DEMO" ? isDemo : !isDemo;
  });
  return pick<string>(match, "id", "accountId");
}

async function brokerJson(path: string, token: string, init?: RequestInit): Promise<Record<string, unknown>> {
  const response = await fetch(`${BROKER_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
  });
  const text = await response.text();
  let data: Record<string, unknown> = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  if (!response.ok) {
    throw new BrokerHttpError(String(data.message ?? data.error ?? `ActionBroker ${response.status}`), response.status);
  }
  return data;
}

function brokerErrorMessage(err: unknown) {
  return err instanceof Error ? err.message : "Erro desconhecido";
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
    await brokerJson("/api/users/change-account-type", brokerToken, {
      method: "POST",
      body: JSON.stringify({ accountType }),
    });
  } catch (err) {
    const message = brokerErrorMessage(err);
    const safeToContinue =
      message.toLowerCase().includes("já é do tipo") ||
      message.toLowerCase().includes("trades ativos") ||
      (err instanceof BrokerHttpError && err.status === 400);
    if (!safeToContinue) {
      return json(
        { success: false, message: `Falha ao ativar conta ${accountType}: ${message}` },
        502,
      );
    }
    console.warn("execute-action-trade: continuing after account switch warning", {
      userId: tokenRes.userId,
      accountType,
      message,
    });
  }

  let accountId = body.accountId ?? undefined;
  if (!accountId) {
    try {
      const me = await brokerJson("/api/auth/me", brokerToken);
      accountId = pickAccountId(me, accountType);
    } catch { /* only used for trace; official order payload does not require it */ }
  }

  console.log("execute-action-trade: sending", {
    userId: tokenRes.userId,
    asset: assetId,
    amount,
    direction,
    timeframe,
    accountType,
    hasAccountId: Boolean(accountId),
  });

  const payload: Record<string, unknown> = {
    asset: assetId,
    amount,
    direction,
    method: "timeframe",
    expiryTime: durationFor(timeframe),
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
    console.error("execute-action-trade: broker rejected", { status: upstream.status, message, keys: Object.keys(data) });
    return json({ success: false, message, broker_status: upstream.status }, upstream.status);
  }

  const trade = (data.trade as Record<string, unknown> | undefined) ?? undefined;
  const dataNested = (data.data as Record<string, unknown> | undefined) ?? undefined;
  const order = (data.order as Record<string, unknown> | undefined) ?? undefined;
  const trade_id =
    (data.orderId as string) ??
    (data.tradeId as string) ??
    (data.id as string) ??
    (trade?.id as string) ??
    (trade?.orderId as string) ??
    (dataNested?.orderId as string) ??
    (dataNested?.tradeId as string) ??
    (dataNested?.id as string) ?? "";
  const new_balance = Number(
    (data.balance as number | string | undefined) ??
    (dataNested?.balance as number | string | undefined) ??
    (trade?.balance as number | string | undefined) ?? 0,
  );
  console.log("execute-action-trade: broker accepted", {
    trade_id,
    accountType,
    hasAccountId: Boolean(accountId),
    keys: Object.keys(data),
  });

  return json({
    success: true,
    trade_id,
    message: (data.message as string) ?? "Ordem enviada",
    new_balance,
    account_type: accountType,
    account_id: accountId ?? null,
    broker_trade: trade ?? order ?? dataNested ?? data,
  });
});
