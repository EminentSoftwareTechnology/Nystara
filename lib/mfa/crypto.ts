import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const VERSION = "v1";

function key(): Buffer {
  const raw = process.env.MFA_ENCRYPTION_KEY;
  const decoded = raw ? Buffer.from(raw, "base64") : Buffer.alloc(0);
  if (decoded.length !== 32) {
    throw new Error("MFA_ENCRYPTION_KEY must be 32 random bytes, base64-encoded (openssl rand -base64 32)");
  }
  return decoded;
}

/** AES-256-GCM. The user id is bound as associated data so a ciphertext can't be moved to another account. */
export function encryptSecret(plaintext: string, userId: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  cipher.setAAD(Buffer.from(userId));
  const data = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return [VERSION, iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), data.toString("base64url")].join(".");
}

export function decryptSecret(payload: string, userId: string): string {
  const [version, iv, tag, data] = payload.split(".");
  if (version !== VERSION || !iv || !tag || !data) throw new Error("Unsupported secret format");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
  decipher.setAAD(Buffer.from(userId));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
