import { randomUUID } from "node:crypto";

import type { Knex } from "knex";

import { getDb } from "../db/knex.js";
import type { GoogleIdentity } from "./google.js";

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
  return db.transaction(async (trx) => {
    const row = await trx("users")
      .where({ id })
      .first<Pick<UserRow, "token_version"> | undefined>("token_version");

    if (row === undefined) return undefined;

    const next = row.token_version + 1;

    await trx("users")
      .where({ id })
      .update({ token_version: next, updated_at: new Date() });

    return next;
  });
}
