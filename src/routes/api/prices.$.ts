import { createFileRoute } from "@tanstack/react-router";

// Proxy para o servidor de cotações da ActionBroker
// /api/prices/<path>  ->  https://prices.actionbroker.app/<path>
const UPSTREAM = "https://prices.actionbroker.app";

async function proxy(request: Request, splat: string) {
  const url = new URL(request.url);
  const target = `${UPSTREAM}/${splat}${url.search}`;
  const headers = new Headers();
  headers.set("accept", "application/json");
  const res = await fetch(target, { method: request.method, headers });
  const body = await res.arrayBuffer();
  return new Response(body, {
    status: res.status,
    headers: {
      "Content-Type": res.headers.get("content-type") ?? "application/json",
      "Cache-Control": "no-store",
    },
  });
}

export const Route = createFileRoute("/api/prices/$")({
  server: {
    handlers: {
      GET: async ({ params, request }) => proxy(request, params._splat ?? ""),
    },
  },
});
