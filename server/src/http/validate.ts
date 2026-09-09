import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { ZodType } from "zod";

import { ApiError, zodDetails } from "./errors.js";

/**
 * Schemas for the parts of a request a route accepts. Anything not listed is
 * not validated and must not be read by the route: every handler reads its
 * input from `validated(request)`, never from `request.body` directly.
 */
export interface RequestSchemas {
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
}

export interface ValidatedRequest<
  TBody = unknown,
  TQuery = unknown,
  TParams = unknown,
> {
  body: TBody;
  query: TQuery;
  params: TParams;
}

const STORE = Symbol.for("soteria.validated");

/**
 * Validates the request against the given schemas and stores the parsed result.
 * On failure the response is `400 validation_failed` with field paths and
 * messages only — never the offending values, which may be user secrets.
 */
export function validate(schemas: RequestSchemas): RequestHandler {
  return (request: Request, _response: Response, next: NextFunction): void => {
    const parsed: Record<string, unknown> = {
      body: undefined,
      query: undefined,
      params: undefined,
    };

    for (const part of ["body", "query", "params"] as const) {
      const schema = schemas[part];

      if (schema === undefined) {
        continue;
      }

      const result = schema.safeParse(request[part]);

      if (!result.success) {
        next(
          new ApiError(
            "validation_failed",
            `The request ${part} did not match the expected shape.`,
            zodDetails(result.error),
          ),
        );
        return;
      }

      parsed[part] = result.data;
    }

    (request as unknown as Record<symbol, unknown>)[STORE] = parsed;
    next();
  };
}

/** Reads the validated payload a `validate()` middleware stored. */
export function validated<TBody = unknown, TQuery = unknown, TParams = unknown>(
  request: Request,
): ValidatedRequest<TBody, TQuery, TParams> {
  const stored = (request as unknown as Record<symbol, unknown>)[STORE];

  if (stored === undefined) {
    throw new Error(
      "validated() was called on a route with no validate() middleware.",
    );
  }

  return stored as ValidatedRequest<TBody, TQuery, TParams>;
}
