import { randomUUID } from "node:crypto";

import {
  computeScores,
  MAX_OPTION_WEIGHT,
  QUESTIONS,
  type Scores,
} from "@soteria/shared";
import knexFactory, { type Knex } from "knex";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { knexConfigFor } from "../db/config.js";
import { readScoreHistory } from "./history.js";
import { writeScoreSnapshots } from "./snapshots.js";

/**
 * Integration test against a real SQL Server, mirroring
 * `account/delete.integration.test.ts`: runs in CI's `db-migrations` job and is
 * skipped when DATABASE_URL is unset, so the default `npm test` needs no
 * database. There is no Docker on the dev machine — this suite runs only in CI.
 *
 * What it pins that the unit tests cannot: that the hourly coalescing check
 * behaves differently at 59 vs 61 minutes against real stored rows and real
 * datetime round-tripping, and that `readScoreHistory` reads them back.
 */
const databaseUrl = process.env.DATABASE_URL;
const suite =
  databaseUrl === undefined || databaseUrl === "" ? describe.skip : describe;

const BEST: Scores = computeScores({
  answers: Object.fromEntries(
    QUESTIONS.map((question) => [
      question.id,
      question.options.find((o) => o.weight === MAX_OPTION_WEIGHT)?.id ??
        question.options[0]!.id,
    ]),
  ),
});

suite("score snapshot coalescing (integration)", () => {
  let db: Knex;

  beforeAll(async () => {
    db = knexFactory(knexConfigFor(databaseUrl as string));
    await db.migrate.rollback(undefined, true);
    await db.migrate.latest();
  }, 120_000);

  afterAll(async () => {
    await db?.destroy();
  });

  async function freshUser(): Promise<string> {
    const userId = randomUUID();
    await db("users").insert({
      id: userId,
      google_sub: `sub-${userId}`,
      email: `${userId}@example.test`,
    });
    return userId;
  }

  const T0 = new Date("2026-09-09T12:00:00.000Z");

  it("drops a second snapshot 59 minutes later", async () => {
    const userId = await freshUser();

    const first = await writeScoreSnapshots(userId, null, BEST, db, T0);
    expect(first).toBe(BEST.categories.length);

    const second = await writeScoreSnapshots(
      userId,
      null,
      BEST,
      db,
      new Date(T0.getTime() + 59 * 60 * 1000),
    );

    expect(second).toBe(0);
    const rows = await db("score_snapshots").where({ user_id: userId });
    expect(rows).toHaveLength(BEST.categories.length);
  });

  it("writes a second snapshot 61 minutes later", async () => {
    const userId = await freshUser();

    await writeScoreSnapshots(userId, null, BEST, db, T0);
    const second = await writeScoreSnapshots(
      userId,
      null,
      BEST,
      db,
      new Date(T0.getTime() + 61 * 60 * 1000),
    );

    expect(second).toBe(BEST.categories.length);
    const rows = await db("score_snapshots").where({ user_id: userId });
    expect(rows).toHaveLength(BEST.categories.length * 2);
  });

  it("readScoreHistory returns the stored points within the window", async () => {
    const userId = await freshUser();
    await writeScoreSnapshots(userId, null, BEST, db, T0);

    const history = await readScoreHistory(
      userId,
      90,
      db,
      new Date(T0.getTime() + 24 * 60 * 60 * 1000),
    );

    const passwords = history.categories.find(
      (c) => c.key === "password_hygiene",
    );
    expect(passwords?.points).toHaveLength(1);
    expect(passwords?.points[0]?.score).toBe(
      BEST.categories.find((c) => c.key === "password_hygiene")?.score,
    );
  });

  it("excludes points older than the window", async () => {
    const userId = await freshUser();
    await writeScoreSnapshots(userId, null, BEST, db, T0);

    const history = await readScoreHistory(
      userId,
      30,
      db,
      new Date(T0.getTime() + 40 * 24 * 60 * 60 * 1000),
    );

    for (const series of history.categories) {
      expect(series.points).toEqual([]);
    }
  });
});
