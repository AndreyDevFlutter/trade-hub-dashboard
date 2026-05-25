// Edge Function: execute-action-trade
// Single Source of Truth para envio de ordens à corretora ActionBroker.
// O front-end NÃO calcula saldo. Esta função valida o input, executa a ordem
// no broker e devolve { success, trade_id, message, new_balance? }.

const BROKER_BASE = "https://api.actionbroker.app";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-broker-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Direction = "CALL" | "PUT";
type TimeFrame = "M1" | "M5" | "M15";
type AccountType = "DEMO" | "REAL";

interface TradeBody {
  asset?: string;          // assetId (UUID)
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, message: "Method not allowed" }, 405);

  // Token do broker do usuário: header dedicado OU Authorization Bearer
  const brokerToken =
    req.headers.get("x-broker-token") ??
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    "";
  if (!brokerToken) {
    return json({ success: false, message: "Sessão da corretora ausente" }, 401);
  }

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

  // Garante conta ativa (best-effort, não bloqueia se falhar)
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
  } catch {
    /* segue */
  }

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
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

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
    (dataNested?.id as string) ??
    "";
  const new_balance = Number(
    (data.balance as number | string | undefined) ??
      (dataNested?.balance as number | string | undefined) ??
      (trade?.balance as number | string | undefined) ??
      0,
  );

  return json({
    success: true,
    trade_id,
    message: (data.message as string) ?? "Ordem enviada",
    new_balance,
    account_type: accountType,
  });
});
