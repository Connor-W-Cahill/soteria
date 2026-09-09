import { randomUUID } from "node:crypto";

import type { NextFunction, Request, Response } from "express";

const HEADER = "x-request-id";

/**
 * Assigns every request a correlation id, echoed back in the `x-request-id`
 * response header and attached to every log line and audit row. An inbound id
 * is trusted only if it looks like a plain token, so a caller cannot inject
 * newlines or arbitrary text into the logs.
 */
export function requestId() {
  return (request: Request, response: Response, next: NextFunction): void => {
    const inbound = request.header(HEADER);
    const id =
      inbound !== undefined && /^[A-Za-z0-9._-]{1,60}$/.test(inbound)
        ? inbound
        : randomUUID();

    response.locals.requestId = id;
    response.setHeader(HEADER, id);
    next();
  };
}

export function requestIdOf(response: Response): string | undefined {
  const id: unknown = response.locals.requestId;

  return typeof id === "string" ? id : undefined;
}
