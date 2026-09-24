import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

/**
 * Pure(ish) auth business logic — DB reads/writes but no cookies() calls, so
 * it's testable directly (cookies() requires a live Next.js request scope
 * and can't be exercised from a plain Vitest test). src/lib/actions/auth.ts
 * is a thin "use server" wrapper around this that also manages the session
 * cookie.
 */

export async function verifyCredentials(username: string, password: string) {
  const trimmed = username.trim();
  if (!trimmed || !password) {
    throw new Error("Enter your username and password.");
  }
  const user = await prisma.user.findUnique({ where: { username: trimmed } });
  if (!user || !verifyPassword(password, user.passwordHash)) {
    throw new Error("Incorrect username or password.");
  }
  return user;
}

export async function changeCredentials(
  userId: string,
  input: { currentPassword: string; newUsername?: string; newPassword?: string }
) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (!verifyPassword(input.currentPassword, user.passwordHash)) {
    throw new Error("Current password is incorrect.");
  }

  const newUsername = input.newUsername?.trim();
  const data: { username?: string; passwordHash?: string } = {};

  if (newUsername && newUsername !== user.username) {
    const existing = await prisma.user.findUnique({ where: { username: newUsername } });
    if (existing && existing.id !== user.id) {
      throw new Error("That username is already taken.");
    }
    data.username = newUsername;
  }

  if (input.newPassword) {
    if (input.newPassword.length < 8) {
      throw new Error("New password must be at least 8 characters.");
    }
    data.passwordHash = hashPassword(input.newPassword);
  }

  if (Object.keys(data).length === 0) {
    throw new Error("Enter a new username or password to update.");
  }

  return prisma.user.update({ where: { id: userId }, data });
}
