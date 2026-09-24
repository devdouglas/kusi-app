import { describe, it, expect } from "vitest";
import { createSessionToken, verifySessionToken } from "@/lib/auth/session";

describe("session tokens", () => {
  it("round-trips a valid token", () => {
    const token = createSessionToken({ userId: "u1", username: "SarahV" });
    expect(verifySessionToken(token)).toEqual({ userId: "u1", username: "SarahV" });
  });

  it("rejects a tampered payload (signature no longer matches)", () => {
    const token = createSessionToken({ userId: "u1", username: "SarahV" });
    const [, signature] = token.split(".");
    const tamperedData = Buffer.from(JSON.stringify({ userId: "u1", username: "AnotherUser" })).toString("base64url");
    expect(verifySessionToken(`${tamperedData}.${signature}`)).toBeNull();
  });

  it("rejects a token with an invalid signature", () => {
    const token = createSessionToken({ userId: "u1", username: "SarahV" });
    const [data] = token.split(".");
    expect(verifySessionToken(`${data}.not-the-real-signature-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa`)).toBeNull();
  });

  it("rejects malformed tokens without throwing", () => {
    expect(verifySessionToken("")).toBeNull();
    expect(verifySessionToken("not-a-token")).toBeNull();
    expect(verifySessionToken(null)).toBeNull();
    expect(verifySessionToken(undefined)).toBeNull();
  });

  it("produces different signatures for different payloads", () => {
    const tokenA = createSessionToken({ userId: "u1", username: "SarahV" });
    const tokenB = createSessionToken({ userId: "u2", username: "OtherUser" });
    expect(tokenA).not.toBe(tokenB);
  });
});
