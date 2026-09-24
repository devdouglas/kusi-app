"use server";

import { cookies } from "next/headers";
import { verifyCredentials, changeCredentials } from "@/lib/auth/service";
import { createSessionToken, SESSION_COOKIE, SESSION_MAX_AGE_SECONDS } from "@/lib/auth/session";
import { getCurrentUser } from "@/lib/auth/current-user";

async function setSessionCookie(user: { id: string; username: string }) {
  const token = createSessionToken({ userId: user.id, username: user.username });
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function login(input: { username: string; password: string }) {
  const user = await verifyCredentials(input.username, input.password);
  await setSessionCookie(user);
}

export async function logout() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export async function updateCredentials(input: { currentPassword: string; newUsername?: string; newPassword?: string }) {
  const current = await getCurrentUser();
  if (!current) throw new Error("Not signed in.");

  const updated = await changeCredentials(current.id, input);

  // Refresh the session cookie so a username change takes effect immediately
  // (the signed cookie embeds the username) instead of waiting for re-login.
  await setSessionCookie(updated);

  return { username: updated.username };
}
