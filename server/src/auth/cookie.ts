import type { Response } from "express";

import type { AuthConfig } from "./config.js";
import { SESSION_TTL_SECONDS } from "./session.js";

/** The only cookie Soteria sets. */
export const SESSION_COOKIE = "soteria_session";

/**
 * Cookie attributes, fixed in one place so no route can weaken them.
 *
 * - `httpOnly` keeps the token out of `document.cookie`, so an XSS foothold
 *   cannot read the session out of the page.
 * - `sameSite: "lax"` stops the cookie riding along on cross-site POSTs, which
 *   is the CSRF control for the state-changing routes; `lax` rather than
 *   `strict` so that following a link back into the app keeps you signed in.
 * - `secure` is on everywhere except plain-HTTP local development.
 * - `path: "/"` because the API and the app share an origin in production.
 */
function attributes(config: AuthConfig) {
  return {
    httpOnly: true,
    secure: config.secureCookies,
    sameSite: "lax" as const,
    path: "/",
  };
}

export function setSessionCookie(
  response: Response,
  token: string,
  config: AuthConfig,
): void {
  response.cookie(SESSION_COOKIE, token, {
    ...attributes(config),
    maxAge: SESSION_TTL_SECONDS * 1000,
  });
}

/**
 * Clears the cookie.
 *
 * The attributes must match the ones it was set with or the browser treats it as
 * a different cookie and leaves the original in place — a sign-out that appears
 * to work and does not.
 */
export function clearSessionCookie(
  response: Response,
  config: AuthConfig,
): void {
  response.clearCookie(SESSION_COOKIE, attributes(config));
}
