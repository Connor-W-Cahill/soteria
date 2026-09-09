# 0004 — Azure SQL Database via Knex + `mssql`

## Status

Accepted (implementation plan section 2, 2026-09-08).

## Context

The brief mandates an Azure-hosted SQL database. The data is relational and
small: a dozen tables, mostly per-user rows plus two shared caches (see
[`data-model.md`](../data-model.md)). The team needs migrations that run the same
way locally, in CI, and against Azure, and a local database that does not require
an Azure connection to develop against.

## Decision

- **Azure SQL Database**, General Purpose serverless on the free offer, in
  production.
- **SQL Server 2022 in Docker** (`docker-compose.yml`) for local development and
  CI, so the dialect matches production exactly.
- **Knex** query builder and migration tool with the **`mssql`** driver.
- Migrations live in `server/src/db/migrations`; a typed CLI
  (`npm run db:migrate` / `db:rollback` / `db:seed` / `db:status`) wraps Knex so
  the same commands work everywhere (INF-04).

## Consequences

- One SQL dialect (T-SQL) across every environment; no SQLite-in-dev surprises.
- Knex migrations are plain, reviewable, and reversible, which suits a course
  project where the schema is a graded artifact.
- SQL Server's rule that a row may be reached by only one cascade path forces
  three foreign keys to `NO ACTION` and a deliberate delete order for account
  deletion; this is documented in `data-model.md` and is not a defect.
- The free serverless tier auto-pauses after 60 minutes idle, so the first
  request after a pause is slow; the health check's retry loop and the deploy
  smoke test account for it (see [`deploy.md`](../../deploy.md)).
- Knex is a query builder, not an ORM: no lazy loading, no identity map, and SQL
  stays visible. The team writes explicit queries in `server/src/db/`.
