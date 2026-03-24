import { recordAuditEvent } from "../audit";
import { CURRENT_KEY_VERSION, encryptUserSecret } from "../encryption";
import { settingsSchema } from "../validation";

export async function getSettings(userId: string, env: Env): Promise<Response> {
  const db = env.DB;

  const row = await db
    .prepare("SELECT provider, model_id, api_key_encrypted FROM user_settings WHERE user_id = ?")
    .bind(userId)
    .first<{ provider: string; model_id: string; api_key_encrypted: string }>();

  if (!row) {
    return Response.json({ provider: null, modelId: null, hasApiKey: false });
  }

  return Response.json({
    provider: row.provider,
    modelId: row.model_id,
    hasApiKey: !!row.api_key_encrypted,
  });
}

export async function putSettings(
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

  const parsed = settingsSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid settings" },
      { status: 400 }
    );
  }

  const data = parsed.data;

  const encryptionKey = env.ENCRYPTION_KEY;
  if (!encryptionKey) {
    return Response.json({ error: "Encryption not configured" }, { status: 500 });
  }

  const existing = await db
    .prepare("SELECT user_id FROM user_settings WHERE user_id = ?")
    .bind(userId)
    .first();

  if (data.apiKey) {
    const encryptedKey = await encryptUserSecret(
      data.apiKey,
      encryptionKey,
      userId
    );

    if (existing) {
      await db
        .prepare(
          "UPDATE user_settings SET provider = ?, model_id = ?, api_key_encrypted = ?, key_version = ?, updated_at = datetime('now') WHERE user_id = ?"
        )
        .bind(
          data.provider,
          data.modelId,
          encryptedKey,
          CURRENT_KEY_VERSION,
          userId
        )
        .run();
    } else {
      await db
        .prepare(
          "INSERT INTO user_settings (user_id, provider, model_id, api_key_encrypted, key_version) VALUES (?, ?, ?, ?, ?)"
        )
        .bind(
          userId,
          data.provider,
          data.modelId,
          encryptedKey,
          CURRENT_KEY_VERSION
        )
        .run();
    }
  } else if (existing) {
    await db
      .prepare(
        "UPDATE user_settings SET provider = ?, model_id = ?, updated_at = datetime('now') WHERE user_id = ?"
      )
      .bind(data.provider, data.modelId, userId)
      .run();
  } else {
    return Response.json(
      { error: "API key is required when creating settings" },
      { status: 400 }
    );
  }

  await recordAuditEvent(
    db,
    userId,
    data.apiKey ? "settings_update_api_key" : "settings_update",
    { type: "user_settings", id: userId }
  );

  return Response.json({ ok: true });
}
