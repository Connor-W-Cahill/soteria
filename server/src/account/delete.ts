import type { Knex } from "knex";

import { recordAuditEvent } from "../db/audit.js";
import { getDb } from "../db/knex.js";
import { logger } from "../logging/logger.js";

/**
 * Deletes a user and every row they own, in the order US-20 and the data model
 * require (docs/architecture/data-model.md, "SQL Server cascade-path
 * constraints"). The caller has already bumped `token_version`; this function
 * does not, and must not be reached with an un-revoked session.
 *
 * Everything happens in one transaction, so a failure part-way leaves the
 * account whole rather than half-deleted:
 *
 *   1. `alerts` for the user       — `alerts.cve_match_id` is NO ACTION, so the
 *   2. `cve_matches` for the user's   rows it points at cannot be cascade-deleted
 *      `user_software`                out from under it; both are cleared by hand.
 *   3. one `audit_log` row          — written *before* the user is gone, with the
 *                                     real `user_id`, so the FK is satisfied.
 *   4. `delete from users`          — cascades questionnaire_responses,
 *                                     score_snapshots, coach_progress,
 *                                     user_software, recommendations,
 *                                     notification_settings, AND flips the audit
 *                                     row's `user_id` to NULL via ON DELETE SET
 *                                     NULL. The deletion record survives; the
 *                                     identifier does not.
 *
 * There is no payload column and no hashed id: a stable hash of the user id is
 * still a durable, linkable pseudonym for someone who has asked to be forgotten.
 * See issue #26 for the full reasoning.
 */
export async function deleteUserAndData(
  userId: string,
  requestId: string | undefined = undefined,
  db: Knex = getDb(),
): Promise<void> {
  await db.transaction(async (trx) => {
    await trx("alerts").where({ user_id: userId }).delete();

    await trx("cve_matches")
      .whereIn(
        "user_software_id",
        trx("user_software").select("id").where({ user_id: userId }),
      )
      .delete();

    await recordAuditEvent(
      { action: "account.delete", userId, actor: "user", requestId },
      trx,
    );

    await trx("users").where({ id: userId }).delete();
  });

  logger.info(
    { action: "account.delete", requestId },
    "Account and all owned data deleted",
  );
}
