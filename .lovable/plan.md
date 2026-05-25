# Plano corrigido: Ciclo completo da operação com token server-side

Correção de segurança aceita: o `brokerToken` nunca mais transita pelo frontend nem por headers. Ambas as Edge Functions (`execute-action-trade` e a nova `check-action-status`) leem o token exclusivamente de `Deno.env.get("ACTION_BROKER_TOKEN")`.

## 0. Secret no servidor (pré-requisito)

Adicionar via `add_secret`:
- `ACTION_BROKER_TOKEN` — token de sessão da ActionBroker. Sem isso, ambas as funções respondem `500`.

Vou solicitar esse secret antes de tocar no código.

## 1. Refatorar `execute-action-trade` para usar `Deno.env`

Arquivo: `supabase/functions/execute-action-trade/index.ts`.

- Remover leitura de `x-broker-token` e `Authorization`.
- Substituir por:
  ```ts
  const brokerToken = Deno.env.get("ACTION_BROKER_TOKEN");
  if (!brokerToken) {
    return json({ success: false, message: "ACTION_BROKER_TOKEN ausente no servidor" }, 500);
  }
  ```
- Manter restante do fluxo (validação de input, `change-account-type`, `POST /api/trading/create`, normalização da resposta).
- Atualizar `Access-Control-Allow-Headers` removendo `x-broker-token`.

## 2. Nova Edge Function `check-action-status`

Arquivo: `supabase/functions/check-action-status/index.ts` + entrada em `supabase/config.toml` (`verify_jwt = false`).

- Lê token via `Deno.env.get("ACTION_BROKER_TOKEN")`; sem token → `500`.
- `POST` com body `{ trade_id: string }`. Valida formato.
- Consulta a corretora (com fallback):
  1. `GET /api/trading/{trade_id}`.
  2. Fallback: `GET /api/trading/history?page=1&limit=50` e filtra por `id`.
  3. Se ainda `ACTIVE`, devolve `{ success: true, status: "PENDING" }`.
- Busca saldo atualizado via `GET /api/auth/me` para devolver `new_balance_real/demo`.
- Resposta normalizada:
  ```ts
  {
    success: boolean,
    status: "WIN" | "LOSS" | "DRAW" | "PENDING",
    profit: number,
    payout: number,
    amount: number,
    new_balance_real: number,
    new_balance_demo: number,
    account_type: "REAL" | "DEMO",
    trade: { id, asset, direction, entryPrice, exitPrice, endTime, status, result, ... }
  }
  ```
- CORS: `Access-Control-Allow-Headers: authorization, x-client-info, apikey, content-type` (sem token custom).

## 3. Refatorar `TradePanel` (`src/routes/dashboard.tsx`)

### 3.1 Remoção de superfície de token no frontend
- Remover a prop `brokerToken` do `<TradePanel>`.
- Remover `headers: { "x-broker-token": brokerToken }` de TODAS as chamadas `supabase.functions.invoke(...)`.
- `DashboardPage` deixa de passar `token` ao painel (continua usando o token local apenas para chamadas ao seu próprio backend de proxy `/api/...`, que é fora do escopo desta refatoração).

### 3.2 Novos estados
- `isSending: boolean` — durante `invoke('execute-action-trade')`.
- `isWaitingResult: boolean` — entre sucesso do envio e fim do polling.
- `pendingTradeId: string | null`.
- `pendingDirection: "CALL" | "PUT" | null`.
- `countdown: number` — segundos restantes (UI).
- Derivado: `isBusy = isSending || isWaitingResult` → desabilita inputs e ambos os botões.

Refs para cleanup: `timeoutRef`, `intervalRef` (limpos no unmount e ao concluir).

### 3.3 Fluxo pós envio
Quando `execute-action-trade` retorna `success: true` com `trade_id`:
1. `setIsSending(false)`, `setIsWaitingResult(true)`, `setPendingTradeId(data.trade_id)`.
2. `waitMs` por timeframe:
   - M1 → 65 s
   - M5 → 305 s
   - M15 → 905 s
3. `setInterval` 1 s → atualiza `countdown`.
4. `setTimeout(waitMs)` → dispara polling.

### 3.4 Feedback visual
Durante `isWaitingResult`:
- Inputs e botões `disabled`.
- Botão da direção pendente: `Loader2` + texto `Aguardando resultado do {timeFrame}... {countdown}s`.
- Faixa no card: "Operação em andamento — aguarde o fechamento da vela."

### 3.5 Polling de resultado
```ts
const { data: statusData, error: statusError } =
  await supabase.functions.invoke("check-action-status", {
    body: { trade_id: pendingTradeId },
  });
```
- Erro ou `success: false` → `toast.error`, libera UI.
- `status === "PENDING"` → até 2 retries com 3 s de intervalo, depois desiste com toast informativo.
- Sempre ao final: limpa timers, `setIsWaitingResult(false)`, `setPendingTradeId(null)`, `setCountdown(0)`.

### 3.6 Atualização de estado global
Após resposta válida, em paralelo:
1. **Saldo imediato**: novo callback `onBalanceFromServer(real, demo)` no `<TradePanel>` → `setProfile({ ...profile, balance_real: real, balance_demo: demo })`. Em seguida, `onBalanceRefresh?.()` revalida.
2. **Histórico**: novo callback `onTradeResolved(trade)` → merge otimista no `history` (`[trade, ...rest].slice(0, 20)`). Depois `onPlaced()` revalida via API.
3. **Toast final**:
   - WIN → `toast.success("Win! +$X.XX")`
   - LOSS → `toast.error("Loss · -$X.XX")`
   - DRAW → `toast("Empate · valor devolvido")`

### 3.7 Race conditions e segurança
- `place()` retorna cedo se `isBusy`.
- `handleSwitchAccount` no `DashboardPage` bloqueia troca enquanto `isWaitingResult` (toast "Aguarde o fechamento da operação").
- Cleanup de timers no unmount evita callbacks órfãos.

## 4. Arquivos afetados

- `supabase/functions/execute-action-trade/index.ts` (passa a usar `Deno.env`)
- `supabase/functions/check-action-status/index.ts` (novo, `Deno.env`)
- `supabase/config.toml` (registrar `check-action-status` com `verify_jwt = false`)
- `src/routes/dashboard.tsx` (remove `brokerToken` do painel, novos estados, polling, novos callbacks de saldo/histórico)

Nenhuma mudança em banco, RLS ou rotas. Design preservado; só lógica assíncrona, estados e textos.

## 5. Ordem de execução

1. `add_secret(["ACTION_BROKER_TOKEN"])` e aguardar o usuário inserir.
2. Reescrever `execute-action-trade` para `Deno.env`.
3. Criar `check-action-status` + atualizar `config.toml`.
4. Refatorar `TradePanel` + wiring no `DashboardPage`.
5. Testar via `supabase--curl_edge_functions` (ambas as funções) e verificar logs.
