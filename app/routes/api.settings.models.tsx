import type { Route } from "./+types/api.settings.models";
import { getSettingsModels } from "~/lib/api/settings-models";
import { requireApiUser } from "~/lib/api/require-user";

export async function loader(args: Route.LoaderArgs) {
  const auth = await requireApiUser(args);
  if (auth instanceof Response) return auth;
  return getSettingsModels(auth.userId, auth.env, args.request);
}

export default function ApiSettingsModelsResource() {
  return null;
}
