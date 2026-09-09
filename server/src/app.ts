import type { HealthResponse } from "@soteria/shared";
import cookieParser from "cookie-parser";
import express from "express";
import { z } from "zod";

import { accountRouter } from "./account/routes.js";
import { readAuthConfig, type AuthConfig } from "./auth/config.js";
import { attachSession } from "./auth/middleware.js";
import { authRouter } from "./auth/routes.js";
import { isDbConnected } from "./db/knex.js";
import { errorHandler, notFoundHandler } from "./http/errors.js";
import { globalRateLimit, publicRateLimit } from "./http/rate-limit.js";
import { requestId } from "./http/request-id.js";
import { corsMiddleware, securityHeaders } from "./http/security.js";
import { validate } from "./http/validate.js";
import { requestLog } from "./logging/request-log.js";
import { questionnaireRouter } from "./questionnaire/routes.js";

const healthResponse = z.object({
  status: z.literal("ok"),
  version: z.string(),
  dbConnected: z.boolean(),
});

export interface AppOptions {
  /** Overridable so tests do not need a live database. */
  checkDbConnection?: () => Promise<boolean>;
  /** Disabled in tests that fire many requests in a row. */
  enableRateLimit?: boolean;
  /**
   * Auth settings. Read from the environment when omitted, which throws if
   * GOOGLE_CLIENT_ID or SESSION_SECRET is missing — a server that cannot verify
   * a token must not start rather than start with the check disabled.
   */
  auth?: AuthConfig;
  /** Overridable so route tests need neither Google nor a database. */
  authRouterOptions?: Omit<Parameters<typeof authRouter>[0], "config">;
  /** Overridable so route tests need no database. */
  accountRouterOptions?: Omit<Parameters<typeof accountRouter>[0], "config">;
  /** Overridable so route tests need no database. */
  loadSessionUser?: Parameters<typeof attachSession>[0]["loadUser"];
  /** Overridable so questionnaire route tests need no database. */
  questionnaireRouterOptions?: Parameters<typeof questionnaireRouter>[0];
}

export function createApp(options: AppOptions = {}) {
  const checkDbConnection = options.checkDbConnection ?? isDbConnected;
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(securityHeaders());
  app.use(corsMiddleware());
  app.use(requestId());
  app.use(requestLog());

  if (options.enableRateLimit !== false) {
    app.use(globalRateLimit());
  }

  // JSON only, deliberately. This is load-bearing for more than convenience:
  // the only thing preventing login CSRF on POST /api/auth/google is that a
  // cross-site HTML form cannot produce a body express.json() will parse. A
  // security review confirmed it — form posts with text/plain,
  // application/x-www-form-urlencoded and multipart/form-data all get 400
  // validation_failed and set no cookie. Adding express.urlencoded() here, a
  // one-line change nobody would think to flag, makes login CSRF live
  // immediately. If a route ever needs form bodies, mount the parser on that
  // route and add an origin check or a CSRF token to the auth routes first.
  app.use(express.json({ limit: "100kb" }));

  const auth = options.auth ?? readAuthConfig();

  // Parsed before the session middleware, which reads request.cookies. No secret
  // is passed: the session cookie carries its own signature, so cookie-parser
  // never needs to verify anything.
  app.use(cookieParser());
  app.use(
    attachSession({
      config: auth,
      ...(options.loadSessionUser === undefined
        ? {}
        : { loadUser: options.loadSessionUser }),
    }),
  );
  app.use(authRouter({ config: auth, ...options.authRouterOptions }));
  app.use(questionnaireRouter(options.questionnaireRouterOptions));
  app.use(accountRouter({ config: auth, ...options.accountRouterOptions }));

  app.get(
    "/api/health",
    ...(options.enableRateLimit === false ? [] : [publicRateLimit()]),
    validate({ query: z.object({}).strict() }),
    (_request, response, next) => {
      checkDbConnection()
        .then((dbConnected) => {
          const health: HealthResponse = healthResponse.parse({
            status: "ok",
            version: process.env.npm_package_version ?? "0.1.0",
            dbConnected,
          });

          response.json(health);
        })
        .catch(next);
    },
  );

  // Must stay last: unmatched routes become a 404 envelope, and every thrown or
  // forwarded error becomes an `{ error: { code, message, details? } }` body.
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
