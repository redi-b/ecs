import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const PREFIX = "enc:v1:";

function deriveKey(raw: string) {
  // Accept 32-byte base64/hex or arbitrary passphrase → SHA-256.
  const trimmed = raw.trim();
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    return Buffer.from(trimmed, "hex");
  }
  try {
    const b64 = Buffer.from(trimmed, "base64");
    if (b64.length === 32) {
      return b64;
    }
  } catch {
    // fall through
  }
  return createHash("sha256").update(trimmed, "utf8").digest();
}

export function isEncryptedSecret(value: string) {
  return value.startsWith(PREFIX);
}

/**
 * Encrypt secrets at rest (AES-GCM). Used for merchant payment credentials
 * and platform system secrets (e.g. Medusa admin token).
 */
export function encryptSecret(plaintext: string, encryptionKey: string | undefined) {
  if (!encryptionKey?.trim()) {
    throw new Error("Encryption key is required to store secrets.");
  }
  const key = deriveKey(encryptionKey);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64url")}.${tag.toString("base64url")}.${ciphertext.toString("base64url")}`;
}

export function decryptSecret(payload: string, encryptionKey: string | undefined) {
  if (!isEncryptedSecret(payload)) {
    // Legacy plaintext spike — still loadable once until re-saved.
    return payload;
  }
  if (!encryptionKey?.trim()) {
    throw new Error("Encryption key is required to read secrets.");
  }
  const body = payload.slice(PREFIX.length);
  const [ivB64, tagB64, dataB64] = body.split(".");
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error("Invalid encrypted secret format.");
  }
  const key = deriveKey(encryptionKey);
  const iv = Buffer.from(ivB64, "base64url");
  const tag = Buffer.from(tagB64, "base64url");
  const data = Buffer.from(dataB64, "base64url");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

export function secretFingerprint(plaintext: string) {
  const trimmed = plaintext.trim();
  if (trimmed.length < 4) {
    return "****";
  }
  return trimmed.slice(-4);
}
