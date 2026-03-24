import { getAuth } from "@clerk/react-router/server";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

type ApiArgs = LoaderFunctionArgs | ActionFunctionArgs;

export async function requireApiUser(
  args: ApiArgs
): Promise<{ userId: string; env: Env } | Response> {
  const env = args.context.cloudflare.env;
  if (!env.CLERK_SECRET_KEY) {
    return Response.json(
      { error: "Clerk backend auth is not configured" },
      { status: 500 }
    );
  }

  try {
    const { isAuthenticated, userId } = await getAuth(args);
    if (!isAuthenticated || !userId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    return { userId, env };
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}
