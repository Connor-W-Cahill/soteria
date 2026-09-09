# Soteria

Personal cybersecurity posture assistant. CS330 group project (Fall 2026).
React + Node.js REST API + Azure SQL, hosted on Azure, with live data from the
NVD CVE API and Have I Been Pwned.

**Status: implementation in progress.**

Start here:

1. `docs/plan/IMPLEMENTATION_PLAN.md` — architecture decisions, phases, agent assignments, course calendar.
2. `docs/plan/ISSUE_BACKLOG.md` — the 48 GitHub issues (10 epics) with acceptance criteria. Canonical data: `docs/plan/issues.json`.
3. `docs/plan/AGENT_RUNBOOK.md` — `ai-task` commands and prompts to execute each phase with Codex Sol/Terra/Luna and Claude Opus.
4. `docs/design/DESIGN_SEED.md` — the visual design, derived from seed `3080478562`.

Source user stories: `../CybersecurityAppUserStories.md`. Charter: `../output/Soteria_Group_Project_Charter.docx`.

## Local development

Requirements: Node.js 22 or newer and npm.

1. Run `npm install` from the repository root.
2. Copy `.env.example` to `.env` and adjust only the values needed locally.
3. Start the local database with `docker compose up -d sql` (SQL Server 2022),
   then run `npm run db:ensure && npm run db:migrate && npm run db:seed`.
4. Run `npm run dev` to start the React client and Node API together.

The client runs at `http://localhost:5173` and proxies `/api` requests to the
server at `http://localhost:3000`. Check the API with `GET /api/health`.

## Database

Azure SQL in production, SQL Server 2022 in Docker locally, through Knex with
the `mssql` driver. `DATABASE_URL` carries the connection (see `.env.example`).

- `npm run db:ensure` creates the database if it does not exist (local and CI only).
- `npm run db:migrate` applies migrations from `server/src/db/migrations`.
- `npm run db:rollback` undoes the last migration batch.
- `npm run db:status` prints the current migration version.
- `npm run db:seed` loads `shared/catalog/products.json` into `products`.

The schema, its privacy invariants, and the ERD are documented in
[`docs/architecture/data-model.md`](docs/architecture/data-model.md).

## API conventions

The error envelope, request validation, log redaction, correlation ids, rate
limiting, and the audit log are documented in
[`docs/architecture/conventions.md`](docs/architecture/conventions.md). Every
route added from Phase 2 on uses them.

## Checks

- `npm run lint` checks ESLint and Prettier.
- `npm run typecheck` type-checks all workspaces in strict mode.
- `npm test` runs Vitest across all workspaces, including the server's
  Supertest health-endpoint test.
- `npm test -w @soteria/server` with `DATABASE_URL` set also runs the migration
  integration test; it is skipped when the variable is unset.
- `npm run playwright -w @soteria/client` runs browser tests once Phase 1 adds
  the first end-to-end scenario.
