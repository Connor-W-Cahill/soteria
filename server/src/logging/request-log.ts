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

    // "close" rather than "finish": an aborted or reset connection never
    // finishes, and that is exactly the traffic worth seeing.
    let logged = false;

    response.on("close", () => {
      if (logged) {
        return;
      }

      logged = true;

      const durationMs =
        Number(process.hrtime.bigint() - startedAt) / 1_000_000;

      logger.info(
        {
          method: request.method,
          path: request.route?.path ?? request.path,
          status: response.writableEnded ? response.statusCode : 499,
          durationMs: Math.round(durationMs),
          requestId: requestIdOf(response),
        },
        "request",
      );
    });

    next();
  };
}
