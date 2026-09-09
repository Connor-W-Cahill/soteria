import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { errorHandler, notFoundHandler } from "./errors.js";
import { publicRateLimit, sensitiveRateLimit } from "./rate-limit.js";

function appWithLimit(limiter: express.RequestHandler) {
  const app = express();

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
