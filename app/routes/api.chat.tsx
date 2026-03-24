import type { Route } from "./+types/api.chat";
import { postChat } from "~/lib/api/chat";
import { requireApiUser } from "~/lib/api/require-user";

export async function action(args: Route.ActionArgs) {
  const auth = await requireApiUser(args);
  if (auth instanceof Response) return auth;

  if (args.request.method !== "POST") {
    return new Response(null, { status: 405 });
  }

  return postChat(auth.userId, auth.env, args.request);
}

export default function ApiChatResource() {
  return null;
}
