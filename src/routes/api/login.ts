import { createFileRoute } from "@tanstack/react-router";
import { setCookie } from "@tanstack/react-start/server";
import { z } from "zod";
import { brokerFetch, extractUpstreamCookies, SESSION_COOKIE } from "@/lib/broker.server";

const schema = z.object({
  email: z.string().min(1).max(255),
  password: z.string().min(1).max(255),
});

export const Route = createFileRoute("/api/login")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json({ message: "Bad request" }, { status: 400 });
        }
        const parsed = schema.safeParse(body);
        if (!parsed.success) {
          return Response.json({ message: "Dados inválidos" }, { status: 400 });
        }

        const upstream = await brokerFetch("/api/auth/login", {
          method: "POST",
          body: JSON.stringify(parsed.data),
        });
        const data = await upstream.json().catch(() => ({}));

        if (!upstream.ok) {
          return Response.json(
            { message: (data as { message?: string })?.message ?? "Credenciais inválidas" },
            { status: upstream.status },
          );
        }

        const cookieHeader = extractUpstreamCookies(upstream);
        if (cookieHeader) {
          setCookie(SESSION_COOKIE, cookieHeader, {
            httpOnly: true,
            secure: true,
            sameSite: "lax",
            path: "/",
            maxAge: 60 * 60 * 24 * 7,
          });
        }

        // Return a marker token so the client store stays compatible.
        // The real session lives in the httpOnly ab_session cookie.
        return Response.json({
          token: "session",
          user: (data as { user?: unknown })?.user ?? null,
        });
      },
    },
  },
});
