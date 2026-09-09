import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "./app.js";

function testApp(dbConnected: boolean) {
  return createApp({
    checkDbConnection: async () => dbConnected,
    enableRateLimit: false,
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

  it("never echoes a posted password, even on the error path", async () => {
    const response = await request(testApp(true))
      .post("/api/health")
      .send({ password: "hunter2" });

    expect(JSON.stringify(response.body)).not.toContain("hunter2");
  });
});
