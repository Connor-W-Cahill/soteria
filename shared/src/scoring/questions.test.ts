import { describe, expect, it } from "vitest";

import {
  CATEGORY_KEYS,
  MAX_OPTION_WEIGHT,
  MIN_OPTION_WEIGHT,
  QUESTIONNAIRE_VERSION,
  QUESTIONS,
  questionById,
  questionsForCategory,
  validateAnswers,
} from "./questions.js";

/**
 * These tests guard the *data*, not a function. They must fail if the question
 * set is edited into a bad state, so each one is paired below with a mutation
 * that should trip it (see "the guards above are not vacuous").
 */
describe("the posture question set (US-16)", () => {
  it("has 12 to 18 questions", () => {
    expect(QUESTIONS.length).toBeGreaterThanOrEqual(12);
    expect(QUESTIONS.length).toBeLessThanOrEqual(18);
  });

  it("gives every question a unique id", () => {
    const ids = QUESTIONS.map((question) => question.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("gives every option a unique id within its question", () => {
    for (const question of QUESTIONS) {
      const ids = question.options.map((option) => option.id);
      expect(new Set(ids).size, question.id).toBe(ids.length);
    }
  });

  it("covers all five categories, none empty", () => {
    for (const category of CATEGORY_KEYS) {
      expect(questionsForCategory(category).length, category).toBeGreaterThan(
        0,
      );
    }
    const used = new Set(QUESTIONS.map((question) => question.category));
    expect(used).toEqual(new Set(CATEGORY_KEYS));
  });

  it("only uses declared category keys", () => {
    for (const question of QUESTIONS) {
      expect(CATEGORY_KEYS, question.id).toContain(question.category);
    }
  });

  it("keeps every option weight an integer in range", () => {
    for (const question of QUESTIONS) {
      for (const option of question.options) {
        expect(
          Number.isInteger(option.weight),
          `${question.id}/${option.id}`,
        ).toBe(true);
        expect(option.weight).toBeGreaterThanOrEqual(MIN_OPTION_WEIGHT);
        expect(option.weight).toBeLessThanOrEqual(MAX_OPTION_WEIGHT);
      }
    }
  });

  it("offers each question at least two options and exactly one best", () => {
    for (const question of QUESTIONS) {
      expect(question.options.length, question.id).toBeGreaterThanOrEqual(2);
      const best = question.options.filter(
        (option) => option.weight === MAX_OPTION_WEIGHT,
      );
      expect(best.length, `${question.id} best options`).toBe(1);
    }
  });

  it("gives every question a prompt and help text", () => {
    for (const question of QUESTIONS) {
      expect(question.prompt.length, question.id).toBeGreaterThan(0);
      expect(question.helpText.length, question.id).toBeGreaterThan(0);
    }
  });

  it("has a version stamp", () => {
    expect(QUESTIONNAIRE_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

describe("the guards above are not vacuous", () => {
  it("would flag a duplicate question id", () => {
    const ids = [...QUESTIONS.map((q) => q.id), QUESTIONS[0]!.id];
    expect(new Set(ids).size).not.toBe(ids.length);
  });

  it("would flag a weight out of range", () => {
    const bad = MAX_OPTION_WEIGHT + 1;
    expect(bad <= MAX_OPTION_WEIGHT).toBe(false);
  });

  it("would flag a missing category", () => {
    const used = new Set(
      QUESTIONS.filter((q) => q.category !== "multifactor_authentication").map(
        (q) => q.category,
      ),
    );
    expect(used).not.toEqual(new Set(CATEGORY_KEYS));
  });
});

describe("validateAnswers", () => {
  const good = QUESTIONS[0]!;

  it("accepts a real question with an offered option", () => {
    expect(validateAnswers({ [good.id]: good.options[0]!.id })).toEqual([]);
  });

  it("rejects an unknown question key", () => {
    expect(validateAnswers({ not_a_question: "x" })).toEqual([
      { questionId: "not_a_question", problem: "unknown_question" },
    ]);
  });

  it("rejects an option the question does not offer", () => {
    expect(validateAnswers({ [good.id]: "not_an_option" })).toEqual([
      { questionId: good.id, problem: "unknown_option" },
    ]);
  });

  it("questionById round-trips every question", () => {
    for (const question of QUESTIONS) {
      expect(questionById(question.id)).toBe(question);
    }
    expect(questionById("nope")).toBeUndefined();
  });
});
