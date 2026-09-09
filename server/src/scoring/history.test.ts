import { CATEGORY_KEYS } from "@soteria/shared";
import type { Knex } from "knex";
import { describe, expect, it, vi } from "vitest";

import { readScoreHistory } from "./history.js";

const USER_ID = "11111111-1111-4111-8111-111111111111";

interface Row {
  category: string;
  score: number;
  rationale: string | null;
  captured_at: string;
}

/**
 * A db stub that records the range predicate and returns fixed rows. The real
 * ordering is done by SQL; the rows are supplied already oldest-first.
 */
function stubDb(rows: Row[]) {
  const calls: { andWhere?: unknown[] } = {};
  const query = {
    where: vi.fn(() => query),
    andWhere: vi.fn((...args: unknown[]) => {
      calls.andWhere = args;
      return query;
    }),
    orderBy: vi.fn(() => query),
    select: vi.fn(async () => rows),
  };
  const db = vi.fn(() => query) as unknown as Knex;

  return { db, query, calls };
}

const NOW = new Date("2026-09-09T12:00:00.000Z");

describe("readScoreHistory", () => {
  it("returns all five categories in canonical order, even with no rows", async () => {
    const { db } = stubDb([]);

    const result = await readScoreHistory(USER_ID, 90, db, NOW);

    expect(result.categories.map((c) => c.key)).toEqual([...CATEGORY_KEYS]);
    for (const series of result.categories) {
      expect(series.points).toEqual([]);
    }
    expect(result.changes).toEqual([]);
    expect(result.days).toBe(90);
  });

  it("asks the database only for rows inside the window", async () => {
    const { db, calls } = stubDb([]);

    await readScoreHistory(USER_ID, 30, db, NOW);

    const since = new Date("2026-08-10T12:00:00.000Z");
    expect(calls.andWhere).toEqual(["captured_at", ">=", since]);
    expect((await readScoreHistory(USER_ID, 30, db, NOW)).since).toBe(
      since.toISOString(),
    );
  });

  it("groups points per category, oldest first", async () => {
    const { db } = stubDb([
      {
        category: "password_hygiene",
        score: 40,
        rationale: "1 of 3 questions answered",
        captured_at: "2026-09-01T00:00:00.000Z",
      },
      {
        category: "password_hygiene",
        score: 70,
        rationale: "3 of 3 questions answered",
        captured_at: "2026-09-05T00:00:00.000Z",
      },
      {
        category: "multifactor_authentication",
        score: 55,
        rationale: null,
        captured_at: "2026-09-05T00:00:00.000Z",
      },
    ]);

    const result = await readScoreHistory(USER_ID, 90, db, NOW);
    const passwords = result.categories.find(
      (c) => c.key === "password_hygiene",
    );

    expect(passwords?.points.map((p) => p.score)).toEqual([40, 70]);
    expect(passwords?.points[0]?.capturedAt).toBe("2026-09-01T00:00:00.000Z");
  });

  it("builds a change log entry per capture where a category moved", async () => {
    const { db } = stubDb([
      {
        category: "multifactor_authentication",
        score: 40,
        rationale: null,
        captured_at: "2026-09-01T00:00:00.000Z",
      },
      {
        category: "multifactor_authentication",
        score: 52,
        rationale: null,
        captured_at: "2026-09-03T00:00:00.000Z",
      },
    ]);

    const result = await readScoreHistory(USER_ID, 90, db, NOW);

    expect(result.changes).toHaveLength(1);
    expect(result.changes[0]?.deltas).toEqual([
      { key: "multifactor_authentication", from: 40, to: 52, delta: 12 },
    ]);
  });

  it("ignores a stored category the current question set no longer uses", async () => {
    const { db } = stubDb([
      {
        category: "legacy_category",
        score: 10,
        rationale: null,
        captured_at: "2026-09-01T00:00:00.000Z",
      },
    ]);

    const result = await readScoreHistory(USER_ID, 90, db, NOW);

    for (const series of result.categories) {
      expect(series.points).toEqual([]);
    }
  });
});
