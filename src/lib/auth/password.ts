import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

/**
 * Password hashing via Node's built-in scrypt — no extra dependency needed.
 * Stored as "salt:hash" (both hex). Runs fine in Proxy (Node runtime by
 * default in this Next.js version) as well as Server Actions.
 */

const KEY_LENGTH = 64;

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, KEY_LENGTH).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hashHex] = stored.split(":");
  if (!salt || !hashHex) return false;
  const candidate = scryptSync(password, salt, KEY_LENGTH);
  const expected = Buffer.from(hashHex, "hex");
  if (candidate.length !== expected.length) return false;
  return timingSafeEqual(candidate, expected);
}
