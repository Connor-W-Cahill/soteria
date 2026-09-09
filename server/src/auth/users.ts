import { randomUUID } from "node:crypto";

import type { Knex } from "knex";

import { getDb } from "../db/knex.js";
import { ApiError } from "../http/errors.js";
import type { GoogleIdentity } from "./google.js";

/**
 * SQL Server's unique-constraint violations: 2627 for a constraint, 2601 for a
 * unique index. `users.email` is UNIQUE NOT NULL, and two reachable cases hit it:
 * a returning user whose Google email changed to an address already on another
 * row, and a new `google_sub` carrying a recycled address (a deleted-and-
 * recreated Workspace account gets a new subject and keeps the old email).
 *
 * Unhandled, either one throws and the route 500s on every subsequent attempt —
 * a permanent lockout with no action the user can take. Neither ever merges two
 * identities, which is the part that matters; this only makes the failure legible.
 */
const UNIQUE_VIOLATION = new Set([2627, 2601]);

function isEmailCollision(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;

  const number = (error as { number?: unknown }).number;
  if (typeof number !== "number" || !UNIQUE_VIOLATION.has(number)) return false;

  // Only claim an email collision when the message names that column; a
  // google_sub collision is a different bug and must not be mislabelled.
  const message = String((error as { message?: unknown }).message ?? "");
  return /email/i.test(message);
}

/** Never includes the address: the message is shown to whoever asked. */
function emailCollision(): ApiError {
  return ApiError.conflict(
    "That Google account's email address is already linked to a different Soteria account. Sign in with the original account, or contact support to merge them.",
  );
}

export interface UserRecord {
  id: string;
  email: string;
  displayName: string | null;
  tokenVersion: number;
}

interface UserRow {
  id: string;
  email: string;
  display_name: string | null;
  token_version: number;
}

function toRecord(row: UserRow): UserRecord {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    tokenVersion: row.token_version,
  };
}

const COLUMNS = ["id", "email", "display_name", "token_version"] as const;

/**
 * Finds or creates the user for a verified Google identity.
 *
 * The match is on `google_sub`, never on email: Google's subject is stable but a
 * Google account's email address can change, and matching on a mutable field
 * would either strand a returning user with a new address or — worse — hand them
 * a different person's row if an address were ever reassigned.
 *
 * Runs in a transaction so a first sign-in cannot interleave with itself and
 * create two rows for one person.
 */
export async function upsertGoogleUser(
  identity: GoogleIdentity,
  db: Knex = getDb(),
  now = new Date(),
): Promise<UserRecord> {
  try {
    return await upsert(identity, db, now);
  } catch (error) {
    if (isEmailCollision(error)) throw emailCollision();
    throw error;
  }
}

async function upsert(
  identity: GoogleIdentity,
  db: Knex,
  now: Date,
): Promise<UserRecord> {
  return db.transaction(async (trx) => {
    const existing = await trx("users")
      .where({ google_sub: identity.googleSub })
      .first<UserRow | undefined>(...COLUMNS);

    if (existing !== undefined) {
      await trx("users").where({ id: existing.id }).update({
        email: identity.email,
        display_name: identity.displayName,
        last_seen_at: now,
        updated_at: now,
      });

      return {
        ...toRecord(existing),
        email: identity.email,
        displayName: identity.displayName,
      };
    }

    const id = randomUUID();

    await trx("users").insert({
      id,
      google_sub: identity.googleSub,
      email: identity.email,
      display_name: identity.displayName,
      token_version: 0,
      created_at: now,
      updated_at: now,
      last_seen_at: now,
    });

    return {
      id,
      email: identity.email,
      displayName: identity.displayName,
      tokenVersion: 0,
    };
  });
}

/** Loads the user a session token points at, or `undefined` if the row is gone. */
export async function findUserById(
  id: string,
  db: Knex = getDb(),
): Promise<UserRecord | undefined> {
  const row = await db<UserRow>("users")
    .where({ id })
    .first(...COLUMNS);

  return row === undefined ? undefined : toRecord(row);
}

/**
 * Invalidates every outstanding session for a user and returns the new version.
 *
 * This is how sign-out-everywhere works, and it is the step that must precede an
 * account deletion (US-20): bump first, so a cookie that is in flight while the
 * rows are being deleted cannot be used against the half-deleted account.
 */
export async function bumpTokenVersion(
  id: string,
  db: Knex = getDb(),
): Promise<number | undefined> {
  // One atomic increment rather than read-then-write. The read-then-write version
  // could lose an update under two concurrent sign-outs (0->1 instead of 0->2).
  // That failed safe — a lost update still leaves the version at or above what
  // any outstanding cookie carries — but nobody should have to re-derive that,
  // and `token_version + 1` in the database removes the question.
  return db.transaction(async (trx) => {
    const updated = await trx("users")
      .where({ id })
      .update({
        token_version: trx.raw("token_version + 1"),
        updated_at: new Date(),
      });

    if (updated === 0) return undefined;

    const row = await trx("users")
      .where({ id })
      .first<Pick<UserRow, "token_version"> | undefined>("token_version");

    return row?.token_version;
  });
}
