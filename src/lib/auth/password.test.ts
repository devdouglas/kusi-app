import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

describe("password hashing", () => {
  it("verifies the correct password against its own hash", () => {
    const hash = hashPassword("correct-horse-battery-staple");
    expect(verifyPassword("correct-horse-battery-staple", hash)).toBe(true);
  });

  it("rejects an incorrect password", () => {
    const hash = hashPassword("correct-horse-battery-staple");
    expect(verifyPassword("wrong-password", hash)).toBe(false);
  });

  it("never stores the password in plain text", () => {
    const hash = hashPassword("correct-horse-battery-staple");
    expect(hash).not.toContain("correct-horse-battery-staple");
  });

  it("produces a different hash each time (random salt), but both still verify", () => {
    const hashA = hashPassword("same-password");
    const hashB = hashPassword("same-password");
    expect(hashA).not.toBe(hashB);
    expect(verifyPassword("same-password", hashA)).toBe(true);
    expect(verifyPassword("same-password", hashB)).toBe(true);
  });

  it("rejects gracefully (never throws) against a malformed stored hash", () => {
    expect(verifyPassword("anything", "not-a-valid-hash")).toBe(false);
    expect(verifyPassword("anything", "")).toBe(false);
  });
});
