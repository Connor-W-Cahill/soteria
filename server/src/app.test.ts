import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "./app.js";

describe("GET /api/health", () => {
  it("returns the service health contract", async () => {
    const app = createApp({ checkDbConnection: async () => false });
    const response = await request(app).get("/api/health").expect(200);

    expect(response.body).toEqual({
      status: "ok",
      version: expect.any(String),
      dbConnected: false,
    });
  });

  it("reports dbConnected when the database answers", async () => {
    const app = createApp({ checkDbConnection: async () => true });
    const response = await request(app).get("/api/health").expect(200);

    expect(response.body.dbConnected).toBe(true);
  });
});
