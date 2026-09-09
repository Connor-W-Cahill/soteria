import { computeScores, type ScoresResponse } from "@soteria/shared";
import { Router } from "express";
import { z } from "zod";

import { requireSession, sessionOf } from "../auth/middleware.js";
import { validate, validated } from "../http/validate.js";
import {
  createQuestionnaireStore,
  type QuestionnaireStore,
} from "../questionnaire/store.js";
import { readScoreHistory } from "./history.js";

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
 *
 * `GET /api/scores/history?days=N` is the exception — it *does* read
 * `score_snapshots`, because its job is to report what the score was over time,
 * not what it is now. `days` is validated to a bounded integer: an unbounded
 * window is a cheap way for a signed-in caller to pull their entire history in
 * one request, so the ceiling lives here at the edge.
 */
export interface ScoringRouterOptions {
  /** Overridable so route tests need no database. */
  store?: QuestionnaireStore;
  /** Overridable so route tests need no database. */
  readHistory?: typeof readScoreHistory;
}

/** Widest window the history endpoint will serve, in days. */
const HISTORY_MAX_DAYS = 365;
/** Default window when `days` is omitted. */
const HISTORY_DEFAULT_DAYS = 90;

const historyQuery = z
  .object({
    days: z.coerce
      .number()
      .int()
      .min(1)
      .max(HISTORY_MAX_DAYS)
      .default(HISTORY_DEFAULT_DAYS),
  })
  .strict();

export function scoringRouter(options: ScoringRouterOptions = {}): Router {
  const store = options.store ?? createQuestionnaireStore();
  const readHistory = options.readHistory ?? readScoreHistory;
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

  router.get(
    "/api/scores/history",
    requireSession(),
    validate({ query: historyQuery }),
    (request, response, next) => {
      const session = sessionOf(request);

      if (session === undefined) {
        return;
      }

      const { days } = validated<never, z.infer<typeof historyQuery>>(
        request,
      ).query;

      readHistory(session.user.id, days)
        .then((body) => response.json(body))
        .catch(next);
    },
  );

  return router;
}
