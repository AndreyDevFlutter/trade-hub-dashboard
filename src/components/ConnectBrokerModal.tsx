import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Link2 } from "lucide-react";
import { authService } from "@/services/authService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConnected: () => void;
}

export function ConnectBrokerModal({ open, onOpenChange, onConnected }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accountType, setAccountType] = useState<"REAL" | "DEMO">("DEMO");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await authService.connectBroker({ email, password, account_type: accountType });
      toast.success("Corretora conectada com sucesso");
      onConnected();
      onOpenChange(false);
    } catch (err) {
      toast.error((err as Error)?.message ?? "Falha ao conectar corretora");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-primary" /> Conectar ActionBroker
          </DialogTitle>
          <DialogDescription>
            Informe suas credenciais da ActionBroker. Vamos guardar o token de forma
            segura no servidor — ele nunca passa pelo navegador.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label htmlFor="ab-email">Email da corretora</Label>
            <Input
              id="ab-email"
              type="email"
              autoComplete="off"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ab-password">Senha</Label>
            <Input
              id="ab-password"
              type="password"
              autoComplete="off"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ab-account">Conta padrão</Label>
            <select
              id="ab-account"
              value={accountType}
              onChange={(e) => setAccountType(e.target.value as "REAL" | "DEMO")}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="DEMO">DEMO</option>
              <option value="REAL">REAL</option>
            </select>
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Conectando...
              </>
            ) : (
              "Conectar corretora"
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
