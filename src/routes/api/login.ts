import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { loginUser } from "@/lib/mockStore.server";

const schema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(1).max(255),
});

export const Route = createFileRoute("/api/login")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json();
          const parsed = schema.safeParse(body);
          if (!parsed.success) {
            return Response.json({ message: "Invalid payload" }, { status: 400 });
          }
          const token = loginUser(parsed.data.email, parsed.data.password);
          if (!token) {
            return Response.json({ message: "Credenciais inválidas" }, { status: 401 });
          }
          return Response.json({ token });
        } catch {
          return Response.json({ message: "Bad request" }, { status: 400 });
        }
      },
    },
  },
});
