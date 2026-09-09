import { computeScores, type ScoresResponse } from "@soteria/shared";
import { Router } from "express";
import { z } from "zod";

import { requireSession, sessionOf } from "../auth/middleware.js";
import { validate } from "../http/validate.js";
import {
  createQuestionnaireStore,
  type QuestionnaireStore,
} from "../questionnaire/store.js";

/**
 * `GET /api/scores` — the signed-in user's category scores and overall score.
 *
 * Scores are **computed on read**, from the answers in
 * `questionnaire_responses`, rather than read back from `score_snapshots`. The
 * engine is a pure function, so recomputing is cheap and correct, and it means a
 * change to the rules takes effect for everyone immediately instead of leaving
 * users looking at numbers produced by rules that no longer exist.
 *
 * `score_snapshots` is therefore a history table, not a cache: it records what
 * the score was at a point in time for US-19's trend, and nothing reads it to
 * answer this route.
 */
export interface ScoringRouterOptions {
  /** Overridable so route tests need no database. */
  store?: QuestionnaireStore;
}

export function scoringRouter(options: ScoringRouterOptions = {}): Router {
  const store = options.store ?? createQuestionnaireStore();
  const router = Router();

  router.get(
    "/api/scores",
    requireSession(),
    validate({ query: z.object({}).strict() }),
    (request, response, next) => {
      const session = sessionOf(request);

      if (session === undefined) {
        // requireSession() has already rejected; this is for the type narrowing.
        return;
      }

      store
        .latest(session.user.id)
        .then((submission) => {
          const scores = computeScores({
            answers: submission?.answers ?? {},
            // US-24 does not exist yet, so no software findings are available and
            // software_exposure comes back provisional. Passing nothing is the
            // honest signal; passing an empty array would mean "checked, found
            // none", which is a different and false claim.
          });
          const body: ScoresResponse = {
            ...scores,
            version: submission?.version ?? null,
            updatedAt: submission?.updatedAt ?? null,
          };

          response.json(body);
        })
        .catch(next);
    },
  );

  return router;
}
