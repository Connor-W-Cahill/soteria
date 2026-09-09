import { describe, expect, it } from "vitest";

import {
  AuthConfigError,
  MIN_SESSION_SECRET_BYTES,
  readAuthConfig,
} from "./config.js";

const GOOD = {
  GOOGLE_CLIENT_ID: "client.apps.googleusercontent.com",
  SESSION_SECRET: "x".repeat(MIN_SESSION_SECRET_BYTES),
} satisfies NodeJS.ProcessEnv;

describe("readAuthConfig", () => {
  it("reads both values", () => {
    const config = readAuthConfig(GOOD);

    expect(config.googleClientId).toBe(GOOD.GOOGLE_CLIENT_ID);
    expect(config.sessionSecret.byteLength).toBe(MIN_SESSION_SECRET_BYTES);
  });

  it("throws when the client id is missing", () => {
    expect(() =>
      readAuthConfig({ SESSION_SECRET: GOOD.SESSION_SECRET }),
    ).toThrow(AuthConfigError);
  });

  it("throws when the client id is blank", () => {
    expect(() => readAuthConfig({ ...GOOD, GOOGLE_CLIENT_ID: "   " })).toThrow(
      AuthConfigError,
    );
  });

  it("throws when the session secret is missing", () => {
    expect(() =>
      readAuthConfig({ GOOGLE_CLIENT_ID: GOOD.GOOGLE_CLIENT_ID }),
    ).toThrow(AuthConfigError);
  });

  it("rejects a session secret shorter than the HS256 block size", () => {
    expect(() =>
      readAuthConfig({
        ...GOOD,
        SESSION_SECRET: "x".repeat(MIN_SESSION_SECRET_BYTES - 1),
      }),
    ).toThrow(AuthConfigError);
  });

  it("never puts the secret in the error message", () => {
    const secret = "a-recognisable-short-secret";

    try {
      readAuthConfig({ ...GOOD, SESSION_SECRET: secret });
      expect.unreachable("should have thrown");
    } catch (error) {
      expect((error as Error).message).not.toContain(secret);
      expect((error as Error).message).toContain("bytes");
    }
  });

  it("does not set Secure outside production", () => {
    expect(
      readAuthConfig({ ...GOOD, NODE_ENV: "development" }).secureCookies,
    ).toBe(false);
  });

  it("sets Secure in production", () => {
    expect(
      readAuthConfig({ ...GOOD, NODE_ENV: "production" }).secureCookies,
    ).toBe(true);
  });
});
