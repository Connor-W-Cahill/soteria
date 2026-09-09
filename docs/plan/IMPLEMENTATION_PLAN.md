# Soteria Implementation Plan

Planner: Claude (Fable 5.1), 2026-09-08. Status: **plan only, nothing implemented.**

Companion files:

- `docs/plan/ISSUE_BACKLOG.md` (rendered) and `docs/plan/issues.json` (canonical): every GitHub issue to create, with acceptance criteria, agent, milestone, dependencies.
- `docs/plan/AGENT_RUNBOOK.md`: the exact `ai-task` commands and prompts to run each phase.
- `docs/design/DESIGN_SEED.md` and `docs/design/derive-seed.mjs`: the seeded visual design.

## 1. Inputs and how they were read

| Input | Used for |
|---|---|
| `CybersecurityAppUserStories.md` | 38 stories (US-01..US-38) and the 12-story baseline shortlist. Every story becomes one GitHub issue. |
| `Group Project Charter.pdf` / `output/Soteria_Group_Project_Charter.docx` | Product name (Soteria), scope and out-of-scope, success indicators, and the AI collaboration policy that dictates the PR workflow. |
| `ProjectBrainstorming.txt` | Mandatory stack: React frontend, Node.js REST API, Azure-hosted SQL, Azure hosting, one live external API. |
| `syllabus_cs330_CURRENT.pdf` | Sprint calendar (Sprint 1 planning week 8, reviews weeks 9/11/13, Milestone 5 code review week 12, Milestone 6 testing report week 16). |
| Working agreement (`~/.claude/CLAUDE.md`, `~/.codex/AGENTS.md`) and `ai-task` | Agent topology: Codex 5.6 Sol lead, Terra/Luna workers, Claude Opus for review or hard work, one Herdr tab per outcome. This is what I understood "header setup" to mean. |

Assumptions made because the request was ambiguous:

1. **"Header setup" = the working agreement** (Sol/Terra/Luna/Opus roles, Herdr topology, `ai-task`). The plan is written to be executed by those agents, not by me.
2. **"Opus 4.5 or 4.6"**: `ai-task review` and `ai-task start --lead claude` pass `--model opus`, which resolves to whatever Opus your Claude Code has as its default. If you want a pinned version, add `--model <exact id>`; I have not guessed an id.
3. **GitHub MCP**: it is configured for Codex (`~/.codex/config.toml`, `mcp_servers.github`, token from `GITHUB_PERSONAL_ACCESS_TOKEN`) but not for Claude Code. So Sol does all GitHub creation. `gh` is authenticated as `Connor-W-Cahill` as a fallback.
4. **Repository location**: `/home/connor/Work/CS330/soteria` (this folder). The course files stay one level up and are not committed. If the instructor later requires a classroom org, transfer the repo; issues and history come with it.
5. **Email digests (US-32/33)** are stretch per the charter and are last.

## 2. Architecture decisions (fixed, so agents do not re-decide them)

| Decision | Choice | Why |
|---|---|---|
| Layout | npm-workspaces monorepo: `client/`, `server/`, `shared/` | Shared pure rule modules (scoring, recommendations, generators, plain-language CVE text) are tested once and used by both tiers. |
| Frontend | React 18 + Vite + TypeScript strict, React Router, TanStack Query, plain CSS with tokens | Course requires React; tokens make the seed enforceable. |
| Backend | Node 22 LTS, Express 5, TypeScript, zod, pino, helmet, express-rate-limit | Azure App Service supports Node 22; small and conventional. |
| Database | Azure SQL Database (free offer) via Knex + `mssql`; local dev via SQL Server 2022 in Docker | Course requires Azure SQL; Knex migrations are boring and reliable with mssql. |
| Hosting | Azure Static Web Apps (client), Azure App Service Linux (API), Azure SQL | All have free or student tiers; SWA/App Service split keeps the API a plain Node process. |
| Auth | Google Identity Services → server verifies ID token → httpOnly session JWT cookie | US-14; no passwords ever. |
| Breach check | HIBP Pwned Passwords range API called from the browser with `Add-Padding` | US-01/05: the server is never in the path. |
| Strength | `@zxcvbn-ts/core` in the browser | US-04; local only. |
| External live data | NVD CVE API 2.0 (the required external API), server-side, cached in SQL, token-bucket rate limited | US-24/34; HIBP is a second live API. |
| Scheduled work | GitHub Actions cron → secret-protected internal endpoints | Works on free App Service tiers without Always On. |
| Testing | Vitest, Supertest, Playwright, `@axe-core/playwright` | Coverage gates in INF-09. |
| Design | Seed 3080478562 → tokens (see DESIGN_SEED.md) | Look is derived from the seed, not from agent taste. |

Privacy invariants that every PR reviewer checks (from the charter):

- No table column, log line, network request to Soteria, or client storage ever holds a password, passphrase, generated credential, or full hash.
- The only third party that sees password-derived data is HIBP, and it sees only a 5-character SHA-1 prefix.
- Account deletion cascades everything user-owned.

## 3. Phases

Phases run in order. Each phase is one Herdr task tab led by Sol; workers are added per the runbook. A phase is done when its issues are closed by merged PRs, CI is green on `main`, and production is deployed.

| Phase | Outcome | Issues | Lead | Workers | Opus |
|---|---|---|---|---|---|
| 0 | GitHub repo, labels, milestones, templates, all issues, project board | INF-01 | Sol | none | no |
| 1 | Scaffold, seeded design system, data model, thin Azure deploy, docs, catalog, conventions | INF-02..INF-08 | Sol | Terra (INF-03), Luna (INF-06, INF-07) | review INF-08 |
| 2 | Anonymous password tools | US-01, 02, 03, 04, 05, 15 | Sol (US-01) | Terra (02, 03, 04, 15), Luna (05) | review US-01 |
| 3 | Google sign-in, account deletion | US-14, US-20 | Sol (US-14) | Terra (US-20) | review both |
| 4 | Questionnaire, scoring engine, explanations, history | US-16, 17, 18, 19 | Sol (US-17) | Terra (16, 18, 19) | no |
| 5 | Coach, breach awareness | US-06..US-13 | Sol integrates | Terra (06, 07, 08, 10, 12, 13), Luna (09, 11) | no |
| 6 | Software profile, NVD client, matcher, freshness | US-21..US-26, US-34 | Sol (US-24) | Terra (21, 23, 25, 34), Luna (22, 26) | review US-24 |
| 7 | Recommendation engine and lifecycle | US-27..US-30 | Sol (US-27) | Terra (28, 29, 30) | no |
| 8 | Alerts job, dashboard, filters | US-31, 35, 36 | Sol (US-31) | Terra (35, 36) | no |
| 9 | Keyboard and mobile audits | US-37, US-38 | Sol | Luna (37), Terra (38) | no |
| 10 | Testing report, demo data, review packet | INF-09, INF-10 | Sol | Luna | no |
| 11 | Stretch: email digests | US-32, US-33 | Sol or Opus | Terra | review US-32 |

Hard items where Sol should raise reasoning effort (`model_reasoning_effort = high`) or you may hand the lead to Opus (`ai-task start --lead claude`): INF-05 (Azure), US-14 (auth), US-17 (scoring engine), US-24 (CVE matcher), US-27 (recommendation engine), US-31 (refresh job). Everything else is routine Terra/Luna work.

## 4. Course calendar alignment

Agents will finish far ahead of the sprint calendar. That is fine: the GitHub milestones exist so demos and course deliverables line up with what was built.

| Course event | Week | Target date | Plan phase feeding it |
|---|---|---|---|
| Milestone 3 architectural design | 6 | Sep 28 – Oct 4 | Phase 1 (INF-06 overview, ADRs) |
| Milestone 4 component design | 7 | Oct 5 – 11 | Phase 1 (INF-06 components) |
| Sprint 1 planning | 8 | Oct 12 | Phases 2–4 as the Sprint 1 backlog |
| Presentation 1 | 9 | Oct 19 – 25 | Phases 2–4 demo |
| Presentation 2 | 11 | Nov 2 – 8 | Phases 5–6 demo |
| Milestone 5 code review | 12 | Nov 9 – 15 | INF-10 review packet |
| Presentation 3 | 13 | Nov 16 – 22 | Phases 7–8 demo |
| Milestone 6 testing report | 16 | Dec 7 – 13 | INF-09 |

## 5. Working rules for the agents

1. **One issue, one branch, one PR.** Branch `feat/US-01-breach-check` or `infra/INF-02-scaffold`. PR title starts with the key. PR body uses the template: summary, linked issue (`Closes #n`), acceptance checklist copied from the issue, **AI assistance** section (tool, what it influenced, verification performed), screenshots for UI.
2. **Commits** are small and end with `AI-Assisted: Codex` or `AI-Assisted: Claude`, per the charter's disclosure protocol.
3. **Agents never merge.** A human teammate reviews and merges (charter: second-person review of AI-assisted PRs). Agents may request review from Opus first when the issue carries `review:security`.
4. **Issues track every major change.** Anything not covered by an existing issue gets a new `type:chore` or `type:bug` issue before the work starts. Sol updates the issue with a short progress comment when a PR opens and when it merges.
5. **Verification before "done":** lint, typecheck, unit tests, relevant integration or Playwright test, and a final diff read. CI must be green.
6. **Design seed is law.** Any UI PR that introduces a literal color, radius, shadow, or font outside `tokens.css` fails review.
7. **Secrets** live in `.env` (git-ignored), GitHub Actions secrets, and App Service settings. `.env.example` documents names only.
8. **Handoffs**: when a phase spans sessions, Sol writes `HANDOFF.md` at repo root (working-agreement convention) before closing the tab.

## 6. Data model sketch (detail in INF-04)

`users(id, google_sub, email, display_name, token_version, created_at)` →
`questionnaire_responses(user_id, question_id, option_id, answered_at)`,
`score_snapshots(user_id, taken_at, overall, password_hygiene, breach_prep, mfa, software_exposure, update_habits, trigger)`,
`coach_progress(user_id, manager_name, step_id, completed_at)`,
`user_software(id, user_id, product_id, version, version_unknown, updated_at)`,
`cve_matches(id, user_software_id, cve_id, confidence, status, dismiss_reason, resolved_version, changed_at)`,
`recommendations(id, user_id, key, category, priority, status, note, changed_at)`,
`alerts(id, user_id, type, title, body, cve_id, created_at, read_at)`,
`notification_settings(user_id, digest_opt_in, unsubscribe_token)`.
Shared reference: `products(id, name, vendor, category, cpe_vendor, cpe_product, version_scheme, version_help, advisory_url)`, `cve_cache(cve_id, published, last_modified, cvss_score, cvss_severity, cvss_vector, description, configurations_json, fetched_at)`, `cve_refresh_runs(started_at, finished_at, ok, error)`. `audit_log(id, user_id_hash, action, at)`.

## 7. Risks the agents must respect

| Risk | Handling in the plan |
|---|---|
| NVD rate limits (5 req/30 s unkeyed) | Token bucket, per-product incremental fetch, cache, fixtures for demos; request a free NVD API key and store it as a secret. |
| Version matching false positives | Confidence levels `exact/possible/unknown`, dismiss-with-reason, links to official records, boundary tests. |
| Azure free-tier quirks (cold starts, no Always On) | GitHub Actions cron for jobs; thin deploy in Phase 1 to surface problems early. |
| Google OAuth consent screen setup | Documented in `docs/deploy.md`; test users added while the app is in "testing" status. |
| Agents drifting from the seed or the privacy invariants | Lint rule for colors; log-redaction and network-interception tests; review checklist in the PR template. |
| Course requires human-explainable code | Plain-language docs for scoring, matching, recommendations; ADRs; every PR has a summary a teammate can present. |

## 8. Claude's role during implementation (open question for Connor)

Per the working agreement, Claude is for fresh-context review, architecture criticism, and tutoring, not routine implementation. This plan assumes Claude Opus reviews the `review:security` issues (INF-08, US-01, US-14, US-20, US-24, US-32) via `ai-task review`, and is otherwise absent. Confirm or change this before Phase 0 starts.
