import { SignJWT } from "jose";
import { describe, expect, it } from "vitest";

import {
  SESSION_ALGORITHM,
  SESSION_AUDIENCE,
  SESSION_ISSUER,
  SESSION_TTL_SECONDS,
  issueSessionToken,
  verifySessionToken,
} from "./session.js";
import { TEST_AUTH_CONFIG } from "./testing.js";

const USER_ID = "11111111-1111-4111-8111-111111111111";

async function signed(payload: Record<string, unknown>): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  return new SignJWT(payload)
    .setProtectedHeader({ alg: SESSION_ALGORITHM })
    .setIssuer(SESSION_ISSUER)
    .setAudience(SESSION_AUDIENCE)
    .setIssuedAt(now)
    .setExpirationTime(now + SESSION_TTL_SECONDS)
    .sign(TEST_AUTH_CONFIG.sessionSecret);
}

/**
 * Unit tests for verifySessionToken, written because the route-level versions of
 * these cases pass for the wrong reason.
 *
 * A token carrying `tv: "3"` is rejected end-to-end even with the shape check
 * removed, because `middleware.ts` then compares `user.tokenVersion !== claims
 * .tokenVersion` and `3 !== "3"` is true. So a `/api/me` test cannot observe
 * this guard: it sees the composition of two guards and cannot say which one
 * fired. Mutating the check away failed no test until these existed — the same
 * finding the security review made about four other guards on this PR.
 */
describe("verifySessionToken — claim shape", () => {
  it("accepts a token this module issued", async () => {
    const token = await issueSessionToken(
      { userId: USER_ID, tokenVersion: 3 },
      TEST_AUTH_CONFIG,
    );

    await expect(verifySessionToken(token, TEST_AUTH_CONFIG)).resolves.toEqual({
      userId: USER_ID,
      tokenVersion: 3,
    });
  });

  for (const [label, payload] of [
    ["a string tv", { sub: USER_ID, tv: "3" }],
    ["a fractional tv", { sub: USER_ID, tv: 3.5 }],
    ["an infinite tv", { sub: USER_ID, tv: Number.POSITIVE_INFINITY }],
    ["a null tv", { sub: USER_ID, tv: null }],
    ["a missing tv", { sub: USER_ID }],
    ["an object tv", { sub: USER_ID, tv: { valueOf: 3 } }],
  ] as const) {
    it(`returns undefined for ${label}`, async () => {
      expect(
        await verifySessionToken(await signed(payload), TEST_AUTH_CONFIG),
      ).toBeUndefined();
    });
  }

  for (const [label, payload] of [
    ["a non-string sub", { sub: 42, tv: 3 }],
    ["an empty sub", { sub: "", tv: 3 }],
    ["a missing sub", { tv: 3 }],
  ] as const) {
    it(`returns undefined for ${label}`, async () => {
      expect(
        await verifySessionToken(await signed(payload), TEST_AUTH_CONFIG),
      ).toBeUndefined();
    });
  }

  it("returns undefined rather than throwing for a malformed token", async () => {
    // Callers treat every bad token identically, so none of them can leak the
    // difference between expired, forged and malformed to an attacker.
    expect(
      await verifySessionToken("not-a-jwt", TEST_AUTH_CONFIG),
    ).toBeUndefined();
    expect(await verifySessionToken("", TEST_AUTH_CONFIG)).toBeUndefined();
  });
});
