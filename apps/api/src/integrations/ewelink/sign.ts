import { createHmac, randomBytes } from "node:crypto";

/** eWeLink's request signature: HMAC-SHA256(appSecret, message), base64-encoded. */
export function signMessage(message: string, appSecret: string): string {
  return createHmac("sha256", appSecret).update(message).digest("base64");
}

/** Anti-replay nonce eWeLink expects on auth calls: an 8-char alphanumeric string. */
export function generateNonce(): string {
  return randomBytes(6).toString("base64url").slice(0, 8);
}
