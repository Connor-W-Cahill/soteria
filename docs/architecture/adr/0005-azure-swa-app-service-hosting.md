# 0005 — Azure Static Web Apps + App Service (Linux) hosting

## Status

Accepted (implementation plan section 2, 2026-09-08).

## Context

The brief mandates Azure hosting. Soteria is a static client bundle plus a plain
Node API plus a SQL database. The team has a student subscription and needs every
piece to sit on a free or student tier. A thin end-to-end deploy is done in
Phase 1 (INF-05) specifically to surface Azure quirks before feature work.

## Decision

- **Client** → **Azure Static Web Apps** (Free): serves the Vite build, gives
  HTTPS and a global CDN, no server process.
- **API** → **Azure App Service**, Linux, Node 22, **F1** free tier (parameter
  `appServicePlanSku`, move to B1 if the daily CPU quota bites).
- **Database** → **Azure SQL Database** free offer (see
  [0004](0004-azure-sql-knex-mssql.md)).
- Everything is described in `infra/main.bicep` and provisioned by
  `infra/deploy.sh`; deploys run from `.github/workflows/deploy.yml` only after CI
  passes on `main`. Full walkthrough in [`deploy.md`](../../deploy.md).

## Consequences

- The SWA / App Service split keeps the API a pure JSON process with no static
  file serving, which matches the `default-src 'none'` CSP and the Vite build.
- CORS must be locked to exactly the SWA origin because the session is an
  httpOnly cookie; there is deliberately no wildcard fallback, so a
  misconfiguration fails closed (see `deploy.md` section 5).
- F1 has no "Always On" and a 60 CPU-minute daily budget, so the API cold-starts
  and cannot host background timers. Scheduled work is therefore external (see
  [0010](0010-github-actions-cron-scheduled-work.md)).
- Infrastructure is code (Bicep), so the environment can be torn
  down (`az group delete`) and rebuilt without portal clicking.
- The one-time `az login` and subscription setup cannot be done by an automated
  agent; that step is a documented human task.
