# Soteria Issue Backlog

Generated from `issues.json` (canonical). 48 issues in 10 epics. Sol creates these on GitHub in INF-01.

## Summary by phase

| Phase | Key | Title | Agent | Milestone | Depends on |
|---|---|---|---|---|---|
| 0 | INF-01 | Bootstrap GitHub repository, labels, milestones, templates | sol | Sprint 0: Foundation | — |
| 1 | INF-02 | Monorepo scaffold: client, server, shared, lint, test, CI | sol | Sprint 0: Foundation | INF-01 |
| 1 | INF-03 | Seeded design system: tokens, fonts, app shell, base components | terra | Sprint 0: Foundation | INF-02 |
| 1 | INF-04 | Data model and migrations (Azure SQL via Knex + mssql) | sol | Sprint 0: Foundation | INF-02 |
| 1 | INF-05 | Thin end-to-end Azure deployment | sol | Sprint 0: Foundation | INF-02, INF-04 |
| 1 | INF-06 | Architecture and component design docs (course Milestones 3 and 4) | luna | Sprint 0: Foundation | INF-04 |
| 1 | INF-07 | Product catalog with CPE identifiers and version-lookup instructions | luna | Sprint 0: Foundation | INF-02 |
| 1 | INF-08 | Shared conventions: error envelope, request validation, logging redaction, audit log | sol | Sprint 0: Foundation | INF-02, INF-04 |
| 2 | US-01 | US-01 Private breach check (HIBP k-anonymity) | sol | Sprint 1 | INF-03 |
| 2 | US-02 | US-02 Random password generator (browser-only) | terra | Sprint 1 | INF-03 |
| 2 | US-03 | US-03 Passphrase generator (EFF wordlist) | terra | Sprint 1 | US-02 |
| 2 | US-04 | US-04 Explain password results (strength vs breach status) | terra | Sprint 1 | US-01 |
| 2 | US-05 | US-05 Explain password privacy | luna | Sprint 1 | US-01 |
| 2 | US-15 | US-15 Use password tools anonymously | terra | Sprint 1 | US-01, US-02, US-03 |
| 3 | US-14 | US-14 Sign in with Google | sol | Sprint 1 | INF-04, INF-08, INF-05 |
| 3 | US-20 | US-20 Delete account and all saved data | terra | Sprint 1 | US-14 |
| 4 | US-16 | US-16 Complete a posture questionnaire | terra | Sprint 1 | US-14, INF-04 |
| 4 | US-17 | US-17 Category scores (scoring engine) | sol | Sprint 1 | US-16 |
| 4 | US-18 | US-18 Understand score calculations | terra | Sprint 1 | US-17 |
| 4 | US-19 | US-19 Track posture over time | terra | Sprint 1 | US-17 |
| 5 | US-06 | US-06 Guided password-manager adoption | terra | Sprint 2 | INF-03 |
| 5 | US-07 | US-07 Secure setup checklist | terra | Sprint 2 | US-06 |
| 5 | US-08 | US-08 Record adoption progress | terra | Sprint 2 | US-07, US-14 |
| 5 | US-09 | US-09 Compare important features | luna | Sprint 2 | INF-03 |
| 5 | US-10 | US-10 Resume unfinished coach tasks | terra | Sprint 2 | US-08 |
| 5 | US-11 | US-11 Enroll in official HIBP breach notifications | luna | Sprint 2 | INF-03 |
| 5 | US-12 | US-12 Record notification enrollment | terra | Sprint 2 | US-11, US-08 |
| 5 | US-13 | US-13 Respond to a compromised password | terra | Sprint 2 | US-01, US-04 |
| 6 | US-21 | US-21 Build a software profile | terra | Sprint 2 | INF-07, US-14 |
| 6 | US-22 | US-22 Find installed versions | luna | Sprint 2 | US-21 |
| 6 | US-23 | US-23 Handle an unknown version | terra | Sprint 2 | US-21 |
| 6 | US-24 | US-24 Match relevant CVEs (NVD client, cache, matcher) | sol | Sprint 2 | INF-07, INF-04, US-21 |
| 6 | US-25 | US-25 Understand a matched CVE | terra | Sprint 2 | US-24 |
| 6 | US-26 | US-26 Verify vulnerability guidance (official links) | luna | Sprint 2 | US-25 |
| 6 | US-34 | US-34 See CVE data freshness | terra | Sprint 2 | US-24 |
| 7 | US-27 | US-27 Prioritize security actions (recommendation engine) | sol | Sprint 3 | US-17, US-24, US-08 |
| 7 | US-28 | US-28 Reevaluate after an update | terra | Sprint 3 | US-27 |
| 7 | US-29 | US-29 Dismiss a finding with context | terra | Sprint 3 | US-27 |
| 7 | US-30 | US-30 Review completed actions | terra | Sprint 3 | US-28, US-29 |
| 8 | US-31 | US-31 In-app CVE alerts (scheduled refresh job) | sol | Sprint 3 | US-24, US-29 |
| 8 | US-35 | US-35 View a useful dashboard | terra | Sprint 3 | US-27, US-31, US-34, US-10 |
| 8 | US-36 | US-36 Filter vulnerability findings | terra | Sprint 3 | US-25 |
| 9 | US-37 | US-37 Navigate without a mouse (keyboard audit) | luna | Sprint 4 | US-35 |
| 9 | US-38 | US-38 Use core tools on a phone (375px audit) | terra | Sprint 4 | US-35 |
| 10 | INF-09 | Testing report and coverage gates (course Milestone 6) | luna | Sprint 4 | US-37, US-38 |
| 10 | INF-10 | Demo data, presentation script, and code-review packet | luna | Sprint 4 | US-35 |
| 11 | US-32 | US-32 Control email digests (stretch) | sol | Sprint 4 | US-31 |
| 11 | US-33 | US-33 Group related email alerts (stretch) | terra | Sprint 4 | US-32 |

## Epics

### EPIC-0 — Epic: Foundation and delivery pipeline

Milestone: Sprint 0: Foundation. Labels: `type:epic` `area:devops` `priority:baseline`.

- INF-01 Bootstrap GitHub repository, labels, milestones, templates (sol)
- INF-02 Monorepo scaffold: client, server, shared, lint, test, CI (sol)
- INF-03 Seeded design system: tokens, fonts, app shell, base components (terra)
- INF-04 Data model and migrations (Azure SQL via Knex + mssql) (sol)
- INF-05 Thin end-to-end Azure deployment (sol)
- INF-06 Architecture and component design docs (course Milestones 3 and 4) (luna)
- INF-07 Product catalog with CPE identifiers and version-lookup instructions (luna)
- INF-08 Shared conventions: error envelope, request validation, logging redaction, audit log (sol)

### EPIC-1 — Epic: Password checking and generation

Milestone: Sprint 1. Labels: `type:epic` `area:password-tools` `priority:baseline`.

- US-01 Private breach check (HIBP k-anonymity) (sol)
- US-02 Random password generator (browser-only) (terra)
- US-03 Passphrase generator (EFF wordlist) (terra)
- US-04 Explain password results (strength vs breach status) (terra)
- US-05 Explain password privacy (luna)
- US-15 Use password tools anonymously (terra)

### EPIC-4 — Epic: Accounts and saved posture

Milestone: Sprint 1. Labels: `type:epic` `area:auth` `area:questionnaire` `priority:baseline`.

- US-14 Sign in with Google (sol)
- US-20 Delete account and all saved data (terra)
- US-16 Complete a posture questionnaire (terra)
- US-17 Category scores (scoring engine) (sol)
- US-18 Understand score calculations (terra)
- US-19 Track posture over time (terra)

### EPIC-2 — Epic: Password manager coach

Milestone: Sprint 2. Labels: `type:epic` `area:coach` `priority:baseline`.

- US-06 Guided password-manager adoption (terra)
- US-07 Secure setup checklist (terra)
- US-08 Record adoption progress (terra)
- US-09 Compare important features (luna)
- US-10 Resume unfinished coach tasks (terra)

### EPIC-3 — Epic: Breach awareness

Milestone: Sprint 2. Labels: `type:epic` `area:coach` `priority:baseline`.

- US-11 Enroll in official HIBP breach notifications (luna)
- US-12 Record notification enrollment (terra)
- US-13 Respond to a compromised password (terra)

### EPIC-5 — Epic: Software profiles and CVE matching

Milestone: Sprint 2. Labels: `type:epic` `area:software-cve` `priority:baseline`.

- US-21 Build a software profile (terra)
- US-22 Find installed versions (luna)
- US-23 Handle an unknown version (terra)
- US-24 Match relevant CVEs (NVD client, cache, matcher) (sol)
- US-25 Understand a matched CVE (terra)
- US-26 Verify vulnerability guidance (official links) (luna)
- US-34 See CVE data freshness (terra)

### EPIC-6 — Epic: Recommendations and resolution

Milestone: Sprint 3. Labels: `type:epic` `area:recommendations` `priority:baseline`.

- US-27 Prioritize security actions (recommendation engine) (sol)
- US-28 Reevaluate after an update (terra)
- US-29 Dismiss a finding with context (terra)
- US-30 Review completed actions (terra)

### EPIC-7 — Epic: Alerts and dashboard

Milestone: Sprint 3. Labels: `type:epic` `area:alerts` `area:dashboard` `priority:baseline`.

- US-31 In-app CVE alerts (scheduled refresh job) (sol)
- US-35 View a useful dashboard (terra)
- US-36 Filter vulnerability findings (terra)

### EPIC-8 — Epic: Accessibility, mobile, and testing report

Milestone: Sprint 4. Labels: `type:epic` `area:a11y` `priority:baseline`.

- US-37 Navigate without a mouse (keyboard audit) (luna)
- US-38 Use core tools on a phone (375px audit) (terra)
- INF-09 Testing report and coverage gates (course Milestone 6) (luna)
- INF-10 Demo data, presentation script, and code-review packet (luna)

### EPIC-9 — Epic: Email digests (stretch)

Milestone: Sprint 4. Labels: `type:epic` `area:alerts` `priority:stretch`.

- US-32 Control email digests (stretch) (sol)
- US-33 Group related email alerts (stretch) (terra)

## Issues

### INF-01 — Bootstrap GitHub repository, labels, milestones, templates

**Labels:** `type:infra` `area:devops` `priority:baseline` `agent:sol`  
**Milestone:** Sprint 0: Foundation · **Phase:** 0 · **Depends on:** none

Create the `soteria` repository through the GitHub MCP (fallback: `gh repo create`). Initialize git in `/home/connor/Work/CS330/soteria`, commit the plan docs, push `main`.

**Acceptance**
- [ ] Repo exists, private, `main` protected: require PR, 1 approving review, status checks, no force push.
- [ ] All labels and milestones from `docs/plan/issues.json` created.
- [ ] `.github/ISSUE_TEMPLATE/story.yml`, `bug.yml`; `.github/pull_request_template.md` with an **AI assistance** section (tool, what it influenced, verification performed) per charter section 6.
- [ ] `CODEOWNERS` naming the human team; `CONTRIBUTING.md` describing branch-per-issue (`feat/US-01-breach-check`), commit trailer `AI-Assisted: Codex|Claude`, squash merge.
- [ ] Every epic and story in `issues.json` created as an issue, epics link children, stories link `Part of #<epic>`.
- [ ] GitHub Project (board) with columns Backlog / Ready / In progress / In review / Done, auto-add on issue open.

---

### INF-02 — Monorepo scaffold: client, server, shared, lint, test, CI

**Labels:** `type:infra` `area:devops` `priority:baseline` `agent:sol`  
**Milestone:** Sprint 0: Foundation · **Phase:** 1 · **Depends on:** INF-01

npm workspaces: `client/` (React 18, Vite, TypeScript strict, React Router, TanStack Query), `server/` (Node 22 LTS, Express 5, TypeScript, zod, pino), `shared/` (types and pure rule modules used by both).

**Acceptance**
- [ ] `npm run lint`, `npm run typecheck`, `npm test` pass at root; ESLint + Prettier configured; `engines.node >= 22`.
- [ ] Vitest for unit tests in all three packages; Supertest wired in server; Playwright installed in client (no tests yet).
- [ ] `.github/workflows/ci.yml` runs lint, typecheck, unit tests on every PR; required status check on `main`.
- [ ] `GET /api/health` returns `{ status, version, dbConnected }`.
- [ ] `README.md` with local setup (`.env.example` documented, `npm run dev` starts both).

---

### INF-03 — Seeded design system: tokens, fonts, app shell, base components

**Labels:** `type:infra` `area:design-system` `priority:baseline` `agent:terra`  
**Milestone:** Sprint 0: Foundation · **Phase:** 1 · **Depends on:** INF-02

Implement `docs/design/DESIGN_SEED.md` exactly. Seed 3080478562.

**Acceptance**
- [ ] `client/src/styles/tokens.css` generated from `docs/design/derive-seed.mjs`; light and dark values.
- [ ] Google Fonts Sora / Nunito Sans / Red Hat Mono loaded with fallbacks.
- [ ] Split-header shell: band 1 (wordmark, bell, theme toggle, sign-in), band 2 (underlined nav tabs); bottom tab bar below 768px.
- [ ] Base components: Button, Input, Select, Checkbox, Card (flat-bordered), Badge, SeverityBadge (label + color), Tabs, Dialog, Toast, EmptyState (geometric SVG), SparklineCard, SkipLink.
- [ ] Storybook-free demo route `/dev/kit` (dev only) showing every component; footer shows `design seed 3080478562`.
- [ ] Stylelint or ESLint rule fails CI on literal hex/rgb/oklch colors outside `tokens.css`.
- [ ] axe (`@axe-core/playwright`) smoke test on `/dev/kit` passes with zero violations.

---

### INF-04 — Data model and migrations (Azure SQL via Knex + mssql)

**Labels:** `type:infra` `area:devops` `priority:baseline` `agent:sol`  
**Milestone:** Sprint 0: Foundation · **Phase:** 1 · **Depends on:** INF-02

Knex migrations in `server/src/db/migrations`. Local dev uses SQL Server in Docker (`mcr.microsoft.com/mssql/server:2022-latest`) via `docker-compose.yml`; production uses Azure SQL.

**Tables (initial)**: `users`, `questionnaire_responses`, `score_snapshots`, `coach_progress`, `products` (catalog), `user_software`, `cve_cache`, `cve_matches`, `recommendations`, `alerts`, `notification_settings`, `audit_log`.

**Acceptance**
- [ ] `npm run db:migrate` / `db:rollback` / `db:seed` work locally and against Azure SQL via `DATABASE_URL`.
- [ ] Seed loads `shared/catalog/products.json` into `products`.
- [ ] `docs/architecture/data-model.md` with an ERD (Mermaid) and column-level notes; **no column ever stores a password, hash, or generated credential** (documented and enforced by review checklist).
- [ ] Integration test spins up the Docker DB in CI (service container) and runs migrations.

---

### INF-05 — Thin end-to-end Azure deployment

**Labels:** `type:infra` `area:devops` `priority:baseline` `agent:sol`  
**Milestone:** Sprint 0: Foundation · **Phase:** 1 · **Depends on:** INF-02, INF-04

Deploy the health endpoint and empty shell before any feature work (charter risk: Azure learning curve).

**Targets**: Azure Static Web Apps (Free) for `client/`; Azure App Service (Linux, Node 22, F1 or B1) for `server/`; Azure SQL Database free offer.

**Acceptance**
- [ ] `infra/` contains Bicep (or `az` CLI script) that provisions all three plus App Service settings; `docs/deploy.md` walks a teammate through it with the student subscription.
- [ ] `.github/workflows/deploy.yml` deploys client and server on push to `main` after CI passes; secrets documented (never committed).
- [ ] Production URL serves the shell; `/api/health` reports `dbConnected: true`.
- [ ] CORS locked to the SWA origin; HSTS on; `helmet` defaults on.

---

### INF-06 — Architecture and component design docs (course Milestones 3 and 4)

**Labels:** `type:chore` `area:devops` `priority:baseline` `agent:luna`  
**Milestone:** Sprint 0: Foundation · **Phase:** 1 · **Depends on:** INF-04

Turn the plan into the course artifacts.

**Acceptance**
- [ ] `docs/architecture/overview.md`: context diagram, container diagram (React SPA, Node API, Azure SQL, HIBP, NVD, Google Identity), deployment diagram, key decisions as ADRs (`docs/architecture/adr/`).
- [ ] `docs/architecture/components.md`: component-level design of scoring engine, CVE matcher, recommendation engine, alert generator, with interfaces and sequence diagrams (Mermaid).
- [ ] Class list extracted from the user stories (nouns) mapped to tables/modules, suitable for CRC cards.

---

### INF-07 — Product catalog with CPE identifiers and version-lookup instructions

**Labels:** `type:chore` `area:software-cve` `priority:baseline` `agent:luna`  
**Milestone:** Sprint 0: Foundation · **Phase:** 1 · **Depends on:** INF-02

Curate `shared/catalog/products.json`: 18 to 24 products across OS, browser, desktop app. Each entry: `id`, `name`, `vendor`, `category`, `cpeVendor`, `cpeProduct`, `versionScheme` (semver | build | marketing), `versionHelp` (step-by-step text and platform), `vendorAdvisoryUrl`.

**Suggested set**: Windows 10, Windows 11, macOS, Ubuntu; Chrome, Firefox, Edge, Safari; Zoom, Slack, Discord, VLC, 7-Zip, Adobe Acrobat Reader, Notepad++, Spotify, Steam, Microsoft Office, iTunes, WinRAR, OBS Studio, Java (JRE).

**Acceptance**
- [ ] Every CPE string verified against the NVD CPE dictionary search (record the query used in the PR).
- [ ] Version help written for nontechnical users, one product per test snapshot.
- [ ] JSON schema in `shared/catalog/products.schema.json`; test validates the file.

---

### INF-08 — Shared conventions: error envelope, request validation, logging redaction, audit log

**Labels:** `type:infra` `area:devops` `priority:baseline` `review:security` `agent:sol`  
**Milestone:** Sprint 0: Foundation · **Phase:** 1 · **Depends on:** INF-02, INF-04

**Acceptance**
- [ ] All API errors use `{ error: { code, message, details? } }`; zod validates every request body/query; 404/400/401/403/500 handled centrally.
- [ ] pino logger with a redaction list that drops any field named like `password|passphrase|secret|token|authorization|hash`; a unit test proves a request body containing `password` never appears in logs.
- [ ] `audit_log` records auth events, deletions, dismissals, and refresh jobs (user id, action, timestamp; no payloads).
- [ ] Rate limiting (`express-rate-limit`) on public endpoints.

---

### US-01 — US-01 Private breach check (HIBP k-anonymity)

**Labels:** `type:story` `area:password-tools` `priority:baseline` `review:security` `agent:sol`  
**Milestone:** Sprint 1 · **Phase:** 2 · **Depends on:** INF-03

As a user concerned about password security, I want to check whether a password has appeared in known breach data without the application storing or receiving it, so that I can replace compromised credentials without exposing them further.

**Design**: entirely client-side. SHA-1 via Web Crypto, send first 5 hex chars to `https://api.pwnedpasswords.com/range/{prefix}` with `Add-Padding: true`, compare suffixes locally. The Soteria server is never involved.

**Acceptance**
- [ ] Password input never leaves the browser: a Playwright test intercepts all network requests during a check and asserts the only request is the range call and that no request body or URL contains the password or full hash.
- [ ] Result shows breach count or "not found"; handles HIBP failure with a clear non-blocking error.
- [ ] Input is `type=password` with a show/hide toggle; no autocomplete; value cleared on navigation.
- [ ] Unit tests for prefix/suffix split and suffix matching, including padded lines (`:0`).

---

### US-02 — US-02 Random password generator (browser-only)

**Labels:** `type:story` `area:password-tools` `priority:baseline` `agent:terra`  
**Milestone:** Sprint 1 · **Phase:** 2 · **Depends on:** INF-03

As a user creating a new account, I want to generate a strong random password in my browser, so that I can protect the account without inventing a predictable password myself.

**Acceptance**
- [ ] Uses `crypto.getRandomValues` with rejection sampling (no modulo bias); length 8–64, toggles for upper/lower/digits/symbols, "avoid ambiguous characters".
- [ ] Copy button with confirmation toast; generated value is never sent anywhere and never persisted (no localStorage).
- [ ] Generator lives in `shared/password/generate.ts` with unit tests for character-class guarantees and distribution sanity.

---

### US-03 — US-03 Passphrase generator (EFF wordlist)

**Labels:** `type:story` `area:password-tools` `priority:baseline` `agent:terra`  
**Milestone:** Sprint 1 · **Phase:** 2 · **Depends on:** US-02

As a user who needs to memorize a password, I want to generate a long multi-word passphrase, so that I can use a credential that is both memorable and difficult to guess.

**Acceptance**
- [ ] EFF large wordlist (7,776 words) bundled in `shared/password/eff-large.json` with its license note; 3–8 words; separator choice; optional capitalization and digit.
- [ ] Entropy shown in bits (log2(7776) per word) with a one-sentence explanation.
- [ ] Same privacy guarantees as US-02.

---

### US-04 — US-04 Explain password results (strength vs breach status)

**Labels:** `type:story` `area:password-tools` `priority:baseline` `agent:terra`  
**Milestone:** Sprint 1 · **Phase:** 2 · **Depends on:** US-01

As a user evaluating a password, I want to see separate explanations of its estimated strength and known-breach status, so that I understand why a password may need to be changed.

**Acceptance**
- [ ] Strength via `@zxcvbn-ts/core` running locally; show score 0–4, crack-time estimate, and the library's warning/suggestions in plain language.
- [ ] Two visually separate result cards: "Strength (estimated locally)" and "Breach status (from Have I Been Pwned)"; a strong but breached password is clearly flagged as unsafe.
- [ ] Copy text reviewed for a nontechnical reader; no jargon without a tooltip.

---

### US-05 — US-05 Explain password privacy

**Labels:** `type:story` `area:password-tools` `priority:baseline` `agent:luna`  
**Milestone:** Sprint 1 · **Phase:** 2 · **Depends on:** US-01

As a privacy-conscious user, I want a clear explanation of how password checks are performed locally and what data is sent to the breach service, so that I can decide whether I trust the tool before entering a password.

**Acceptance**
- [ ] `/learn/password-privacy` page and an inline "How this works" disclosure above the checker: describes SHA-1, the 5-character prefix, padding, and what HIBP can and cannot learn; links HIBP's API docs.
- [ ] States explicitly that Soteria's server never receives the password and that nothing is stored.
- [ ] Reading level checked (aim for grade 8–10).

---

### US-15 — US-15 Use password tools anonymously

**Labels:** `type:story` `area:password-tools` `priority:baseline` `agent:terra`  
**Milestone:** Sprint 1 · **Phase:** 2 · **Depends on:** US-01, US-02, US-03

As a first-time visitor, I want to use the password checker and generator without creating an account, so that I can evaluate the tools before sharing my identity.

**Acceptance**
- [ ] `/tools` routes render without a session; no auth prompt, no cookies set, no analytics.
- [ ] Signed-out nav hides account-only tabs but keeps Password Tools and Learn.
- [ ] Playwright test: fresh context, run checker and both generators, assert zero `Set-Cookie` headers and no `/api/` calls.

---

### US-14 — US-14 Sign in with Google

**Labels:** `type:story` `area:auth` `priority:baseline` `review:security` `agent:sol`  
**Milestone:** Sprint 1 · **Phase:** 3 · **Depends on:** INF-04, INF-08, INF-05

As a returning user, I want to sign in with my Google account, so that I can access my saved cybersecurity profile without creating another password.

**Design**: Google Identity Services button → ID token → `POST /api/auth/google` verifies with `google-auth-library` (audience = client id) → upsert `users` (google_sub, email, display name) → session JWT in `httpOnly; Secure; SameSite=Lax` cookie, 7-day expiry, `token_version` claim for revocation. `GET /api/me`, `POST /api/auth/logout`.

**Acceptance**
- [ ] Sign-in works locally and in production; band-1 shows avatar and menu when signed in.
- [ ] Supertest: invalid/expired token rejected 401; forged audience rejected; cookie flags asserted.
- [ ] Route guard: account-only pages redirect to `/signin?next=`.
- [ ] Opus security review on session handling before merge.

---

### US-20 — US-20 Delete account and all saved data

**Labels:** `type:story` `area:auth` `priority:baseline` `review:security` `agent:terra`  
**Milestone:** Sprint 1 · **Phase:** 3 · **Depends on:** US-14

As a privacy-conscious user, I want to delete my account and its saved profile, goals, score history, and notification settings, so that I retain control over my personal data.

**Acceptance**
- [ ] `DELETE /api/me` with typed confirmation (`DELETE`) in a dialog; cascades every user-owned row (FKs `ON DELETE CASCADE` plus an integration test that counts zero rows afterward across all user tables).
- [ ] Session revoked (cookie cleared, `token_version` bumped before delete); audit_log keeps only `user_deleted` with a hashed user id.
- [ ] Settings page explains exactly what is deleted and that HIBP enrollment must be cancelled with HIBP directly.

---

### US-16 — US-16 Complete a posture questionnaire

**Labels:** `type:story` `area:questionnaire` `priority:baseline` `agent:terra`  
**Milestone:** Sprint 1 · **Phase:** 4 · **Depends on:** US-14, INF-04

As a signed-in user, I want to complete a cybersecurity-habits questionnaire, so that the application can create a personalized and explainable posture score.

**Design**: questions defined in `shared/scoring/questions.ts` (id, category, prompt, options with weights, help text). 12–18 questions across the five categories. Answers saved per user with a version stamp.

**Acceptance**
- [ ] Multi-step form, one category per step, progress indicator, save-and-resume, keyboard operable.
- [ ] `PUT /api/questionnaire` validates against the question set; `GET` returns current answers.
- [ ] Submitting triggers scoring (US-17) and a `score_snapshots` row (US-19).

---

### US-17 — US-17 Category scores (scoring engine)

**Labels:** `type:story` `area:questionnaire` `priority:baseline` `agent:sol`  
**Milestone:** Sprint 1 · **Phase:** 4 · **Depends on:** US-16

As a signed-in user, I want to see separate scores for password hygiene, breach preparedness, multifactor authentication, software exposure, and update habits, so that I can identify the area that needs the most attention.

**Design**: pure function `computeScores(answers, softwareFindings, coachProgress) -> { categories: { key, score, contributions[] }, overall }` in `shared/scoring/engine.ts`. Software exposure derives from active CVE matches (until US-24 exists it uses a neutral value and says so). Each contribution records `{ sourceId, label, delta, reason }` for US-18.

**Acceptance**
- [ ] Deterministic, table-driven unit tests with golden fixtures for each category, including boundary cases (no answers, all best, all worst).
- [ ] `GET /api/scores` returns categories and overall; UI shows five sparkline cards per the design seed.
- [ ] Rules documented in `docs/architecture/scoring.md` in plain language.

---

### US-18 — US-18 Understand score calculations

**Labels:** `type:story` `area:questionnaire` `priority:baseline` `agent:terra`  
**Milestone:** Sprint 1 · **Phase:** 4 · **Depends on:** US-17

As a signed-in user, I want to see how each questionnaire answer or software finding affects my score, so that I understand how the score was calculated and how to improve it.

**Acceptance**
- [ ] Each category card expands to a contribution list: answer or finding, points gained/lost, one-sentence reason, and a "how to improve" hint linking to the relevant tool or recommendation.
- [ ] Uses `contributions[]` from the engine only; no scoring logic in the client.
- [ ] Screen-reader friendly disclosure pattern (button + `aria-expanded`).

---

### US-19 — US-19 Track posture over time

**Labels:** `type:story` `area:questionnaire` `priority:baseline` `agent:terra`  
**Milestone:** Sprint 1 · **Phase:** 4 · **Depends on:** US-17

As a returning user, I want to view changes in my posture score over time, so that I can see whether completing recommended actions has improved my security habits.

**Acceptance**
- [ ] `score_snapshots` row on every scoring event (questionnaire save, software change, recommendation completion, CVE refresh that changes matches); at most one snapshot per user per hour (coalesce).
- [ ] `GET /api/scores/history?days=90` powers the sparklines and a `/progress` page with a per-category line chart and a change log ("Oct 3: enabled MFA on email, +12 MFA").
- [ ] Charts have text alternatives (table toggle).

---

### US-06 — US-06 Guided password-manager adoption

**Labels:** `type:story` `area:coach` `priority:baseline` `agent:terra`  
**Milestone:** Sprint 2 · **Phase:** 5 · **Depends on:** INF-03

As a user who is new to password managers, I want guided help choosing and setting up a password manager, so that I can begin using unique passwords without giving this application access to my vault.

**Design**: content-driven coach in `shared/coach/content.ts`: a 3-question chooser (devices, budget, sync needs) that yields a neutral shortlist, then hands off to the checklist (US-07).

**Acceptance**
- [ ] `/coach` flow works signed-out (no persistence) and signed-in (progress saved).
- [ ] Never asks for or accepts vault data; copy says so.
- [ ] Content reviewed for neutrality: Bitwarden featured as the open-source example, at least two others listed.

---

### US-07 — US-07 Secure setup checklist

**Labels:** `type:story` `area:coach` `priority:baseline` `agent:terra`  
**Milestone:** Sprint 2 · **Phase:** 5 · **Depends on:** US-06

As a user adopting a password manager, I want a checklist for installing the manager, creating a strong master passphrase, and enabling multifactor authentication, so that I can configure it safely.

**Acceptance**
- [ ] Checklist steps: install, create master passphrase (links to US-03 generator, never stores it), enable MFA, save recovery code offline, import/replace weak passwords, install browser extension, enable device unlock.
- [ ] Each step has why/how text and vendor doc links; steps are keyboard-checkable.
- [ ] Signed-in completion writes `coach_progress` and feeds the password-hygiene and MFA categories (US-17 contributions).

---

### US-08 — US-08 Record adoption progress

**Labels:** `type:story` `area:coach` `priority:baseline` `agent:terra`  
**Milestone:** Sprint 2 · **Phase:** 5 · **Depends on:** US-07, US-14

As a user who already has a password manager, I want to record which manager I use and mark recommended setup steps complete, so that my posture plan reflects the protections I have already adopted.

**Acceptance**
- [ ] `PUT /api/coach/progress` stores manager name (from list or "other") and completed step ids; no credentials or vault details.
- [ ] Changing progress re-scores and snapshots (US-19).

---

### US-09 — US-09 Compare important features

**Labels:** `type:story` `area:coach` `priority:baseline` `agent:luna`  
**Milestone:** Sprint 2 · **Phase:** 5 · **Depends on:** INF-03

As a user comparing password managers, I want to review the security features I should look for and see Bitwarden as an open-source example, so that I can make an informed choice without being forced to use one product.

**Acceptance**
- [ ] `/learn/password-managers` page: feature glossary (zero-knowledge, open source, audits, MFA support, breach monitoring, sharing, emergency access) with Bitwarden as the worked example; a neutral comparison table of 4–5 managers with source links and a last-reviewed date.
- [ ] Table is responsive (stacks at 375px) and has a caption.

---

### US-10 — US-10 Resume unfinished coach tasks

**Labels:** `type:story` `area:coach` `priority:baseline` `agent:terra`  
**Milestone:** Sprint 2 · **Phase:** 5 · **Depends on:** US-08

As a returning user, I want to view unfinished password-manager setup tasks, so that I know which security improvements to complete next.

**Acceptance**
- [ ] Dashboard card and `/coach` header list remaining steps ordered by security value; empty state when done.
- [ ] Remaining steps also surface as recommendations (US-27) once that engine exists.

---

### US-11 — US-11 Enroll in official HIBP breach notifications

**Labels:** `type:story` `area:coach` `priority:baseline` `agent:luna`  
**Milestone:** Sprint 2 · **Phase:** 5 · **Depends on:** INF-03

As a user who wants future breach warnings, I want to open Have I Been Pwned's official free notification-enrollment page from the application, so that I can register directly with the service that provides the notifications.

**Acceptance**
- [ ] `/breach-awareness` page explains what HIBP notifications are and opens `https://haveibeenpwned.com/NotifyMe` in a new tab with `rel="noopener noreferrer"`.
- [ ] Soteria never collects the email for this purpose; copy says so.

---

### US-12 — US-12 Record notification enrollment

**Labels:** `type:story` `area:coach` `priority:baseline` `agent:terra`  
**Milestone:** Sprint 2 · **Phase:** 5 · **Depends on:** US-11, US-08

As a user who enrolled in external breach notifications, I want to mark that security action complete in my posture profile, so that my breach-preparedness score reflects the step I took.

**Acceptance**
- [ ] Signed-in "I enrolled" toggle stored in `coach_progress` (step `hibp_notify`); contributes to breach preparedness (US-17) and snapshots (US-19).

---

### US-13 — US-13 Respond to a compromised password

**Labels:** `type:story` `area:coach` `priority:baseline` `agent:terra`  
**Milestone:** Sprint 2 · **Phase:** 5 · **Depends on:** US-01, US-04

As a user responding to a compromised-password result, I want a prioritized list of next steps, so that I know to change the password, avoid reusing it, and enable multifactor authentication where available.

**Acceptance**
- [ ] When US-01 returns a breach, show an ordered response panel: change it now (link to generator), change it everywhere it was reused, enable MFA, watch for phishing, consider a password manager (link to coach).
- [ ] Works anonymously; if signed in, offers to add "rotate reused passwords" as a recommendation (US-27).

---

### US-21 — US-21 Build a software profile

**Labels:** `type:story` `area:software-cve` `priority:baseline` `agent:terra`  
**Milestone:** Sprint 2 · **Phase:** 6 · **Depends on:** INF-07, US-14

As a user concerned about vulnerable software, I want to add supported operating systems, browsers, and desktop applications to my profile, so that I can receive vulnerability information relevant to products I use.

**Acceptance**
- [ ] `/software` page: searchable picker from `products` catalog grouped by category; add with version (validated by product `versionScheme`) or "unknown"; edit and remove.
- [ ] `GET/POST/PUT/DELETE /api/software` scoped to the user; max 30 entries.
- [ ] Adding or changing software triggers matching (US-24) and a snapshot (US-19).

---

### US-22 — US-22 Find installed versions

**Labels:** `type:story` `area:software-cve` `priority:baseline` `agent:luna`  
**Milestone:** Sprint 2 · **Phase:** 6 · **Depends on:** US-21

As a nontechnical user, I want product-specific instructions for finding an installed software version, so that I can enter accurate information without already knowing where the version is displayed.

**Acceptance**
- [ ] Version field shows a "Where do I find this?" disclosure rendering `versionHelp` from the catalog, with platform tabs where relevant.
- [ ] An example of the expected format (`e.g. 128.0.6613.84`) drawn from `versionScheme`.

---

### US-23 — US-23 Handle an unknown version

**Labels:** `type:story` `area:software-cve` `priority:baseline` `agent:terra`  
**Milestone:** Sprint 2 · **Phase:** 6 · **Depends on:** US-21

As a user who cannot determine a software version, I want to mark the version as unknown and receive general update guidance, so that the application helps me without claiming that a specific vulnerability affects me.

**Acceptance**
- [ ] Unknown-version entries show "update guidance" (how to enable auto-update, vendor download link) and are excluded from exact CVE matching; matcher reports them as `unknown` confidence, never `exact`.
- [ ] Software-exposure score treats unknown as a mild penalty with a contribution explaining why (US-18).

---

### US-24 — US-24 Match relevant CVEs (NVD client, cache, matcher)

**Labels:** `type:story` `area:software-cve` `priority:baseline` `review:security` `agent:sol`  
**Milestone:** Sprint 2 · **Phase:** 6 · **Depends on:** INF-07, INF-04, US-21

As a user with a saved software profile, I want to see CVEs that match my products and versions, so that I can focus on vulnerabilities that may affect my own devices.

**Design**: server module `server/src/cve/`: `nvdClient` (CVE API 2.0, `virtualMatchString=cpe:2.3:a:vendor:product`, `pubStartDate` windowing, optional `NVD_API_KEY`, respects 5 req/30 s unkeyed with a token bucket, exponential backoff); `cveCache` table keyed by CVE id storing raw configurations, CVSS v3.1 base score/severity, published/modified, description; `matcher` evaluates `cpeMatch` ranges (`versionStartIncluding/Excluding`, `versionEndIncluding/Excluding`, exact version) against the user version using a per-`versionScheme` comparator and classifies `exact | possible | unknown`. Results persisted in `cve_matches` (user_software_id, cve_id, confidence, status).

**Acceptance**
- [ ] Recorded NVD fixtures under `server/test/fixtures/nvd/` (at least 3 products, including a range with `versionEndExcluding`); matcher unit tests cover inclusive/exclusive boundaries, pre-release strings, and marketing versions.
- [ ] `POST /api/software/refresh` (per user, rate-limited) and `GET /api/findings` return matches with product, version, confidence.
- [ ] Only products in the catalog are ever queried; the last 2 years of CVEs are fetched initially, then incremental by `lastModStartDate`.
- [ ] Opus review of matcher correctness and of the false-positive/false-negative policy documented in `docs/architecture/cve-matching.md`.

---

### US-25 — US-25 Understand a matched CVE

**Labels:** `type:story` `area:software-cve` `priority:baseline` `agent:terra`  
**Milestone:** Sprint 2 · **Phase:** 6 · **Depends on:** US-24

As a user reviewing a matched CVE, I want to see its severity, affected product, publication date, and a plain-language explanation, so that I can understand the risk without reading raw security data.

**Acceptance**
- [ ] Finding card and `/findings/:cveId` detail: SeverityBadge (label + color), CVSS score, product and your version, published date, match confidence with a plain explanation of what `possible` means, NVD description, and a templated plain-language summary ("An attacker who gets you to open a crafted file could run code on your computer") generated from CWE/CVSS vector fields with a lookup table in `shared/cve/plain-language.ts`.
- [ ] Unit tests for the plain-language table across all CVSS AV/PR/UI combinations.

---

### US-26 — US-26 Verify vulnerability guidance (official links)

**Labels:** `type:story` `area:software-cve` `priority:baseline` `agent:luna`  
**Milestone:** Sprint 2 · **Phase:** 6 · **Depends on:** US-25

As a user reviewing a software vulnerability, I want links to the official NVD record and relevant vendor guidance, so that I can verify the information before taking action.

**Acceptance**
- [ ] Each finding links `https://nvd.nist.gov/vuln/detail/<id>` plus NVD references tagged `Vendor Advisory` or `Patch`, plus the catalog `vendorAdvisoryUrl`.
- [ ] External links open in a new tab with `noopener noreferrer` and an external-link icon with `aria-label`.

---

### US-34 — US-34 See CVE data freshness

**Labels:** `type:story` `area:alerts` `priority:baseline` `agent:terra`  
**Milestone:** Sprint 2 · **Phase:** 6 · **Depends on:** US-24

As a user viewing vulnerability information, I want to see when the CVE data was last updated and whether cached data is stale, so that I can judge how current the findings are when the external service is unavailable.

**Acceptance**
- [ ] `GET /api/cve/status` returns last successful refresh time, last attempt, last error (sanitized), and `stale: boolean` (older than 24 h).
- [ ] Freshness chip on `/software`, `/findings`, and the dashboard: "Updated 3 h ago" or "Stale: last updated 2 days ago (NVD unavailable)"; not color-only.
- [ ] Refresh button disabled while a refresh runs; shows an accessible progress state.

---

### US-27 — US-27 Prioritize security actions (recommendation engine)

**Labels:** `type:story` `area:recommendations` `priority:baseline` `agent:sol`  
**Milestone:** Sprint 3 · **Phase:** 7 · **Depends on:** US-17, US-24, US-08

As a user with several security findings, I want recommendations ordered by urgency and expected benefit, so that I know which improvement to make first.

**Design**: `shared/recommendations/engine.ts`: `generateRecommendations({ scores, findings, coachProgress, answers })` yields records `{ key, category, title, why, how, urgency 1–5, benefit 1–5, effort 1–3, source: cve | questionnaire | coach }`; priority = urgency*2 + benefit - effort, ties broken by category gap. Server upserts into `recommendations` keeping status for existing keys.

**Acceptance**
- [ ] Golden-fixture tests: a critical CVE outranks any questionnaire item; MFA-on-email outranks MFA-on-forum; completed coach steps do not regenerate.
- [ ] `GET /api/recommendations?status=active` sorted by priority; `/recommendations` page lists cards with the why/how and a primary action link.
- [ ] Rules documented in `docs/architecture/recommendations.md`.

---

### US-28 — US-28 Reevaluate after an update

**Labels:** `type:story` `area:recommendations` `priority:baseline` `agent:terra`  
**Milestone:** Sprint 3 · **Phase:** 7 · **Depends on:** US-27

As a user who updated vulnerable software, I want to record the new version and have the application reevaluate the matching CVEs, so that resolved findings no longer appear as active risks.

**Acceptance**
- [ ] "I updated this" action on a finding or software row opens a version input; saving re-runs the matcher for that product only (no NVD call if cache is fresh).
- [ ] Matches no longer applicable move to `resolved` with `resolved_version` and timestamp; the recommendation derived from them moves to `resolved`; snapshot recorded.
- [ ] Integration test: version bump past `versionEndExcluding` resolves the finding.

---

### US-29 — US-29 Dismiss a finding with context

**Labels:** `type:story` `area:recommendations` `priority:baseline` `agent:terra`  
**Milestone:** Sprint 3 · **Phase:** 7 · **Depends on:** US-27

As a user who believes a CVE does not apply, I want to dismiss it with a reason while keeping the decision in my history, so that I can manage false matches without silently erasing the finding.

**Acceptance**
- [ ] Dismiss dialog with reason select (not installed, different edition, already mitigated, other + text ≤ 280 chars); writes `dismissed`, `dismiss_reason`, timestamp; audit_log entry.
- [ ] Dismissed findings are excluded from scores and active recommendations but appear in history (US-30) and can be un-dismissed.
- [ ] A later refresh never resurrects a dismissed CVE for the same product/version.

---

### US-30 — US-30 Review completed actions

**Labels:** `type:story` `area:recommendations` `priority:baseline` `agent:terra`  
**Milestone:** Sprint 3 · **Phase:** 7 · **Depends on:** US-28, US-29

As a returning user, I want to view completed, resolved, and dismissed recommendations separately from active recommendations, so that I can review my progress without cluttering my current task list.

**Acceptance**
- [ ] `/recommendations` has tabs Active / Completed / Resolved / Dismissed with counts; each item shows when and why its status changed.
- [ ] "Mark complete" on active items (for non-CVE items) with an optional note; re-scores and snapshots.
- [ ] Tabs are keyboard operable (`role=tablist`, arrow keys).

---

### US-31 — US-31 In-app CVE alerts (scheduled refresh job)

**Labels:** `type:story` `area:alerts` `priority:baseline` `agent:sol`  
**Milestone:** Sprint 3 · **Phase:** 8 · **Depends on:** US-24, US-29

As a user with saved software, I want an in-application alert when newly retrieved CVE data matches my profile, so that I can respond without manually searching for vulnerabilities.

**Design**: `POST /api/internal/refresh` protected by `INTERNAL_JOB_SECRET`, invoked every 6 hours by `.github/workflows/cve-refresh.yml` (cron) so it works on App Service tiers without Always On. The job refreshes `cve_cache` for all catalog products in use, re-matches every user, and inserts `alerts` rows for new `exact|possible` matches. Alerts: `{ user_id, type, title, body, cve_id?, read_at }`.

**Acceptance**
- [ ] Bell in band 1 shows unread count; `/alerts` list with mark-read and mark-all-read; `GET/PATCH /api/alerts`.
- [ ] Integration test: a fixture CVE added between two refreshes produces exactly one alert per affected user and none for dismissed matches.
- [ ] Job is idempotent and logs to `audit_log`; failures set the freshness error (US-34).

---

### US-35 — US-35 View a useful dashboard

**Labels:** `type:story` `area:dashboard` `priority:baseline` `agent:terra`  
**Milestone:** Sprint 3 · **Phase:** 8 · **Depends on:** US-27, US-31, US-34, US-10

As a signed-in user, I want a dashboard that combines category scores with a prioritized action list, so that I can understand my posture and immediately see what to do next.

**Acceptance**
- [ ] `/` when signed in: overall score sentence, five sparkline cards (US-17/19), top 5 recommendations (US-27), unread alerts (US-31), freshness chip (US-34), coach remaining steps (US-10); empty states with geometric illustrations for each block when data is missing.
- [ ] Single `GET /api/dashboard` aggregate to avoid waterfall requests; skeleton loading states.
- [ ] Signed-out `/` is a landing page that leads to the password tools and sign-in.

---

### US-36 — US-36 Filter vulnerability findings

**Labels:** `type:story` `area:dashboard` `priority:baseline` `agent:terra`  
**Milestone:** Sprint 3 · **Phase:** 8 · **Depends on:** US-25

As a user with multiple saved products, I want to filter findings by product and severity, so that I can focus on the vulnerabilities most relevant to the device I am updating.

**Acceptance**
- [ ] `/findings` filter bar: product multi-select, severity checkboxes, confidence, status; filters reflected in the URL query string; result count announced via `aria-live`.
- [ ] Server-side filtering on `GET /api/findings`; indexed columns.

---

### US-37 — US-37 Navigate without a mouse (keyboard audit)

**Labels:** `type:story` `area:a11y` `priority:baseline` `agent:luna`  
**Milestone:** Sprint 4 · **Phase:** 9 · **Depends on:** US-35

As a keyboard-only user, I want to operate the password tools, questionnaire, software profile, and dashboard without a mouse, so that I can use the core application independently.

**Acceptance**
- [ ] Playwright keyboard-only journeys (no mouse events) for: run breach check, generate password, complete questionnaire, add software with version, dismiss a finding, mark recommendation complete.
- [ ] Skip link, focus management on route change and dialog open/close, no focus traps, visible focus everywhere; axe passes on every route with zero serious/critical violations.
- [ ] Fixes filed as `type:bug` issues and linked here.

---

### US-38 — US-38 Use core tools on a phone (375px audit)

**Labels:** `type:story` `area:a11y` `priority:baseline` `agent:terra`  
**Milestone:** Sprint 4 · **Phase:** 9 · **Depends on:** US-35

As a user viewing the site on a phone, I want the password tools and prioritized recommendations to remain readable and usable on a small screen, so that I can improve my posture without needing a desktop computer.

**Acceptance**
- [ ] Playwright at 375x667: no horizontal scroll on any route; bottom tab bar works; tables stack or scroll within their container; 44px targets.
- [ ] Visual snapshots of tools and recommendations at 375px stored in the repo for the testing report.

---

### INF-09 — Testing report and coverage gates (course Milestone 6)

**Labels:** `type:chore` `area:devops` `priority:baseline` `agent:luna`  
**Milestone:** Sprint 4 · **Phase:** 10 · **Depends on:** US-37, US-38

**Acceptance**
- [ ] Coverage thresholds in CI: `shared` 90 %, `server` 80 %, `client` 70 % lines.
- [ ] `docs/testing/report.md`: test strategy (unit / API integration / e2e / accessibility / privacy), traceability matrix story → tests, defect log, known gaps.
- [ ] Privacy test suite enumerated: log redaction, no password in network, no credential columns, deletion cascade.

---

### INF-10 — Demo data, presentation script, and code-review packet

**Labels:** `type:chore` `area:devops` `priority:baseline` `agent:luna`  
**Milestone:** Sprint 4 · **Phase:** 10 · **Depends on:** US-35

**Acceptance**
- [ ] `npm run db:seed:demo` creates a demo user with answers, software, cached CVE fixtures, matches, and history so a sprint review needs no live NVD call.
- [ ] `docs/demo-script.md` per sprint review; `docs/code-review-packet.md` for course Milestone 5 (week 12) listing the PRs, reviewers, and AI-assistance disclosures.

---

### US-32 — US-32 Control email digests (stretch)

**Labels:** `type:story` `area:alerts` `priority:stretch` `review:security` `agent:sol`  
**Milestone:** Sprint 4 · **Phase:** 11 · **Depends on:** US-31

As a user who wants CVE email alerts, I want to explicitly opt into a daily digest and unsubscribe whenever I choose, so that I control whether the application contacts me.

**Charter note**: a full email-digest system is out of the semester baseline. Attempt only after every `priority:baseline` issue is closed. Provider: a free-tier transactional email API (Resend free tier or Azure Communication Services trial); provider behind `server/src/email/provider.ts`.

**Acceptance**
- [ ] Opt-in default off; `notification_settings` row; signed unsubscribe link works without login; every email has the link.
- [ ] Only the Google account email is used; no other addresses collected.

---

### US-33 — US-33 Group related email alerts (stretch)

**Labels:** `type:story` `area:alerts` `priority:stretch` `agent:terra`  
**Milestone:** Sprint 4 · **Phase:** 11 · **Depends on:** US-32

As a user receiving a CVE digest, I want related new findings grouped into one concise message, so that I can understand what changed without receiving an email for every individual record.

**Acceptance**
- [ ] Daily job (GitHub Actions cron → `/api/internal/digest`) groups unread alerts since last digest by product, highest severity first, max 10 lines, links to `/findings`; none sent when nothing changed.
- [ ] Snapshot test of the rendered text and HTML email.

---

