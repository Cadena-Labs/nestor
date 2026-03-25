// Vite-style `import.meta.env` and RR virtual/CSS modules without `types: ["vite/client"]`.
declare module "*.css";

declare module "virtual:react-router/server-build";

declare global {
  interface ImportMetaEnv {
    readonly MODE: string;
    readonly DEV: boolean;
    readonly PROD: boolean;
    readonly SSR: boolean;
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }

  interface Env {
    /**
     * When using 1Password Connect (`CONNECT_SERVER_URL` + token + vault/item IDs), load from the Connect item’s
     * custom fields instead of (or overriding) Worker secrets.
     */
    CONNECT_CACHE_SECONDS?: string;
    CONNECT_ITEM_ID?: string;
    CONNECT_SERVER_URL?: string;
    CONNECT_TOKEN?: string;
    CONNECT_VAULT_ID?: string;

    ENCRYPTION_KEY?: string;
    CLERK_SECRET_KEY?: string;
    CLERK_PUBLISHABLE_KEY?: string;
    CLERK_JWT_KEY?: string;
    CLERK_API_URL?: string;
    CLERK_DOMAIN?: string;
    CLERK_PROXY_URL?: string;
    CLERK_IS_SATELLITE?: string;
    /** Set to `1` or `true` to omit PAN-OS log query tools from the model. */
    DISABLE_LOG_TOOLS?: string;
    /** Max serialized characters per tool result (default 100000). */
    MAX_TOOL_OUTPUT_CHARS?: string;
    /** Max `streamText` tool round-trips (default 10, hard cap 25). */
    CHAT_MAX_STEPS?: string;
    /** Max `nlogs` / per-query log cap passed to PAN-OS (default 100). */
    CHAT_MAX_LOGS?: string;
  }
}

declare module "react-router" {
  export interface AppLoadContext {
    cloudflare: {
      env: Env;
      ctx: ExecutionContext;
    };
  }

  interface RouterContextProvider {
    cloudflare: {
      env: Env;
      ctx: ExecutionContext;
    };
  }
}

export {};
