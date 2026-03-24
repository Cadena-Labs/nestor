import { recordAuditEvent } from "../audit";
import { CURRENT_KEY_VERSION, encryptUserSecret } from "../encryption";
import { deviceCreateSchema, deviceUpdateSchema } from "../validation";

export async function listDevices(userId: string, env: Env): Promise<Response> {
  const db = env.DB;

  const { results } = await db
    .prepare(
      "SELECT id, name, host, created_at, updated_at FROM devices WHERE user_id = ? ORDER BY created_at DESC"
    )
    .bind(userId)
    .all<{ id: string; name: string; host: string; created_at: string; updated_at: string }>();

  return Response.json(results);
}

export async function createDevice(
  userId: string,
  env: Env,
  request: Request
): Promise<Response> {
  const db = env.DB;
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = deviceCreateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid device" },
      { status: 400 }
    );
  }

  const data = parsed.data;

  const encryptionKey = env.ENCRYPTION_KEY;
  if (!encryptionKey) {
    return Response.json({ error: "Encryption not configured" }, { status: 500 });
  }

  const id = crypto.randomUUID();
  const encryptedKey = await encryptUserSecret(
    data.apiKey,
    encryptionKey,
    userId
  );

  await db
    .prepare(
      "INSERT INTO devices (id, user_id, name, host, api_key_encrypted, key_version) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .bind(
      id,
      userId,
      data.name,
      data.host,
      encryptedKey,
      CURRENT_KEY_VERSION
    )
    .run();

  await recordAuditEvent(db, userId, "device_create", {
    type: "device",
    id,
  });

  return Response.json({ id, name: data.name, host: data.host }, { status: 201 });
}

export async function updateDevice(
  userId: string,
  env: Env,
  deviceId: string,
  request: Request
): Promise<Response> {
  const db = env.DB;
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = deviceUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid device" },
      { status: 400 }
    );
  }

  const data = parsed.data;

  const encryptionKey = env.ENCRYPTION_KEY;
  if (!encryptionKey) {
    return Response.json({ error: "Encryption not configured" }, { status: 500 });
  }

  const device = await db
    .prepare("SELECT id FROM devices WHERE id = ? AND user_id = ?")
    .bind(deviceId, userId)
    .first();

  if (!device) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  if (data.apiKey) {
    const encryptedKey = await encryptUserSecret(
      data.apiKey,
      encryptionKey,
      userId
    );
    await db
      .prepare(
        "UPDATE devices SET name = ?, host = ?, api_key_encrypted = ?, key_version = ?, updated_at = datetime('now') WHERE id = ?"
      )
      .bind(
        data.name,
        data.host,
        encryptedKey,
        CURRENT_KEY_VERSION,
        deviceId
      )
      .run();
  } else {
    await db
      .prepare(
        "UPDATE devices SET name = ?, host = ?, updated_at = datetime('now') WHERE id = ?"
      )
      .bind(data.name, data.host, deviceId)
      .run();
  }

  await recordAuditEvent(db, userId, "device_update", {
    type: "device",
    id: deviceId,
  });

  return Response.json({ ok: true });
}

export async function deleteDevice(
  userId: string,
  env: Env,
  deviceId: string
): Promise<Response> {
  const db = env.DB;

  await db
    .prepare("DELETE FROM devices WHERE id = ? AND user_id = ?")
    .bind(deviceId, userId)
    .run();

  await recordAuditEvent(db, userId, "device_delete", {
    type: "device",
    id: deviceId,
  });

  return Response.json({ ok: true });
}
