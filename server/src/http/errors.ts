import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

import { logger } from "../logging/logger.js";
import { requestIdOf } from "./request-id.js";

/**
 * Every API error is serialised as `{ error: { code, message, details? } }`.
 * Nothing else is ever sent on an error path, so a stack trace, a SQL message,
 * or a request body can never leak to a client.
 */
export interface ErrorEnvelope {
  error: {
    code: ErrorCode;
    message: string;
    details?: unknown;
  };
}

export const ERROR_CODES = [
  "bad_request",
  "validation_failed",
  "unauthorized",
  "forbidden",
  "not_found",
  "rate_limited",
  "internal_error",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  bad_request: 400,
  validation_failed: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  rate_limited: 429,
  internal_error: 500,
};

/** An error that is safe to show a client verbatim. */
export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details: unknown;

  constructor(code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = STATUS_BY_CODE[code];
    this.details = details;
  }

  static badRequest(message: string, details?: unknown): ApiError {
    return new ApiError("bad_request", message, details);
  }

  static unauthorized(message = "Sign in to continue."): ApiError {
    return new ApiError("unauthorized", message);
  }

  static forbidden(
    message = "You do not have access to this resource.",
  ): ApiError {
    return new ApiError("forbidden", message);
  }

  static notFound(message = "That resource does not exist."): ApiError {
    return new ApiError("not_found", message);
  }

  toEnvelope(): ErrorEnvelope {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.details === undefined ? {} : { details: this.details }),
      },
    };
  }
}

/**
 * Turns a zod failure into validation details. Only the field path and the
 * validation message are kept — never the value that failed, which may be user
 * secrets.
 */
export function zodDetails(error: ZodError): Array<{
  path: string;
  message: string;
}> {
  return error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));
}

/** Terminal 404 handler; mounted after every route. */
export function notFoundHandler(
  _request: Request,
  _response: Response,
  next: NextFunction,
): void {
  next(ApiError.notFound());
}

/**
 * Central error handler. Client errors are echoed; anything else becomes a
 * generic 500 whose internal cause is logged, never returned.
 */
export function errorHandler(
  error: unknown,
  _request: Request,
  response: Response,
  next: NextFunction,
): void {
  if (response.headersSent) {
    next(error);
    return;
  }

  const apiError =
    error instanceof ApiError
      ? error
      : error instanceof ZodError
        ? new ApiError(
            "validation_failed",
            "The request did not match the expected shape.",
            zodDetails(error),
          )
        : undefined;

  if (apiError !== undefined) {
    if (apiError.status >= 500) {
      logger.error(
        { err: apiError, requestId: requestIdOf(response) },
        "Request failed",
      );
    } else {
      logger.info(
        {
          code: apiError.code,
          status: apiError.status,
          requestId: requestIdOf(response),
        },
        "Request rejected",
      );
    }

    response.status(apiError.status).json(apiError.toEnvelope());
    return;
  }

  logger.error(
    { err: error, requestId: requestIdOf(response) },
    "Unhandled request error",
  );

  response
    .status(500)
    .json(
      new ApiError(
        "internal_error",
        "Something went wrong on our side. Please try again.",
      ).toEnvelope(),
    );
}
