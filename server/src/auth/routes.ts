import type { MeResponse, SessionUser } from "@soteria/shared";
import { Router } from "express";
import { z } from "zod";

import { recordAuditEvent } from "../db/audit.js";
import { ApiError } from "../http/errors.js";
import { validate, validated } from "../http/validate.js";
import { requestIdOf } from "../http/request-id.js";
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
  /** Overridable so route tests need neither Google nor a database. */
  verifyIdToken?: typeof verifyGoogleIdToken;
  upsertUser?: typeof upsertGoogleUser;
  bumpVersion?: typeof bumpTokenVersion;
  /** Overridable so route tests need no database. */
  audit?: (event: Parameters<typeof recordAuditEvent>[0]) => Promise<void>;
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

  router.post(
    "/api/auth/google",
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
        }

        clearSessionCookie(response, config);
        // 204 whether or not there was a session: signing out is idempotent and
        // the response must not reveal whether the cookie was valid.
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
