import type { Route } from "./+types/api.settings";
import { getSettings, putSettings } from "~/lib/api/settings";
import { requireApiUser } from "~/lib/api/require-user";

export async function loader(args: Route.LoaderArgs) {
  const auth = await requireApiUser(args);
  if (auth instanceof Response) return auth;
  return getSettings(auth.userId, auth.env);
}

export async function action(args: Route.ActionArgs) {
  const auth = await requireApiUser(args);
  if (auth instanceof Response) return auth;
  if (args.request.method !== "PUT") {
    return new Response(null, { status: 405 });
  }
  return putSettings(auth.userId, auth.env, args.request);
}

export default function ApiSettingsResource() {
  return null;
}
