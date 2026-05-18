import { api, setToken, clearToken } from "@/lib/api";

export interface LoginPayload {
  email: string;
  password: string;
}

interface ABLoginResponse {
  success?: boolean;
  message?: string;
  token?: string;
  data?: { token?: string; accessToken?: string };
  accessToken?: string;
}

export const authService = {
  async login(payload: LoginPayload): Promise<{ token: string }> {
    const { data } = await api.post<ABLoginResponse>("/auth/login", payload);
    const token =
      data.token ?? data.accessToken ?? data.data?.token ?? data.data?.accessToken;
    if (!token) {
      throw new Error(data.message ?? "Resposta de login sem token");
    }
    setToken(token);
    return { token };
  },
  logout() {
    clearToken();
  },
};
