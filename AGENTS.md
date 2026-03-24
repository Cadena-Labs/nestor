# Nestor

AI-powered networking assistant for Palo Alto firewall/Panorama monitoring.

## Stack

- **Runtime**: Cloudflare Workers
- **Framework**: React Router v7 (framework mode); `/api/*` as resource routes
- **AI**: Vercel AI SDK (provider-agnostic) + @assistant-ui/react (chat UI)
- **Auth**: Clerk
- **Database**: Cloudflare D1
- **Styling**: Tailwind CSS v4
- **Package Manager**: bun

## Commands

- `bun run dev` — Start dev server
- `bun run build` — Build for production
- `bun run deploy` — Build and deploy to Cloudflare Workers
- `bun run typecheck` — Run TypeScript type checking
- `bun run secrets:sync` — Optional: pull from a 1Password **Environment** (SDK) into `wrangler secret put` if you are not using Connect
- `bun run secrets:sync:dry-run` — Dry run for the above
- `wrangler d1 migrations apply nestor --local` — Apply D1 migrations locally

## Secrets (1Password Connect — preferred for production)

[1Password Connect](https://developer.1password.com/docs/connect/) exposes a **private REST API** on infrastructure you run (`connect-api` + `connect-sync` containers). The Worker calls it with **`fetch`** (see [`app/lib/connect-env.ts`](app/lib/connect-env.ts)); the official `@1password/connect` npm client is **not** bundled because it depends on Node `stream` / axios.

- **Deploy Connect**: Follow [Get started with a Connect server](https://developer.1password.com/docs/connect/get-started) (Secrets Automation workflow, `1password-credentials.json`, access token, Docker/K8s). API shape: [Connect API reference](https://developer.1password.com/docs/connect/api-reference/) (e.g. `GET /v1/vaults/{vaultUUID}/items/{itemUUID}` with `Authorization: Bearer <token>`).
- **1Password data model**: Connect reads **vault items**, not [Environments (beta)](https://developer.1password.com/docs/environments/read-environment-variables). Create one item (e.g. **Server** / **API Credential**) in a vault the server can access. Add **custom fields** whose **labels** exactly match Worker secret names (`ENCRYPTION_KEY`, `CLERK_SECRET_KEY`, … — see [`app/lib/worker-secret-keys.ts`](app/lib/worker-secret-keys.ts)).
- **Cloudflare Worker env**: Set **`CONNECT_SERVER_URL`** (public **HTTPS** base URL of `connect-api`, reachable from Cloudflare’s network), **`CONNECT_VAULT_ID`**, **`CONNECT_ITEM_ID`** (often as non-secret `vars`), and **`CONNECT_TOKEN`** as a **Wrangler secret**. Optional **`CONNECT_CACHE_SECONDS`** (default 300) controls in-isolate caching of fetched fields.
- **Networking**: The Connect API must be reachable from **Workers outbound** fetch (public hostname, or a tunnel such as Cloudflare Tunnel to your Connect host). Lock down with firewall / mTLS / token scoping as your threat model requires.
- **Failure mode**: If Connect is configured but the fetch fails, the Worker responds **503** (“Service configuration error”).

## Secrets (1Password Environments + sync script — optional)

- Use when you do **not** run Connect: keep a 1Password **Environment** as source of truth and run **`bun run secrets:sync`** in CI before deploy (see [`scripts/op-sync-wrangler-secrets.ts`](scripts/op-sync-wrangler-secrets.ts)). Requires `OP_SERVICE_ACCOUNT_TOKEN` and `OP_ENVIRONMENT_ID`. Example comments in [`scripts/github-deploy-workflow.example.yml`](scripts/github-deploy-workflow.example.yml).
- **Local**: `.1password/environments.toml` → `.dev.vars`, or plain `.dev.vars` / `secrets:sync --write-dev-vars`.

## Architecture

- `workers/app.ts` — Worker entry point (`fetch` → React Router `createRequestHandler`, then merge shared security headers onto the response); exports `ChatRateLimiter` Durable Object for cross-isolate chat rate limiting
- `workers/chat-rate-limiter.ts` — Durable Object implementation
- `app/` — React Router frontend (routes, components)
- `app/routes/` — File-based routes
- `app/lib/` — Shared utilities (AI provider, PAN-OS client, encryption)

## Security / operations

- **PAN-OS XML API**: requests use `POST` to `/api/` with `application/x-www-form-urlencoded` body so the API key is not in the URL query string.
- **At-rest secrets**: new rows use HKDF-derived per-user AES-GCM keys (`key_version = 1`); legacy `key_version = 0` ciphertext is re-encrypted on next chat read. Apply D1 migrations `0002_key_version.sql` and `0003_audit_events.sql`.
- **Optional env vars**: `DISABLE_LOG_TOOLS` (`1`/`true`), `MAX_TOOL_OUTPUT_CHARS`, `CHAT_MAX_STEPS`, `CHAT_MAX_LOGS` (see `app/env.d.ts`).
- **Observability**: Wrangler observability is enabled; do not add `console.log` of API keys or PAN responses. The codebase currently avoids logging credentials.

## Learned User Preferences

- Use React Router v7 as the only HTTP/routing layer for this app, including all `/api/*` resource routes; do not add Hono or another parallel framework on the same worker.
- Treat security and trust boundaries as a primary concern when suggesting architecture, dependencies, or operational changes.
- Prefer signed commits (for example SSH signing via 1Password); do not disable Git signing to work around an unavailable signing agent.

## Learned Workspace Facts

- Single maintainer on this project; history rewrites and force pushes do not require coordinating with other developers.
- There is no `CLAUDE.md` in this repo; `AGENTS.md` is the canonical agent-facing project summary.
- Local Wrangler development expects Worker secrets in `.dev.vars` at the repository root; the app does not load `.env` by default.
- Optional `.1password/environments.toml` with `mount_paths` limits the 1Password Cursor plugin’s mounted-env validation to those paths; developers without a matching 1Password FIFO at those paths may see shell commands blocked in Cursor until they align mounts or disable validation for the repo.
