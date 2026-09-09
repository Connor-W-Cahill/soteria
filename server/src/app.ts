import type { HealthResponse } from "@soteria/shared";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { z } from "zod";

import { isDbConnected } from "./db/knex.js";

const healthResponse = z.object({
  status: z.literal("ok"),
  version: z.string(),
  dbConnected: z.boolean(),
});

export interface AppOptions {
  /** Overridable so tests do not need a live database. */
  checkDbConnection?: () => Promise<boolean>;
}

export function createApp(options: AppOptions = {}) {
  const checkDbConnection = options.checkDbConnection ?? isDbConnected;
  const app = express();

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(rateLimit({ windowMs: 60_000, limit: 120 }));
  app.use(express.json({ limit: "100kb" }));

  app.get("/api/health", (_request, response, next) => {
    checkDbConnection()
      .then((dbConnected) => {
        const health: HealthResponse = healthResponse.parse({
          status: "ok",
          version: process.env.npm_package_version ?? "0.1.0",
          dbConnected,
        });

        response.json(health);
      })
      .catch(next);
  });

  return app;
}
