import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { LogOut, TrendingUp, Wifi, Loader2, ArrowUpRight, ArrowDownRight, Link2 } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { userService } from "@/services/userService";
import { authService } from "@/services/authService";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { ConnectBrokerModal } from "@/components/ConnectBrokerModal";
import {
  actionbrokerService,
  type ABAsset,
  type ABTab,
  type ABTrade,
} from "@/services/actionbrokerService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — TraderHub" },
      { name: "description", content: "Painel de ativos da corretora." },
    ],
  }),
  component: DashboardPage,
});

function formatMoney(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "USD" });
}

function formatTime(iso?: string) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch {
    return "—";
  }
}

function DashboardPage() {
  const navigate = useNavigate();
  const { session, loading: sessionLoading } = useSession();
  const { profile, accountType, brokerConnected, setAccountType, setProfile, setBrokerConnected, reset } = useAuthStore();
  const [assets, setAssets] = useState<ABAsset[]>([]);
  const [tabs, setTabs] = useState<ABTab[]>([]);
  const [activeTrades, setActiveTrades] = useState<ABTrade[]>([]);
  const [history, setHistory] = useState<ABTrade[]>([]);
  const [assetsLoading, setAssetsLoading] = useState(true);
  const [online, setOnline] = useState<number | null>(null);
  const [switching, setSwitching] = useState(false);
  const [connectOpen, setConnectOpen] = useState(false);

  async function refreshAccount(syncAccountType = false) {
    const freshProfile = await userService.getProfile();
    setProfile(freshProfile);
    if (syncAccountType) setAccountType(freshProfile.account_type);
    return freshProfile;
  }

  async function refreshAssets() {
    setAssetsLoading(true);
    try {
      const [list, tabList] = await Promise.all([
        actionbrokerService.listAssets(),
        actionbrokerService.listTabs(),
      ]);
      setAssets(list.filter((a) => a.isActive));
      setTabs(tabList);
    } catch {
      toast.error("Falha ao carregar ativos");
    } finally {
      setAssetsLoading(false);
    }
  }

  async function refreshTrades() {
    const [act, hist] = await Promise.all([
      actionbrokerService.activeTrades(),
      actionbrokerService.tradeHistory(20),
    ]);
    setActiveTrades(act);
    setHistory(hist);
  }

  async function handleSwitchAccount(next: "REAL" | "DEMO") {
    if (next === accountType || switching) return;
    setSwitching(true);
    try {
      await actionbrokerService.switchAccount(next);
      setAccountType(next);
      await refreshAccount();
      toast.success(`Conta ${next} ativada`);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } }; message?: string };
      const raw = e?.response?.data?.message ?? e?.message ?? "";
      const lower = raw.toLowerCase();
      if (lower.includes("já é do tipo")) {
        // Corretora considera que já está no tipo pedido — sincroniza UI.
        setAccountType(next);
        await refreshAccount();
        toast.success(`Conta ${next} ativada`);
      } else if (lower.includes("trades ativos") || lower.includes("operações ativas")) {
        toast.error(
          `Não dá pra trocar de conta agora: existem operações em aberto. Aguarde finalizarem.`,
        );
      } else {
        toast.error(raw || "Falha ao trocar de conta");
      }
    } finally {
      setSwitching(false);
    }
  }

  useEffect(() => {
    if (!session) return;
    refreshAssets();
    refreshTrades();
    actionbrokerService.onlineUsers().then(setOnline).catch(() => {});
  }, [session, brokerConnected]);

  useEffect(() => {
    if (sessionLoading) return;
    if (!session) {
      navigate({ to: "/login" });
      return;
    }
    refreshAccount(true).then(() => {
      setBrokerConnected(true);
    }).catch((err: unknown) => {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 401) {
        setBrokerConnected(false);
        setConnectOpen(true);
      } else {
        toast.error("Falha ao carregar perfil");
      }
    });
    const interval = window.setInterval(() => {
      refreshAccount().catch(() => {});
      refreshTrades().catch(() => {});
    }, 5000);
    return () => window.clearInterval(interval);
  }, [session, sessionLoading, navigate, setAccountType, setProfile, setBrokerConnected]);

  async function handleLogout() {
    await authService.signOut();
    reset();
    navigate({ to: "/login" });
  }

  const activeBalance = profile
    ? accountType === "REAL"
      ? profile.balance_real
      : profile.balance_demo
    : 0;

  const tabAssets = useMemo(() => tabs.map((t) => t.asset).filter(Boolean), [tabs]);

  const assetGroups = useMemo(() => {
    return assets.reduce<Record<string, ABAsset[]>>((acc, item) => {
      const key = item.category || item.type || "Ativos";
      acc[key] = acc[key] ?? [];
      acc[key].push(item);
      return acc;
    }, {});
  }, [assets]);

  if (sessionLoading || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!profile) {
    return (
      <>
        <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4 text-center">
          <Link2 className="h-10 w-10 text-primary" />
          <h1 className="text-xl font-semibold">Conecte sua corretora</h1>
          <p className="text-sm text-muted-foreground max-w-sm">
            Para começar a operar, conecte sua conta da ActionBroker. O token fica
            guardado no servidor — seu navegador nunca o vê.
          </p>
          <div className="flex gap-2">
            <Button onClick={() => setConnectOpen(true)}>
              <Link2 className="h-4 w-4 mr-1" /> Conectar corretora
            </Button>
            <Button variant="ghost" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-1" /> Sair
            </Button>
          </div>
        </div>
        <ConnectBrokerModal
          open={connectOpen}
          onOpenChange={setConnectOpen}
          onConnected={() => {
            setBrokerConnected(true);
            refreshAccount(true).catch(() => {});
          }}
        />
      </>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-card/50 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-primary" />
            <span className="font-semibold tracking-tight">TraderHub</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden sm:inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="h-2 w-2 rounded-full bg-bull animate-pulse" />
              <Wifi className="h-3.5 w-3.5" />
              {online !== null ? `${online} online` : "Conectado"}
            </span>
            <div className="flex items-center gap-2">
              <Avatar className="h-8 w-8">
                <AvatarImage src={profile.avatar} alt={profile.name} />
                <AvatarFallback>{profile.name[0]}</AvatarFallback>
              </Avatar>
              <span className="text-sm hidden sm:inline">{profile.name}</span>
            </div>
            <Button variant="outline" size="sm" onClick={() => setConnectOpen(true)}>
              <Link2 className="h-4 w-4" />
              <span className="hidden sm:inline ml-1">Corretora</span>
            </Button>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline ml-1">Sair</span>
            </Button>
          </div>
        </div>
      </header>
      <ConnectBrokerModal
        open={connectOpen}
        onOpenChange={setConnectOpen}
        onConnected={() => {
          setBrokerConnected(true);
          refreshAccount(true).catch(() => {});
        }}
      />


      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <section className="grid gap-4 md:grid-cols-3">
          <BalanceCard
            label="Conta REAL"
            value={profile.balance_real}
            active={accountType === "REAL"}
            tone="real"
            onClick={() => handleSwitchAccount("REAL")}
            disabled={switching}
          />
          <BalanceCard
            label="Conta DEMO"
            value={profile.balance_demo}
            active={accountType === "DEMO"}
            tone="demo"
            onClick={() => handleSwitchAccount("DEMO")}
            disabled={switching}
          />
          <div className="bg-card border border-border rounded-xl p-6">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Conta ativa</p>
            <p className="text-xl font-semibold mt-2">
              {accountType} · {formatMoney(activeBalance)}
            </p>
            <p className="text-xs text-muted-foreground mt-3">
              Clique em uma conta acima para alternar na corretora.
            </p>
          </div>
        </section>

        <TradePanel
          assets={assets}
          accountType={accountType}
          accountId={accountType === "REAL" ? profile.account_id_real : profile.account_id_demo}
          onPlaced={refreshTrades}
          onBalanceRefresh={() => refreshAccount().catch(() => {})}
          onBalanceFromServer={(real, demo) => {
            if (!profile) return;
            // Only mirror balances fetched back from the broker, never a locally calculated debit.
            setProfile({ ...profile, balance_real: real, balance_demo: demo });
          }}
          onTradeResolved={(trade) => {
            setHistory((prev) => {
              const next = [trade, ...prev.filter((t) => t.id !== trade.id)];
              return next.slice(0, 20);
            });
            setActiveTrades((prev) => prev.filter((t) => t.id !== trade.id));
          }}
        />


        {tabAssets.length > 0 && (
          <section className="bg-card border border-border rounded-xl p-6">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Suas abas abertas
            </h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {tabAssets.map((a) => (
                <span
                  key={a.id}
                  className="text-xs px-3 py-1.5 rounded-full border border-border bg-background/60"
                >
                  {a.symbol} · <span className="text-muted-foreground">{a.name}</span>
                </span>
              ))}
            </div>
          </section>
        )}

        <section className="grid gap-6 lg:grid-cols-2">
          <TradesPanel
            title="Operações em andamento"
            empty="Sem operações abertas no momento."
            trades={activeTrades}
            showResult={false}
          />
          <TradesPanel
            title="Histórico recente"
            empty="Nenhuma operação no histórico."
            trades={history}
            showResult
          />
        </section>

        <section className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold">Ativos da corretora</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Lista sincronizada diretamente da plataforma.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={refreshAssets} disabled={assetsLoading}>
              {assetsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Atualizar"}
            </Button>
          </div>

          {assetsLoading ? (
            <div className="py-16 flex justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : assets.length === 0 ? (
            <p className="text-sm text-muted-foreground py-10">
              Nenhum ativo retornado pela corretora para esta conta.
            </p>
          ) : (
            <div className="mt-6 space-y-6">
              {Object.entries(assetGroups).map(([group, list]) => (
                <div key={group} className="space-y-3">
                  <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                    {group}
                  </h2>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {list.map((item) => (
                      <AssetCard key={item.id} asset={item} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function TradesPanel({
  title,
  empty,
  trades,
  showResult,
}: {
  title: string;
  empty: string;
  trades: ABTrade[];
  showResult: boolean;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
        {title}
      </h2>
      {trades.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8">{empty}</p>
      ) : (
        <ul className="mt-4 divide-y divide-border">
          {trades.map((t) => {
            const isCall = t.direction === "CALL";
            const profit = Number(t.profit ?? 0);
            const win = t.result === "WIN" || profit > 0;
            const loss = t.result === "LOSS" || profit < 0;
            return (
              <li key={t.id} className="py-3 flex items-center justify-between gap-3 text-sm">
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={`h-7 w-7 rounded-md flex items-center justify-center ${
                      isCall ? "bg-bull/15 text-bull" : "bg-bear/15 text-bear"
                    }`}
                  >
                    {isCall ? (
                      <ArrowUpRight className="h-4 w-4" />
                    ) : (
                      <ArrowDownRight className="h-4 w-4" />
                    )}
                  </span>
                  <div className="min-w-0">
                    <p className="font-medium truncate">
                      {t.asset?.symbol ?? "—"}{" "}
                      <span className="text-xs text-muted-foreground">· {t.type ?? "—"}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatTime(t.startTime)} → {formatTime(t.endTime)}
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="tabular-nums">{formatMoney(Number(t.amount) || 0)}</p>
                  {showResult ? (
                    <p
                      className={`text-xs tabular-nums ${
                        win ? "text-bull" : loss ? "text-bear" : "text-muted-foreground"
                      }`}
                    >
                      {win ? "+" : loss ? "" : ""}
                      {formatMoney(profit)}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      {t.status ?? "ACTIVE"} · {t.duration}s
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function AssetCard({ asset }: { asset: ABAsset }) {
  const price = Number(asset.lastPrice);
  return (
    <article className="rounded-xl border border-border bg-background/40 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">{asset.symbol}</h3>
          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{asset.name}</p>
        </div>
        <span
          className={`text-xs px-2 py-1 rounded-md ${
            asset.isOpen ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
          }`}
        >
          {asset.isOpen ? "Aberto" : "Fechado"}
        </span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">Preço</p>
          <p className="font-medium tabular-nums">
            {Number.isFinite(price) && price > 0 ? price : "—"}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Payout</p>
          <p className="font-medium tabular-nums">{asset.payout}%</p>
        </div>
      </div>
    </article>
  );
}

function TradePanel({
  assets,
  accountType,
  accountId,
  onPlaced,
  onBalanceRefresh,
  onBalanceFromServer,
  onTradeResolved,
}: {
  assets: ABAsset[];
  accountType: "REAL" | "DEMO";
  accountId?: string | null;
  onPlaced: () => void;
  onBalanceRefresh?: () => void;
  onBalanceFromServer?: (real: number, demo: number) => void;
  onTradeResolved?: (trade: ABTrade) => void;
}) {
  const tradable = useMemo(() => assets.filter((a) => a.isOpen), [assets]);
  const [asset, setAsset] = useState<string>("");
  const [amount, setAmount] = useState<string>("1");
  const [timeFrame, setTimeFrame] = useState<"M1" | "M5" | "M15">("M1");

  const [isSending, setIsSending] = useState(false);
  const [isWaitingResult, setIsWaitingResult] = useState(false);
  const [pendingDirection, setPendingDirection] = useState<null | "CALL" | "PUT">(null);
  const [pendingTradeId, setPendingTradeId] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);

  const timeoutRef = useRef<number | null>(null);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (!asset && tradable.length > 0) setAsset(tradable[0].id);
  }, [tradable, asset]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    };
  }, []);

  function clearTimers() {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }

  function resetPending() {
    clearTimers();
    setIsWaitingResult(false);
    setPendingDirection(null);
    setPendingTradeId(null);
    setCountdown(0);
  }

  async function pollResult(tradeId: string, attempt = 0) {
    try {
      const { data, error } = await supabase.functions.invoke("check-action-status", {
        body: { trade_id: tradeId },
      });
      if (error) throw new Error(error.message ?? "Falha ao consultar resultado");
      if (!data?.success) throw new Error(data?.message ?? "Falha ao consultar resultado");

      if (data.status === "PENDING") {
        if (attempt < 2) {
          window.setTimeout(() => pollResult(tradeId, attempt + 1), 3000);
          return;
        }
        toast("Resultado ainda não disponível — atualizando histórico.");
        onPlaced();
        onBalanceRefresh?.();
        resetPending();
        return;
      }

      // WIN / LOSS / DRAW
      if (
        onBalanceFromServer &&
        Number.isFinite(Number(data.new_balance_real)) &&
        Number.isFinite(Number(data.new_balance_demo))
      ) {
        onBalanceFromServer(Number(data.new_balance_real), Number(data.new_balance_demo));
      }
      onBalanceRefresh?.();
      if (data.trade && onTradeResolved) {
        onTradeResolved(data.trade as ABTrade);
      }
      onPlaced();

      const profit = Number(data.profit ?? 0);
      if (data.status === "WIN") {
        toast.success(`Win! ${profit >= 0 ? "+" : ""}${formatMoney(profit)}`);
      } else if (data.status === "LOSS") {
        toast.error(`Loss · ${formatMoney(profit)}`);
      } else {
        toast("Empate · valor devolvido");
      }
      resetPending();
    } catch (err) {
      toast.error((err as Error)?.message ?? "Falha ao consultar resultado");
      onPlaced();
      onBalanceRefresh?.();
      resetPending();
    }
  }

  async function place(direction: "CALL" | "PUT") {
    if (isSending || isWaitingResult) return;
    const amt = Number(amount);
    if (!asset || !Number.isFinite(amt) || amt <= 0) {
      toast.error("Informe ativo e valor válido");
      return;
    }
    setIsSending(true);
    setPendingDirection(direction);
    try {
      const { data, error } = await supabase.functions.invoke("execute-action-trade", {
        body: {
          assetId: asset,
          accountId,
          amount: amt,
          direction,
          timeframe: timeFrame,
          account_type: accountType,
        },
      });

      if (error) {
        const ctx = (error as { context?: { error?: string; message?: string } }).context;
        throw new Error(ctx?.message ?? ctx?.error ?? error.message ?? "Falha na operação");
      }
      if (!data?.success) throw new Error(data?.message ?? "Falha na operação");

      const tradeId = String(data.trade_id ?? "");
      toast.success(tradeId ? `Ordem enviada · ${tradeId}` : "Ordem enviada");
      onPlaced();
      if (
        onBalanceFromServer &&
        Number.isFinite(Number(data.new_balance_real)) &&
        Number.isFinite(Number(data.new_balance_demo))
      ) {
        onBalanceFromServer(Number(data.new_balance_real), Number(data.new_balance_demo));
      } else {
        onBalanceRefresh?.();
      }
      if (data.is_marketing) {
        toast.warning(
          "Conta marketing detectada: a corretora registra no histórico, mas não liquida como saldo/portfólio real.",
        );
      }

      if (!tradeId) {
        // Sem id não há como consultar — libera UI
        setIsSending(false);
        setPendingDirection(null);
        return;
      }

      const waitMs = timeFrame === "M15" ? 905_000 : timeFrame === "M5" ? 305_000 : 65_000;
      setIsSending(false);
      setIsWaitingResult(true);
      setPendingTradeId(tradeId);
      setCountdown(Math.floor(waitMs / 1000));

      intervalRef.current = window.setInterval(() => {
        setCountdown((c) => (c > 0 ? c - 1 : 0));
      }, 1000);

      timeoutRef.current = window.setTimeout(() => {
        if (intervalRef.current) {
          window.clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        pollResult(tradeId, 0);
      }, waitMs);
    } catch (err) {
      toast.error((err as Error)?.message ?? "Falha na operação");
      setIsSending(false);
      setPendingDirection(null);
    }
  }

  const isBusy = isSending || isWaitingResult;
  const inputsDisabled = isBusy;
  const buttonsDisabled = isBusy || !asset;

  return (
    <section className="bg-card border border-border rounded-xl p-6">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Operar
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Conta ativa: <span className="font-medium">{accountType}</span>
          </p>
        </div>
      </div>

      {isWaitingResult && (
        <div className="mb-4 rounded-md border border-border bg-background/60 px-3 py-2 text-xs text-muted-foreground">
          Operação em andamento — aguarde o fechamento da vela ({countdown}s).
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-4">
        <label className="flex flex-col gap-1.5 text-xs">
          <span className="text-muted-foreground">Ativo</span>
          <select
            value={asset}
            onChange={(e) => setAsset(e.target.value)}
            disabled={inputsDisabled}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm disabled:opacity-60"
          >
            {tradable.length === 0 && <option value="">Nenhum ativo aberto</option>}
            {tradable.map((a) => (
              <option key={a.id} value={a.id}>
                {a.symbol} · {a.payout}%
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5 text-xs">
          <span className="text-muted-foreground">Valor (USD)</span>
          <Input
            type="number"
            min={1}
            step={1}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={inputsDisabled}
          />
        </label>

        <label className="flex flex-col gap-1.5 text-xs">
          <span className="text-muted-foreground">Expiração</span>
          <select
            value={timeFrame}
            onChange={(e) => setTimeFrame(e.target.value as "M1" | "M5" | "M15")}
            disabled={inputsDisabled}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm disabled:opacity-60"
          >
            <option value="M1">M1 (1 min)</option>
            <option value="M5">M5 (5 min)</option>
            <option value="M15">M15 (15 min)</option>
          </select>
        </label>

        <div className="grid grid-cols-2 gap-2 items-end">
          <Button
            type="button"
            onClick={() => place("CALL")}
            disabled={buttonsDisabled}
            className="h-10 bg-bull hover:bg-bull/90 text-white"
          >
            {pendingDirection === "CALL" ? (
              <span className="flex items-center gap-1.5 text-xs">
                <Loader2 className="h-4 w-4 animate-spin" />
                {isWaitingResult ? `${timeFrame} · ${countdown}s` : "Enviando…"}
              </span>
            ) : (
              <>
                <ArrowUpRight className="h-4 w-4 mr-1" /> Buy
              </>
            )}
          </Button>
          <Button
            type="button"
            onClick={() => place("PUT")}
            disabled={buttonsDisabled}
            className="h-10 bg-bear hover:bg-bear/90 text-white"
          >
            {pendingDirection === "PUT" ? (
              <span className="flex items-center gap-1.5 text-xs">
                <Loader2 className="h-4 w-4 animate-spin" />
                {isWaitingResult ? `${timeFrame} · ${countdown}s` : "Enviando…"}
              </span>
            ) : (
              <>
                <ArrowDownRight className="h-4 w-4 mr-1" /> Sell
              </>
            )}
          </Button>
        </div>
      </div>
    </section>
  );
}


function BalanceCard({
  label,
  value,
  active,
  tone,
  onClick,
  disabled,
}: {
  label: string;
  value: number;
  active: boolean;
  tone: "real" | "demo";
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`text-left rounded-xl border p-6 transition disabled:opacity-60 ${
        active
          ? "border-primary/60 bg-card shadow-[0_0_0_1px_var(--primary)]"
          : "border-border bg-card hover:border-primary/40"
      }`}
    >
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-3xl font-semibold mt-2 tabular-nums">{formatMoney(value)}</p>
      <p className={`text-xs mt-3 ${tone === "real" ? "text-bear" : "text-primary"}`}>
        {active ? "Conta ativa" : "Clique para ativar"}
      </p>
    </button>
  );
}
