import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { TrendingUp, ArrowRight, Shield, Zap, LineChart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/authStore";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TraderHub — Painel de Trading" },
      {
        name: "description",
        content:
          "Painel profissional para operar via API com autenticação JWT, contas REAL e DEMO.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  const navigate = useNavigate();
  const token = useAuthStore((s) => s.token);
  useEffect(() => {
    if (token) navigate({ to: "/dashboard" });
  }, [token, navigate]);

  return (
    <main className="min-h-screen">
      <header className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-6 w-6 text-primary" />
          <span className="font-semibold tracking-tight">TraderHub</span>
        </div>
        <Link to="/login">
          <Button variant="secondary" size="sm">
            Entrar
          </Button>
        </Link>
      </header>

      <section className="max-w-6xl mx-auto px-6 pt-20 pb-24 text-center">
        <span className="inline-block text-xs uppercase tracking-[0.2em] text-primary mb-4">
          API · JWT · Mock-ready
        </span>
        <h1 className="text-4xl sm:text-6xl font-semibold tracking-tight max-w-3xl mx-auto">
          Opere em CALL ou PUT direto da sua conta de corretora.
        </h1>
        <p className="text-muted-foreground mt-5 max-w-xl mx-auto">
          Painel limpo, escuro, com troca instantânea entre conta REAL e DEMO.
          Estrutura preparada para conectar em endpoints reais.
        </p>
        <div className="mt-8 flex gap-3 justify-center">
          <Link to="/login">
            <Button size="lg">
              Acessar painel <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>

        <div className="grid sm:grid-cols-3 gap-4 mt-20 text-left">
          <Feature
            icon={<Shield className="h-5 w-5 text-primary" />}
            title="Auth JWT"
            desc="Token armazenado e injetado em todas as chamadas via interceptor Axios."
          />
          <Feature
            icon={<Zap className="h-5 w-5 text-primary" />}
            title="Ordens instantâneas"
            desc="Envio autenticado para o endpoint /api/order com atualização de saldo."
          />
          <Feature
            icon={<LineChart className="h-5 w-5 text-primary" />}
            title="REAL ou DEMO"
            desc="Alterne o tipo de conta a qualquer momento, sem perder a sessão."
          />
        </div>
      </section>
    </main>
  );
}

function Feature({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="h-9 w-9 rounded-md bg-secondary flex items-center justify-center">
        {icon}
      </div>
      <h3 className="font-semibold mt-4">{title}</h3>
      <p className="text-sm text-muted-foreground mt-1">{desc}</p>
    </div>
  );
}
