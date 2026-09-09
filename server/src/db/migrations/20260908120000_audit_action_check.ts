import type { Knex } from "knex";

/**
 * Constrains `audit_log.action` to the closed vocabulary INF-08 defines in
 * `server/src/db/audit.ts`. `actor` and `outcome` were already constrained; the
 * privacy claim ("the trail records that something happened, never what was in
 * it") is only enforceable if `action` cannot carry free text either.
 *
 * The list is inlined rather than imported: a migration must keep describing the
 * schema it created even after the application's union moves on. Extending
 * `AUDIT_ACTIONS` therefore means adding a migration, which is the point.
 */
const AUDIT_ACTIONS = [
  "auth.sign_in",
  "auth.sign_out",
  "account.delete",
  "software.add",
  "software.remove",
  "recommendation.dismiss",
  "recommendation.complete",
  "alert.dismiss",
  "job.cve_refresh",
  "job.digest_send",
];

const CONSTRAINT = "ck_audit_log_action";

export async function up(knex: Knex): Promise<void> {
  const values = AUDIT_ACTIONS.map((action) => `'${action}'`).join(", ");

  await knex.raw(
    `ALTER TABLE [audit_log] ADD CONSTRAINT [${CONSTRAINT}] CHECK ([action] IN (${values}))`,
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(
    `ALTER TABLE [audit_log] DROP CONSTRAINT IF EXISTS [${CONSTRAINT}]`,
  );
}
