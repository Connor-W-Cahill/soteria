import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "./app.js";
import { TEST_AUTH_CONFIG } from "./auth/testing.js";

function testApp(dbConnected: boolean) {
  return createApp({
    checkDbConnection: async () => dbConnected,
    enableRateLimit: false,
    auth: TEST_AUTH_CONFIG,
  });
}

describe("GET /api/health", () => {
  it("returns the service health contract", async () => {
    const response = await request(testApp(false))
      .get("/api/health")
      .expect(200);

    expect(response.body).toEqual({
      status: "ok",
      version: expect.any(String),
      dbConnected: false,
    });
  });

  it("reports dbConnected when the database answers", async () => {
    const response = await request(testApp(true))
      .get("/api/health")
      .expect(200);

    expect(response.body.dbConnected).toBe(true);
  });

  it("rejects unexpected query parameters with the error envelope", async () => {
    const response = await request(testApp(true))
      .get("/api/health?debug=1")
      .expect(400);

    expect(response.body.error.code).toBe("validation_failed");
  });
});

describe("the app's shared conventions", () => {
  it("returns the 404 envelope for an unknown route", async () => {
    const response = await request(testApp(true))
      .get("/api/unknown")
      .expect(404);

    expect(response.body).toEqual({
      error: { code: "not_found", message: "That resource does not exist." },
    });
  });

  it("sets a correlation id on every response", async () => {
    const response = await request(testApp(true)).get("/api/health");

    expect(response.headers["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("keeps helmet's security headers", async () => {
    const response = await request(testApp(true)).get("/api/health");

    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.headers["x-powered-by"]).toBeUndefined();
  });

  /**
   * Security review finding 2: body-parser attaches the raw request body to a
   * parse failure as an own enumerable property, so an unparseable body with a
   * password in it was written to the log verbatim, and the request got a 500
   * instead of a 400.
   */
  it("rejects a malformed JSON body with 400, not 500", async () => {
    const response = await request(testApp(true))
      .post("/api/health")
      .set("content-type", "application/json")
      .send('{"password":"hunter2"');

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("bad_request");
    expect(JSON.stringify(response.body)).not.toContain("hunter2");
  });

  it("rejects an oversized body with 413 rather than 500", async () => {
    const response = await request(testApp(true))
      .post("/api/health")
      .set("content-type", "application/json")
      .send(JSON.stringify({ note: "x".repeat(200_000) }));

    expect(response.status).toBe(413);
    expect(response.body.error.code).toBe("payload_too_large");
  });

  it("never echoes a posted password, even on the error path", async () => {
    const response = await request(testApp(true))
      .post("/api/health")
      .send({ password: "hunter2" });

    expect(JSON.stringify(response.body)).not.toContain("hunter2");
  });
});
