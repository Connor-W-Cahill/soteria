import {
  CATEGORY_KEYS,
  deriveScoreChanges,
  type CategoryKey,
  type ScoreHistoryResponse,
  type ScoreHistorySeries,
} from "@soteria/shared";
import type { Knex } from "knex";

import { getDb } from "../db/knex.js";

/**
 * Reads `score_snapshots` for one user over the last `days` days and shapes it
 * for `GET /api/scores/history`.
 *
 * This is the one place that reads `score_snapshots` to answer a request.
 * `GET /api/scores` deliberately recomputes from answers instead; here the whole
 * point is to report what the score *was*, so the stored rows are the source of
 * truth and are returned as-is.
 *
 * `days` is already validated and bounded by the route — this function trusts
 * it. An unbounded window would be a cheap way for a caller to ask the database
 * for a user's entire history, so the bound lives at the edge, not here.
 */
export async function readScoreHistory(
  userId: string,
  days: number,
  db: Knex = getDb(),
  now: Date = new Date(),
): Promise<ScoreHistoryResponse> {
  const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  const rows = await db("score_snapshots")
    .where({ user_id: userId })
    .andWhere("captured_at", ">=", since)
    .orderBy("captured_at", "asc")
    .select<
      {
        category: string;
        score: number;
        rationale: string | null;
        captured_at: Date | string;
      }[]
    >("category", "score", "rationale", "captured_at");

  const byCategory = new Map<CategoryKey, ScoreHistorySeries>(
    CATEGORY_KEYS.map((key) => [key, { key, points: [] }]),
  );

  for (const row of rows) {
    const series = byCategory.get(row.category as CategoryKey);
    // A category key the current question set no longer uses is skipped rather
    // than invented into the response.
    if (series === undefined) continue;

    series.points.push({
      capturedAt: new Date(row.captured_at).toISOString(),
      score: row.score,
      rationale: row.rationale,
    });
  }

  const categories = CATEGORY_KEYS.map((key) => byCategory.get(key)!);

  return {
    days,
    since: since.toISOString(),
    categories,
    changes: deriveScoreChanges(categories),
  };
}
