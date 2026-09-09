import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../app.js";
import { TEST_AUTH_CONFIG } from "../auth/testing.js";
import { allowedOrigins, corsOptions } from "./security.js";

const SWA = "https://soteria-web-abc123.azurestaticapps.net";

function testApp() {
  return createApp({
    checkDbConnection: async () => true,
    enableRateLimit: false,
    auth: TEST_AUTH_CONFIG,
  });
}

describe("allowedOrigins", () => {
  it("uses WEB_ORIGIN when it is set", () => {
    expect(allowedOrigins({ WEB_ORIGIN: SWA })).toEqual([SWA]);
  });

  it("falls back to the Vite dev server outside production", () => {
    expect(allowedOrigins({ NODE_ENV: "development" })).toContain(
      "http://localhost:5173",
    );
  });

  it("allows nothing in production when WEB_ORIGIN is unset", () => {
    expect(allowedOrigins({ NODE_ENV: "production" })).toEqual([]);
  });

  it("never allows a wildcard", () => {
    for (const env of [
      { NODE_ENV: "production", WEB_ORIGIN: SWA },
      { NODE_ENV: "development" },
      {},
    ]) {
      expect(allowedOrigins(env)).not.toContain("*");
    }
  });
});

describe("corsOptions", () => {
  function decide(env: NodeJS.ProcessEnv, origin: string | undefined) {
    let allowed: unknown;
    const { origin: check } = corsOptions(env);

    (
      check as (
        o: string | undefined,
        cb: (e: null, a?: boolean) => void,
      ) => void
    )(origin, (_error, value) => {
      allowed = value;
    });

    return allowed;
  }

  it("allows the configured Static Web App origin", () => {
    expect(decide({ WEB_ORIGIN: SWA }, SWA)).toBe(true);
  });

  it("rejects any other origin, including a lookalike", () => {
    expect(decide({ WEB_ORIGIN: SWA }, "https://evil.example")).toBe(false);
    expect(decide({ WEB_ORIGIN: SWA }, `${SWA}.evil.example`)).toBe(false);
  });

  it("allows requests with no Origin header, which are not CORS requests", () => {
    expect(decide({ WEB_ORIGIN: SWA }, undefined)).toBe(true);
  });

  it("allows credentials, because the session is an httpOnly cookie", () => {
    expect(corsOptions({ WEB_ORIGIN: SWA }).credentials).toBe(true);
  });
});

describe("security headers", () => {
  it("keeps helmet's defaults on", async () => {
    const response = await request(testApp()).get("/api/health");

    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.headers["referrer-policy"]).toBe("no-referrer");
    expect(response.headers["x-powered-by"]).toBeUndefined();
  });

  it("does not pin HSTS outside production", async () => {
    const response = await request(testApp()).get("/api/health");

    expect(response.headers["strict-transport-security"]).toBeUndefined();
  });
});
