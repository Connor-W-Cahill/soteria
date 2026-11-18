import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createApp } from "../app.js";
import { TEST_AUTH_CONFIG } from "../auth/testing.js";
import { readClientHeaders, resolveClientDir } from "./client.js";

/**
 * Issue #111: the deployed document must carry the client CSP and the four
 * security headers that the Static Web App used to send. This uses the real
 * committed `client/public/security-headers.json` — the file the Vite build
 * copies into `dist/` — and `client/csp.test.ts` pins that file to `PROD_CSP`,
 * so the chain from `csp.mjs` to the wire is asserted end to end.
 */
const COMMITTED_HEADERS = fileURLToPath(
  new URL("../../../client/public/security-headers.json", import.meta.url),
);

const EXPECTED = readClientHeaders(path.dirname(COMMITTED_HEADERS));

let clientDir: string;

function app(dir: string | null = clientDir) {
  return createApp({
    checkDbConnection: async () => true,
    enableRateLimit: false,
    auth: TEST_AUTH_CONFIG,
    clientDir: dir,
  });
}

function expectClientHeaders(headers: Record<string, string>) {
  for (const [name, value] of Object.entries(EXPECTED)) {
    expect(headers[name], name).toBe(value);
  }
}

beforeAll(() => {
  clientDir = mkdtempSync(path.join(tmpdir(), "soteria-client-"));
  mkdirSync(path.join(clientDir, "assets"));
  writeFileSync(
    path.join(clientDir, "index.html"),
    "<!doctype html><title>Soteria</title>",
  );
  writeFileSync(
    path.join(clientDir, "assets", "index-abc123.js"),
    "console.log(1)",
  );
  copyFileSync(
    COMMITTED_HEADERS,
    path.join(clientDir, "security-headers.json"),
  );
});

afterAll(() => {
  rmSync(clientDir, { recursive: true, force: true });
});

describe("serving the client from the API origin (#111)", () => {
  it("sends the client document with the client CSP and security headers", async () => {
    const response = await request(app()).get("/");

    expect(response.status).toBe(200);
    expect(response.text).toContain("<title>Soteria</title>");
    expectClientHeaders(response.headers);
    expect(response.headers["cache-control"]).toBe("no-cache");
  });

  it("answers client-side routes with index.html and the same headers", async () => {
    for (const route of ["/signin", "/scores", "/settings/account"]) {
      const response = await request(app()).get(route);

      expect(response.status, route).toBe(200);
      expect(response.text).toContain("<title>Soteria</title>");
      expectClientHeaders(response.headers);
    }
  });

  it("does not let the API's default-src 'none' policy reach the document", async () => {
    const response = await request(app()).get("/signin");

    expect(response.headers["content-security-policy"]).not.toMatch(
      /^default-src 'none'/,
    );
    expect(response.headers["content-security-policy"]).toContain(
      "connect-src 'self' https://api.pwnedpasswords.com",
    );
  });

  it("allows the Google sign-in popup to talk back to the page", async () => {
    const response = await request(app()).get("/signin");

    expect(response.headers["cross-origin-opener-policy"]).toBe(
      "same-origin-allow-popups",
    );
  });

  it("serves hashed assets with long-lived caching and the security headers", async () => {
    const response = await request(app()).get("/assets/index-abc123.js");

    expect(response.status).toBe(200);
    expect(response.headers["cache-control"]).toBe(
      "public, max-age=31536000, immutable",
    );
    expectClientHeaders(response.headers);
  });

  it("returns 404, not index.html, for a missing asset", async () => {
    for (const missing of ["/assets/gone.js", "/missing.css", "/favicon.ico"]) {
      const response = await request(app()).get(missing);

      expect(response.status, missing).toBe(404);
      expect(response.text).not.toContain("<title>Soteria</title>");
    }
  });

  it("leaves the API alone: JSON 404 envelope and the API's own CSP", async () => {
    const response = await request(app()).get("/api/does-not-exist");

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBeDefined();
    expect(response.headers["content-security-policy"]).toMatch(
      /^default-src 'none'/,
    );

    const health = await request(app()).get("/api/health");
    expect(health.body.status).toBe("ok");
  });

  it("does not answer non-GET requests with the document", async () => {
    const response = await request(app()).post("/signin").send({});

    expect(response.status).toBe(404);
  });

  it("serves no client when none is configured", async () => {
    const response = await request(app(null)).get("/");

    expect(response.status).toBe(404);
  });
});

describe("readClientHeaders", () => {
  it("refuses to serve a client build that has no security-headers.json", () => {
    const empty = mkdtempSync(path.join(tmpdir(), "soteria-empty-"));
    writeFileSync(path.join(empty, "index.html"), "<!doctype html>");

    try {
      expect(() => app(empty)).toThrow(/refusing to serve the client/);
    } finally {
      rmSync(empty, { recursive: true, force: true });
    }
  });

  it("refuses a headers file that drops the CSP", () => {
    const partial = mkdtempSync(path.join(tmpdir(), "soteria-partial-"));
    writeFileSync(
      path.join(partial, "security-headers.json"),
      JSON.stringify({ ...EXPECTED, "content-security-policy": "" }),
    );

    try {
      expect(() => readClientHeaders(partial)).toThrow(
        /content-security-policy/,
      );
    } finally {
      rmSync(partial, { recursive: true, force: true });
    }
  });
});

describe("resolveClientDir", () => {
  it("serves nothing by default outside production, where Vite serves the client", () => {
    expect(resolveClientDir({ NODE_ENV: "development" })).toBeUndefined();
  });

  it("defaults to the bundled public/ directory in production", () => {
    expect(resolveClientDir({ NODE_ENV: "production" })).toMatch(
      /[\\/]public$/,
    );
  });

  it("honours CLIENT_DIR", () => {
    expect(resolveClientDir({ CLIENT_DIR: "/srv/client" })).toBe(
      path.resolve("/srv/client"),
    );
  });
});
