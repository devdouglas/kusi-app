import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/auth/session";

/** Verifies the session cookie's signature (no DB call) — cheap, safe to call from a layout on every request. */
export const getSessionPayload = cache(async () => {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  return verifySessionToken(token);
});

/** The signed-in user, read fresh from the database (null if not signed in, or the session refers to a deleted user). */
export const getCurrentUser = cache(async () => {
  const payload = await getSessionPayload();
  if (!payload) return null;
  return prisma.user.findUnique({ where: { id: payload.userId } });
});
