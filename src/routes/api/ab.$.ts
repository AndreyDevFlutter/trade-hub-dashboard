import { createFileRoute } from "@tanstack/react-router";

// Proxy genérico para a API pública da ActionBroker
// Uso no front: fetch("/api/ab/public/assets") -> proxia para
// https://api.actionbroker.app/api/public/assets
const UPSTREAM = "https://api.actionbroker.app/api";

export const Route = createFileRoute("/api/ab/$")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const path = params._splat ?? "";
        const url = new URL(request.url);
        const target = `${UPSTREAM}/${path}${url.search}`;
        const res = await fetch(target, {
          headers: { accept: "application/json" },
        });
        const body = await res.text();
        return new Response(body, {
          status: res.status,
          headers: {
            "Content-Type":
              res.headers.get("content-type") ?? "application/json",
            "Cache-Control": "no-store",
          },
        });
      },
    },
  },
});
