import knexFactory, { type Knex } from "knex";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { knexConfigFor } from "./config.js";
import { toProductRow } from "./catalog.js";

/**
 * Integration test against a real SQL Server. Runs in CI against the
 * `mcr.microsoft.com/mssql/server:2022-latest` service container and locally
 * against `docker compose up sql`. Skipped when DATABASE_URL is unset so the
 * default `npm test` needs no database.
 */
const databaseUrl = process.env.DATABASE_URL;
const suite =
  databaseUrl === undefined || databaseUrl === "" ? describe.skip : describe;

const EXPECTED_TABLES = [
  "users",
  "questionnaire_responses",
  "score_snapshots",
  "coach_progress",
  "products",
  "user_software",
  "cve_cache",
  "cve_matches",
  "recommendations",
  "alerts",
  "notification_settings",
  "audit_log",
];

suite("initial schema migration", () => {
  let db: Knex;

  beforeAll(async () => {
    db = knexFactory(knexConfigFor(databaseUrl as string));
    await db.migrate.rollback(undefined, true);
    await db.migrate.latest();
  }, 120_000);

  afterAll(async () => {
    await db?.destroy();
  });

  it("creates every table in the data model", async () => {
    for (const table of EXPECTED_TABLES) {
      expect(await db.schema.hasTable(table), table).toBe(true);
    }
  });

  it("stores no column that could hold a credential", async () => {
    const rows = await db<{ COLUMN_NAME: string }>(
      "INFORMATION_SCHEMA.COLUMNS",
    ).select("COLUMN_NAME");
    const forbidden = /password|passphrase|secret|credential|hash|token/i;

    expect(
      rows.map((row) => row.COLUMN_NAME).filter((name) => forbidden.test(name)),
    ).toEqual([]);
  });

  it("cascades every user-owned row when the account is deleted", async () => {
    const userId = crypto.randomUUID();

    await db("users").insert({
      id: userId,
      google_sub: `sub-${userId}`,
      email: `${userId}@example.test`,
    });
    await db("questionnaire_responses").insert({
      id: crypto.randomUUID(),
      user_id: userId,
      submission_id: crypto.randomUUID(),
      question_key: "mfa_enabled",
      answer_value: "yes",
    });
    await db("score_snapshots").insert({
      id: crypto.randomUUID(),
      user_id: userId,
      category: "accounts",
      score: 70,
    });
    await db("notification_settings").insert({ user_id: userId });
    await db("audit_log").insert({ user_id: userId, action: "auth.sign_in" });

    await db("users").where({ id: userId }).delete();

    expect(
      await db("questionnaire_responses").where({ user_id: userId }),
    ).toHaveLength(0);
    expect(await db("score_snapshots").where({ user_id: userId })).toHaveLength(
      0,
    );
    expect(
      await db("notification_settings").where({ user_id: userId }),
    ).toHaveLength(0);

    // The audit trail survives, anonymised.
    const audit = await db("audit_log").where({ action: "auth.sign_in" });
    expect(audit.length).toBeGreaterThan(0);
    expect(audit.every((row) => row.user_id === null)).toBe(true);
  });

  it("rejects a status outside the coach_progress check constraint", async () => {
    const userId = crypto.randomUUID();

    await db("users").insert({
      id: userId,
      google_sub: `sub-${userId}`,
      email: `${userId}@example.test`,
    });

    await expect(
      db("coach_progress").insert({
        id: crypto.randomUUID(),
        user_id: userId,
        track: "password-manager",
        task_key: "install",
        status: "elsewhere",
      }),
    ).rejects.toThrow();

    await db("users").where({ id: userId }).delete();
  });

  it("seeds and re-seeds the product catalog idempotently", async () => {
    const row = toProductRow({
      id: "test-product",
      name: "Test Product",
      vendor: "Test Vendor",
      category: "desktop-app",
      cpeVendor: "test",
      cpeProduct: "product",
      versionScheme: "semver",
      versionHelp: "Open Help, then About.",
      vendorAdvisoryUrl: "https://example.test/advisories",
    });

    await db("products").insert(row);
    const updated = await db("products").where({ id: row.id }).update(row);

    expect(updated).toBe(1);
    await db("products").where({ id: row.id }).delete();
  });

  // Security review finding 9: the AUDIT_ACTIONS union is a compile-time guard
  // only. The CHECK constraint is what makes "no free text in the trail" true of
  // the database.
  it("rejects an action outside the audit_log vocabulary", async () => {
    await expect(
      db("audit_log").insert({ action: "whatever.i.like" }),
    ).rejects.toThrow();

    await expect(
      db("audit_log").insert({ action: "auth.sign_in" }),
    ).resolves.toBeDefined();
  });

  it("rolls back cleanly", async () => {
    await db.migrate.rollback(undefined, true);
    expect(await db.schema.hasTable("users")).toBe(false);
    await db.migrate.latest();
  }, 120_000);
});
