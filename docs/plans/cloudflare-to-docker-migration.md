# Nestor: Cloudflare Workers → Docker Migration

## Context

Nestor is an AI-powered PAN-OS networking assistant deployed on Cloudflare Workers. The on-prem requirement (direct network access to firewalls on private networks, data residency) makes Cloudflare's edge deployment unsuitable. This plan migrates to a single Docker container running a Bun/Express server with local SQLite, preserving ~95% of the codebase unchanged.

**Key insight**: By creating a thin D1-compatible wrapper around `bun:sqlite`, route handlers and API lib functions remain untouched. The existing in-memory rate limiter fallback eliminates the need to replace Durable Objects.

---

## Step 1: Create D1-Compatible SQLite Adapter

**New file**: `app/lib/d1-compat.ts`

Wrap `bun:sqlite` to match the D1 API surface the codebase actually uses:
- `prepare(sql)` → returns chainable object
- `.bind(...args)` → stores args, returns self
- `.all<T>()` → `{ results: T[] }` (D1 wraps results)
- `.first<T>()` → `T | null`
- `.run()` → `{ meta: { changes: number, last_row_id: number } }`

Also implement:
- `batch(stmts)` if used anywhere (check first)
- `exec(sql)` for running raw SQL (used by migration runner)

Export a factory: `createD1Compat(dbPath: string) → D1CompatDatabase`

**Critical files to reference**:
- `app/lib/api/conversations.ts` — typical D1 usage patterns
- `app/lib/api/devices.ts` — same patterns
- `app/lib/api/settings.ts` — same patterns
- `app/lib/api/chat.ts` — most complex D1 usage

---

## Step 2: Create Server Entry Point

**New file**: `server.ts`

Express server that replaces `workers/app.ts`:

1. Initialize SQLite database (bun:sqlite → D1 compat wrapper)
2. Run migrations from migrations/ directory on startup
3. Resolve env via 1Password Connect (reuse resolveEnvWithConnect)
4. Construct Env-shaped context:
   - env.DB → D1 compat wrapper instance
   - env.CHAT_RATE_LIMITER → undefined (triggers in-memory fallback)
   - String env vars → from process.env + 1Password overlay
5. Create React Router request handler with context
6. Serve static assets from build/client/
7. Apply security headers (reuse buildSecurityHeaders)
8. Add GET /api/health endpoint for Docker health checks

**Key**: Keep the `{ cloudflare: { env, ctx } }` context shape so `requireApiUser()` and all route handlers work without changes. Provide a minimal `ctx` stub with a no-op `waitUntil`.

**Critical files to reference**:
- `workers/app.ts` — current entry point to replicate behavior
- `app/lib/connect-env.ts` — 1Password Connect integration to preserve
- `app/lib/security.ts` — `buildSecurityHeaders()` to reuse
- `app/lib/api/require-user.ts` — context access pattern to preserve

---

## Step 3: Update Build Configuration

### `vite.config.ts`
- Remove `@cloudflare/vite-plugin` import and `cloudflare()` plugin call
- Remove `panosDevProxy()` (no longer needed — Node.js supports `NODE_TLS_REJECT_UNAUTHORIZED`)
- Keep: `reactRouter()`, `tailwindcss()`, `tsconfigPaths()`

### `react-router.config.ts`
- Check if any changes needed for Node.js adapter (may need to specify server build entry)

### `app/env.d.ts`
- Update `DB` type from `D1Database` to `D1CompatDatabase` (our wrapper)
- Make `CHAT_RATE_LIMITER` optional or remove it
- Remove `ExecutionContext` import if Cloudflare-specific
- Keep `AppLoadContext` shape with `cloudflare.env` for compatibility

### `tsconfig.json`
- Remove `tsconfig.cloudflare.json` references if present
- Remove Cloudflare worker types from `compilerOptions.types`
- Add `bun-types` if not already present

---

## Step 4: Update Package Dependencies

### `package.json`

**Remove:**
- `@cloudflare/vite-plugin`
- `wrangler`
- Any `@cloudflare/*` packages

**Add:**
- `express` + `@types/express`
- `@react-router/express` (React Router's Express adapter)
- `compression` (gzip for static assets)
- `morgan` (request logging, optional)

**Update scripts:**
```json
{
  "dev": "react-router dev",
  "build": "react-router build",
  "start": "bun run server.ts",
  "typecheck": "react-router typegen && tsc -b"
}
```

Remove: `cf-typegen`, `deploy` (wrangler), `secrets:sync`

---

## Step 5: Docker Configuration

### New file: `Dockerfile` (multi-stage)

- Stage 1 (builder): `oven/bun:latest` — install deps, run `bun run build`
- Stage 2 (runtime): `oven/bun:latest` — copy build output, migrations, server entry, node_modules
- Expose port 3000, declare /data volume
- Health check via curl to /api/health
- CMD: `bun run server.ts`

### New file: `docker-compose.yml`

- Single service `nestor` with build context
- Port mapping from env (default 3000)
- Named volume `nestor-data` mounted at `/data` for SQLite persistence
- `env_file: .env` for configuration
- `restart: unless-stopped`
- Health check with 30s interval

### New file: `.env.example`

Consolidate from `.dev.vars.example` — same variables, different file name. Add:
- `DATABASE_PATH=/data/nestor.db` (SQLite file location)
- `PORT=3000`

---

## Step 6: Clean Up Cloudflare Artifacts

**Remove files:**
- `workers/app.ts`
- `workers/chat-rate-limiter.ts`
- `wrangler.jsonc`
- `worker-configuration.d.ts`
- `tsconfig.cloudflare.json`
- `.dev.vars.example` (replaced by `.env.example`)
- `scripts/op-sync-wrangler-secrets.ts` (wrangler-specific)
- `scripts/run-with-ephemeral-dev-vars.sh` (wrangler-specific dev flow)

**Keep:**
- `scripts/run-with-1password-environment.sh` (still useful for dev)
- `migrations/` directory (SQL files work as-is)
- All `app/` code (routes, components, lib)

---

## Step 7: Update 1Password Connect Integration

**File**: `app/lib/connect-env.ts`

Minor adjustments:
- The current code receives `env: Env` and merges secrets on top. In the Docker setup, `env` will be constructed from `process.env` instead of Cloudflare bindings.
- The HTTP-based Connect API calls remain identical.
- Cache logic remains identical (module-level cache works in long-lived Node process, even better than per-isolate in Workers).

---

## File Change Summary

| Action | Files | Count |
|--------|-------|-------|
| **New** | `server.ts`, `app/lib/d1-compat.ts`, `Dockerfile`, `docker-compose.yml`, `.env.example` | 5 |
| **Modified** | `package.json`, `vite.config.ts`, `react-router.config.ts`, `app/env.d.ts`, `tsconfig.json`, `app/lib/connect-env.ts` | 6 |
| **Removed** | `workers/app.ts`, `workers/chat-rate-limiter.ts`, `wrangler.jsonc`, `worker-configuration.d.ts`, `tsconfig.cloudflare.json`, `.dev.vars.example`, `scripts/op-sync-wrangler-secrets.ts`, `scripts/run-with-ephemeral-dev-vars.sh` | 8 |
| **Unchanged** | All routes, components, API handlers, encryption, auth, AI providers, PAN-OS client | ~95% |

---

## Verification

1. **Unit test the D1 adapter**: Write tests that exercise `prepare().bind().all()`, `.first()`, `.run()` with the same queries used in the app
2. **Run existing tests**: `bun test` — existing tests should pass with the adapter
3. **Local dev smoke test**: `bun run dev` → sign in → create device → start chat conversation → verify messages persist
4. **Docker build and run**:
   - `docker compose up --build`
   - Verify health check passes
   - Verify app loads at http://localhost:3000
5. **Data persistence**: Stop container, restart, verify conversations/devices still exist
6. **Rate limiting**: Send 20+ rapid chat requests, verify rate limit kicks in
