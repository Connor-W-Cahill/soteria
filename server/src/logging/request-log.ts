import type { NextFunction, Request, Response } from "express";

import { requestIdOf } from "../http/request-id.js";
import { logger } from "./logger.js";

/**
 * One log line per request, recording only method, route, status, and duration.
 * Request bodies and query strings are deliberately not logged at all: the
 * redaction list in `logger.ts` is the safety net, not the policy.
 */
export function requestLog() {
  return (request: Request, response: Response, next: NextFunction): void => {
    const startedAt = process.hrtime.bigint();

    response.on("finish", () => {
      const durationMs =
        Number(process.hrtime.bigint() - startedAt) / 1_000_000;

      logger.info(
        {
          method: request.method,
          path: request.route?.path ?? request.path,
          status: response.statusCode,
          durationMs: Math.round(durationMs),
          requestId: requestIdOf(response),
        },
        "request",
      );
    });

    next();
  };
}
