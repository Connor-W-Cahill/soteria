import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "./app.js";

describe("GET /api/health", () => {
  it("returns the service health contract", async () => {
    const response = await request(createApp()).get("/api/health").expect(200);

    expect(response.body).toEqual({
      status: "ok",
      version: expect.any(String),
      dbConnected: false,
    });
  });
});
