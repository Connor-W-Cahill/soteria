import type { Knex } from "knex";

/**
 * Initial Soteria schema.
 *
 * Privacy invariant enforced here: no column in any table stores a password, a
 * passphrase, a generated credential, or a password hash (full or partial).
 * Password-derived data never leaves the browser, so it never reaches the API
 * and it has nowhere to land in this schema. See docs/architecture/data-model.md.
 */

const STATUS_COACH = ["not_started", "in_progress", "done", "skipped"];
const STATUS_RECOMMENDATION = ["open", "done", "dismissed"];
const VERSION_SCHEMES = ["semver", "build", "marketing"];
const SEVERITIES = ["critical", "high", "medium", "low", "none"];
const AUDIT_ACTORS = ["user", "system", "job"];
const AUDIT_OUTCOMES = ["success", "failure"];

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("users", (table) => {
    table.uuid("id").primary();
    // Google's stable subject identifier. No password material is ever stored.
    table.string("google_sub", 255).notNullable().unique();
    table.string("email", 320).notNullable().unique();
    table.string("display_name", 200).nullable();
    table.datetime("created_at").notNullable().defaultTo(knex.fn.now());
    table.datetime("updated_at").notNullable().defaultTo(knex.fn.now());
    table.datetime("last_seen_at").nullable();
  });

  await knex.schema.createTable("questionnaire_responses", (table) => {
    table.uuid("id").primary();
    table
      .uuid("user_id")
      .notNullable()
      .references("id")
      .inTable("users")
      .onDelete("CASCADE");
    // Groups the answers that were submitted together.
    table.uuid("submission_id").notNullable();
    table.string("question_key", 100).notNullable();
    table.string("answer_value", 200).notNullable();
    table.datetime("answered_at").notNullable().defaultTo(knex.fn.now());
    table.unique(["submission_id", "question_key"]);
    table.index(["user_id", "answered_at"], "ix_questionnaire_user_answered");
  });

  await knex.schema.createTable("score_snapshots", (table) => {
    table.uuid("id").primary();
    table
      .uuid("user_id")
      .notNullable()
      .references("id")
      .inTable("users")
      .onDelete("CASCADE");
    table.uuid("submission_id").nullable();
    table.string("category", 60).notNullable();
    table.integer("score").notNullable();
    table.string("rationale", 500).nullable();
    table.datetime("captured_at").notNullable().defaultTo(knex.fn.now());
    table.index(["user_id", "category", "captured_at"], "ix_scores_user_cat");
  });

  await knex.schema.createTable("coach_progress", (table) => {
    table.uuid("id").primary();
    table
      .uuid("user_id")
      .notNullable()
      .references("id")
      .inTable("users")
      .onDelete("CASCADE");
    table.string("track", 60).notNullable();
    table.string("task_key", 100).notNullable();
    table
      .string("status", 20)
      .notNullable()
      .defaultTo("not_started")
      .checkIn(STATUS_COACH, "ck_coach_progress_status");
    table.datetime("updated_at").notNullable().defaultTo(knex.fn.now());
    table.unique(["user_id", "track", "task_key"]);
  });

  // Curated catalog (shared/catalog/products.json). Not user-owned data.
  await knex.schema.createTable("products", (table) => {
    table.string("id", 80).primary();
    table.string("name", 200).notNullable();
    table.string("vendor", 200).notNullable();
    table.string("category", 60).notNullable();
    table.string("cpe_vendor", 120).notNullable();
    table.string("cpe_product", 120).notNullable();
    table
      .string("version_scheme", 20)
      .notNullable()
      .checkIn(VERSION_SCHEMES, "ck_products_scheme");
    table.text("version_help").notNullable();
    table.string("version_help_platform", 80).nullable();
    table.string("vendor_advisory_url", 500).notNullable();
    table.datetime("updated_at").notNullable().defaultTo(knex.fn.now());
    table.index(["cpe_vendor", "cpe_product"], "ix_products_cpe");
  });

  await knex.schema.createTable("user_software", (table) => {
    table.uuid("id").primary();
    table
      .uuid("user_id")
      .notNullable()
      .references("id")
      .inTable("users")
      .onDelete("CASCADE");
    table
      .string("product_id", 80)
      .notNullable()
      .references("id")
      .inTable("products")
      .onDelete("NO ACTION");
    table.string("installed_version", 100).nullable();
    table.boolean("version_unknown").notNullable().defaultTo(false);
    table.datetime("added_at").notNullable().defaultTo(knex.fn.now());
    table.datetime("updated_at").notNullable().defaultTo(knex.fn.now());
    table.unique(["user_id", "product_id"]);
  });

  // Server-side cache of NVD CVE records. Shared across users; not user-owned.
  await knex.schema.createTable("cve_cache", (table) => {
    table.string("cve_id", 30).primary();
    table.datetime("published_at").nullable();
    table.datetime("last_modified_at").nullable();
    table.decimal("cvss_score", 3, 1).nullable();
    table
      .string("severity", 20)
      .nullable()
      .checkIn(SEVERITIES, "ck_cve_cache_severity");
    table.text("summary").notNullable();
    table.text("plain_language").nullable();
    table.text("references_json").nullable();
    table.string("source", 40).notNullable().defaultTo("nvd");
    table.datetime("fetched_at").notNullable().defaultTo(knex.fn.now());
    table.index(["last_modified_at"], "ix_cve_cache_modified");
  });

  await knex.schema.createTable("cve_matches", (table) => {
    table.uuid("id").primary();
    table
      .uuid("user_software_id")
      .notNullable()
      .references("id")
      .inTable("user_software")
      .onDelete("CASCADE");
    table
      .string("cve_id", 30)
      .notNullable()
      .references("cve_id")
      .inTable("cve_cache")
      .onDelete("NO ACTION");
    table.string("match_reason", 300).notNullable();
    table.datetime("first_seen_at").notNullable().defaultTo(knex.fn.now());
    table.datetime("matched_at").notNullable().defaultTo(knex.fn.now());
    table.unique(["user_software_id", "cve_id"]);
  });

  await knex.schema.createTable("recommendations", (table) => {
    table.uuid("id").primary();
    table
      .uuid("user_id")
      .notNullable()
      .references("id")
      .inTable("users")
      .onDelete("CASCADE");
    table.string("kind", 40).notNullable();
    // Opaque pointer to the thing being recommended about (product id, CVE id,
    // coach task key). Deliberately not a foreign key: a recommendation outlives
    // the row that produced it.
    table.string("subject_ref", 120).nullable();
    table.string("title", 200).notNullable();
    table.text("body").notNullable();
    table.integer("priority").notNullable().defaultTo(0);
    table
      .string("status", 20)
      .notNullable()
      .defaultTo("open")
      .checkIn(STATUS_RECOMMENDATION, "ck_recommendations_status");
    table.string("dismissed_reason", 300).nullable();
    table.datetime("created_at").notNullable().defaultTo(knex.fn.now());
    table.datetime("updated_at").notNullable().defaultTo(knex.fn.now());
    table.datetime("resolved_at").nullable();
    table.index(["user_id", "status", "priority"], "ix_recommendations_queue");
  });

  await knex.schema.createTable("alerts", (table) => {
    table.uuid("id").primary();
    table
      .uuid("user_id")
      .notNullable()
      .references("id")
      .inTable("users")
      .onDelete("CASCADE");
    // NO ACTION avoids a second cascade path to `users`, which SQL Server
    // rejects. Account deletion removes alerts before cve_matches; see
    // docs/architecture/data-model.md.
    table
      .uuid("cve_match_id")
      .nullable()
      .references("id")
      .inTable("cve_matches")
      .onDelete("NO ACTION");
    table
      .string("severity", 20)
      .notNullable()
      .defaultTo("none")
      .checkIn(SEVERITIES, "ck_alerts_severity");
    table.string("title", 200).notNullable();
    table.text("body").notNullable();
    table.datetime("created_at").notNullable().defaultTo(knex.fn.now());
    table.datetime("read_at").nullable();
    table.datetime("dismissed_at").nullable();
    table.index(["user_id", "created_at"], "ix_alerts_user_created");
  });

  await knex.schema.createTable("notification_settings", (table) => {
    table
      .uuid("user_id")
      .primary()
      .references("id")
      .inTable("users")
      .onDelete("CASCADE");
    table.boolean("email_digest_enabled").notNullable().defaultTo(false);
    table.string("digest_frequency", 20).notNullable().defaultTo("weekly");
    table
      .boolean("hibp_enrollment_acknowledged")
      .notNullable()
      .defaultTo(false);
    table.datetime("updated_at").notNullable().defaultTo(knex.fn.now());
  });

  /**
   * Append-only audit trail. Records that something happened, never what was in
   * it: there is no payload column, and `user_id` is set to NULL on account
   * deletion so the deletion event itself survives without identifying anyone.
   */
  await knex.schema.createTable("audit_log", (table) => {
    table.bigIncrements("id").primary();
    table
      .uuid("user_id")
      .nullable()
      .references("id")
      .inTable("users")
      .onDelete("SET NULL");
    table
      .string("actor", 40)
      .notNullable()
      .defaultTo("user")
      .checkIn(AUDIT_ACTORS, "ck_audit_log_actor");
    table.string("action", 60).notNullable();
    table
      .string("outcome", 20)
      .notNullable()
      .defaultTo("success")
      .checkIn(AUDIT_OUTCOMES, "ck_audit_log_outcome");
    table.string("request_id", 60).nullable();
    table.datetime("occurred_at").notNullable().defaultTo(knex.fn.now());
    table.index(["occurred_at"], "ix_audit_log_occurred");
    table.index(["user_id", "occurred_at"], "ix_audit_log_user");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("audit_log");
  await knex.schema.dropTableIfExists("notification_settings");
  await knex.schema.dropTableIfExists("alerts");
  await knex.schema.dropTableIfExists("recommendations");
  await knex.schema.dropTableIfExists("cve_matches");
  await knex.schema.dropTableIfExists("cve_cache");
  await knex.schema.dropTableIfExists("user_software");
  await knex.schema.dropTableIfExists("products");
  await knex.schema.dropTableIfExists("coach_progress");
  await knex.schema.dropTableIfExists("score_snapshots");
  await knex.schema.dropTableIfExists("questionnaire_responses");
  await knex.schema.dropTableIfExists("users");
}
