import {
  CATEGORY_KEYS,
  MAX_OPTION_WEIGHT,
  QUESTIONS,
  type CategoryKey,
  type Question,
} from "./questions.js";

/**
 * The posture scoring engine (US-17).
 *
 * A **pure function**, deliberately: given the same inputs it returns the same
 * output, with no clock, no randomness, no I/O and no database. That is what
 * makes the golden fixtures in `engine.test.ts` meaningful, and it is why the
 * explanations US-18 shows can be regenerated from stored answers rather than
 * having to be stored alongside them.
 *
 * This module is reachable from `@soteria/shared`'s barrel, so it must stay
 * browser-safe — no Node built-ins. `browser-safety.test.ts` enforces that.
 *
 * ## How a score is produced
 *
 * Every answered option carries a `weight` in [0, 4], defined next to the
 * question a human reads rather than in here. A category's score is the sum of
 * its answered weights over the maximum those same questions could have scored,
 * as a percentage:
 *
 *     score = round(100 * sum(weight) / (4 * answeredQuestions))
 *
 * The denominator counts **answered** questions, not all of them. That choice
 * matters: scoring partial answers against the full denominator would make an
 * incomplete questionnaire look like bad habits rather than an unfinished form,
 * and US-16 explicitly supports save-and-resume. `answered` and `total` are
 * reported per category so the UI can say which it is.
 *
 * ## Software exposure
 *
 * `software_exposure` is the one category with an outside input: active CVE
 * matches from US-24, which does not exist yet. Until it does, the engine uses
 * the questionnaire answers alone and marks the category `provisional`, and the
 * contribution list says so in words a person can read. It does not invent a
 * neutral 50 and present it as measured.
 */

/** One reason a category ended up where it did. Drives US-18's explanations. */
export interface Contribution {
  /** Question id, or a synthetic id for a non-questionnaire input. */
  sourceId: string;
  /** Short human-readable label for the thing that contributed. */
  label: string;
  /**
   * Points this contributed toward the category's raw total, and the most it
   * could have contributed. `delta` of 0 out of 4 is a real signal, not a gap.
   */
  delta: number;
  maxDelta: number;
  /** Plain-language reason, shown verbatim to the user. */
  reason: string;
}

export interface CategoryScore {
  key: CategoryKey;
  /** 0-100. `null` when nothing in this category has been answered. */
  score: number | null;
  answered: number;
  total: number;
  /**
   * True when the score is missing an input it is meant to have — today only
   * `software_exposure`, which awaits US-24's CVE matches.
   */
  provisional: boolean;
  contributions: Contribution[];
}

export interface Scores {
  categories: CategoryScore[];
  /**
   * 0-100 across every answered question, or `null` when nothing is answered.
   *
   * Computed from the raw weights rather than by averaging the category
   * percentages, so a category with three questions counts for more than one
   * with a single question. Averaging percentages would let the shortest
   * category swing the overall score as much as the longest.
   */
  overall: number | null;
  /** True when any category is provisional. */
  provisional: boolean;
}

/** An answer map: question id -> chosen option id. */
export type Answers = Readonly<Record<string, string>>;

/**
 * Active CVE matches per product, from US-24. Not yet produced by anything;
 * accepted now so the engine's signature does not change when it is.
 */
export interface SoftwareFinding {
  productId: string;
  productName: string;
  severity: "critical" | "high" | "medium" | "low" | "none";
}

/** Coach progress from US-06..US-13. Reserved; not yet scored. */
export interface CoachProgress {
  completedTaskKeys: readonly string[];
}

function optionFor(question: Question, answers: Answers) {
  const chosen = answers[question.id];

  if (chosen === undefined) return undefined;

  return question.options.find((option) => option.id === chosen);
}

function percentage(raw: number, max: number): number | null {
  if (max === 0) return null;

  return Math.round((100 * raw) / max);
}

/**
 * Scores one category from the questionnaire alone.
 *
 * An answer naming an option the question does not offer is treated as
 * unanswered rather than as zero. Storing such an answer is prevented by
 * `validateAnswers` on the way in, so reaching this branch means the question
 * set changed under a stored submission — and silently scoring it 0 would
 * report a habit the user never claimed.
 */
function scoreCategory(category: CategoryKey, answers: Answers): CategoryScore {
  const questions = QUESTIONS.filter((q) => q.category === category);
  const contributions: Contribution[] = [];
  let raw = 0;
  let max = 0;

  for (const question of questions) {
    const option = optionFor(question, answers);

    if (option === undefined) continue;

    raw += option.weight;
    max += MAX_OPTION_WEIGHT;
    contributions.push({
      sourceId: question.id,
      label: question.prompt,
      delta: option.weight,
      maxDelta: MAX_OPTION_WEIGHT,
      reason:
        option.weight === MAX_OPTION_WEIGHT
          ? `You answered "${option.label}", which is the strongest option for this question.`
          : `You answered "${option.label}", worth ${option.weight} of ${MAX_OPTION_WEIGHT} points here.`,
    });
  }

  return {
    key: category,
    score: percentage(raw, max),
    answered: contributions.length,
    total: questions.length,
    provisional: false,
    contributions,
  };
}

export interface ComputeScoresInput {
  answers: Answers;
  /** From US-24. Empty or omitted until it exists. */
  softwareFindings?: readonly SoftwareFinding[];
  /** From US-06..US-13. Reserved. */
  coachProgress?: CoachProgress;
}

export function computeScores(input: ComputeScoresInput): Scores {
  const { answers, softwareFindings } = input;

  const categories = CATEGORY_KEYS.map((key) => {
    const scored = scoreCategory(key, answers);

    if (key !== "software_exposure") return scored;

    // US-24 does not exist, so there are no findings to fold in. Say so, in the
    // contribution list, rather than presenting a questionnaire-only number as
    // if it accounted for the software actually installed.
    if (softwareFindings === undefined || softwareFindings.length === 0) {
      return {
        ...scored,
        provisional: true,
        contributions: [
          ...scored.contributions,
          {
            sourceId: "software_exposure.no_cve_data",
            label: "Known vulnerabilities in your software",
            delta: 0,
            maxDelta: 0,
            reason:
              "This category will also account for known vulnerabilities affecting the software you list. That check is not part of this build yet, so this score reflects your answers only.",
          },
        ],
      };
    }

    return { ...scored, provisional: false };
  });

  // Overall is recomputed from raw weights rather than averaged from the
  // category percentages: averaging would give a one-question category the same
  // pull as a three-question one.
  let overallRaw = 0;
  let overallMax = 0;

  for (const question of QUESTIONS) {
    const option = optionFor(question, answers);

    if (option === undefined) continue;

    overallRaw += option.weight;
    overallMax += MAX_OPTION_WEIGHT;
  }

  return {
    categories,
    overall: percentage(overallRaw, overallMax),
    provisional: categories.some((category) => category.provisional),
  };
}

/**
 * `GET /api/scores`. The engine's output plus the provenance of the answers it
 * was computed from, so the UI can say "as of" rather than implying it is live.
 */
export interface ScoresResponse extends Scores {
  /** Question-set version the answers were given under, or null if none. */
  version: string | null;
  /** ISO timestamp of the last answer save, or null if never. */
  updatedAt: string | null;
}

/** The category most worth attention: lowest score, ties broken canonically. */
export function weakestCategory(scores: Scores): CategoryScore | undefined {
  const scored = scores.categories.filter(
    (category): category is CategoryScore & { score: number } =>
      category.score !== null,
  );

  if (scored.length === 0) return undefined;

  return scored.reduce((worst, category) =>
    category.score < worst.score ? category : worst,
  );
}
