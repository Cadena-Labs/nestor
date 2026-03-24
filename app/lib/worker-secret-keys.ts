/**
 * Worker env keys that can be supplied by 1Password (Connect item fields or Environments sync).
 * Excludes Cloudflare bindings (`DB`, `CHAT_RATE_LIMITER`) and Connect bootstrap vars (`CONNECT_*`).
 */
export const WORKER_SECRET_ENV_KEYS = [
  "CHAT_MAX_LOGS",
  "CHAT_MAX_STEPS",
  "CLERK_API_URL",
  "CLERK_DOMAIN",
  "CLERK_IS_SATELLITE",
  "CLERK_JWT_KEY",
  "CLERK_PROXY_URL",
  "CLERK_PUBLISHABLE_KEY",
  "CLERK_SECRET_KEY",
  "DISABLE_LOG_TOOLS",
  "ENCRYPTION_KEY",
  "MAX_TOOL_OUTPUT_CHARS",
] as const;

export type WorkerSecretEnvKey = (typeof WORKER_SECRET_ENV_KEYS)[number];
