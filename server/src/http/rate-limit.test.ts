import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { errorHandler, notFoundHandler } from "./errors.js";
import {
  globalRateLimit,
  publicRateLimit,
  sensitiveRateLimit,
} from "./rate-limit.js";

function appWithLimit(limiter: express.RequestHandler, trustProxy = false) {
  const app = express();

  if (trustProxy) {
    app.set("trust proxy", 1);
  }

  app.use(limiter);
  app.get("/thing", (_request, response) => response.json({ ok: true }));
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

describe("rate limiting", () => {
  it("answers a rate-limited request with the error envelope", async () => {
    const app = appWithLimit(sensitiveRateLimit());

    for (let attempt = 0; attempt < 10; attempt += 1) {
      await request(app).get("/thing").expect(200);
    }

    const response = await request(app).get("/thing").expect(429);

    expect(response.body).toEqual({
      error: {
        code: "rate_limited",
        message: "Too many requests. Please wait a moment and try again.",
      },
    });
  });

  it("gives public endpoints a lower ceiling than the global limit", async () => {
    const app = appWithLimit(publicRateLimit());

    for (let attempt = 0; attempt < 30; attempt += 1) {
      await request(app).get("/thing").expect(200);
    }

    await request(app).get("/thing").expect(429);
  });
});

/**
 * Security review finding 1: Azure App Service appends the client to
 * X-Forwarded-For as `ip:port`, so `req.ip` changed on every connection and the
 * limiter never fired. express-rate-limit's own validation would have caught the
 * malformed address, but its checks are disabled when NODE_ENV=production —
 * exactly where this runs. These tests send the real Azure header shape.
 */
describe("rate limiting behind Azure App Service", () => {
  const AZURE_XFF = "9.9.9.9, 203.0.113.5:41234";

  it("still limits when the client arrives as ip:port on X-Forwarded-For", async () => {
    const app = appWithLimit(sensitiveRateLimit(), true);

    for (let attempt = 0; attempt < 10; attempt += 1) {
      await request(app)
        .get("/thing")
        .set("x-forwarded-for", AZURE_XFF)
        .expect(200);
    }

    const response = await request(app)
      .get("/thing")
      .set("x-forwarded-for", AZURE_XFF)
      .expect(429);

    expect(response.body.error.code).toBe("rate_limited");
  });

  it("keys on the address, so a changing source port shares one bucket", async () => {
    const app = appWithLimit(sensitiveRateLimit(), true);

    for (let attempt = 0; attempt < 10; attempt += 1) {
      await request(app)
        .get("/thing")
        .set("x-forwarded-for", `9.9.9.9, 203.0.113.5:${40000 + attempt}`)
        .expect(200);
    }

    await request(app)
      .get("/thing")
      .set("x-forwarded-for", "9.9.9.9, 203.0.113.5:59999")
      .expect(429);
  });

  it("keeps separate buckets for genuinely different clients", async () => {
    const app = appWithLimit(sensitiveRateLimit(), true);

    for (let attempt = 0; attempt < 10; attempt += 1) {
      await request(app)
        .get("/thing")
        .set("x-forwarded-for", "9.9.9.9, 203.0.113.5:41234")
        .expect(200);
    }

    await request(app)
      .get("/thing")
      .set("x-forwarded-for", "9.9.9.9, 198.51.100.7:41234")
      .expect(200);
  });

  it("handles a bracketed IPv6 client with a port", async () => {
    const app = appWithLimit(sensitiveRateLimit(), true);

    for (let attempt = 0; attempt < 10; attempt += 1) {
      await request(app)
        .get("/thing")
        .set("x-forwarded-for", "9.9.9.9, [2001:db8::1]:41234")
        .expect(200);
    }

    await request(app)
      .get("/thing")
      .set("x-forwarded-for", "9.9.9.9, [2001:db8::1]:50000")
      .expect(429);
  });

  it("applies the global ceiling too", async () => {
    const app = appWithLimit(globalRateLimit(), true);

    for (let attempt = 0; attempt < 120; attempt += 1) {
      await request(app)
        .get("/thing")
        .set("x-forwarded-for", `9.9.9.9, 203.0.113.9:${40000 + attempt}`)
        .expect(200);
    }

    await request(app)
      .get("/thing")
      .set("x-forwarded-for", "9.9.9.9, 203.0.113.9:60000")
      .expect(429);
  });
});
