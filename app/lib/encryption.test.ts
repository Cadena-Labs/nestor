import { describe, expect, test } from "bun:test";
import {
  CURRENT_KEY_VERSION,
  LEGACY_KEY_VERSION,
  decryptUserSecret,
  encrypt,
  encryptUserSecret,
} from "./encryption";

const masterB64 = () => btoa("12345678901234567890123456789012");

describe("encryptUserSecret / decryptUserSecret", () => {
  test("roundtrips v1 per-user ciphertext", async () => {
    const master = masterB64();
    const cipher = await encryptUserSecret("sk-test", master, "user_abc");
    const plain = await decryptUserSecret(
      cipher,
      master,
      "user_abc",
      CURRENT_KEY_VERSION
    );
    expect(plain).toBe("sk-test");
  });

  test("different users yield different ciphertext for same plaintext", async () => {
    const master = masterB64();
    const a = await encryptUserSecret("same", master, "user_a");
    const b = await encryptUserSecret("same", master, "user_b");
    expect(a).not.toBe(b);
  });

  test("legacy v0 decrypt still works", async () => {
    const master = masterB64();
    const cipher = await encrypt("legacy-key", master);
    const plain = await decryptUserSecret(
      cipher,
      master,
      "any",
      LEGACY_KEY_VERSION
    );
    expect(plain).toBe("legacy-key");
  });
});
