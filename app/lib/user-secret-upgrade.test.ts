import { describe, expect, test } from "bun:test";

import {
  CURRENT_KEY_VERSION,
  LEGACY_KEY_VERSION,
  encrypt,
  encryptUserSecret,
} from "./encryption";
import { decryptProviderApiKey } from "./user-secret-upgrade";

const masterB64 = () => btoa("12345678901234567890123456789012");

type RunCall = {
  sql: string;
  values: unknown[];
};

function makeDb() {
  const calls: RunCall[] = [];

  return {
    calls,
    db: {
      prepare(sql: string) {
        return {
          bind(...values: unknown[]) {
            return {
              async run() {
                calls.push({ sql, values });
                return { success: true };
              },
            };
          },
        };
      },
    } as unknown as D1Database,
  };
}

describe("decryptProviderApiKey", () => {
  test("returns current-version provider keys without rewriting them", async () => {
    const { db, calls } = makeDb();
    const master = masterB64();
    const ciphertext = await encryptUserSecret("sk-provider", master, "user_abc");

    const plaintext = await decryptProviderApiKey(
      db,
      master,
      "user_abc",
      "openai",
      ciphertext,
      CURRENT_KEY_VERSION
    );

    expect(plaintext).toBe("sk-provider");
    expect(calls).toHaveLength(0);
  });

  test("re-encrypts legacy provider keys into user_provider_api_keys", async () => {
    const { db, calls } = makeDb();
    const master = masterB64();
    const legacyCiphertext = await encrypt("legacy-provider-key", master);

    const plaintext = await decryptProviderApiKey(
      db,
      master,
      "user_abc",
      "openrouter",
      legacyCiphertext,
      LEGACY_KEY_VERSION
    );

    expect(plaintext).toBe("legacy-provider-key");
    expect(calls).toHaveLength(1);
    expect(calls[0]?.sql).toContain("UPDATE user_provider_api_keys");
    expect(calls[0]?.values).toEqual([
      expect.any(String),
      CURRENT_KEY_VERSION,
      "user_abc",
      "openrouter",
      LEGACY_KEY_VERSION,
    ]);
  });
});
