/**
 * Load application secrets from a self-hosted [1Password Connect](https://developer.1password.com/docs/connect/)
 * server at runtime (plain `fetch` — avoids @1password/connect’s Node/stream/axios stack, which does not run on Workers).
 *
 * Configure one 1Password item (e.g. category **Server** or **API Credential**) in a vault the Connect server can
 * read. Add **custom fields** whose **labels** match Worker env names (`ENCRYPTION_KEY`, `CLERK_SECRET_KEY`, …).
 * Use type **text** or **concealed** for values. See allowlist below.
 *
 * API: `GET {CONNECT_SERVER_URL}/v1/vaults/{vaultId}/items/{itemId}` with `Authorization: Bearer {CONNECT_TOKEN}`.
 * @see https://developer.1password.com/docs/connect/api-reference/
 */

import { WORKER_SECRET_ENV_KEYS } from "./worker-secret-keys";

const ALLOWED = new Set<string>(WORKER_SECRET_ENV_KEYS);

const LABEL_RE = /^[A-Z][A-Z0-9_]*$/;

type ConnectField = {
  label?: string;
  value?: string;
  type?: string;
  purpose?: string;
};

function readLabel(field: ConnectField): string | undefined {
  const raw = field.label;
  return typeof raw === "string" && raw.length > 0 ? raw : undefined;
}

function readValue(field: ConnectField): string | undefined {
  const raw = field.value;
  return typeof raw === "string" ? raw : undefined;
}

/**
 * Maps Connect item `fields` to env-style keys by field label (must match allowlist and `LABEL_RE`).
 */
export function connectItemFieldsToSecrets(item: unknown): Record<string, string> {
  if (item === null || typeof item !== "object") {
    return {};
  }

  const fields = (item as { fields?: unknown }).fields;
  if (!Array.isArray(fields)) {
    return {};
  }

  const out: Record<string, string> = {};

  for (const raw of fields) {
    if (raw === null || typeof raw !== "object") continue;
    const field = raw as ConnectField;
    const label = readLabel(field);
    const value = readValue(field);
    if (!label || value === undefined || value === "") continue;
    if (!LABEL_RE.test(label) || !ALLOWED.has(label)) continue;
    out[label] = value;
  }

  return out;
}

function connectConfigured(env: Env): env is Env & {
  CONNECT_SERVER_URL: string;
  CONNECT_TOKEN: string;
  CONNECT_VAULT_ID: string;
  CONNECT_ITEM_ID: string;
} {
  const base = env.CONNECT_SERVER_URL?.trim();
  const token = env.CONNECT_TOKEN?.trim();
  const vault = env.CONNECT_VAULT_ID?.trim();
  const item = env.CONNECT_ITEM_ID?.trim();
  return Boolean(base && token && vault && item);
}

function cacheTtlMs(env: Env): number {
  const raw = env.CONNECT_CACHE_SECONDS?.trim();
  if (!raw) return 300_000;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 0) return 300_000;
  return Math.min(n * 1000, 3_600_000);
}

let cache: { secrets: Record<string, string>; expiresAt: number } | null = null;

async function fetchConnectItemJson(
  baseUrl: string,
  token: string,
  vaultId: string,
  itemId: string
): Promise<unknown> {
  const base = baseUrl.replace(/\/+$/, "");
  const url = `${base}/v1/vaults/${encodeURIComponent(vaultId)}/items/${encodeURIComponent(itemId)}`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    const body = await res.text();
    const snippet = body.length > 200 ? `${body.slice(0, 200)}…` : body;
    throw new Error(`Connect API ${res.status} for item: ${snippet}`);
  }

  return (await res.json()) as unknown;
}

/**
 * When Connect env vars are set, fetches the configured item and merges allowlisted field values onto `env`.
 * Caches merged secret fields per isolate (TTL from `CONNECT_CACHE_SECONDS`, default 300s).
 */
export async function resolveEnvWithConnect(env: Env): Promise<Env> {
  if (!connectConfigured(env)) {
    return env;
  }

  const ttl = cacheTtlMs(env);
  const now = Date.now();
  if (cache && cache.expiresAt > now) {
    return { ...env, ...cache.secrets };
  }

  const item = await fetchConnectItemJson(
    env.CONNECT_SERVER_URL,
    env.CONNECT_TOKEN,
    env.CONNECT_VAULT_ID,
    env.CONNECT_ITEM_ID
  );

  const secrets = connectItemFieldsToSecrets(item);
  cache = { secrets, expiresAt: now + ttl };

  return { ...env, ...secrets };
}
