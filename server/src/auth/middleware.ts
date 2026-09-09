import type { NextFunction, Request, RequestHandler, Response } from "express";

import { ApiError } from "../http/errors.js";
import type { AuthConfig } from "./config.js";
import { SESSION_COOKIE, clearSessionCookie } from "./cookie.js";
import { verifySessionToken } from "./session.js";
import { findUserById, type UserRecord } from "./users.js";

const STORE = Symbol.for("soteria.session");

export interface SessionContext {
  user: UserRecord;
}

/** Reads the session a middleware attached. */
export function sessionOf(request: Request): SessionContext | undefined {
  return (request as Request & { [STORE]?: SessionContext })[STORE];
}

export interface SessionMiddlewareOptions {
  config: AuthConfig;
  /** Overridable so route tests need no database. */
  loadUser?: (id: string) => Promise<UserRecord | undefined>;
}

/**
 * Attaches the session when the cookie is valid, and does nothing when it is
 * not. Never rejects: this is for routes that render differently for a signed-in
 * user but work anonymously, which on this site is most of them.
 *
 * Three things have to hold, and the third is the one that is easy to forget:
 * the cookie must verify, the user row must still exist, and the token version
 * in the cookie must equal the row's. That last check is what makes revocation
 * real — without it a bumped `token_version` would change nothing and a signed
 * cookie would outlive a sign-out-everywhere or an account deletion.
 *
 * A cookie that fails any of the three is actively cleared, so a browser holding
 * a stale or revoked token stops sending it instead of retrying forever.
 */
export function attachSession(
  options: SessionMiddlewareOptions,
): RequestHandler {
  const loadUser = options.loadUser ?? findUserById;

  return (request: Request, response: Response, next: NextFunction): void => {
    const cookies = (request as Request & { cookies?: Record<string, unknown> })
      .cookies;
    const raw = cookies?.[SESSION_COOKIE];

    if (typeof raw !== "string" || raw === "") {
      next();
      return;
    }

    verifySessionToken(raw, options.config)
      .then(async (claims) => {
        if (claims === undefined) {
          clearSessionCookie(response, options.config);
          return;
        }

        const user = await loadUser(claims.userId);

        if (user === undefined || user.tokenVersion !== claims.tokenVersion) {
          clearSessionCookie(response, options.config);
          return;
        }

        (request as Request & { [STORE]?: SessionContext })[STORE] = { user };
      })
      .then(() => next())
      .catch(next);
  };
}

/**
 * Rejects the request with 401 unless a session was attached. Mount `attachSession`
 * before this; on its own it would reject everything.
 */
export function requireSession(): RequestHandler {
  return (request: Request, _response: Response, next: NextFunction): void => {
    if (sessionOf(request) === undefined) {
      next(ApiError.unauthorized());
      return;
    }

    next();
  };
}
