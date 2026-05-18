import { api, setToken, clearToken } from "@/lib/api";

export interface LoginPayload {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
}

export const authService = {
  async login(payload: LoginPayload): Promise<LoginResponse> {
    const { data } = await api.post<LoginResponse>("/login", payload);
    setToken(data.token);
    return data;
  },
  logout() {
    clearToken();
  },
};
