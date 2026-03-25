import { recordAuditEvent } from "../audit";
import { CURRENT_KEY_VERSION, encryptUserSecret } from "../encryption";
import { type Provider } from "../ai-provider";
import {
  applyProviderKeyUpdates,
  buildProviderKeyUpdates,
  createEmptyKeysConfigured,
  deriveNextModelId,
  type ProviderKeyUpdates,
} from "../settings-state";
import { settingsSchema } from "../validation";

export async function getSettings(userId: string, env: Env): Promise<Response> {
  const db = env.DB;

  const row = await db
    .prepare("SELECT provider, model_id FROM user_settings WHERE user_id = ?")
    .bind(userId)
    .first<{ provider: Provider; model_id: string }>();

  const { results } = await db
    .prepare("SELECT provider FROM user_provider_api_keys WHERE user_id = ?")
    .bind(userId)
    .all<{ provider: string }>();

  const keysConfigured = createEmptyKeysConfigured(results);

  if (!row) {
    return Response.json({ provider: null, modelId: null, keysConfigured });
  }

  return Response.json({
    provider: row.provider,
    modelId: row.model_id,
    keysConfigured,
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
  const providerKeyUpdates = buildProviderKeyUpdates(
    data.provider,
    data.apiKey,
    data.providerKeys as ProviderKeyUpdates | undefined
  );
  const hasProviderKeyUpdates = Object.keys(providerKeyUpdates).length > 0;

  const encryptionKey = env.ENCRYPTION_KEY;
  if (hasProviderKeyUpdates && !encryptionKey) {
    return Response.json({ error: "Encryption not configured" }, { status: 500 });
  }

  const existing = await db
    .prepare("SELECT user_id, provider, model_id FROM user_settings WHERE user_id = ?")
    .bind(userId)
    .first<{ user_id: string; provider: Provider; model_id: string }>();

  const { results } = await db
    .prepare("SELECT provider FROM user_provider_api_keys WHERE user_id = ?")
    .bind(userId)
    .all<{ provider: string }>();

  const keysConfigured = applyProviderKeyUpdates(
    createEmptyKeysConfigured(results),
    providerKeyUpdates
  );
  const nextModelId = deriveNextModelId({
    currentProvider: existing?.provider,
    nextProvider: data.provider,
    currentModelId: existing?.model_id,
    requestedModelId: data.modelId,
  });

  if (!keysConfigured[data.provider]) {
    return Response.json(
      { error: "The selected provider needs an API key before you can save settings" },
      { status: 400 }
    );
  }

  for (const [provider, value] of Object.entries(providerKeyUpdates) as Array<
    [Provider, string | null]
  >) {
    if (value === null) {
      await db
        .prepare(
          "DELETE FROM user_provider_api_keys WHERE user_id = ? AND provider = ?"
        )
        .bind(userId, provider)
        .run();

      await recordAuditEvent(db, userId, "settings_provider_key_delete", {
        type: "provider_api_key",
        id: provider,
      });
      continue;
    }

    const encryptedKey = await encryptUserSecret(
      value,
      encryptionKey!,
      userId
    );

    await db
      .prepare(
        `INSERT INTO user_provider_api_keys (user_id, provider, api_key_encrypted, key_version)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(user_id, provider) DO UPDATE SET
           api_key_encrypted = excluded.api_key_encrypted,
           key_version = excluded.key_version,
           updated_at = datetime('now')`
      )
      .bind(userId, provider, encryptedKey, CURRENT_KEY_VERSION)
      .run();

    await recordAuditEvent(db, userId, "settings_provider_key_set", {
      type: "provider_api_key",
      id: provider,
    });
  }

  if (existing) {
    await db
      .prepare(
        "UPDATE user_settings SET provider = ?, model_id = ?, updated_at = datetime('now') WHERE user_id = ?"
      )
      .bind(data.provider, nextModelId, userId)
      .run();
  } else {
    await db
      .prepare(
        "INSERT INTO user_settings (user_id, provider, model_id) VALUES (?, ?, ?)"
      )
      .bind(
        userId,
        data.provider,
        nextModelId
      )
      .run();
  }

  await recordAuditEvent(
    db,
    userId,
    hasProviderKeyUpdates ? "settings_update_api_keys" : "settings_update",
    { type: "user_settings", id: userId }
  );

  return Response.json({ ok: true });
}
