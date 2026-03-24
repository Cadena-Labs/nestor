/**
 * Optional path: pulls secrets from a 1Password **Environment** (SDK) into Wrangler.
 * For production, prefer [1Password Connect](https://developer.1password.com/docs/connect/) + runtime fetch
 * (`app/lib/connect-env.ts`) so app secrets are not stored as individual Worker secrets.
 *
 * Pulls secrets from a 1Password Environment and applies them to Cloudflare Workers
 * (`wrangler secret put`) and/or merges them into a local `.dev.vars` file.
 *
 * Requires:
 * - OP_SERVICE_ACCOUNT_TOKEN — service account with read access to the Environment
 * - OP_ENVIRONMENT_ID — Environment ID (Developer → View Environments → copy ID)
 *
 * Optional:
 * - WRANGLER_ENV — passed to `wrangler -e` when set
 */
import {
  WORKER_SECRET_ENV_KEYS,
  type WorkerSecretEnvKey,
} from "../app/lib/worker-secret-keys";
import { createClient } from "@1password/sdk";
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");

const ALLOWED_SET = new Set<string>(WORKER_SECRET_ENV_KEYS);

function parseArgs(argv: string[]) {
  let dryRun = false;
  let writeDevVars: string | null = null;
  let wranglerEnv: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--dry-run") {
      dryRun = true;
    } else if (arg === "--write-dev-vars") {
      writeDevVars = join(REPO_ROOT, ".dev.vars");
    } else if (arg.startsWith("--write-dev-vars=")) {
      const pathArg = arg.slice("--write-dev-vars=".length).trim();
      writeDevVars = pathArg ? pathArg : join(REPO_ROOT, ".dev.vars");
    } else if (arg.startsWith("--wrangler-env=")) {
      wranglerEnv = arg.slice("--wrangler-env=".length).trim() || undefined;
    } else if ((arg === "-e" || arg === "--env") && argv[i + 1]) {
      wranglerEnv = argv[++i];
    }
  }

  return { dryRun, writeDevVars, wranglerEnv };
}

function loadPackageVersion(): string {
  try {
    const raw = readFileSync(join(REPO_ROOT, "package.json"), "utf8");
    const pkg = JSON.parse(raw) as { version?: string };
    return typeof pkg.version === "string" ? pkg.version : "0.0.0";
  } catch {
    return "0.0.0";
  }
}

function parseDevVarsFile(content: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const line of content.split(/\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1);
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    map.set(key, value);
  }
  return map;
}

function formatDevVarsLine(key: string, value: string): string {
  if (/[\n\r="#]/.test(value) || /^\s/.test(value) || /\s$/.test(value)) {
    const escaped = value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    return `${key}="${escaped}"`;
  }
  return `${key}=${value}`;
}

function mergeDevVars(
  path: string,
  updates: Map<string, string>,
  dryRun: boolean
): void {
  let existing = new Map<string, string>();
  try {
    existing = parseDevVarsFile(readFileSync(path, "utf8"));
  } catch {
    /* missing file */
  }

  for (const [k, v] of updates) {
    existing.set(k, v);
  }

  const header = [
    "# Merged by scripts/op-sync-wrangler-secrets.ts — do not commit real secrets.",
    "",
  ].join("\n");

  const keys = [...existing.keys()].sort();
  const body = keys.map((k) => formatDevVarsLine(k, existing.get(k) ?? "")).join("\n");
  const out = `${header}${body}\n`;

  if (dryRun) {
    console.log(`[dry-run] would write ${path} (${keys.length} keys)`);
    return;
  }

  writeFileSync(path, out, "utf8");
  console.log(`Wrote ${path} (${keys.length} keys)`);
}

function wranglerBin(): string {
  return join(REPO_ROOT, "node_modules", ".bin", "wrangler");
}

async function wranglerSecretPut(
  key: string,
  value: string,
  wranglerEnv: string | undefined
): Promise<void> {
  const args = ["secret", "put", key];
  if (wranglerEnv) {
    args.unshift("-e", wranglerEnv);
  }

  await new Promise<void>((resolve, reject) => {
    const child = spawn(wranglerBin(), args, {
      cwd: REPO_ROOT,
      stdio: ["pipe", "inherit", "inherit"],
      env: process.env,
    });

    child.stdin?.write(value, "utf8");
    child.stdin?.end();

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`wrangler secret put ${key} exited with code ${code}`));
    });
  });
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const { dryRun, writeDevVars, wranglerEnv } = parseArgs(argv);

  const token = process.env.OP_SERVICE_ACCOUNT_TOKEN?.trim();
  const environmentId = process.env.OP_ENVIRONMENT_ID?.trim();

  if (!token) {
    console.error("Missing OP_SERVICE_ACCOUNT_TOKEN");
    process.exit(1);
  }
  if (!environmentId) {
    console.error("Missing OP_ENVIRONMENT_ID");
    process.exit(1);
  }

  const effectiveWranglerEnv =
    wranglerEnv || process.env.WRANGLER_ENV?.trim() || undefined;

  const client = await createClient({
    auth: token,
    integrationName: "nestor",
    integrationVersion: loadPackageVersion(),
  });

  const { variables } = await client.environments.getVariables(environmentId);

  const fromOp = new Map<string, string>();
  for (const v of variables) {
    if (!ALLOWED_SET.has(v.name)) {
      console.warn(`Skipping unknown 1Password variable (not in allowlist): ${v.name}`);
      continue;
    }
    fromOp.set(v.name, v.value);
  }

  const toSync: { key: WorkerSecretEnvKey; value: string }[] = [];
  for (const key of WORKER_SECRET_ENV_KEYS) {
    const value = fromOp.get(key);
    if (value === undefined) {
      console.warn(`Missing in 1Password Environment (skipped): ${key}`);
      continue;
    }
    if (value === "") {
      console.warn(`Empty value in 1Password Environment (skipped): ${key}`);
      continue;
    }
    toSync.push({ key, value });
  }

  if (toSync.length === 0) {
    console.error("No overlapping secrets to sync between 1Password and allowlist.");
    process.exit(1);
  }

  console.log(
    `${dryRun ? "[dry-run] " : ""}Syncing ${toSync.length} secret(s) to Worker${effectiveWranglerEnv ? ` (env: ${effectiveWranglerEnv})` : ""}`
  );

  if (dryRun) {
    for (const { key } of toSync) {
      console.log(`  would wrangler secret put ${key}`);
    }
  } else {
    for (const { key, value } of toSync) {
      console.log(`wrangler secret put ${key}`);
      await wranglerSecretPut(key, value, effectiveWranglerEnv);
    }
  }

  if (writeDevVars) {
    const updates = new Map<string, string>();
    for (const { key, value } of toSync) {
      updates.set(key, value);
    }
    mergeDevVars(writeDevVars, updates, dryRun);
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
