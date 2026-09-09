import type { MeResponse, SessionUser } from "@soteria/shared";
import { Router, type RequestHandler } from "express";
import { z } from "zod";

import { recordAuditEvent } from "../db/audit.js";
import { ApiError } from "../http/errors.js";
import { sensitiveRateLimit } from "../http/rate-limit.js";
import { requestIdOf } from "../http/request-id.js";
import { validate, validated } from "../http/validate.js";
import type { AuthConfig } from "./config.js";
import { clearSessionCookie, setSessionCookie } from "./cookie.js";
import { GoogleTokenError, verifyGoogleIdToken } from "./google.js";
import { requireSession, sessionOf } from "./middleware.js";
import { issueSessionToken } from "./session.js";
import {
  bumpTokenVersion,
  upsertGoogleUser,
  type UserRecord,
} from "./users.js";

const googleSignIn = z
  .object({
    // Google ID tokens are compact JWTs. The bound is generous but finite so a
    // multi-megabyte string is rejected before any crypto is attempted.
    credential: z.string().min(1).max(4096),
  })
  .strict();

function toSessionUser(user: UserRecord): SessionUser {
  return { id: user.id, email: user.email, displayName: user.displayName };
}

export interface AuthRouterOptions {
  config: AuthConfig;
  /**
   * Disabled by tests that fire many requests in a row, exactly as
   * `AppOptions.enableRateLimit` does for the global limiter.
   */
  enableRateLimit?: boolean;
  /** Overridable so route tests need neither Google nor a database. */
  verifyIdToken?: typeof verifyGoogleIdToken;
  upsertUser?: typeof upsertGoogleUser;
  bumpVersion?: typeof bumpTokenVersion;
  /** Overridable so route tests need no database. */
  audit?: (event: Parameters<typeof recordAuditEvent>[0]) => Promise<void>;
}

/**
 * `/api/me` answers with an id, an email and a display name, and Express adds an
 * ETag, so without this the body is storable and revalidates with a 304. There is
 * no shared cache in front of the API today; there will be the day anything
 * (Front Door, APIM, a corporate proxy) is added, and by then nobody will
 * remember to look.
 */
function noStore(): RequestHandler {
  return (_request, response, next) => {
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("Vary", "Cookie, Origin");
    next();
  };
}

export function authRouter(options: AuthRouterOptions): Router {
  const config = options.config;
  const verifyIdToken = options.verifyIdToken ?? verifyGoogleIdToken;
  const upsertUser = options.upsertUser ?? upsertGoogleUser;
  const bumpVersion = options.bumpVersion ?? bumpTokenVersion;
  const audit =
    options.audit ??
    ((event: Parameters<typeof recordAuditEvent>[0]) =>
      recordAuditEvent(event));
  const router = Router();

  // Every auth response, not just /api/me: a 401 body and a Set-Cookie are both
  // things a cache must not keep.
  router.use(["/api/me", "/api/auth/google", "/api/auth/logout"], noStore());
  // The global limiter allows 120/min, which for a credential endpoint means 120
  // outbound Google verifications and up to 120 audit_log inserts per minute per
  // IP from an unauthenticated caller. sensitiveRateLimit is 10 per 15 minutes
  // and its docstring already named US-14; it was simply never mounted.
  const sensitive =
    options.enableRateLimit === false ? [] : [sensitiveRateLimit()];

  router.post(
    "/api/auth/google",
    ...sensitive,
    validate({ body: googleSignIn, query: z.object({}).strict() }),
    (request, response, next) => {
      const { credential } =
        validated<z.infer<typeof googleSignIn>>(request).body;

      (async () => {
        let identity;

        try {
          identity = await verifyIdToken(credential, config);
        } catch (error) {
          if (error instanceof GoogleTokenError) {
            // The reason is recorded as an audit outcome, never returned: a
            // client that could tell "expired" from "wrong audience" learns
            // about our configuration.
            await audit({
              action: "auth.sign_in",
              actor: "user",
              outcome: "failure",
              requestId: requestIdOf(response),
            });

            throw ApiError.unauthorized(
              "That Google sign-in could not be verified.",
            );
          }

          throw error;
        }

        const user = await upsertUser(identity);
        const token = await issueSessionToken(
          { userId: user.id, tokenVersion: user.tokenVersion },
          config,
        );

        setSessionCookie(response, token, config);

        await audit({
          action: "auth.sign_in",
          userId: user.id,
          actor: "user",
          requestId: requestIdOf(response),
        });

        const body: MeResponse = { user: toSessionUser(user) };
        response.status(200).json(body);
      })().catch(next);
    },
  );

  router.post(
    "/api/auth/logout",
    ...sensitive,
    validate({ query: z.object({}).strict() }),
    (request, response, next) => {
      const session = sessionOf(request);

      (async () => {
        // Signing out clears this browser's cookie and bumps the version, so
        // every other browser holding a cookie for this user is signed out too.
        // "Log out" that leaves other sessions alive is the weaker guarantee and
        // not the one a user expects after losing a device.
        if (session !== undefined) {
          await bumpVersion(session.user.id);
          await audit({
            action: "auth.sign_out",
            userId: session.user.id,
            actor: "user",
            requestId: requestIdOf(response),
          });
          // Inside the guard, deliberately. It used to sit outside, "because
          // sign-out is idempotent" — which handed any site a forced sign-out:
          // a cross-site form POST is a top-level navigation, so SameSite=Lax
          // correctly withheld the cookie (no version bump, other browsers
          // safe) but the browser still applied the expiring Set-Cookie and
          // deleted the visitor's session. Clearing only when a valid session
          // presented itself closes that, and costs nothing: a caller with no
          // session has no cookie worth clearing.
          clearSessionCookie(response, config);
        }

        // 204 whether or not there was a session: the response must not reveal
        // whether the cookie was valid.
        response.status(204).end();
      })().catch(next);
    },
  );

  router.get(
    "/api/me",
    validate({ query: z.object({}).strict() }),
    (request, response) => {
      const session = sessionOf(request);
      const body: MeResponse = {
        user: session === undefined ? null : toSessionUser(session.user),
      };

      response.json(body);
    },
  );

  return router;
}

/** Exported for routes added by later phases. */
export { requireSession };
