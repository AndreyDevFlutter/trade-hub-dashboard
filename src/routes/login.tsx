import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { authService } from "@/services/authService";
import { userService } from "@/services/userService";
import { useAuthStore } from "@/store/authStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TrendingUp, Loader2 } from "lucide-react";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Login — Trader Dashboard" },
      { name: "description", content: "Acesse seu painel de trading." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { token, setToken, setProfile } = useAuthStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (token) navigate({ to: "/dashboard" });
  }, [token, navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { token } = await authService.login({ email, password });
      setToken(token);
      const profile = await userService.getProfile();
      setProfile(profile);
      toast.success("Login realizado com sucesso");
      navigate({ to: "/dashboard" });
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Falha ao autenticar";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 bg-[radial-gradient(ellipse_at_top,var(--accent)_0%,transparent_55%)]">
      <div className="w-full max-w-md">
        <Link to="/" className="flex items-center gap-2 mb-8 justify-center">
          <TrendingUp className="h-7 w-7 text-primary" />
          <span className="text-xl font-semibold tracking-tight">TraderHub</span>
        </Link>
        <div className="bg-card border border-border rounded-xl p-8 shadow-2xl">
          <h1 className="text-2xl font-semibold">Entrar na plataforma</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Acesse com suas credenciais da corretora.
          </p>

          <form onSubmit={onSubmit} className="space-y-4 mt-6">
            <div className="space-y-2">
              <Label htmlFor="email">Email / Login</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Entrando...
                </>
              ) : (
                "Entrar"
              )}
            </Button>
          </form>

          <p className="text-xs text-muted-foreground mt-6 text-center">
            Use as credenciais ativas da corretora.
          </p>
        </div>
      </div>
    </main>
  );
}
