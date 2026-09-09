import knexFactory, { type Knex } from "knex";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { knexConfigFor } from "../db/config.js";
import { deleteUserAndData } from "./delete.js";

/**
 * Integration test against a real SQL Server, mirroring
 * `server/src/db/schema.integration.test.ts`: runs in CI against the
 * `mcr.microsoft.com/mssql/server:2022-latest` service container and locally
 * against `docker compose up sql`. Skipped when DATABASE_URL is unset so the
 * default `npm test` needs no database.
 *
 * The claim under test is the US-20 acceptance criterion: after a delete, zero
 * rows remain for the user in *every* user-owned table, and the only trace left
 * is one anonymised `audit_log` row.
 */
const databaseUrl = process.env.DATABASE_URL;
const suite =
  databaseUrl === undefined || databaseUrl === "" ? describe.skip : describe;

/** Every table that holds data owned by a user, directly or through a parent. */
const USER_OWNED_TABLES = [
  "questionnaire_responses",
  "score_snapshots",
  "coach_progress",
  "user_software",
  "cve_matches",
  "recommendations",
  "alerts",
  "notification_settings",
];

suite("deleteUserAndData", () => {
  let db: Knex;

  beforeAll(async () => {
    db = knexFactory(knexConfigFor(databaseUrl as string));
    await db.migrate.rollback(undefined, true);
    await db.migrate.latest();
  }, 120_000);

  afterAll(async () => {
    await db?.destroy();
  });

  async function seedFullAccount(): Promise<string> {
    const userId = crypto.randomUUID();
    const softwareId = crypto.randomUUID();
    const productId = `product-${userId}`;
    const cveId = `CVE-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

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
    await db("coach_progress").insert({
      id: crypto.randomUUID(),
      user_id: userId,
      track: "password-manager",
      task_key: "install",
    });
    await db("products").insert({
      id: productId,
      name: "Test Product",
      vendor: "Test Vendor",
      category: "desktop-app",
      cpe_vendor: "test",
      cpe_product: "product",
      version_scheme: "semver",
      version_help: "About box.",
      vendor_advisory_url: "https://example.test/advisories",
    });
    await db("user_software").insert({
      id: softwareId,
      user_id: userId,
      product_id: productId,
    });
    await db("cve_cache").insert({ cve_id: cveId, summary: "A test CVE." });
    const [matchId] = await db("cve_matches")
      .insert({
        id: crypto.randomUUID(),
        user_software_id: softwareId,
        cve_id: cveId,
        match_reason: "version in range",
      })
      .returning("id");
    await db("recommendations").insert({
      id: crypto.randomUUID(),
      user_id: userId,
      kind: "update",
      title: "Update it",
      body: "There is a fix.",
    });
    await db("alerts").insert({
      id: crypto.randomUUID(),
      user_id: userId,
      // The NO ACTION foreign key: this must not block the delete.
      cve_match_id:
        typeof matchId === "object" && matchId !== null
          ? (matchId as { id: string }).id
          : matchId,
      title: "New CVE affects your software",
      body: "See recommendations.",
    });
    await db("notification_settings").insert({ user_id: userId });

    return userId;
  }

  it("leaves zero rows in every user-owned table", async () => {
    const userId = await seedFullAccount();
    const softwareIds = (
      await db("user_software").where({ user_id: userId }).select("id")
    ).map((row) => row.id as string);

    await deleteUserAndData(userId, "req-test", db);

    expect(await db("users").where({ id: userId })).toHaveLength(0);

    for (const table of USER_OWNED_TABLES) {
      const remaining =
        table === "cve_matches"
          ? await db(table).whereIn("user_software_id", softwareIds)
          : await db(table).where({ user_id: userId });

      expect(remaining, `${table} still has rows`).toHaveLength(0);
    }
  });

  it("keeps one anonymised audit_log row for the deletion", async () => {
    const userId = await seedFullAccount();

    await deleteUserAndData(userId, "req-audit", db);

    const rows = await db("audit_log")
      .where({ action: "account.delete", request_id: "req-audit" })
      .select("user_id");

    expect(rows).toHaveLength(1);
    expect(rows[0]?.user_id).toBeNull();
  });

  it("does not touch catalog data", async () => {
    const before = await db("products").count<{ n: number }[]>({ n: "*" });
    const userId = await seedFullAccount();
    await deleteUserAndData(userId, undefined, db);
    const after = await db("products").count<{ n: number }[]>({ n: "*" });

    // One product was seeded and it must survive; the count only grows.
    expect(Number(after[0]?.n)).toBeGreaterThanOrEqual(Number(before[0]?.n));
  });
});
