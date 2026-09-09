import rateLimit, {
  ipKeyGenerator,
  type RateLimitRequestHandler,
} from "express-rate-limit";
import type { Request, Response } from "express";

import { ApiError } from "./errors.js";

/**
 * Azure App Service appends the client to `X-Forwarded-For` as `ip:port`, so
 * with `trust proxy` set Express reports `req.ip` as `203.0.113.5:41234` — a
 * value that changes on every TCP connection. Keying on that gives every
 * request its own bucket and the limiter never fires.
 *
 * express-rate-limit does detect the malformed address, but its validation
 * checks are disabled when NODE_ENV=production, which is exactly where this
 * runs. So strip the port explicitly and key on the address alone.
 */
export function clientKey(request: Request): string {
  const raw = request.ip ?? "";
  // IPv6 arrives bracketed as [::1]:41234 when a port is attached; IPv4 as
  // 203.0.113.5:41234. A bare IPv6 address contains colons but no brackets.
  const bracketed = /^\[(?<address>.+)\](?::\d+)?$/.exec(raw);
  const address =
    bracketed?.groups?.address ??
    /^(?<v4>\d{1,3}(?:\.\d{1,3}){3}):\d+$/.exec(raw)?.groups?.v4 ??
    raw;

  return ipKeyGenerator(address);
}

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
  keyGenerator: clientKey,
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
