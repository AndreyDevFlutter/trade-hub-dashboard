import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { authService } from "@/services/authService";
import { useSession } from "@/hooks/use-session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TrendingUp, Loader2 } from "lucide-react";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Criar conta — TraderHub" },
      { name: "description", content: "Crie sua conta no TraderHub." },
    ],
  }),
  component: SignupPage,
});

function SignupPage() {
  const navigate = useNavigate();
  const { session } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (session) navigate({ to: "/dashboard" });
  }, [session, navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Senha precisa ter pelo menos 6 caracteres");
      return;
    }
    setLoading(true);
    try {
      const result = await authService.signUp({ email, password });
      if (result.session) {
        toast.success("Conta criada! Você já está logado.");
        navigate({ to: "/dashboard" });
      } else {
        toast.success(
          "Conta criada — verifique seu email para confirmar antes de entrar.",
        );
        navigate({ to: "/login" });
      }
    } catch (err) {
      toast.error((err as Error)?.message ?? "Falha ao criar conta");
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
          <h1 className="text-2xl font-semibold">Criar conta</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Esta é sua conta TraderHub. Você conectará a corretora depois.
          </p>

          <form onSubmit={onSubmit} className="space-y-4 mt-6">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
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
                autoComplete="new-password"
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Criando...
                </>
              ) : (
                "Criar conta"
              )}
            </Button>
          </form>

          <p className="text-xs text-muted-foreground mt-6 text-center">
            Já tem conta?{" "}
            <Link to="/login" className="text-primary hover:underline">
              Entrar
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
