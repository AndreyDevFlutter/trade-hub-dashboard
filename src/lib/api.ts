import axios from "axios";
import { supabase } from "@/integrations/supabase/client";

export const api = axios.create({
  baseURL: "/api/ab",
  headers: { "Content-Type": "application/json" },
});

// Anexa o JWT do Supabase Auth (NUNCA o token da corretora).
// O proxy /api/ab valida o JWT e injeta o broker_token server-side.
api.interceptors.request.use(async (config) => {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  async (err) => {
    if (err?.response?.status === 401) {
      if (typeof window !== "undefined" && window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }
    return Promise.reject(err);
  },
);
