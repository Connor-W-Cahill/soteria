import type { Knex } from "knex";

import { logger } from "../logging/logger.js";
import { getDb } from "./knex.js";

/**
 * The audit trail records *that* something happened, never what was in it.
 * There is no payload parameter here and no payload column in `audit_log`, so a
 * caller cannot write user content into the trail even by accident.
 */
export const AUDIT_ACTIONS = [
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
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];
export type AuditActor = "user" | "system" | "job";
export type AuditOutcome = "success" | "failure";

export interface AuditEvent {
  action: AuditAction;
  /** Null for anonymous actors and for the record of an account deletion. */
  userId?: string | null;
  actor?: AuditActor;
  outcome?: AuditOutcome;
  requestId?: string | undefined;
}

export interface AuditRow {
  user_id: string | null;
  actor: AuditActor;
  action: AuditAction;
  outcome: AuditOutcome;
  request_id: string | null;
  occurred_at: Date;
}

/** Pure mapping from event to row, so the shape is unit-testable without a database. */
export function toAuditRow(event: AuditEvent, now = new Date()): AuditRow {
  return {
    user_id: event.userId ?? null,
    actor: event.actor ?? "user",
    action: event.action,
    outcome: event.outcome ?? "success",
    request_id: event.requestId ?? null,
    occurred_at: now,
  };
}

/**
 * Appends one row to `audit_log`. Never throws: an audit write must not turn a
 * successful user action into a 500. A failure is logged instead.
 */
export async function recordAuditEvent(
  event: AuditEvent,
  db: Knex = getDb(),
): Promise<void> {
  try {
    await db("audit_log").insert(toAuditRow(event));
  } catch (error) {
    logger.error(
      { err: error, action: event.action },
      "Failed to write an audit_log row",
    );
  }
}
