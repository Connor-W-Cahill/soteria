import { randomUUID } from "node:crypto";

import type { Knex } from "knex";

import { getDb } from "../db/knex.js";

/**
 * Persistence for the posture questionnaire (US-16).
 *
 * Answers live in the existing `questionnaire_responses` table (one row per
 * answered question, grouped by `submission_id`, unique on
 * `(submission_id, question_key)`). No migration is needed:
 *
 *  - An answer is `question_key = <question id>`, `answer_value = <option id>`.
 *    Both are short kebab/snake identifiers well inside the column limits, and
 *    an option id is the *only* thing a user's answer ever is — nothing they
 *    typed is stored, because the questionnaire asks nothing free-text.
 *  - The version stamp the issue asks for is written as one extra row per
 *    submission with the reserved key {@link VERSION_KEY}. Question ids are
 *    lowercase single-underscore slugs and can never equal it, and the route
 *    rejects it as an unknown question before it reaches here, so a client
 *    cannot forge or overwrite it.
 *
 * A user has exactly one *rolling* submission that PUT upserts into, which is
 * what makes save-and-resume work. US-17 will read {@link QuestionnaireStore.latest}
 * and, when it computes a score, is free to freeze that submission and start a
 * new one — that policy is deliberately not decided here.
 */

/** Reserved `question_key` carrying the question-set version for a submission. */
export const VERSION_KEY = "__version__";

export interface QuestionnaireSubmission {
  submissionId: string;
  /** Question-set version the answers were given under. */
  version: string;
  /** Map of question id to chosen option id. */
  answers: Record<string, string>;
  /** ISO timestamp of the most recent answer in the submission. */
  updatedAt: string;
}

export interface QuestionnaireStore {
  /** The user's current submission, or `null` if they have never answered. */
  latest(userId: string): Promise<QuestionnaireSubmission | null>;
  /**
   * Merge `answers` into the user's current submission (creating one if needed)
   * and stamp it with `version`. Returns the full merged submission.
   */
  save(
    userId: string,
    answers: Record<string, string>,
    version: string,
  ): Promise<QuestionnaireSubmission>;
}

interface ResponseRow {
  user_id: string;
  submission_id: string;
  question_key: string;
  answer_value: string;
  answered_at: Date | string;
}

function toSubmission(rows: ResponseRow[]): QuestionnaireSubmission | null {
  if (rows.length === 0) return null;

  const answers: Record<string, string> = {};
  let version = "";
  let updatedAt = new Date(0).toISOString();

  for (const row of rows) {
    const at = new Date(row.answered_at).toISOString();
    if (at > updatedAt) updatedAt = at;

    if (row.question_key === VERSION_KEY) {
      version = row.answer_value;
      continue;
    }

    answers[row.question_key] = row.answer_value;
  }

  return {
    submissionId: rows[0]!.submission_id,
    version,
    answers,
    updatedAt,
  };
}

async function latestSubmissionId(
  trx: Knex,
  userId: string,
): Promise<string | undefined> {
  const row = await trx("questionnaire_responses")
    .where({ user_id: userId })
    .orderBy("answered_at", "desc")
    .first<{ submission_id: string } | undefined>("submission_id");

  return row?.submission_id;
}

async function rowsFor(
  db: Knex,
  userId: string,
  submissionId: string,
): Promise<ResponseRow[]> {
  return db<ResponseRow>("questionnaire_responses")
    .where({ user_id: userId, submission_id: submissionId })
    .select("submission_id", "question_key", "answer_value", "answered_at");
}

export function createQuestionnaireStore(
  getConnection: () => Knex = getDb,
): QuestionnaireStore {
  return {
    async latest(userId) {
      const db = getConnection();
      const submissionId = await latestSubmissionId(db, userId);
      if (submissionId === undefined) return null;

      return toSubmission(await rowsFor(db, userId, submissionId));
    },

    async save(userId, answers, version) {
      const db = getConnection();
      return db.transaction(async (trx) => {
        const submissionId =
          (await latestSubmissionId(trx, userId)) ?? randomUUID();

        const existing = toSubmission(await rowsFor(trx, userId, submissionId));
        const merged = { ...(existing?.answers ?? {}), ...answers };
        const now = new Date();

        // Rewrite the whole submission rather than upsert row-by-row: the table
        // has no cross-dialect upsert (knex `onConflict().merge()` is not
        // supported on mssql) and a delete-then-insert inside one transaction is
        // simpler to reason about than N existence checks.
        await trx("questionnaire_responses")
          .where({ user_id: userId, submission_id: submissionId })
          .delete();

        const rows = [
          {
            id: randomUUID(),
            user_id: userId,
            submission_id: submissionId,
            question_key: VERSION_KEY,
            answer_value: version,
            answered_at: now,
          },
          ...Object.entries(merged).map(([questionId, optionId]) => ({
            id: randomUUID(),
            user_id: userId,
            submission_id: submissionId,
            question_key: questionId,
            answer_value: optionId,
            answered_at: now,
          })),
        ];

        await trx("questionnaire_responses").insert(rows);

        return {
          submissionId,
          version,
          answers: merged,
          updatedAt: now.toISOString(),
        };
      });
    },
  };
}
