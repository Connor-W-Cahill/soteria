import { describe, expect, it } from "vitest";

import {
  computeScores,
  deriveScoreChanges,
  weakestCategory,
  type Answers,
  type ScoreHistorySeries,
  type SoftwareFinding,
} from "./engine.js";
import {
  CATEGORY_KEYS,
  MAX_OPTION_WEIGHT,
  QUESTIONS,
  type CategoryKey,
} from "./questions.js";

/** Answer every question with the option whose weight `pick` selects. */
function answersBy(pick: (weights: number[]) => number): Answers {
  const answers: Record<string, string> = {};

  for (const question of QUESTIONS) {
    const target = pick(question.options.map((option) => option.weight));
    const option = question.options.find((o) => o.weight === target);

    if (option === undefined) {
      throw new Error(`no option of weight ${target} for ${question.id}`);
    }

    answers[question.id] = option.id;
  }

  return answers;
}

const ALL_BEST = answersBy((weights) => Math.max(...weights));
const ALL_WORST = answersBy((weights) => Math.min(...weights));

function questionsIn(key: CategoryKey) {
  return QUESTIONS.filter((question) => question.category === key);
}

function categoryOf(
  scores: ReturnType<typeof computeScores>,
  key: CategoryKey,
) {
  const found = scores.categories.find((category) => category.key === key);

  if (found === undefined) throw new Error(`no category ${key}`);

  return found;
}

function worstOptionOf(question: (typeof QUESTIONS)[number]) {
  return question.options.reduce((low, option) =>
    option.weight < low.weight ? option : low,
  );
}

function bestOptionOf(question: (typeof QUESTIONS)[number]) {
  const best = question.options.find(
    (option) => option.weight === MAX_OPTION_WEIGHT,
  );

  if (best === undefined) throw new Error(`no best option for ${question.id}`);

  return best;
}

describe("computeScores — boundaries", () => {
  it("scores nothing as null rather than zero", () => {
    // A blank questionnaire is an unfinished form, not bad habits. Reporting 0
    // would tell a user their posture is terrible before they answered anything.
    const scores = computeScores({ answers: {} });

    expect(scores.overall).toBeNull();

    for (const key of CATEGORY_KEYS) {
      const category = categoryOf(scores, key);

      expect(category.score, key).toBeNull();
      expect(category.answered, key).toBe(0);
      expect(category.total, key).toBeGreaterThan(0);
    }
  });

  it("scores every best answer as 100", () => {
    const scores = computeScores({ answers: ALL_BEST });

    expect(scores.overall).toBe(100);

    for (const key of CATEGORY_KEYS) {
      expect(categoryOf(scores, key).score, key).toBe(100);
    }
  });

  it("scores every worst answer at the floor the question set allows", () => {
    // NOT hard-coded to 0: one question (breach_unique_email) offers no
    // zero-weight option, because "one email address for everything" is weak but
    // not literally no preparedness. So the worst achievable overall is 2, and a
    // test asserting 0 would be asserting a property of the question set that the
    // question set does not have. Derived from the data so it survives a reweight.
    const scores = computeScores({ answers: ALL_WORST });
    const floorOf = (questions: readonly (typeof QUESTIONS)[number][]) => {
      const raw = questions.reduce(
        (sum, question) => sum + worstOptionOf(question).weight,
        0,
      );

      return Math.round((100 * raw) / (MAX_OPTION_WEIGHT * questions.length));
    };

    expect(scores.overall).toBe(floorOf([...QUESTIONS]));

    for (const key of CATEGORY_KEYS) {
      const category = categoryOf(scores, key);

      expect(category.score, key).toBe(floorOf(questionsIn(key)));
      // Answered-at-the-floor and unanswered are different states and must not
      // collapse into each other: the floor is a number, never null.
      expect(category.score, key).not.toBeNull();
      expect(category.answered, key).toBe(category.total);
    }
  });

  it("keeps a floor score distinct from an unanswered one", () => {
    const worst = computeScores({ answers: ALL_WORST });
    const blank = computeScores({ answers: {} });
    const zeroable = CATEGORY_KEYS.filter((key) =>
      questionsIn(key).every(
        (question) => worstOptionOf(question).weight === 0,
      ),
    );

    // Guard the guard: at least one category must be able to reach 0 for the
    // comparison below to distinguish 0 from null at all.
    expect(zeroable.length).toBeGreaterThan(0);

    for (const key of zeroable) {
      expect(categoryOf(worst, key).score, key).toBe(0);
      expect(categoryOf(blank, key).score, key).toBeNull();
    }
  });

  it("covers all five categories, in canonical order, and nothing else", () => {
    const scores = computeScores({ answers: ALL_BEST });

    expect(scores.categories.map((category) => category.key)).toEqual([
      ...CATEGORY_KEYS,
    ]);
  });
});

describe("computeScores — partial answers", () => {
  it("scores a category against the questions actually answered", () => {
    // The denominator counts answered questions. Against the full denominator a
    // user who answered one question perfectly would score 33, which reads as a
    // bad habit rather than an unfinished form — and US-16 supports resuming.
    const pw = questionsIn("password_hygiene");
    const first = pw[0];

    if (first === undefined) throw new Error("no password_hygiene questions");

    const scores = computeScores({
      answers: { [first.id]: bestOptionOf(first).id },
    });
    const category = categoryOf(scores, "password_hygiene");

    expect(category.score).toBe(100);
    expect(category.answered).toBe(1);
    expect(category.total).toBe(pw.length);
    expect(scores.overall).toBe(100);
  });

  it("leaves untouched categories null when another is answered", () => {
    const first = QUESTIONS[0];

    if (first === undefined) throw new Error("no questions");

    const option = first.options[0];

    if (option === undefined) throw new Error("no options");

    const scores = computeScores({ answers: { [first.id]: option.id } });

    for (const key of CATEGORY_KEYS) {
      if (key === first.category) continue;
      expect(categoryOf(scores, key).score, key).toBeNull();
    }
  });

  it("treats an option the question does not offer as unanswered", () => {
    // Reaching this means the question set changed under a stored submission.
    // Scoring it 0 would report a habit the user never claimed.
    const first = QUESTIONS[0];

    if (first === undefined) throw new Error("no questions");

    const scores = computeScores({
      answers: { [first.id]: "no-such-option-id" },
    });

    expect(categoryOf(scores, first.category).answered).toBe(0);
    expect(scores.overall).toBeNull();
  });

  it("ignores an answer to a question that does not exist", () => {
    const scores = computeScores({ answers: { not_a_question: "whatever" } });

    expect(scores.overall).toBeNull();
  });
});

describe("computeScores — overall weighting", () => {
  it("weights categories by question count, not equally", () => {
    // Every question worst except one whole category best. Averaging the five
    // category percentages would give the same overall whichever category was
    // lifted; computing from raw weights gives a bigger lift to the category
    // with more questions. Asserted as a ranking rather than a formula, so this
    // test cannot pass by reimplementing the engine's arithmetic.
    const counts = new Map(
      CATEGORY_KEYS.map((key) => [key, questionsIn(key).length]),
    );

    // Guard the guard: if every category had the same number of questions this
    // test could not distinguish the two schemes and would pass vacuously.
    expect(
      new Set(counts.values()).size,
      "categories must differ in question count for this test to mean anything",
    ).toBeGreaterThan(1);

    const lifted = CATEGORY_KEYS.map((key) => {
      const answers: Record<string, string> = { ...ALL_WORST };

      for (const question of questionsIn(key)) {
        answers[question.id] = bestOptionOf(question).id;
      }

      const overall = computeScores({ answers }).overall;

      if (overall === null) throw new Error(`expected a score for ${key}`);

      return { key, count: counts.get(key) ?? 0, overall };
    });

    for (const a of lifted) {
      for (const b of lifted) {
        if (a.count > b.count) {
          expect(
            a.overall,
            `${a.key} (${a.count} questions) should outrank ${b.key} (${b.count})`,
          ).toBeGreaterThan(b.overall);
        }
      }
    }

    // And the equal-question categories must not all be identical by accident of
    // averaging: lifting any category must move the overall at all.
    const baseline = computeScores({ answers: ALL_WORST }).overall;

    for (const entry of lifted) {
      expect(entry.overall, entry.key).toBeGreaterThan(baseline ?? 0);
    }
  });
});

describe("computeScores — contributions for US-18", () => {
  it("records one contribution per answered question, with its weight", () => {
    const scores = computeScores({ answers: ALL_BEST });

    for (const key of CATEGORY_KEYS) {
      const category = categoryOf(scores, key);

      for (const question of questionsIn(key)) {
        const contribution = category.contributions.find(
          (entry) => entry.sourceId === question.id,
        );

        expect(contribution, `${key}/${question.id}`).toBeDefined();
        expect(contribution?.delta).toBe(MAX_OPTION_WEIGHT);
        expect(contribution?.maxDelta).toBe(MAX_OPTION_WEIGHT);
      }
    }
  });

  it("gives every contribution a substantive reason", () => {
    const scores = computeScores({ answers: ALL_WORST });

    for (const category of scores.categories) {
      for (const contribution of category.contributions) {
        expect(
          contribution.reason.length,
          contribution.sourceId,
        ).toBeGreaterThan(20);
        expect(contribution.reason).not.toMatch(/TODO|TBD|undefined/i);
      }
    }
  });

  it("quotes the option the user actually chose", () => {
    // US-18 shows these verbatim, so a reason naming a different option than the
    // one answered would be a lie the UI faithfully repeats.
    const scores = computeScores({ answers: ALL_WORST });

    for (const category of scores.categories) {
      for (const contribution of category.contributions) {
        const question = QUESTIONS.find((q) => q.id === contribution.sourceId);

        if (question === undefined) continue;

        expect(contribution.reason, contribution.sourceId).toContain(
          worstOptionOf(question).label,
        );
      }
    }
  });

  it("contributions sum to the category's raw score", () => {
    const scores = computeScores({ answers: ALL_BEST });

    for (const category of scores.categories) {
      const fromQuestions = category.contributions.filter((entry) =>
        QUESTIONS.some((question) => question.id === entry.sourceId),
      );
      const raw = fromQuestions.reduce((sum, entry) => sum + entry.delta, 0);
      const max = fromQuestions.reduce((sum, entry) => sum + entry.maxDelta, 0);

      expect(category.score, category.key).toBe(Math.round((100 * raw) / max));
    }
  });
});

describe("computeScores — software exposure is provisional until US-24", () => {
  it("marks the category provisional and says so in words", () => {
    const scores = computeScores({ answers: ALL_BEST });
    const category = categoryOf(scores, "software_exposure");

    expect(category.provisional).toBe(true);
    expect(scores.provisional).toBe(true);

    const note = category.contributions.find(
      (entry) => entry.sourceId === "software_exposure.no_cve_data",
    );

    expect(note).toBeDefined();
    expect(note?.reason).toMatch(/not part of this build yet/i);
    // It must not silently move the score.
    expect(note?.delta).toBe(0);
    expect(note?.maxDelta).toBe(0);
  });

  it("does not invent a neutral score for the missing input", () => {
    // The tempting shortcut is a hard-coded 50 presented as measured. With all
    // answers best, the category must be 100 from the answers alone.
    const scores = computeScores({ answers: ALL_BEST });

    expect(categoryOf(scores, "software_exposure").score).toBe(100);
  });

  it("marks no other category provisional", () => {
    const scores = computeScores({ answers: ALL_BEST });

    for (const key of CATEGORY_KEYS) {
      if (key === "software_exposure") continue;
      expect(categoryOf(scores, key).provisional, key).toBe(false);
    }
  });

  it("stops being provisional once findings are supplied", () => {
    const findings: SoftwareFinding[] = [
      { productId: "p1", productName: "A Browser", severity: "high" },
    ];
    const scores = computeScores({
      answers: ALL_BEST,
      softwareFindings: findings,
    });
    const category = categoryOf(scores, "software_exposure");

    expect(category.provisional).toBe(false);
    expect(scores.provisional).toBe(false);
    expect(
      category.contributions.some(
        (entry) => entry.sourceId === "software_exposure.no_cve_data",
      ),
    ).toBe(false);
  });
});

describe("computeScores — purity", () => {
  it("is deterministic across repeated calls", () => {
    expect(computeScores({ answers: ALL_BEST })).toEqual(
      computeScores({ answers: ALL_BEST }),
    );
  });

  it("does not mutate the answers it is given", () => {
    const answers = { ...ALL_BEST };
    const before = JSON.stringify(answers);

    computeScores({ answers });

    expect(JSON.stringify(answers)).toBe(before);
  });

  it("uses no clock and no randomness", () => {
    // If anything time- or random-dependent creeps in, two calls straddling a
    // fake clock change would differ. That is what makes the fixtures above
    // meaningful and what lets US-18 regenerate explanations from stored answers.
    const realNow = Date.now;
    const realRandom = Math.random;

    try {
      Date.now = () => 0;
      Math.random = () => 0;
      const atZero = computeScores({ answers: ALL_WORST });

      Date.now = () => 1_000_000_000_000;
      Math.random = () => 0.999;

      expect(computeScores({ answers: ALL_WORST })).toEqual(atZero);
    } finally {
      Date.now = realNow;
      Math.random = realRandom;
    }
  });
});

describe("weakestCategory", () => {
  it("returns undefined when nothing is answered", () => {
    expect(weakestCategory(computeScores({ answers: {} }))).toBeUndefined();
  });

  it("finds the single lowest-scoring category", () => {
    const answers: Record<string, string> = { ...ALL_BEST };

    for (const question of questionsIn("update_habits")) {
      answers[question.id] = worstOptionOf(question).id;
    }

    expect(weakestCategory(computeScores({ answers }))?.key).toBe(
      "update_habits",
    );
  });

  it("ignores unanswered categories rather than treating them as zero", () => {
    // An unanswered category is not the weakest; it is unknown. Returning it
    // would send the user to fix a category they have said nothing about.
    const answers: Record<string, string> = {};

    for (const question of questionsIn("password_hygiene")) {
      answers[question.id] = worstOptionOf(question).id;
    }

    const weakest = weakestCategory(computeScores({ answers }));

    expect(weakest?.key).toBe("password_hygiene");
    expect(weakest?.score).toBe(0);
  });
});

describe("deriveScoreChanges", () => {
  const series = (
    key: ScoreHistorySeries["key"],
    scores: [string, number][],
  ): ScoreHistorySeries => ({
    key,
    points: scores.map(([capturedAt, score]) => ({
      capturedAt,
      score,
      rationale: null,
    })),
  });

  it("emits one entry per capture where a category moved, newest first", () => {
    const changes = deriveScoreChanges([
      series("password_hygiene", [
        ["2026-08-01T00:00:00.000Z", 40],
        ["2026-08-02T00:00:00.000Z", 55],
        ["2026-08-03T00:00:00.000Z", 55],
      ]),
      series("update_habits", [
        ["2026-08-01T00:00:00.000Z", 20],
        ["2026-08-03T00:00:00.000Z", 32],
      ]),
    ]);

    expect(changes.map((change) => change.capturedAt)).toEqual([
      "2026-08-03T00:00:00.000Z",
      "2026-08-02T00:00:00.000Z",
    ]);
    // Aug 3: password_hygiene held at 55 (no delta), update_habits +12.
    expect(changes[0]?.deltas).toEqual([
      { key: "update_habits", from: 20, to: 32, delta: 12 },
    ]);
    expect(changes[1]?.deltas).toEqual([
      { key: "password_hygiene", from: 40, to: 55, delta: 15 },
    ]);
  });

  it("never reports the first snapshot as a change (no baseline)", () => {
    const changes = deriveScoreChanges([
      series("multifactor_authentication", [["2026-08-01T00:00:00.000Z", 70]]),
    ]);

    expect(changes).toEqual([]);
  });
});
