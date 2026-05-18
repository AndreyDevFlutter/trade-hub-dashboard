// Simple in-memory mock store for the trading API.
// Replace with real broker API integration later.

export interface MockUser {
  email: string;
  password: string;
  name: string;
  avatar: string;
  balance_real: number;
  balance_demo: number;
}

const users: Record<string, MockUser> = {
  "trader@demo.com": {
    email: "trader@demo.com",
    password: "123456",
    name: "Trader Pro",
    avatar: "https://api.dicebear.com/9.x/avataaars/svg?seed=Trader",
    balance_real: 1500,
    balance_demo: 10000,
  },
};

// token -> email
const sessions: Record<string, string> = {};

export function loginUser(email: string, password: string): string | null {
  const u = users[email.toLowerCase()];
  if (!u || u.password !== password) return null;
  const token = `mock.${btoa(email + ":" + Date.now())}.jwt`;
  sessions[token] = u.email;
  return token;
}

export function getUserByToken(authHeader: string | null): MockUser | null {
  if (!authHeader) return null;
  const token = authHeader.replace(/^Bearer\s+/i, "");
  const email = sessions[token];
  if (!email) return null;
  return users[email] ?? null;
}

export function applyOrder(
  user: MockUser,
  amount: number,
  accountType: "DEMO" | "REAL",
): { win: boolean; new_balance: number } {
  const win = Math.random() > 0.45;
  const delta = win ? amount * 0.85 : -amount;
  if (accountType === "REAL") {
    user.balance_real = Math.max(0, user.balance_real + delta);
    return { win, new_balance: user.balance_real };
  }
  user.balance_demo = Math.max(0, user.balance_demo + delta);
  return { win, new_balance: user.balance_demo };
}
