import { createHash, randomBytes } from "node:crypto";

export const DEVICE_KEY_PREFIX = "esk_";

// A new device key: "esk_" + 32 random bytes, base64url. Shown to the user once.
export function generateDeviceKey(): string {
  return DEVICE_KEY_PREFIX + randomBytes(32).toString("base64url");
}

// What is stored in devices.key_hash: SHA-256 hex of the full key.
export function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}
