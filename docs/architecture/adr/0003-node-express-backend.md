# 0003 — Node 22 + Express 5 + TypeScript backend

## Status

Accepted (implementation plan section 2, 2026-09-08).

## Context

The brief mandates a Node.js REST API. The API's job is narrow: verify Google ID
tokens, hold sessions, run CRUD against Azure SQL, call the NVD CVE API on a
schedule, and run the pure engines from `@soteria/shared`. It must run on an
Azure App Service Linux free tier (F1) with no "Always On", so it has to be a
plain process with a fast cold start.

## Decision

- **Node 22 LTS** (`engines.node >= 22`), the newest runtime Azure App Service
  Linux offers.
- **Express 5** as the HTTP framework.
- **TypeScript**, compiled ahead of deploy to `dist/` so App Service runs
  `node dist/server.js` with `SCM_DO_BUILD_DURING_DEPLOYMENT=false`.
- Supporting libraries fixed by the plan: **zod** (validation), **pino**
  (logging), **helmet** (headers), **express-rate-limit** (throttling). Their use
  is specified in [`conventions.md`](../conventions.md).

## Consequences

- A small, conventional stack that a nontechnical reviewer and a course grader
  can both follow.
- Pre-compiled output means no build step and no dev dependencies on the App
  Service instance, which keeps the cold start short and the attack surface
  small.
- Express 5's native async error propagation is what makes the single central
  `errorHandler` in `conventions.md` section 1 work without wrapper functions.
- Node 22 pins one runtime for local dev, CI, and production, removing "works on
  my machine" version drift.
- Express is unopinionated about structure; the team imposes structure through
  `server/src/http/`, `server/src/db/`, `server/src/cve/`, and the conventions
  doc rather than through the framework.
