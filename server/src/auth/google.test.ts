import type { OAuth2Client, TokenPayload } from "google-auth-library";
import { describe, expect, it, vi } from "vitest";

import { GoogleTokenError, verifyGoogleIdToken } from "./google.js";
import { TEST_AUTH_CONFIG } from "./testing.js";

function payload(overrides: Partial<TokenPayload> = {}): TokenPayload {
  return {
    iss: "https://accounts.google.com",
    aud: TEST_AUTH_CONFIG.googleClientId,
    sub: "google-subject-123",
    email: "person@example.com",
    email_verified: true,
    name: "A Person",
    iat: 0,
    exp: 0,
    ...overrides,
  } as TokenPayload;
}

/** A stand-in for OAuth2Client that returns whatever payload a test names. */
function clientReturning(value: TokenPayload | undefined): OAuth2Client {
  return {
    verifyIdToken: vi.fn(async () => ({ getPayload: () => value })),
  } as unknown as OAuth2Client;
}

function clientThrowing(): OAuth2Client {
  return {
    verifyIdToken: vi.fn(async () => {
      throw new Error("invalid signature");
    }),
  } as unknown as OAuth2Client;
}

describe("verifyGoogleIdToken", () => {
  it("returns the identity a good token asserts", async () => {
    const identity = await verifyGoogleIdToken(
      "token",
      TEST_AUTH_CONFIG,
      clientReturning(payload()),
    );

    expect(identity).toEqual({
      googleSub: "google-subject-123",
      email: "person@example.com",
      displayName: "A Person",
    });
  });

  it("passes our client id as the required audience", async () => {
    const client = clientReturning(payload());

    await verifyGoogleIdToken("token", TEST_AUTH_CONFIG, client);

    // This is the check that stops a perfectly valid Google token issued to some
    // other application from signing someone into Soteria.
    expect(client.verifyIdToken).toHaveBeenCalledWith({
      idToken: "token",
      audience: TEST_AUTH_CONFIG.googleClientId,
    });
  });

  it("rejects a token minted for another client id", async () => {
    await expect(
      verifyGoogleIdToken(
        "token",
        TEST_AUTH_CONFIG,
        clientReturning(payload({ aud: "someone-elses-client-id" })),
      ),
    ).rejects.toBeInstanceOf(GoogleTokenError);
  });

  it("rejects a token from an unexpected issuer", async () => {
    await expect(
      verifyGoogleIdToken(
        "token",
        TEST_AUTH_CONFIG,
        clientReturning(payload({ iss: "https://accounts.evil.example" })),
      ),
    ).rejects.toBeInstanceOf(GoogleTokenError);
  });

  it("accepts both of Google's issuer spellings", async () => {
    await expect(
      verifyGoogleIdToken(
        "token",
        TEST_AUTH_CONFIG,
        clientReturning(payload({ iss: "accounts.google.com" })),
      ),
    ).resolves.toMatchObject({ googleSub: "google-subject-123" });
  });

  it("rejects an unverified email", async () => {
    // users.email is unique, so an unverified address would let someone claim an
    // address they do not control and collide with a real user's row.
    await expect(
      verifyGoogleIdToken(
        "token",
        TEST_AUTH_CONFIG,
        clientReturning(payload({ email_verified: false })),
      ),
    ).rejects.toBeInstanceOf(GoogleTokenError);
  });

  it("rejects a payload with no subject", async () => {
    await expect(
      verifyGoogleIdToken(
        "token",
        TEST_AUTH_CONFIG,
        clientReturning(payload({ sub: "" })),
      ),
    ).rejects.toBeInstanceOf(GoogleTokenError);
  });

  it("rejects an empty payload", async () => {
    await expect(
      verifyGoogleIdToken(
        "token",
        TEST_AUTH_CONFIG,
        clientReturning(undefined),
      ),
    ).rejects.toBeInstanceOf(GoogleTokenError);
  });

  it("turns a library verification failure into GoogleTokenError", async () => {
    await expect(
      verifyGoogleIdToken("token", TEST_AUTH_CONFIG, clientThrowing()),
    ).rejects.toBeInstanceOf(GoogleTokenError);
  });

  it("never puts the token or the reason in the client-facing message", async () => {
    let error: GoogleTokenError | undefined;

    try {
      await verifyGoogleIdToken(
        "a-secret-looking-token",
        TEST_AUTH_CONFIG,
        clientReturning(payload({ aud: "someone-elses-client-id" })),
      );
    } catch (caught) {
      error = caught as GoogleTokenError;
    }

    expect(error).toBeInstanceOf(GoogleTokenError);
    expect(error?.message).not.toContain("a-secret-looking-token");
    expect(error?.message).not.toContain(error?.reason);
    expect(error?.reason).toBe("bad_audience");
  });

  it("treats a missing display name as null rather than empty", async () => {
    const identity = await verifyGoogleIdToken(
      "token",
      TEST_AUTH_CONFIG,
      clientReturning(payload({ name: "" })),
    );

    expect(identity.displayName).toBeNull();
  });
});
