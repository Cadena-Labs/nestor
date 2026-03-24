import type { Route } from "./+types/api.conversations.$conversationId.messages";
import { appendUserMessage, listMessages } from "~/lib/api/conversations";
import { requireApiUser } from "~/lib/api/require-user";

export async function loader(args: Route.LoaderArgs) {
  const auth = await requireApiUser(args);
  if (auth instanceof Response) return auth;

  const { conversationId } = args.params;
  if (!conversationId) {
    return Response.json({ error: "Missing conversation id" }, { status: 400 });
  }

  return listMessages(auth.userId, auth.env, conversationId);
}

export async function action(args: Route.ActionArgs) {
  const auth = await requireApiUser(args);
  if (auth instanceof Response) return auth;

  const { conversationId } = args.params;
  if (!conversationId) {
    return Response.json({ error: "Missing conversation id" }, { status: 400 });
  }

  if (args.request.method !== "POST") {
    return new Response(null, { status: 405 });
  }

  return appendUserMessage(auth.userId, auth.env, conversationId, args.request);
}

export default function ApiConversationMessagesResource() {
  return null;
}
