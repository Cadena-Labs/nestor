/**
 * AES-256-GCM encryption for API keys stored in D1.
 * v0: legacy — single master key as raw AES key.
 * v1: HKDF-SHA256(master, userId) → per-user AES-GCM key.
 */

import { parseEncryptionKey } from "./security";

const ALGORITHM = "AES-GCM";
const IV_LENGTH = 12;

export const LEGACY_KEY_VERSION = 0;
export const CURRENT_KEY_VERSION = 1;

async function importMasterAesKey(secret: string): Promise<CryptoKey> {
  const keyData = new Uint8Array(parseEncryptionKey(secret));
  return crypto.subtle.importKey("raw", keyData, ALGORITHM, false, [
    "encrypt",
    "decrypt",
  ]);
}

async function deriveUserAesKey(
  masterSecret: string,
  userId: string
): Promise<CryptoKey> {
  const raw = new Uint8Array(parseEncryptionKey(masterSecret));
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    raw,
    { name: "HKDF" },
    false,
    ["deriveKey"]
  );
  const salt = new TextEncoder().encode(`nestor:user-dek:v1:${userId}`);
  return crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt,
      info: new Uint8Array(0),
    },
    keyMaterial,
    { name: ALGORITHM, length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

async function encryptWithKey(
  plaintext: string,
  key: CryptoKey
): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const encoded = new TextEncoder().encode(plaintext);

  const ciphertext = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    encoded
  );

  const combined = new Uint8Array(iv.length + new Uint8Array(ciphertext).length);
  combined.set(iv);
  combined.set(new Uint8Array(ciphertext), iv.length);

  return btoa(String.fromCharCode(...combined));
}

async function decryptWithKey(
  encrypted: string,
  key: CryptoKey
): Promise<string> {
  const combined = Uint8Array.from(atob(encrypted), (c) => c.charCodeAt(0));

  const iv = combined.slice(0, IV_LENGTH);
  const ciphertext = combined.slice(IV_LENGTH);

  const decrypted = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv },
    key,
    ciphertext
  );

  return new TextDecoder().decode(decrypted);
}

/** Legacy: encrypt with raw master key (v0). */
export async function encrypt(
  plaintext: string,
  secret: string
): Promise<string> {
  const key = await importMasterAesKey(secret);
  return encryptWithKey(plaintext, key);
}

/** Legacy: decrypt v0 blobs. */
export async function decrypt(
  encrypted: string,
  secret: string
): Promise<string> {
  const key = await importMasterAesKey(secret);
  return decryptWithKey(encrypted, key);
}

/** Encrypt with per-user derived key (v1). */
export async function encryptUserSecret(
  plaintext: string,
  masterSecret: string,
  userId: string
): Promise<string> {
  const key = await deriveUserAesKey(masterSecret, userId);
  return encryptWithKey(plaintext, key);
}

/** Decrypt user secret for the given stored key version. */
export async function decryptUserSecret(
  encrypted: string,
  masterSecret: string,
  userId: string,
  keyVersion: number
): Promise<string> {
  if (keyVersion === LEGACY_KEY_VERSION) {
    return decrypt(encrypted, masterSecret);
  }
  const key = await deriveUserAesKey(masterSecret, userId);
  return decryptWithKey(encrypted, key);
}
