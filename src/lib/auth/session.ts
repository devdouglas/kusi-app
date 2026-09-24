import { createHmac, timingSafeEqual } from "crypto";

/**
 * A stateless, signed session cookie: {userId, username} + an HMAC-SHA256
 * signature, so Proxy can verify a request is authenticated on every route
 * without a database round trip (the recommended Next.js pattern — see
 * "Optimistic checks with Proxy" in the auth guide). The actual username
 * shown in the UI is still read fresh from the database via getCurrentUser().
 */

export const SESSION_COOKIE = "kusi_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET must be set in production — see .env.example.");
  }
  // Local dev / test only: sessions just won't survive a server restart.
  return "dev-only-insecure-session-secret-do-not-use-in-production";
}

export interface SessionPayload {
  userId: string;
  username: string;
}

function sign(data: string): string {
  return createHmac("sha256", getSecret()).update(data).digest("hex");
}

export function createSessionToken(payload: SessionPayload): string {
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${data}.${sign(data)}`;
}

export function verifySessionToken(token: string | undefined | null): SessionPayload | null {
  if (!token) return null;
  const [data, signature] = token.split(".");
  if (!data || !signature) return null;

  const expected = sign(data);
  const actualBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expected);
  if (actualBuf.length !== expectedBuf.length || !timingSafeEqual(actualBuf, expectedBuf)) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(data, "base64url").toString("utf8"));
    if (typeof parsed?.userId === "string" && typeof parsed?.username === "string") {
      return { userId: parsed.userId, username: parsed.username };
    }
    return null;
  } catch {
    return null;
  }
}
