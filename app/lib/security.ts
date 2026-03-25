import { z } from "zod";

export const MAX_CHAT_MESSAGES = 40;
export const MAX_CHAT_MESSAGE_LENGTH = 4000;
export const MAX_CONVERSATION_TITLE_LENGTH = 80;
export const MAX_DEVICE_NAME_LENGTH = 100;
export const MAX_MODEL_ID_LENGTH = 100;
export const MAX_API_KEY_LENGTH = 512;
export const MAX_LOG_QUERY_LENGTH = 512;
export const MAX_LOGS = 100;
export const CHAT_RATE_LIMIT_WINDOW_MS = 60_000;
export const CHAT_RATE_LIMIT_MAX_REQUESTS = 20;
export const PANOS_REQUEST_TIMEOUT_MS = 15_000;
/** Default cap on serialized tool result size (characters) sent to the LLM. */
export const DEFAULT_MAX_TOOL_OUTPUT_CHARS = 100_000;
export const CHAT_MAX_STEPS_HARD_CAP = 25;

export function parseEnvDisabled(raw: string | undefined): boolean {
  if (raw === undefined || raw === "") return false;
  const v = raw.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

export function resolveMaxToolOutputChars(env: { MAX_TOOL_OUTPUT_CHARS?: string }): number {
  const raw = env.MAX_TOOL_OUTPUT_CHARS?.trim();
  if (!raw) return DEFAULT_MAX_TOOL_OUTPUT_CHARS;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1_000) return DEFAULT_MAX_TOOL_OUTPUT_CHARS;
  return Math.min(n, 2_000_000);
}

export function resolveChatMaxSteps(env: { CHAT_MAX_STEPS?: string }): number {
  const raw = env.CHAT_MAX_STEPS?.trim();
  if (!raw) return 10;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return 10;
  return Math.min(n, CHAT_MAX_STEPS_HARD_CAP);
}

/** Caps the `maxLogs` tool parameter (1 .. MAX_LOGS). */
export function resolveChatMaxLogsPerQuery(env: { CHAT_MAX_LOGS?: string }): number {
  const raw = env.CHAT_MAX_LOGS?.trim();
  if (!raw) return MAX_LOGS;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return MAX_LOGS;
  return Math.min(n, MAX_LOGS);
}

const hostnameLabelRegex = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;
const ipv4Regex =
  /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;

function isBareHostname(value: string): boolean {
  if (value.length > 253) return false;

  return value.split(".").every((label) => hostnameLabelRegex.test(label));
}

function isIPv6Literal(value: string): boolean {
  if (!/^[0-9a-f:]+$/i.test(value)) return false;

  try {
    const url = new URL(`https://[${value}]/`);
    return url.hostname === `[${value.toLowerCase()}]`;
  } catch {
    return false;
  }
}

export function normalizeDeviceHost(value: string): string {
  const host = value.trim().toLowerCase();

  if (!host) {
    throw new Error("Host is required");
  }

  if (
    host.includes("://") ||
    host.includes("/") ||
    host.includes("?") ||
    host.includes("#") ||
    host.includes("@") ||
    host.startsWith("[") ||
    host.endsWith("]")
  ) {
    throw new Error("Host must be a bare hostname or IP literal");
  }

  if (host.includes(":")) {
    if (!isIPv6Literal(host)) {
      throw new Error("Host must not include a port");
    }

    return host;
  }

  if (ipv4Regex.test(host) || isBareHostname(host)) {
    return host;
  }

  throw new Error("Host must be a valid hostname or IP literal");
}

export const deviceHostSchema = z
  .string()
  .trim()
  .min(1)
  .max(253)
  .transform((value, ctx) => {
    try {
      return normalizeDeviceHost(value);
    } catch (error) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: error instanceof Error ? error.message : "Invalid host",
      });

      return z.NEVER;
    }
  });

function decodeBase64(value: string): Uint8Array {
  const normalized = value.trim().replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4;
  const padded =
    padding === 0 ? normalized : normalized.padEnd(normalized.length + (4 - padding), "=");

  let decoded: string;

  try {
    decoded = atob(padded);
  } catch {
    throw new Error("ENCRYPTION_KEY must be valid base64");
  }

  return Uint8Array.from(decoded, (char) => char.charCodeAt(0));
}

export function parseEncryptionKey(secret: string): Uint8Array {
  const key = decodeBase64(secret);

  if (key.length !== 32) {
    throw new Error("ENCRYPTION_KEY must decode to exactly 32 bytes");
  }

  return key;
}

/** Base URL for PAN-OS XML API (no query string — credentials go in POST body). */
export function buildPanosApiEndpoint(host: string): URL {
  const normalizedHost = normalizeDeviceHost(host);
  const authority = normalizedHost.includes(":")
    ? `[${normalizedHost}]`
    : normalizedHost;
  return new URL(`https://${authority}/api/`);
}

export function buildSecurityHeaders(isDev: boolean): Headers {
  const headers = new Headers();
  /** @see https://clerk.com/docs/security/clerk-csp — Clerk injects inline bootstrap scripts unless using nonce + strict-dynamic. */
  const scriptSrc = [
    "'self'",
    "'unsafe-inline'",
    "https://clerk.com",
    "https://*.clerk.com",
    "https://*.clerk.accounts.dev",
    "https://challenges.cloudflare.com",
  ];
  const connectSrc = [
    "'self'",
    "https://clerk.com",
    "https://*.clerk.com",
    "https://*.clerk.accounts.dev",
    "https://clerk-telemetry.com",
    "https://*.clerk-telemetry.com",
    "https://challenges.cloudflare.com",
    "wss://*.clerk.com",
    "wss://*.clerk.accounts.dev",
    "https://api.anthropic.com",
    "https://api.openai.com",
    "https://openrouter.ai",
    "https://*.openrouter.ai",
  ];
  const frameSrc = [
    "'self'",
    "https://challenges.cloudflare.com",
    "https://clerk.com",
    "https://*.clerk.com",
    "https://*.clerk.accounts.dev",
  ];

  if (isDev) {
    scriptSrc.push("'unsafe-eval'");
    connectSrc.push("ws:", "http://127.0.0.1", "http://localhost");
  }

  headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "base-uri 'self'",
      `script-src ${scriptSrc.join(" ")}`,
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: https: https://img.clerk.com",
      `connect-src ${connectSrc.join(" ")}`,
      "worker-src 'self' blob:",
      `frame-src ${frameSrc.join(" ")}`,
      "object-src 'none'",
      "frame-ancestors 'none'",
      "form-action 'self' https://clerk.com https://*.clerk.com https://*.clerk.accounts.dev",
    ].join("; ")
  );
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  return headers;
}

type RateLimitState = {
  count: number;
  resetAt: number;
};

const globalRateLimitStore = globalThis as typeof globalThis & {
  __nestorChatRateLimitStore?: Map<string, RateLimitState>;
};

function getRateLimitStore(): Map<string, RateLimitState> {
  if (!globalRateLimitStore.__nestorChatRateLimitStore) {
    globalRateLimitStore.__nestorChatRateLimitStore = new Map();
  }

  return globalRateLimitStore.__nestorChatRateLimitStore;
}

export function checkChatRateLimit(
  key: string,
  now: number = Date.now()
): { allowed: boolean; retryAfterSeconds?: number } {
  const store = getRateLimitStore();
  const current = store.get(key);

  if (!current || current.resetAt <= now) {
    store.set(key, {
      count: 1,
      resetAt: now + CHAT_RATE_LIMIT_WINDOW_MS,
    });

    return { allowed: true };
  }

  if (current.count >= CHAT_RATE_LIMIT_MAX_REQUESTS) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
    };
  }

  current.count += 1;
  store.set(key, current);
  return { allowed: true };
}

/** Durable Object-backed limiter when `CHAT_RATE_LIMITER` is bound; otherwise in-memory (tests / minimal setups). */
export async function checkChatRateLimitRemote(
  env: Env,
  key: string,
  now: number = Date.now()
): Promise<{ allowed: boolean; retryAfterSeconds?: number }> {
  const ns = env.CHAT_RATE_LIMITER;
  if (!ns) {
    return checkChatRateLimit(key, now);
  }

  try {
    const id = ns.idFromName(key);
    const stub = ns.get(id);
    const res = await stub.fetch("https://rate/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        maxRequests: CHAT_RATE_LIMIT_MAX_REQUESTS,
        windowMs: CHAT_RATE_LIMIT_WINDOW_MS,
      }),
    });

    const data = (await res.json()) as {
      allowed?: boolean;
      retryAfterSeconds?: number;
    };

    if (typeof data.allowed === "boolean") {
      return {
        allowed: data.allowed,
        retryAfterSeconds: data.retryAfterSeconds,
      };
    }
  } catch {
    /* fall through */
  }

  return checkChatRateLimit(key, now);
}
