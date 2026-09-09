import { SignJWT } from "jose";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import { createApp } from "../app.js";
import { SESSION_COOKIE } from "./cookie.js";
import { GoogleTokenError, type GoogleIdentity } from "./google.js";
import {
  SESSION_ALGORITHM,
  SESSION_AUDIENCE,
  SESSION_ISSUER,
  SESSION_TTL_SECONDS,
  issueSessionToken,
} from "./session.js";
import { TEST_AUTH_CONFIG } from "./testing.js";
import type { UserRecord } from "./users.js";

const IDENTITY: GoogleIdentity = {
  googleSub: "google-subject-123",
  email: "person@example.com",
  displayName: "A Person",
};

const USER: UserRecord = {
  id: "11111111-1111-4111-8111-111111111111",
  email: IDENTITY.email,
  displayName: IDENTITY.displayName,
  tokenVersion: 3,
};

interface Overrides {
  verifyIdToken?: (token: string) => Promise<GoogleIdentity>;
  user?: UserRecord | undefined;
  bumpVersion?: (id: string) => Promise<number | undefined>;
}

/** An app with Google and the database stubbed, so only our own logic is tested. */
function testApp(overrides: Overrides = {}) {
  const user = "user" in overrides ? overrides.user : USER;

  return createApp({
    checkDbConnection: async () => true,
    enableRateLimit: false,
    auth: TEST_AUTH_CONFIG,
    loadSessionUser: async () => user,
    authRouterOptions: {
      verifyIdToken: overrides.verifyIdToken ?? (async () => IDENTITY),
      upsertUser: async () => USER,
      bumpVersion: overrides.bumpVersion ?? (async () => USER.tokenVersion + 1),
      // The audit trail is exercised by db/audit.test.ts; here it must not need
      // a database.
      audit: async () => {},
    },
  });
}

function sessionCookie(response: request.Response): string | undefined {
  const raw = response.headers["set-cookie"];
  const all = Array.isArray(raw) ? raw : raw === undefined ? [] : [raw];

  return all.find((value) => value.startsWith(`${SESSION_COOKIE}=`));
}

describe("POST /api/auth/google", () => {
  it("signs the user in and returns them", async () => {
    const response = await request(testApp())
      .post("/api/auth/google")
      .send({ credential: "a-google-id-token" })
      .expect(200);

    expect(response.body).toEqual({
      user: { id: USER.id, email: USER.email, displayName: USER.displayName },
    });
  });

  it("sets the session cookie httpOnly, SameSite=Lax, path=/ and 7-day", async () => {
    const response = await request(testApp())
      .post("/api/auth/google")
      .send({ credential: "a-google-id-token" })
      .expect(200);

    const cookie = sessionCookie(response);

    expect(cookie).toBeDefined();
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Path=/");
    expect(cookie).toContain(`Max-Age=${SESSION_TTL_SECONDS}`);
  });

  it("marks the cookie Secure when configured to", async () => {
    const app = createApp({
      checkDbConnection: async () => true,
      enableRateLimit: false,
      auth: { ...TEST_AUTH_CONFIG, secureCookies: true },
      loadSessionUser: async () => USER,
      authRouterOptions: {
        verifyIdToken: async () => IDENTITY,
        upsertUser: async () => USER,
        bumpVersion: async () => 1,
        audit: async () => {},
      },
    });

    const response = await request(app)
      .post("/api/auth/google")
      .send({ credential: "a-google-id-token" })
      .expect(200);

    expect(sessionCookie(response)).toContain("Secure");
  });

  it("never puts the Google credential in the cookie", async () => {
    const credential = "a-google-id-token-that-must-not-be-stored";
    const response = await request(testApp())
      .post("/api/auth/google")
      .send({ credential })
      .expect(200);

    expect(sessionCookie(response)).not.toContain(credential);
  });

  it("carries no email or name in the session token, only an opaque id", async () => {
    const response = await request(testApp())
      .post("/api/auth/google")
      .send({ credential: "a-google-id-token" })
      .expect(200);

    const cookie = sessionCookie(response) ?? "";
    const token = cookie.slice(`${SESSION_COOKIE}=`.length).split(";")[0] ?? "";
    const payload = JSON.parse(
      Buffer.from(token.split(".")[1] ?? "", "base64url").toString("utf8"),
    ) as Record<string, unknown>;

    expect(payload.sub).toBe(USER.id);
    expect(payload.tv).toBe(USER.tokenVersion);
    expect(Object.keys(payload).sort()).toEqual([
      "aud",
      "exp",
      "iat",
      "iss",
      "sub",
      "tv",
    ]);
  });

  for (const reason of [
    "verification_failed",
    "bad_audience",
    "bad_issuer",
    "email_unverified",
  ] as const) {
    it(`rejects a token with 401 when Google verification fails (${reason})`, async () => {
      const app = testApp({
        verifyIdToken: async () => {
          throw new GoogleTokenError(reason);
        },
      });

      const response = await request(app)
        .post("/api/auth/google")
        .send({ credential: "bad" })
        .expect(401);

      expect(response.body.error.code).toBe("unauthorized");
      // The reason must not reach the client: a caller that can tell "wrong
      // audience" from "expired" learns about our configuration.
      expect(JSON.stringify(response.body)).not.toContain(reason);
      expect(sessionCookie(response)).toBeUndefined();
    });
  }

  it("rejects a missing credential with the validation envelope", async () => {
    const response = await request(testApp())
      .post("/api/auth/google")
      .send({})
      .expect(400);

    expect(response.body.error.code).toBe("validation_failed");
  });

  it("rejects an oversized credential before verifying it", async () => {
    const verifyIdToken = vi.fn(async () => IDENTITY);
    const response = await request(testApp({ verifyIdToken }))
      .post("/api/auth/google")
      .send({ credential: "x".repeat(4097) })
      .expect(400);

    expect(response.body.error.code).toBe("validation_failed");
    expect(verifyIdToken).not.toHaveBeenCalled();
  });
});

describe("GET /api/me", () => {
  it("reports null for an anonymous request", async () => {
    const response = await request(testApp()).get("/api/me").expect(200);

    expect(response.body).toEqual({ user: null });
  });

  it("reports the user for a valid session cookie", async () => {
    const token = await issueSessionToken(
      { userId: USER.id, tokenVersion: USER.tokenVersion },
      TEST_AUTH_CONFIG,
    );

    const response = await request(testApp())
      .get("/api/me")
      .set("Cookie", `${SESSION_COOKIE}=${token}`)
      .expect(200);

    expect(response.body.user.id).toBe(USER.id);
  });

  it("ignores a cookie whose token version is stale, and clears it", async () => {
    // This is the revocation check. Without it, bumping token_version would
    // change nothing and a signed cookie would outlive a sign-out or a deletion.
    const token = await issueSessionToken(
      { userId: USER.id, tokenVersion: USER.tokenVersion - 1 },
      TEST_AUTH_CONFIG,
    );

    const response = await request(testApp())
      .get("/api/me")
      .set("Cookie", `${SESSION_COOKIE}=${token}`)
      .expect(200);

    expect(response.body).toEqual({ user: null });
    expect(sessionCookie(response)).toContain(`${SESSION_COOKIE}=;`);
  });

  it("ignores a cookie whose user row is gone", async () => {
    const token = await issueSessionToken(
      { userId: USER.id, tokenVersion: USER.tokenVersion },
      TEST_AUTH_CONFIG,
    );

    const response = await request(testApp({ user: undefined }))
      .get("/api/me")
      .set("Cookie", `${SESSION_COOKIE}=${token}`)
      .expect(200);

    expect(response.body).toEqual({ user: null });
  });

  it("ignores a cookie signed with the wrong key", async () => {
    const token = await issueSessionToken(
      { userId: USER.id, tokenVersion: USER.tokenVersion },
      {
        ...TEST_AUTH_CONFIG,
        sessionSecret: new TextEncoder().encode(
          "a-completely-different-secret-of-length",
        ),
      },
    );

    const response = await request(testApp())
      .get("/api/me")
      .set("Cookie", `${SESSION_COOKIE}=${token}`)
      .expect(200);

    expect(response.body).toEqual({ user: null });
  });

  it("ignores an expired cookie", async () => {
    const past = Math.floor(Date.now() / 1000) - SESSION_TTL_SECONDS - 60;
    const token = await new SignJWT({ tv: USER.tokenVersion })
      .setProtectedHeader({ alg: SESSION_ALGORITHM })
      .setSubject(USER.id)
      .setIssuer(SESSION_ISSUER)
      .setAudience(SESSION_AUDIENCE)
      .setIssuedAt(past)
      .setExpirationTime(past + 60)
      .sign(TEST_AUTH_CONFIG.sessionSecret);

    const response = await request(testApp())
      .get("/api/me")
      .set("Cookie", `${SESSION_COOKIE}=${token}`)
      .expect(200);

    expect(response.body).toEqual({ user: null });
  });

  it("ignores a cookie minted for a different audience", async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = await new SignJWT({ tv: USER.tokenVersion })
      .setProtectedHeader({ alg: SESSION_ALGORITHM })
      .setSubject(USER.id)
      .setIssuer(SESSION_ISSUER)
      .setAudience("some-other-app")
      .setIssuedAt(now)
      .setExpirationTime(now + SESSION_TTL_SECONDS)
      .sign(TEST_AUTH_CONFIG.sessionSecret);

    const response = await request(testApp())
      .get("/api/me")
      .set("Cookie", `${SESSION_COOKIE}=${token}`)
      .expect(200);

    expect(response.body).toEqual({ user: null });
  });

  it("ignores a token signed with a different HMAC algorithm", async () => {
    // This is the test that actually exercises the `algorithms` pin. jose infers
    // the acceptable algorithms from the key when the option is absent, and a
    // Uint8Array admits every HS*, so without the pin an HS512 token signed with
    // our own secret would verify. Removing `algorithms: [SESSION_ALGORITHM]`
    // from verifySessionToken makes this test fail; the alg:none case below
    // does not, because jose refuses unsigned tokens on its own.
    const now = Math.floor(Date.now() / 1000);
    const token = await new SignJWT({ tv: USER.tokenVersion })
      .setProtectedHeader({ alg: "HS512" })
      .setSubject(USER.id)
      .setIssuer(SESSION_ISSUER)
      .setAudience(SESSION_AUDIENCE)
      .setIssuedAt(now)
      .setExpirationTime(now + SESSION_TTL_SECONDS)
      .sign(TEST_AUTH_CONFIG.sessionSecret);

    const response = await request(testApp())
      .get("/api/me")
      .set("Cookie", `${SESSION_COOKIE}=${token}`)
      .expect(200);

    expect(response.body).toEqual({ user: null });
  });

  it("ignores an unsigned alg:none token", async () => {
    // Kept as a regression guard, but note what it does and does not prove: jose
    // rejects `alg: none` regardless of the `algorithms` option, so this passes
    // even with the pin removed. The HS512 case above is the one that tests it.
    const header = Buffer.from(
      JSON.stringify({ alg: "none", typ: "JWT" }),
    ).toString("base64url");
    const now = Math.floor(Date.now() / 1000);
    const payload = Buffer.from(
      JSON.stringify({
        sub: USER.id,
        tv: USER.tokenVersion,
        iss: SESSION_ISSUER,
        aud: SESSION_AUDIENCE,
        iat: now,
        exp: now + SESSION_TTL_SECONDS,
      }),
    ).toString("base64url");

    const response = await request(testApp())
      .get("/api/me")
      .set("Cookie", `${SESSION_COOKIE}=${header}.${payload}.`)
      .expect(200);

    expect(response.body).toEqual({ user: null });
  });

  it("ignores a malformed cookie without erroring", async () => {
    const response = await request(testApp())
      .get("/api/me")
      .set("Cookie", `${SESSION_COOKIE}=not-a-jwt`)
      .expect(200);

    expect(response.body).toEqual({ user: null });
  });
});

describe("POST /api/auth/logout", () => {
  it("clears the cookie and bumps the token version", async () => {
    const bumpVersion = vi.fn(async () => USER.tokenVersion + 1);
    const token = await issueSessionToken(
      { userId: USER.id, tokenVersion: USER.tokenVersion },
      TEST_AUTH_CONFIG,
    );

    const response = await request(testApp({ bumpVersion }))
      .post("/api/auth/logout")
      .set("Cookie", `${SESSION_COOKIE}=${token}`)
      .expect(204);

    expect(bumpVersion).toHaveBeenCalledWith(USER.id);
    expect(sessionCookie(response)).toContain(`${SESSION_COOKIE}=;`);
  });

  it("is idempotent for an anonymous caller and reveals nothing", async () => {
    const bumpVersion = vi.fn(async () => 1);

    await request(testApp({ bumpVersion }))
      .post("/api/auth/logout")
      .expect(204);

    expect(bumpVersion).not.toHaveBeenCalled();
  });
});
