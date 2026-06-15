import { scryptSync, randomBytes, timingSafeEqual, createCipheriv, createDecipheriv, createHash } from "crypto";

export function hashPin(pin: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(pin, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPin(input: string, stored: string): boolean {
  const [salt, key] = stored.split(":");
  if (!salt || !key) return false;
  const hash = scryptSync(input, salt, 64).toString("hex");
  return timingSafeEqual(Buffer.from(hash), Buffer.from(key));
}

const ALGORITHM = "aes-256-cbc";

function getEncryptionKey(): Buffer {
  const envKey = process.env.ENCRYPTION_KEY;
  if (!envKey) {
    // Deterministic fallback for dev environment
    return createHash("sha256").update("rabbitty-default-dev-secret-key-32bytes").digest();
  }
  if (envKey.length === 64) {
    return Buffer.from(envKey, "hex");
  }
  return createHash("sha256").update(envKey).digest();
}

export function encryptText(text: string): string {
  if (!text) return "";
  const key = getEncryptionKey();
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return `${iv.toString("hex")}:${encrypted}`;
}

export function decryptText(encryptedText: string): string {
  if (!encryptedText) return "";
  const [ivHex, encryptedHex] = encryptedText.split(":");
  if (!ivHex || !encryptedHex) return encryptedText; // Fallback to raw if format doesn't match
  try {
    const key = getEncryptionKey();
    const iv = Buffer.from(ivHex, "hex");
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    let decrypted = decipher.update(encryptedHex, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch {
    // Return the original string as fallback if decryption fails
    return encryptedText;
  }
}
