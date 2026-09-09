import type { HealthResponse } from "@soteria/shared";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { z } from "zod";

const healthResponse = z.object({
  status: z.literal("ok"),
  version: z.string(),
  dbConnected: z.boolean(),
});

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(rateLimit({ windowMs: 60_000, limit: 120 }));
  app.use(express.json({ limit: "100kb" }));

  app.get("/api/health", (_request, response) => {
    const health: HealthResponse = healthResponse.parse({
      status: "ok",
      version: process.env.npm_package_version ?? "0.1.0",
      dbConnected: false,
    });

    response.json(health);
  });

  return app;
}
