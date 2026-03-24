import type { Route } from "./+types/api.conversations";
import { createConversation, listConversations } from "~/lib/api/conversations";
import { requireApiUser } from "~/lib/api/require-user";

export async function loader(args: Route.LoaderArgs) {
  const auth = await requireApiUser(args);
  if (auth instanceof Response) return auth;
  const url = new URL(args.request.url);
  const deviceId = url.searchParams.get("deviceId");
  return listConversations(auth.userId, auth.env, deviceId);
}

export async function action(args: Route.ActionArgs) {
  const auth = await requireApiUser(args);
  if (auth instanceof Response) return auth;
  if (args.request.method !== "POST") {
    return new Response(null, { status: 405 });
  }
  return createConversation(auth.userId, auth.env, args.request);
}

export default function ApiConversationsResource() {
  return null;
}
