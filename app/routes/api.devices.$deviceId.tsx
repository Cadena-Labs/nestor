import type { Route } from "./+types/api.devices.$deviceId";
import { deleteDevice, updateDevice } from "~/lib/api/devices";
import { requireApiUser } from "~/lib/api/require-user";

export async function action(args: Route.ActionArgs) {
  const auth = await requireApiUser(args);
  if (auth instanceof Response) return auth;

  const { deviceId } = args.params;
  if (!deviceId) {
    return Response.json({ error: "Missing device id" }, { status: 400 });
  }

  if (args.request.method === "PUT") {
    return updateDevice(auth.userId, auth.env, deviceId, args.request);
  }

  if (args.request.method === "DELETE") {
    return deleteDevice(auth.userId, auth.env, deviceId);
  }

  return new Response(null, { status: 405 });
}

export default function ApiDeviceResource() {
  return null;
}
