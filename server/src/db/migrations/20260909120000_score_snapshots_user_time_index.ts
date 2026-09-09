import type { Knex } from "knex";

/**
 * Adds a `(user_id, captured_at)` index on `score_snapshots` for US-19.
 *
 * Two hot reads land on this table and neither is served well by the existing
 * `(user_id, category, captured_at)` index, whose second column splits the
 * timeline per category:
 *
 *  - the coalescing check on every questionnaire save — "does this user have any
 *    snapshot in the last hour?" — which wants the single newest row for a user;
 *  - `GET /api/scores/history?days=N`, which scans one user's rows in a date
 *    range across all categories at once.
 *
 * The category-first index stays: US-18/US-19's "how did password hygiene move"
 * query still wants it.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("score_snapshots", (table) => {
    table.index(["user_id", "captured_at"], "ix_scores_user_time");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("score_snapshots", (table) => {
    table.dropIndex(["user_id", "captured_at"], "ix_scores_user_time");
  });
}
