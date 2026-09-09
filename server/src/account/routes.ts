import { Router } from "express";
import { z } from "zod";

import type { AuthConfig } from "../auth/config.js";
import { clearSessionCookie } from "../auth/cookie.js";
import { requireSession, sessionOf } from "../auth/middleware.js";
import { bumpTokenVersion } from "../auth/users.js";
import { ApiError } from "../http/errors.js";
import { requestIdOf } from "../http/request-id.js";
import { validate } from "../http/validate.js";
import { deleteUserAndData } from "./delete.js";

/**
 * The confirmation the dialog collects. `z.literal("DELETE")` rejects an empty
 * body, the wrong word, or a different case with the standard validation
 * envelope — deleting an account must take an unambiguous, typed act.
 */
const deleteMe = z
  .object({
    confirmation: z.literal("DELETE"),
  })
  .strict();

export interface AccountRouterOptions {
  config: AuthConfig;
  /** Overridable so route tests need no database. */
  bumpVersion?: typeof bumpTokenVersion;
  /** Overridable so route tests need no database. */
  deleteAccount?: (
    userId: string,
    requestId: string | undefined,
  ) => Promise<void>;
}

export function accountRouter(options: AccountRouterOptions): Router {
  const config = options.config;
  const bumpVersion = options.bumpVersion ?? bumpTokenVersion;
  const deleteAccount = options.deleteAccount ?? deleteUserAndData;
  const router = Router();

  router.delete(
    "/api/me",
    requireSession(),
    validate({ body: deleteMe, query: z.object({}).strict() }),
    (request, response, next) => {
      const session = sessionOf(request);

      if (session === undefined) {
        // requireSession() already guarantees this; the check keeps the type
        // honest and never fires.
        next(ApiError.unauthorized());
        return;
      }

      // The confirmation is validated by the middleware above; its value is the
      // constant "DELETE", so there is nothing to read back here.
      const userId = session.user.id;

      (async () => {
        // Order is the whole point of US-20:
        //
        //   1. bump token_version — every outstanding cookie for this user is
        //      now invalid, including any that is mid-flight while step 2 runs.
        //   2. delete the rows — a request that raced in with the old cookie
        //      can no longer attach a session, so it cannot act on the
        //      half-deleted account.
        //   3. clear this browser's cookie — cosmetic by now, but it stops the
        //      browser sending a token that will only ever be rejected.
        await bumpVersion(userId);
        await deleteAccount(userId, requestIdOf(response));
        clearSessionCookie(response, config);

        response.status(204).end();
      })().catch(next);
    },
  );

  return router;
}
