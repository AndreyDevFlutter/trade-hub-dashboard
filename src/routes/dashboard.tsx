import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { LogOut, TrendingUp, Wifi, Loader2 } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { userService } from "@/services/userService";
import { authService } from "@/services/authService";
import { actionbrokerService, type ABAsset } from "@/services/actionbrokerService";
import { Button } from "@/components/ui/button";
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
  return v.toLocaleString("pt-BR", {
    style: "currency",
    currency: "USD",
  });
}

function DashboardPage() {
  const navigate = useNavigate();
  const { token, profile, accountType, setAccountType, setProfile, logout } = useAuthStore();
  const [assets, setAssets] = useState<ABAsset[]>([]);
  const [assetsLoading, setAssetsLoading] = useState(true);
  const [online, setOnline] = useState<number | null>(null);

  async function refreshAccount(syncAccountType = false) {
    const freshProfile = await userService.getProfile();
    setProfile(freshProfile);
    if (syncAccountType) setAccountType(freshProfile.account_type);
    return freshProfile;
  }

  async function refreshAssets() {
    setAssetsLoading(true);
    try {
      const list = await actionbrokerService.listAssets();
      setAssets(list.filter((a) => a.isActive));
    } catch {
      setAssets([]);
      toast.error("Falha ao carregar ativos");
    } finally {
      setAssetsLoading(false);
    }
  }

  useEffect(() => {
    refreshAssets();
    actionbrokerService.onlineUsers().then(setOnline).catch(() => {});
  }, []);

  useEffect(() => {
    if (!token) {
      navigate({ to: "/login" });
      return;
    }
    refreshAccount(true).catch(() => {
      toast.error("Falha ao carregar perfil");
      logout();
      navigate({ to: "/login" });
    });
    const interval = window.setInterval(() => {
      refreshAccount().catch(() => {});
    }, 5000);
    return () => window.clearInterval(interval);
  }, [token, navigate, setAccountType, setProfile, logout]);

  function handleLogout() {
    authService.logout();
    logout();
    navigate({ to: "/login" });
  }

  const activeBalance = profile
    ? accountType === "REAL"
      ? profile.balance_real
      : profile.balance_demo
    : 0;

  const assetGroups = useMemo(() => {
    return assets.reduce<Record<string, ABAsset[]>>((acc, item) => {
      const key = item.category || item.type || "Ativos";
      acc[key] = acc[key] ?? [];
      acc[key].push(item);
      return acc;
    }, {});
  }, [assets]);

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
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
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline ml-1">Sair</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <section className="grid gap-4 md:grid-cols-3">
          <BalanceCard label="Conta REAL" value={profile.balance_real} active={accountType === "REAL"} tone="real" />
          <BalanceCard label="Conta DEMO" value={profile.balance_demo} active={accountType === "DEMO"} tone="demo" />
          <div className="bg-card border border-border rounded-xl p-6">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Conta ativa</p>
            <p className="text-xl font-semibold mt-2">{accountType} · {formatMoney(activeBalance)}</p>
            <p className="text-xs text-muted-foreground mt-3">Saldo sincronizado com a corretora.</p>
          </div>
        </section>

        <section className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold">Ativos da corretora</h1>
              <p className="text-sm text-muted-foreground mt-1">Lista sincronizada diretamente da plataforma.</p>
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
            <p className="text-sm text-muted-foreground py-10">Nenhum ativo retornado pela corretora.</p>
          ) : (
            <div className="mt-6 space-y-6">
              {Object.entries(assetGroups).map(([group, list]) => (
                <div key={group} className="space-y-3">
                  <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{group}</h2>
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

function AssetCard({ asset }: { asset: ABAsset }) {
  const price = Number(asset.lastPrice);
  return (
    <article className="rounded-xl border border-border bg-background/40 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">{asset.symbol}</h3>
          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{asset.name}</p>
        </div>
        <span className={`text-xs px-2 py-1 rounded-md ${asset.isOpen ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
          {asset.isOpen ? "Aberto" : "Fechado"}
        </span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">Preço</p>
          <p className="font-medium tabular-nums">{Number.isFinite(price) && price > 0 ? price : "—"}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Payout</p>
          <p className="font-medium tabular-nums">{asset.payout}%</p>
        </div>
      </div>
    </article>
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
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-3xl font-semibold mt-2 tabular-nums">{formatMoney(value)}</p>
      <p className={`text-xs mt-3 ${tone === "real" ? "text-bear" : "text-primary"}`}>
        {tone === "real" ? "Capital real disponível" : "Saldo de prática"}
      </p>
    </div>
  );
}
