import rateLimit, { type RateLimitRequestHandler } from "express-rate-limit";
import type { Request, Response } from "express";

import { ApiError } from "./errors.js";

function envelopeHandler(_request: Request, response: Response): void {
  response
    .status(429)
    .json(
      new ApiError(
        "rate_limited",
        "Too many requests. Please wait a moment and try again.",
      ).toEnvelope(),
    );
}

const shared = {
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: envelopeHandler,
} as const;

/** Baseline limit applied to the whole API. */
export function globalRateLimit(): RateLimitRequestHandler {
  return rateLimit({ ...shared, windowMs: 60_000, limit: 120 });
}

/**
 * Tighter limit for unauthenticated endpoints, which are the ones an outsider
 * can reach. Mounted per-router by the feature phases.
 */
export function publicRateLimit(): RateLimitRequestHandler {
  return rateLimit({ ...shared, windowMs: 60_000, limit: 30 });
}

/**
 * Strictest limit, for endpoints that mint or verify credentials (US-14) and
 * for the internal job triggers (US-31).
 */
export function sensitiveRateLimit(): RateLimitRequestHandler {
  return rateLimit({ ...shared, windowMs: 15 * 60_000, limit: 10 });
}
