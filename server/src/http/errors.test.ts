import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  ApiError,
  bodyParserError,
  errorHandler,
  notFoundHandler,
  zodDetails,
} from "./errors.js";
import { requestId } from "./request-id.js";
import { validate, validated } from "./validate.js";

function appWith(mount: (app: express.Express) => void) {
  const app = express();

  app.use(requestId());
  app.use(express.json());
  mount(app);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

describe("the error envelope", () => {
  it("returns 404 with the envelope for an unknown route", async () => {
    const response = await request(appWith(() => {}))
      .get("/api/nope")
      .expect(404);

    expect(response.body).toEqual({
      error: { code: "not_found", message: "That resource does not exist." },
    });
  });

  it.each([
    ["unauthorized", 401, () => ApiError.unauthorized()],
    ["forbidden", 403, () => ApiError.forbidden()],
    ["bad_request", 400, () => ApiError.badRequest("Nope.")],
  ])("maps %s to %i", async (code, status, make) => {
    const app = appWith((instance) => {
      instance.get("/boom", (_request, _response, next) => next(make()));
    });
    const response = await request(app).get("/boom").expect(status);

    expect(response.body.error.code).toBe(code);
  });

  it("turns an unexpected throw into a generic 500 that leaks nothing", async () => {
    const app = appWith((instance) => {
      instance.get("/boom", () => {
        throw new Error("connection string sa:hunter2@db failed");
      });
    });
    const response = await request(app).get("/boom").expect(500);

    expect(response.body).toEqual({
      error: {
        code: "internal_error",
        message: "Something went wrong on our side. Please try again.",
      },
    });
    expect(JSON.stringify(response.body)).not.toContain("hunter2");
  });

  it("echoes a correlation id on the error response", async () => {
    const response = await request(appWith(() => {}))
      .get("/api/nope")
      .set("x-request-id", "abc-123");

    expect(response.headers["x-request-id"]).toBe("abc-123");
  });

  it("ignores an inbound request id that is not a plain token", async () => {
    const response = await request(appWith(() => {}))
      .get("/api/nope")
      .set("x-request-id", "spaces and <script> are not tokens");

    expect(response.headers["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe("zodDetails", () => {
  it("keeps the path and message but never the offending value", () => {
    const schema = z.object({ password: z.string().min(12) });
    const result = schema.safeParse({ password: "short" });

    expect(result.success).toBe(false);

    const details = zodDetails(result.error!);

    expect(details[0]?.path).toBe("password");
    expect(JSON.stringify(details)).not.toContain("short");
  });
});

describe("validate", () => {
  const schema = z.object({ email: z.string().email() });

  it("rejects an invalid body with validation_failed and field paths only", async () => {
    const app = appWith((instance) => {
      instance.post("/thing", validate({ body: schema }), (_req, res) => {
        res.json({ ok: true });
      });
    });

    const response = await request(app)
      .post("/thing")
      .send({ email: "not-an-email", password: "hunter2" })
      .expect(400);

    expect(response.body.error.code).toBe("validation_failed");
    expect(response.body.error.details).toEqual([
      { path: "email", message: expect.any(String) },
    ]);
    expect(JSON.stringify(response.body)).not.toContain("hunter2");
  });

  it("passes the parsed body to the handler", async () => {
    const app = appWith((instance) => {
      instance.post("/thing", validate({ body: schema }), (req, res) => {
        res.json(validated<{ email: string }>(req).body);
      });
    });

    const response = await request(app)
      .post("/thing")
      .send({ email: "a@example.test" })
      .expect(200);

    expect(response.body).toEqual({ email: "a@example.test" });
  });

  it("throws when a handler reads validated input it never validated", () => {
    expect(() => validated({} as express.Request)).toThrow(
      /no validate\(\) middleware/,
    );
  });
});

/**
 * Security review finding 2: body-parser attaches the raw request body to a
 * parse failure as an own enumerable `body` property. Such an error must be
 * translated into a client error, and must never be handed to the logger whole
 * — `serializeError` drops the attached `body`, which is proved in
 * `logging/logger.test.ts`.
 */
describe("bodyParserError", () => {
  function parseFailure(type: string, body: string) {
    return Object.assign(new SyntaxError("Unexpected end of JSON input"), {
      type,
      body,
      status: 400,
      expose: true,
    });
  }

  it("maps a parse failure to bad_request without echoing the body", () => {
    const apiError = bodyParserError(
      parseFailure("entity.parse.failed", '{"password":"hunter2"'),
    );

    expect(apiError?.code).toBe("bad_request");
    expect(apiError?.status).toBe(400);
    expect(JSON.stringify(apiError?.toEnvelope())).not.toContain("hunter2");
  });

  it("maps an oversized body to payload_too_large", () => {
    const apiError = bodyParserError(parseFailure("entity.too.large", "x"));

    expect(apiError?.code).toBe("payload_too_large");
    expect(apiError?.status).toBe(413);
  });

  it("ignores anything that is not a body-parser error", () => {
    expect(bodyParserError(new Error("unrelated"))).toBeUndefined();
    expect(bodyParserError({ type: "not.entity" })).toBeUndefined();
    expect(bodyParserError(null)).toBeUndefined();
  });

  it("routes a parse failure through the handler as a 400 envelope", async () => {
    const app = appWith((instance) => {
      instance.post("/thing", (_request, _response, next) => {
        next(parseFailure("entity.parse.failed", '{"password":"hunter2"'));
      });
    });

    const response = await request(app).post("/thing").expect(400);

    expect(response.body.error.code).toBe("bad_request");
    expect(JSON.stringify(response.body)).not.toContain("hunter2");
  });
});
