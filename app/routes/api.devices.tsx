import type { Route } from "./+types/api.devices";
import { createDevice, listDevices } from "~/lib/api/devices";
import { requireApiUser } from "~/lib/api/require-user";

export async function loader(args: Route.LoaderArgs) {
  const auth = await requireApiUser(args);
  if (auth instanceof Response) return auth;
  return listDevices(auth.userId, auth.env);
}

export async function action(args: Route.ActionArgs) {
  const auth = await requireApiUser(args);
  if (auth instanceof Response) return auth;
  if (args.request.method !== "POST") {
    return new Response(null, { status: 405 });
  }
  return createDevice(auth.userId, auth.env, args.request);
}

export default function ApiDevicesResource() {
  return null;
}
