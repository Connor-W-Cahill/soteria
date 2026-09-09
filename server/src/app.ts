import type { HealthResponse } from "@soteria/shared";
import express from "express";
import helmet from "helmet";
import { z } from "zod";

import { isDbConnected } from "./db/knex.js";
import { errorHandler, notFoundHandler } from "./http/errors.js";
import { globalRateLimit, publicRateLimit } from "./http/rate-limit.js";
import { requestId } from "./http/request-id.js";
import { validate } from "./http/validate.js";
import { requestLog } from "./logging/request-log.js";

const healthResponse = z.object({
  status: z.literal("ok"),
  version: z.string(),
  dbConnected: z.boolean(),
});

export interface AppOptions {
  /** Overridable so tests do not need a live database. */
  checkDbConnection?: () => Promise<boolean>;
  /** Disabled in tests that fire many requests in a row. */
  enableRateLimit?: boolean;
}

export function createApp(options: AppOptions = {}) {
  const checkDbConnection = options.checkDbConnection ?? isDbConnected;
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(helmet());
  app.use(requestId());
  app.use(requestLog());

  if (options.enableRateLimit !== false) {
    app.use(globalRateLimit());
  }

  app.use(express.json({ limit: "100kb" }));

  app.get(
    "/api/health",
    ...(options.enableRateLimit === false ? [] : [publicRateLimit()]),
    validate({ query: z.object({}).strict() }),
    (_request, response, next) => {
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
    },
  );

  // Must stay last: unmatched routes become a 404 envelope, and every thrown or
  // forwarded error becomes an `{ error: { code, message, details? } }` body.
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
