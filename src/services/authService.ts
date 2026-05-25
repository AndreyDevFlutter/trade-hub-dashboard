import { supabase } from "@/integrations/supabase/client";

export interface AuthCredentials {
  email: string;
  password: string;
}

export const authService = {
  async signUp({ email, password }: AuthCredentials) {
    const redirectTo =
      typeof window !== "undefined" ? `${window.location.origin}/dashboard` : undefined;
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: redirectTo },
    });
    if (error) throw error;
    return data;
  },
  async signIn({ email, password }: AuthCredentials) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  },
  async signOut() {
    await supabase.auth.signOut();
  },
  async connectBroker(payload: AuthCredentials & { account_type?: "REAL" | "DEMO" }) {
    const { data: sess } = await supabase.auth.getSession();
    const token = sess.session?.access_token;
    if (!token) throw new Error("Sessão expirada — entre novamente.");
    const res = await fetch("/api/connect-broker", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    const data = (await res.json().catch(() => ({}))) as { message?: string; success?: boolean };
    if (!res.ok) throw new Error(data.message ?? "Falha ao conectar corretora");
    return data;
  },
};
