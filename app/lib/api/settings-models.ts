import { PROVIDERS, type Provider } from "../ai-provider";
import { listProviderModels } from "../list-provider-models";
import { decryptProviderApiKey } from "../user-secret-upgrade";

export async function getSettingsModels(
  userId: string,
  env: Env,
  request: Request
): Promise<Response> {
  const db = env.DB;
  const url = new URL(request.url);
  const providerParam = url.searchParams.get("provider");

  if (!providerParam || !(providerParam in PROVIDERS)) {
    return Response.json({ error: "Invalid provider" }, { status: 400 });
  }

  const provider = providerParam as Provider;
  const encryptionKey = env.ENCRYPTION_KEY;
  if (!encryptionKey) {
    return Response.json({ error: "Encryption not configured" }, { status: 500 });
  }

  const settings = await db
    .prepare("SELECT provider, model_id FROM user_settings WHERE user_id = ?")
    .bind(userId)
    .first<{ provider: Provider; model_id: string }>();

  const keyRow = await db
    .prepare(
      "SELECT api_key_encrypted, key_version FROM user_provider_api_keys WHERE user_id = ? AND provider = ?"
    )
    .bind(userId, provider)
    .first<{ api_key_encrypted: string; key_version: number }>();

  if (!keyRow) {
    return Response.json(
      { error: "Save an API key for this provider first" },
      { status: 400 }
    );
  }

  const apiKey = await decryptProviderApiKey(
    db,
    encryptionKey,
    userId,
    provider,
    keyRow.api_key_encrypted,
    keyRow.key_version
  );

  try {
    const models = await listProviderModels(
      provider,
      apiKey,
      settings?.provider === provider ? settings.model_id : undefined
    );

    return Response.json({ models });
  } catch {
    return Response.json(
      { error: `Failed to load ${PROVIDERS[provider].label} models` },
      { status: 502 }
    );
  }
}
