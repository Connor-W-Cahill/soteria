import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

import { logger, serializeError } from "../logging/logger.js";
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
  "conflict",
  "payload_too_large",
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
  conflict: 409,
  payload_too_large: 413,
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

  /** The request is valid but collides with state that already exists. */
  static conflict(message: string): ApiError {
    return new ApiError("conflict", message);
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

/**
 * Translates the errors `express.json()` throws into the envelope.
 *
 * body-parser attaches the **raw request body** to a parse failure as an own
 * enumerable `body` property, so such an error must never be logged whole and
 * must never fall through to the generic 500 branch. Its `type` is a stable
 * `entity.*` string.
 */
export function bodyParserError(error: unknown): ApiError | undefined {
  if (typeof error !== "object" || error === null) {
    return undefined;
  }

  const type = (error as { type?: unknown }).type;

  if (typeof type !== "string" || !type.startsWith("entity.")) {
    return undefined;
  }

  if (type === "entity.too.large") {
    return new ApiError("payload_too_large", "That request body is too large.");
  }

  return ApiError.badRequest("The request body could not be parsed as JSON.");
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
        : bodyParserError(error);

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

  // Only the serialised allowlist is logged. The raw error must never be
  // handed to the logger: body-parser attaches the offending request body to
  // its errors, and a driver attaches its query bindings.
  logger.error(
    { err: serializeError(error), requestId: requestIdOf(response) },
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
