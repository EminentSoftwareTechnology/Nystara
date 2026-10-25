import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes } from "node:crypto";

/**
 * Column-level encryption for personal data. Values are AES-256-GCM with a random IV, stored as
 * `enc:v1:<base64url(iv | tag | ciphertext)>`. Fields that must be looked up (email) also get a keyed
 * HMAC "blind index" so equality queries work without storing the plaintext.
 */
export const ENCRYPTED_PREFIX = "enc:v1:";

let keys: { enc: Buffer; index: Buffer } | null = null;

function derivedKeys() {
  if (keys) return keys;
  const raw = process.env.DATA_ENCRYPTION_KEY;
  const master = raw ? Buffer.from(raw, "base64") : Buffer.alloc(0);
  if (master.length !== 32) {
    throw new Error("DATA_ENCRYPTION_KEY must be 32 random bytes, base64-encoded (openssl rand -base64 32)");
  }
  const derive = (info: string) => Buffer.from(hkdfSync("sha256", master, Buffer.alloc(0), info, 32));
  keys = { enc: derive("nystara:field-encryption"), index: derive("nystara:blind-index") };
  return keys;
}

export function isEncrypted(value: string): boolean {
  return value.startsWith(ENCRYPTED_PREFIX);
}

export function encryptField(plaintext: string): string {
  if (isEncrypted(plaintext)) return plaintext;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", derivedKeys().enc, iv);
  const data = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return ENCRYPTED_PREFIX + Buffer.concat([iv, cipher.getAuthTag(), data]).toString("base64url");
}

/** Plaintext passes through unchanged, so rows written before encryption still read correctly. */
export function decryptField(value: string): string {
  if (!isEncrypted(value)) return value;
  const raw = Buffer.from(value.slice(ENCRYPTED_PREFIX.length), "base64url");
  if (raw.length < 28) return value;
  const decipher = createDecipheriv("aes-256-gcm", derivedKeys().enc, raw.subarray(0, 12));
  decipher.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");
}

/** Case-insensitive keyed hash for email equality lookups. */
export function blindIndex(value: string): string {
  return createHmac("sha256", derivedKeys().index).update(value.trim().toLowerCase()).digest("hex");
}
