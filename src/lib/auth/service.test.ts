import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/password";
import { verifyCredentials, changeCredentials } from "@/lib/auth/service";

const createdUserIds: string[] = [];

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
});

async function makeUser(username: string, password: string) {
  const user = await prisma.user.create({
    data: { username, passwordHash: hashPassword(password) },
  });
  createdUserIds.push(user.id);
  return user;
}

describe("verifyCredentials", () => {
  it("returns the user for correct username + password", async () => {
    await makeUser("test-verify-ok", "correct-password");
    const user = await verifyCredentials("test-verify-ok", "correct-password");
    expect(user.username).toBe("test-verify-ok");
  });

  it("rejects an incorrect password without revealing which part was wrong", async () => {
    await makeUser("test-verify-wrong-pw", "correct-password");
    await expect(verifyCredentials("test-verify-wrong-pw", "wrong-password")).rejects.toThrow(
      "Incorrect username or password."
    );
  });

  it("rejects a username that doesn't exist", async () => {
    await expect(verifyCredentials("no-such-user-at-all", "anything")).rejects.toThrow(
      "Incorrect username or password."
    );
  });

  it("rejects empty username or password", async () => {
    await expect(verifyCredentials("", "")).rejects.toThrow("Enter your username and password.");
  });
});

describe("changeCredentials", () => {
  it("requires the correct current password before changing anything", async () => {
    const user = await makeUser("test-change-requires-current", "original-password");
    await expect(
      changeCredentials(user.id, { currentPassword: "wrong-current-password", newPassword: "new-password-123" })
    ).rejects.toThrow("Current password is incorrect.");
  });

  it("changes the password, and the new password then verifies", async () => {
    const user = await makeUser("test-change-password", "original-password");
    await changeCredentials(user.id, { currentPassword: "original-password", newPassword: "brand-new-password" });

    await expect(verifyCredentials("test-change-password", "original-password")).rejects.toThrow();
    const verified = await verifyCredentials("test-change-password", "brand-new-password");
    expect(verified.id).toBe(user.id);
  });

  it("rejects a new password shorter than 8 characters", async () => {
    const user = await makeUser("test-change-short-pw", "original-password");
    await expect(
      changeCredentials(user.id, { currentPassword: "original-password", newPassword: "short" })
    ).rejects.toThrow("New password must be at least 8 characters.");
  });

  it("changes the username, and the old username no longer works", async () => {
    const user = await makeUser("test-change-username-old", "original-password");
    await changeCredentials(user.id, { currentPassword: "original-password", newUsername: "test-change-username-new" });

    await expect(verifyCredentials("test-change-username-old", "original-password")).rejects.toThrow();
    const verified = await verifyCredentials("test-change-username-new", "original-password");
    expect(verified.id).toBe(user.id);
  });

  it("rejects changing to a username that's already taken by someone else", async () => {
    await makeUser("test-change-taken-target", "some-password");
    const user = await makeUser("test-change-taken-source", "original-password");
    await expect(
      changeCredentials(user.id, { currentPassword: "original-password", newUsername: "test-change-taken-target" })
    ).rejects.toThrow("That username is already taken.");
  });

  it("allows re-submitting your own current username unchanged, alongside a password change", async () => {
    const user = await makeUser("test-change-same-username", "original-password");
    const updated = await changeCredentials(user.id, {
      currentPassword: "original-password",
      newUsername: "test-change-same-username",
      newPassword: "another-new-password",
    });
    expect(updated.username).toBe("test-change-same-username");
  });

  it("rejects a no-op update (no new username or password supplied)", async () => {
    const user = await makeUser("test-change-noop", "original-password");
    await expect(changeCredentials(user.id, { currentPassword: "original-password" })).rejects.toThrow(
      "Enter a new username or password to update."
    );
  });
});

describe("seeded account (migration 20260924102401_add_users)", () => {
  it("SarahV exists with a properly-hashed password, seeded via the migration itself (not the demo-data seed script)", async () => {
    // The real password is intentionally never written into this repo, so
    // this checks the account and its hash format rather than logging in
    // with the literal password.
    const user = await prisma.user.findUnique({ where: { username: "SarahV" } });
    expect(user).not.toBeNull();
    expect(user!.passwordHash).toMatch(/^[0-9a-f]{32}:[0-9a-f]{128}$/);
    // A wrong password must still be rejected, proving verifyCredentials
    // actually checks the hash rather than short-circuiting.
    await expect(verifyCredentials("SarahV", "definitely-the-wrong-password")).rejects.toThrow();
  });
});
