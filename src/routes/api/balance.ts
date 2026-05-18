import { createFileRoute } from "@tanstack/react-router";
import { getUserByToken } from "@/lib/mockStore.server";

export const Route = createFileRoute("/api/balance")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const user = getUserByToken(request.headers.get("authorization"));
        if (!user) return new Response("Unauthorized", { status: 401 });
        return Response.json({
          balance_real: user.balance_real,
          balance_demo: user.balance_demo,
        });
      },
    },
  },
});
