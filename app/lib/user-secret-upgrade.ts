import {
  CURRENT_KEY_VERSION,
  LEGACY_KEY_VERSION,
  decryptUserSecret,
  encryptUserSecret,
} from "./encryption";

/** Decrypt user_settings.api_key_encrypted; if legacy v0, re-encrypt as v1 in place. */
export async function decryptUserSettingsApiKey(
  db: D1Database,
  master: string,
  userId: string,
  ciphertext: string,
  keyVersion: number
): Promise<string> {
  const plaintext = await decryptUserSecret(
    ciphertext,
    master,
    userId,
    keyVersion
  );

  if (keyVersion !== LEGACY_KEY_VERSION) {
    return plaintext;
  }

  const newCipher = await encryptUserSecret(plaintext, master, userId);
  await db
    .prepare(
      `UPDATE user_settings SET api_key_encrypted = ?, key_version = ?, updated_at = datetime('now')
       WHERE user_id = ? AND key_version = ?`
    )
    .bind(newCipher, CURRENT_KEY_VERSION, userId, LEGACY_KEY_VERSION)
    .run();

  return plaintext;
}

/** Decrypt devices.api_key_encrypted; if legacy v0, re-encrypt as v1 in place. */
export async function decryptDeviceApiKey(
  db: D1Database,
  master: string,
  userId: string,
  deviceId: string,
  ciphertext: string,
  keyVersion: number
): Promise<string> {
  const plaintext = await decryptUserSecret(
    ciphertext,
    master,
    userId,
    keyVersion
  );

  if (keyVersion !== LEGACY_KEY_VERSION) {
    return plaintext;
  }

  const newCipher = await encryptUserSecret(plaintext, master, userId);
  await db
    .prepare(
      `UPDATE devices SET api_key_encrypted = ?, key_version = ?, updated_at = datetime('now')
       WHERE id = ? AND user_id = ? AND key_version = ?`
    )
    .bind(
      newCipher,
      CURRENT_KEY_VERSION,
      deviceId,
      userId,
      LEGACY_KEY_VERSION
    )
    .run();

  return plaintext;
}
