// Server-only helpers to proxy requests to Action Broker.
export const BROKER_BASE = "https://api.actionbroker.app";
export const SESSION_COOKIE = "ab_session";

/**
 * Extracts the upstream Cookie header value from incoming Set-Cookie headers.
 * Action Broker login responds with httpOnly cookies (session_id, auth_refresh_token).
 * We capture them as a single "name=value; name=value" string we can replay.
 */
export function extractUpstreamCookies(res: Response): string | null {
  // @ts-expect-error - getSetCookie is standard but not in lib.dom yet
  const all: string[] = res.headers.getSetCookie?.() ?? [];
  if (!all.length) {
    const single = res.headers.get("set-cookie");
    if (single) all.push(single);
  }
  const pairs: string[] = [];
  for (const raw of all) {
    const first = raw.split(";")[0]?.trim();
    if (first) pairs.push(first);
  }
  return pairs.length ? pairs.join("; ") : null;
}

export async function brokerFetch(
  path: string,
  init: RequestInit & { cookieHeader?: string | null } = {},
) {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }
  if (init.cookieHeader) headers.set("Cookie", init.cookieHeader);
  return fetch(`${BROKER_BASE}${path}`, { ...init, headers });
}
