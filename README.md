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
3. Run `npm run dev` to start the React client and Node API together.

The client runs at `http://localhost:5173` and proxies `/api` requests to the
server at `http://localhost:3000`. Check the API with `GET /api/health`.

## Checks

- `npm run lint` checks ESLint and Prettier.
- `npm run typecheck` type-checks all workspaces in strict mode.
- `npm test` runs Vitest across all workspaces, including the server's
  Supertest health-endpoint test.
- `npm run playwright -w @soteria/client` runs browser tests once Phase 1 adds
  the first end-to-end scenario.
