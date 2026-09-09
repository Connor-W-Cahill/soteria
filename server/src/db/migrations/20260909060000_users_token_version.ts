import type { Knex } from "knex";

/**
 * Adds the session-revocation counter US-14 needs.
 *
 * Every session cookie carries the `token_version` that was current when it was
 * issued. Bumping this column invalidates every outstanding cookie for that user
 * at once, without a server-side session store: sign-out-everywhere and the
 * revocation that must precede an account deletion (US-20) are both one UPDATE.
 *
 * It defaults to 0 for the rows that already exist, so an existing user's first
 * sign-in after this migration issues a version-0 cookie and matches.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("users", (table) => {
    table.integer("token_version").notNullable().defaultTo(0);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("users", (table) => {
    table.dropColumn("token_version");
  });
}
