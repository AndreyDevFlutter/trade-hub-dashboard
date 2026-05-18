import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  LogOut,
  Wifi,
  Loader2,
} from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { userService } from "@/services/userService";
import {
  tradeService,
  type AccountType,
  type Direction,
} from "@/services/tradeService";
import { authService } from "@/services/authService";
import {
  actionbrokerService,
  type ABAsset,
} from "@/services/actionbrokerService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — TraderHub" },
      { name: "description", content: "Painel de operações em tempo real." },
    ],
  }),
  component: DashboardPage,
});

const FALLBACK_ASSETS: { symbol: string; name: string }[] = [
  { symbol: "EURUSD", name: "EUR/USD" },
  { symbol: "GBPUSD", name: "GBP/USD" },
  { symbol: "USDJPY", name: "USD/JPY" },
  { symbol: "BTCUSD", name: "Bitcoin" },
  { symbol: "ETHUSD", name: "Ethereum" },
];

function formatMoney(v: number) {
  return v.toLocaleString("pt-BR", {
    style: "currency",
    currency: "USD",
  });
}

function DashboardPage() {
  const navigate = useNavigate();
  const { token, profile, accountType, setAccountType, setProfile, updateBalance, logout } =
    useAuthStore();
  const [asset, setAsset] = useState("EURUSD");
  const [amount, setAmount] = useState(10);
  const [submitting, setSubmitting] = useState<Direction | null>(null);
  const [lastResult, setLastResult] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      navigate({ to: "/login" });
      return;
    }
    if (!profile) {
      userService
        .getProfile()
        .then(setProfile)
        .catch(() => toast.error("Falha ao carregar perfil"));
    }
  }, [token, profile, navigate, setProfile]);

  async function handleOrder(direction: Direction) {
    if (amount <= 0) {
      toast.error("Informe um valor de entrada válido");
      return;
    }
    setSubmitting(direction);
    try {
      const res = await tradeService.sendOrder({
        asset,
        direction,
        amount: Number(amount),
        account_type: accountType,
      });
      toast.success(res.message);
      setLastResult(`${res.order_id} • ${res.message}`);
      const balance = await userService.getBalance();
      updateBalance(balance.balance_real, balance.balance_demo);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Erro ao enviar ordem";
      toast.error(msg);
    } finally {
      setSubmitting(null);
    }
  }

  function handleLogout() {
    authService.logout();
    logout();
    navigate({ to: "/login" });
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const activeBalance =
    accountType === "REAL" ? profile.balance_real : profile.balance_demo;

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-primary" />
            <span className="font-semibold tracking-tight">TraderHub</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden sm:inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="h-2 w-2 rounded-full bg-bull animate-pulse" />
              <Wifi className="h-3.5 w-3.5" /> Conectado
            </span>
            <div className="flex items-center gap-2">
              <Avatar className="h-8 w-8">
                <AvatarImage src={profile.avatar} alt={profile.name} />
                <AvatarFallback>{profile.name[0]}</AvatarFallback>
              </Avatar>
              <span className="text-sm hidden sm:inline">{profile.name}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                fetch("/actionbroker-sniffer.zip")
                  .then((r) => {
                    if (!r.ok) throw new Error("Falha: " + r.status);
                    return r.blob();
                  })
                  .then((blob) => {
                    const a = document.createElement("a");
                    a.href = URL.createObjectURL(blob);
                    a.download = "actionbroker-sniffer.zip";
                    a.click();
                    URL.revokeObjectURL(a.href);
                    toast.success("Extensão baixada!");
                  })
                  .catch((e) => toast.error(e.message));
              }}
            >
              🔍 Extensão
            </Button>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline ml-1">Sair</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 grid gap-6 lg:grid-cols-3">
        {/* Account cards */}
        <section className="lg:col-span-2 grid gap-4 sm:grid-cols-2">
          <BalanceCard
            label="Conta REAL"
            value={profile.balance_real}
            active={accountType === "REAL"}
            tone="real"
          />
          <BalanceCard
            label="Conta DEMO"
            value={profile.balance_demo}
            active={accountType === "DEMO"}
            tone="demo"
          />
          <div className="sm:col-span-2 bg-card border border-border rounded-xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">
                  Conta ativa
                </p>
                <p className="text-lg font-semibold mt-1">
                  {accountType} · {formatMoney(activeBalance)}
                </p>
              </div>
              <span
                className={`text-xs px-2 py-1 rounded-md font-medium ${
                  accountType === "REAL"
                    ? "bg-bear/15 text-bear"
                    : "bg-primary/15 text-primary"
                }`}
              >
                {accountType === "REAL" ? "Dinheiro real" : "Treinamento"}
              </span>
            </div>
            {lastResult && (
              <p className="text-xs text-muted-foreground mt-4 border-t border-border pt-3">
                Última ordem: <span className="text-foreground">{lastResult}</span>
              </p>
            )}
          </div>
        </section>

        {/* Operation panel */}
        <aside className="bg-card border border-border rounded-xl p-6 h-fit lg:sticky lg:top-24">
          <h2 className="font-semibold">Nova operação</h2>
          <p className="text-xs text-muted-foreground">
            Defina o ativo, valor e tipo de conta.
          </p>

          <div className="space-y-4 mt-5">
            <div className="space-y-2">
              <Label>Ativo</Label>
              <Select value={asset} onValueChange={setAsset}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ASSETS.map((a) => (
                    <SelectItem key={a} value={a}>
                      {a}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">Valor da entrada (USD)</Label>
              <Input
                id="amount"
                type="number"
                min={1}
                step={1}
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
              />
            </div>

            <div className="space-y-2">
              <Label>Tipo de conta</Label>
              <Select
                value={accountType}
                onValueChange={(v) => setAccountType(v as AccountType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DEMO">DEMO</SelectItem>
                  <SelectItem value="REAL">REAL</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <Button
                onClick={() => handleOrder("CALL")}
                disabled={submitting !== null}
                className="bg-bull text-bull-foreground hover:bg-bull/90 h-12 font-semibold"
              >
                {submitting === "CALL" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <ArrowUpRight className="h-4 w-4" /> CALL
                  </>
                )}
              </Button>
              <Button
                onClick={() => handleOrder("PUT")}
                disabled={submitting !== null}
                className="bg-bear text-bear-foreground hover:bg-bear/90 h-12 font-semibold"
              >
                {submitting === "PUT" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <ArrowDownRight className="h-4 w-4" /> PUT
                  </>
                )}
              </Button>
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}

function BalanceCard({
  label,
  value,
  active,
  tone,
}: {
  label: string;
  value: number;
  active: boolean;
  tone: "real" | "demo";
}) {
  return (
    <div
      className={`rounded-xl border p-6 transition ${
        active
          ? "border-primary/60 bg-card shadow-[0_0_0_1px_var(--primary)]"
          : "border-border bg-card"
      }`}
    >
      <p className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="text-3xl font-semibold mt-2 tabular-nums">
        {formatMoney(value)}
      </p>
      <p
        className={`text-xs mt-3 ${
          tone === "real" ? "text-bear" : "text-primary"
        }`}
      >
        {tone === "real" ? "Capital real disponível" : "Saldo de prática"}
      </p>
    </div>
  );
}
