# Nestor

AI-powered networking assistant for Palo Alto firewall/Panorama monitoring.

## Stack

- **Runtime**: Cloudflare Workers
- **Framework**: React Router v7 (framework mode); `/api/*` as resource routes
- **AI**: Vercel AI SDK (provider-agnostic); chat UI uses `useChat` from `ai/react` (`@assistant-ui/*` is in dependencies but not used under `app/` yet)
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

[1Password Connect](https://developer.1password.com/docs/connect/) exposes a **private REST API** on infrastructure you run (`connect-api` + `connect-sync` containers). The Worker calls it with `**fetch`** (see `[app/lib/connect-env.ts](app/lib/connect-env.ts)`); the official `@1password/connect` npm client is **not** bundled because it depends on Node `stream` / axios.

- **Deploy Connect**: Follow [Get started with a Connect server](https://developer.1password.com/docs/connect/get-started) (Secrets Automation workflow, `1password-credentials.json`, access token, Docker/K8s). API shape: [Connect API reference](https://developer.1password.com/docs/connect/api-reference/) (e.g. `GET /v1/vaults/{vaultUUID}/items/{itemUUID}` with `Authorization: Bearer <token>`).
- **1Password data model**: Connect reads **vault items**, not [Environments (beta)](https://developer.1password.com/docs/environments/read-environment-variables). Create one item (e.g. **Server** / **API Credential**) in a vault the server can access. Add **custom fields** whose **labels** exactly match Worker secret names (`ENCRYPTION_KEY`, `CLERK_SECRET_KEY`, … — see `[app/lib/worker-secret-keys.ts](app/lib/worker-secret-keys.ts)`).
- **Cloudflare Worker env**: Set **`CONNECT_SERVER_URL`** (public **HTTPS** base URL of `connect-api`, e.g. [op-connect.cadenalabs.io](https://op-connect.cadenalabs.io), reachable from Cloudflare’s network), **`CONNECT_VAULT_ID`**, **`CONNECT_ITEM_ID`** (often as non-secret `vars`), and **`CONNECT_TOKEN`** as a **Wrangler secret**. Optional **`CONNECT_CACHE_SECONDS`** (default 300) controls in-isolate caching of fetched fields.
- **Networking**: The Connect API is reachable from **Workers outbound** fetch (via Cloudflare Tunnel). Lock down with firewall / mTLS / token scoping as your threat model requires.
- **Failure mode**: If Connect is configured but the fetch fails, the Worker responds **503** (“Service configuration error”).

## Secrets (1Password Environments + sync script — optional)

- Use when you do **not** run Connect: keep a 1Password **Environment** as source of truth and run `**bun run secrets:sync`** in CI before deploy (see `[scripts/op-sync-wrangler-secrets.ts](scripts/op-sync-wrangler-secrets.ts)`). Requires `OP_SERVICE_ACCOUNT_TOKEN` and `OP_ENVIRONMENT_ID`. Example comments in `[scripts/github-deploy-workflow.example.yml](scripts/github-deploy-workflow.example.yml)`.
- **Local**: `bun run dev` with `op run` (see Learned Workspace Facts), `bun run dev:plain` with a static `.dev.vars`, or `secrets:sync --write-dev-vars`.

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

- Use React Router v7 as the only HTTP/routing layer for this app, including all `/api/`* resource routes; do not add Hono or another parallel framework on the same worker.
- Treat security and trust boundaries as a primary concern when suggesting architecture, dependencies, or operational changes.
- Prefer signed commits (for example SSH signing via 1Password); do not disable Git signing to work around an unavailable signing agent; do not leave unsigned commits on the history when rewriting is acceptable.
- Prefer 1Password Connect for production application secrets when the goal is to avoid storing those values in the Cloudflare dashboard; use Environments plus `secrets:sync` when Connect is not deployed.
- **Do not use `git worktree`** for this project (no linked worktrees / extra checkouts of the same repo). Use **normal clones or branches** for parallel work and experiments so agents and humans always see a single canonical working tree and `.git` layout.

## Learned Workspace Facts

- Single maintainer on this project; history rewrites and force pushes do not require coordinating with other developers.
- There is no `CLAUDE.md` in this repo; `AGENTS.md` is the canonical agent-facing project summary.
- Local Wrangler loads Worker secrets from `.dev.vars` at the repository root; the app does not load `.env` by default. `bun run dev` optionally wraps the dev server in `op run --environment …` when `OP_ENVIRONMENT_ID` is set in the environment or `.op/refs.env`, and generates a temporary `.dev.vars` from `.dev.vars.example`; use `bun run dev:plain` with a hand-maintained `.dev.vars` when not using that flow.
- The 1Password Cursor plugin’s mounted-env hook is optional and not configured in-repo; if you use it, add a local `.1password/environments.toml` with `mount_paths` pointing at paths your setup actually uses.
- Chat UI is wired with Vercel AI SDK `useChat` posting to `/api/chat`; `@assistant-ui/react` and `@assistant-ui/react-ai-sdk` are not imported in `app/` code today.
