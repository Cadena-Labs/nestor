import type { Route } from "./+types/api.conversations.$conversationId";
import { deleteConversation } from "~/lib/api/conversations";
import { requireApiUser } from "~/lib/api/require-user";

export async function action(args: Route.ActionArgs) {
  const auth = await requireApiUser(args);
  if (auth instanceof Response) return auth;

  const { conversationId } = args.params;
  if (!conversationId) {
    return Response.json({ error: "Missing conversation id" }, { status: 400 });
  }

  if (args.request.method !== "DELETE") {
    return new Response(null, { status: 405 });
  }

  return deleteConversation(auth.userId, auth.env, conversationId);
}

export default function ApiConversationResource() {
  return null;
}
