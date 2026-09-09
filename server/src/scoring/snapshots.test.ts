import {
  computeScores,
  MAX_OPTION_WEIGHT,
  QUESTIONS,
  type Scores,
} from "@soteria/shared";
import type { Knex } from "knex";
import { describe, expect, it, vi } from "vitest";

import {
  withinCoalesceWindow,
  writeScoreSnapshots,
  type SnapshotRow,
} from "./snapshots.js";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const SUBMISSION_ID = "22222222-2222-4222-8222-222222222222";

/**
 * Captures the rows an insert would have written, with no database.
 *
 * `lastCapturedAt` stands in for the user's most recent existing snapshot: the
 * `.where().orderBy().first()` the coalescing check runs resolves to it (or to
 * `undefined` when it is not set, i.e. the user has no history).
 */
function captureDb(options: { lastCapturedAt?: Date } = {}) {
  const inserted: SnapshotRow[][] = [];
  const insert = vi.fn(async (rows: SnapshotRow[]) => {
    inserted.push(rows);
  });
  const query = {
    where: vi.fn(() => query),
    andWhere: vi.fn(() => query),
    orderBy: vi.fn(() => query),
    first: vi.fn(async () =>
      options.lastCapturedAt === undefined
        ? undefined
        : { captured_at: options.lastCapturedAt },
    ),
    insert,
  };
  const db = vi.fn(() => query) as unknown as Knex;

  return { db, inserted, insert, query };
}

function answersOf(pick: (weights: number[]) => number) {
  const answers: Record<string, string> = {};

  for (const question of QUESTIONS) {
    const target = pick(question.options.map((option) => option.weight));
    const option = question.options.find((o) => o.weight === target);

    if (option === undefined) throw new Error(`no option for ${question.id}`);

    answers[question.id] = option.id;
  }

  return answers;
}

const BEST: Scores = computeScores({
  answers: answersOf((weights) => Math.max(...weights)),
});

describe("writeScoreSnapshots", () => {
  it("writes one row per scored category", async () => {
    const { db, inserted } = captureDb();

    const written = await writeScoreSnapshots(
      USER_ID,
      SUBMISSION_ID,
      BEST,
      db,
      new Date("2026-09-09T12:00:00.000Z"),
    );

    expect(written).toBe(BEST.categories.length);
    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toHaveLength(BEST.categories.length);
    expect(inserted[0]?.map((row) => row.category).sort()).toEqual(
      BEST.categories.map((category) => category.key).sort(),
    );
  });

  it("stores the score, the user and the submission on every row", async () => {
    const { db, inserted } = captureDb();

    await writeScoreSnapshots(USER_ID, SUBMISSION_ID, BEST, db);

    for (const row of inserted[0] ?? []) {
      expect(row.user_id).toBe(USER_ID);
      expect(row.submission_id).toBe(SUBMISSION_ID);
      expect(row.score).toBe(100);
      expect(row.id).toMatch(/^[0-9a-f-]{36}$/);
    }
  });

  it("skips categories with no score rather than storing a zero", async () => {
    // `score` is NOT NULL, so an unanswered category has nowhere honest to go.
    // Writing 0 would put a false low point into US-19's trend chart.
    const { db, inserted } = captureDb();
    const blank = computeScores({ answers: {} });

    const written = await writeScoreSnapshots(
      USER_ID,
      SUBMISSION_ID,
      blank,
      db,
    );

    expect(written).toBe(0);
    expect(inserted).toHaveLength(0);
  });

  it("writes only the categories that have been answered", async () => {
    const first = QUESTIONS[0];

    if (first === undefined) throw new Error("no questions");

    const best = first.options.find(
      (option) => option.weight === MAX_OPTION_WEIGHT,
    );

    if (best === undefined) throw new Error("no best option");

    const { db, inserted } = captureDb();
    const partial = computeScores({ answers: { [first.id]: best.id } });

    const written = await writeScoreSnapshots(
      USER_ID,
      SUBMISSION_ID,
      partial,
      db,
    );

    expect(written).toBe(1);
    expect(inserted[0]?.[0]?.category).toBe(first.category);
  });

  it("records how many questions the score came from", async () => {
    const { db, inserted } = captureDb();

    await writeScoreSnapshots(USER_ID, SUBMISSION_ID, BEST, db);

    for (const row of inserted[0] ?? []) {
      expect(row.rationale).toMatch(/^\d+ of \d+ questions answered/);
    }
  });

  it("says in the rationale when a category is provisional", async () => {
    const { db, inserted } = captureDb();

    await writeScoreSnapshots(USER_ID, SUBMISSION_ID, BEST, db);

    const software = inserted[0]?.find(
      (row) => row.category === "software_exposure",
    );

    expect(software?.rationale).toMatch(/provisional/i);

    for (const row of inserted[0] ?? []) {
      if (row.category === "software_exposure") continue;
      expect(row.rationale, row.category).not.toMatch(/provisional/i);
    }
  });

  it("keeps the rationale inside the column's 500 characters", async () => {
    const { db, inserted } = captureDb();

    await writeScoreSnapshots(USER_ID, SUBMISSION_ID, BEST, db);

    for (const row of inserted[0] ?? []) {
      expect((row.rationale ?? "").length).toBeLessThanOrEqual(500);
    }
  });

  it("stores no answer values and no explanation prose", async () => {
    // The answers live in questionnaire_responses and are the source of truth;
    // US-18's explanations are regenerated by the pure engine rather than read
    // back, so a stored explanation cannot drift from the rules that made it.
    const { db, inserted } = captureDb();

    await writeScoreSnapshots(USER_ID, SUBMISSION_ID, BEST, db);

    const serialised = JSON.stringify(inserted[0]);

    for (const category of BEST.categories) {
      for (const contribution of category.contributions) {
        expect(serialised).not.toContain(contribution.reason);
      }
    }

    for (const row of inserted[0] ?? []) {
      expect(Object.keys(row).sort()).toEqual([
        "captured_at",
        "category",
        "id",
        "rationale",
        "score",
        "submission_id",
        "user_id",
      ]);
    }
  });

  it("accepts a null submission id", async () => {
    const { db, inserted } = captureDb();

    await writeScoreSnapshots(USER_ID, null, BEST, db);

    for (const row of inserted[0] ?? []) {
      expect(row.submission_id).toBeNull();
    }
  });

  describe("coalescing — at most one snapshot per user per hour", () => {
    const LAST = new Date("2026-09-09T12:00:00.000Z");

    it("drops a save 59 minutes after the previous snapshot", async () => {
      const { db, inserted } = captureDb({ lastCapturedAt: LAST });

      const written = await writeScoreSnapshots(
        USER_ID,
        SUBMISSION_ID,
        BEST,
        db,
        new Date("2026-09-09T12:59:00.000Z"),
      );

      expect(written).toBe(0);
      expect(inserted).toHaveLength(0);
    });

    it("writes a save 61 minutes after the previous snapshot", async () => {
      const { db, inserted } = captureDb({ lastCapturedAt: LAST });

      const written = await writeScoreSnapshots(
        USER_ID,
        SUBMISSION_ID,
        BEST,
        db,
        new Date("2026-09-09T13:01:00.000Z"),
      );

      expect(written).toBe(BEST.categories.length);
      expect(inserted).toHaveLength(1);
    });

    it("writes when the user has no previous snapshot", async () => {
      const { db, inserted } = captureDb();

      const written = await writeScoreSnapshots(
        USER_ID,
        SUBMISSION_ID,
        BEST,
        db,
      );

      expect(written).toBe(BEST.categories.length);
      expect(inserted).toHaveLength(1);
    });

    it("does not delete or rewrite the coalesced-with row", async () => {
      // The decision is DROP, not REPLACE: a second save in the hour must leave
      // the existing rows untouched, so no delete is issued.
      const { db, query } = captureDb({ lastCapturedAt: LAST });

      await writeScoreSnapshots(
        USER_ID,
        SUBMISSION_ID,
        BEST,
        db,
        new Date("2026-09-09T12:30:00.000Z"),
      );

      expect(query.insert).not.toHaveBeenCalled();
      expect(
        (query as unknown as Record<string, unknown>).delete,
      ).toBeUndefined();
    });
  });
});

describe("withinCoalesceWindow", () => {
  const last = new Date("2026-09-09T12:00:00.000Z");

  it("is true at 59 minutes and false at 61 minutes", () => {
    expect(
      withinCoalesceWindow(last, new Date("2026-09-09T12:59:00.000Z")),
    ).toBe(true);
    expect(
      withinCoalesceWindow(last, new Date("2026-09-09T13:01:00.000Z")),
    ).toBe(false);
  });

  it("is false exactly on the hour boundary", () => {
    expect(
      withinCoalesceWindow(last, new Date("2026-09-09T13:00:00.000Z")),
    ).toBe(false);
  });
});
