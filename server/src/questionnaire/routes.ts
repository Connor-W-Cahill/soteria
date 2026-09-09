import {
  QUESTIONNAIRE_VERSION,
  QUESTIONS,
  validateAnswers,
  type QuestionnaireState,
} from "@soteria/shared";
import { Router } from "express";
import { z } from "zod";

import { ApiError } from "../http/errors.js";
import { validate, validated } from "../http/validate.js";
import { requireSession, sessionOf } from "../auth/middleware.js";
import { createQuestionnaireStore, type QuestionnaireStore } from "./store.js";

/**
 * `GET /api/questionnaire` — the signed-in user's current answers.
 * `PUT /api/questionnaire` — save (and merge) answers for save-and-resume.
 *
 * Both require a session. PUT validates every entry against the question set in
 * `@soteria/shared`: an unknown question key or an option the question does not
 * offer is rejected with `400 validation_failed` and never stored. Only option
 * ids are accepted, so nothing free-text can be written.
 *
 * SCORING SEAM (US-17): after a successful save, US-17 will call the scoring
 * engine and write a `score_snapshots` row, and record a `questionnaire.submit`
 * audit event (which needs its own migration to widen the audit_log check
 * constraint). That is deliberately not wired here — see the marked spot in the
 * PUT handler. This route computes no score and writes no snapshot.
 */

const MAX_ANSWERS = QUESTIONS.length;
const KEY_MAX = 100;
const VALUE_MAX = 200;

const putBody = z
  .object({
    answers: z
      .record(z.string().min(1).max(KEY_MAX), z.string().min(1).max(VALUE_MAX))
      .refine((answers) => Object.keys(answers).length <= MAX_ANSWERS, {
        message: `At most ${MAX_ANSWERS} answers may be submitted.`,
      }),
  })
  .strict();

export interface QuestionnaireRouterOptions {
  /** Overridable so route tests need no database. */
  store?: QuestionnaireStore;
}

function toState(
  submission: Awaited<ReturnType<QuestionnaireStore["latest"]>>,
): QuestionnaireState {
  if (submission === null) {
    return { version: null, answers: {}, updatedAt: null };
  }

  return {
    version: submission.version === "" ? null : submission.version,
    answers: submission.answers,
    updatedAt: submission.updatedAt,
  };
}

export function questionnaireRouter(
  options: QuestionnaireRouterOptions = {},
): Router {
  const store = options.store ?? createQuestionnaireStore();
  const router = Router();

  router.get(
    "/api/questionnaire",
    requireSession(),
    validate({ query: z.object({}).strict() }),
    (request, response, next) => {
      const session = sessionOf(request)!;

      store
        .latest(session.user.id)
        .then((submission) => response.json(toState(submission)))
        .catch(next);
    },
  );

  router.put(
    "/api/questionnaire",
    requireSession(),
    validate({ body: putBody, query: z.object({}).strict() }),
    (request, response, next) => {
      const session = sessionOf(request)!;
      const { answers } = validated<z.infer<typeof putBody>>(request).body;

      const problems = validateAnswers(answers);

      if (problems.length > 0) {
        // Field paths and messages only — the offending values are not echoed,
        // matching the rest of the validation layer.
        next(
          new ApiError(
            "validation_failed",
            "One or more answers did not match the question set.",
            problems.map((problem) => ({
              path: `answers.${problem.questionId}`,
              message:
                problem.problem === "unknown_question"
                  ? "Not a question in the current set."
                  : "Not an option this question offers.",
            })),
          ),
        );
        return;
      }

      store
        .save(session.user.id, answers, QUESTIONNAIRE_VERSION)
        .then((submission) => {
          // ── SCORING SEAM (US-17) ──────────────────────────────────────────
          // US-17 wires scoring here: compute category scores from
          // `submission.answers` via the engine in `@soteria/shared` and insert
          // a `score_snapshots` row (US-19). Intentionally not called in US-16 —
          // this route produces no score and no snapshot.
          // ─────────────────────────────────────────────────────────────────

          response.json(toState(submission));
        })
        .catch(next);
    },
  );

  return router;
}
