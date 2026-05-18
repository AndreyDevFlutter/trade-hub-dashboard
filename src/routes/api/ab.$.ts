import { createFileRoute } from "@tanstack/react-router";

// Proxy genérico para a API da ActionBroker (contorna CORS do browser)
// /api/ab/<path>  ->  https://api.actionbroker.app/api/<path>
const UPSTREAM = "https://api.actionbroker.app/api";

async function proxy(request: Request, splat: string) {
  const url = new URL(request.url);
  const target = `${UPSTREAM}/${splat}${url.search}`;

  const headers = new Headers();
  const ct = request.headers.get("content-type");
  if (ct) headers.set("content-type", ct);
  const auth = request.headers.get("authorization");
  if (auth) headers.set("authorization", auth);
  headers.set("accept", "application/json");

  const init: RequestInit = { method: request.method, headers };
  if (!["GET", "HEAD"].includes(request.method)) {
    init.body = await request.arrayBuffer();
  }

  const res = await fetch(target, init);
  const body = await res.arrayBuffer();
  return new Response(body, {
    status: res.status,
    headers: {
      "Content-Type": res.headers.get("content-type") ?? "application/json",
      "Cache-Control": "no-store",
    },
  });
}

export const Route = createFileRoute("/api/ab/$")({
  server: {
    handlers: {
      GET: async ({ params, request }) => proxy(request, params._splat ?? ""),
      POST: async ({ params, request }) => proxy(request, params._splat ?? ""),
      PUT: async ({ params, request }) => proxy(request, params._splat ?? ""),
      PATCH: async ({ params, request }) => proxy(request, params._splat ?? ""),
      DELETE: async ({ params, request }) =>
        proxy(request, params._splat ?? ""),
    },
  },
});
