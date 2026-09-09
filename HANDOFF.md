# Soteria handoff

Last updated 2026-09-09 by the Claude Opus lead: Phase 2 closed, Phase 3 in flight. Written
for the next lead — read this before touching anything, then read
`docs/plan/IMPLEMENTATION_PLAN.md` sections 2, 3 and 5, and
`docs/plan/AGENT_RUNBOOK.md`.

## Where things stand

**Phase 1 (INF-01..INF-08) is complete and merged.** `main` carries the npm
workspaces scaffold, the seeded design system, the twelve-table Azure SQL schema
with migrations and seeds, the product catalog, the shared HTTP conventions, and
the Azure infrastructure-as-code.

**Phase 2 (anonymous password tools) is complete and epic #2 is closed.** All
six issues are closed by merged PRs and `main` is green — lint, typecheck, unit
tests and the full Playwright suite, which now actually reaches Playwright in CI
(for part of the phase `npm test` failed first, so the e2e step never ran).

| Issue     | Work                           | PR            |
| --------- | ------------------------------ | ------------- |
| #19 US-01 | Private breach check           | #71 (via #70) |
| #20 US-02 | Random password generator      | #72           |
| #21 US-03 | Passphrase generator           | #86           |
| #22 US-04 | Explain password results       | #91           |
| #23 US-05 | Explain password privacy       | #85           |
| #24 US-15 | Use password tools anonymously | #97           |

**Phase 3 (Google sign-in, account deletion) is in flight.**

| Issue     | Work                    | PR                      | State                               |
| --------- | ----------------------- | ----------------------- | ----------------------------------- |
| #25 US-14 | Sign in with Google     | #105                    | **green, held for security review** |
| #26 US-20 | Delete account          | worker, stacked on #105 | in progress                         |
| #27 US-16 | Questionnaire (Phase 4) | worker, stacked on #105 | in progress                         |

**#105 is green but deliberately unmerged.** Issue #25 carries `review:security`
and its acceptance criteria require an independent review of session handling
before merge. The lead wrote the PR, so an Opus reviewer with fresh context was
launched against it (worktree `soteria-review-us14`). Read its comment on #105
before merging, and fix what it finds — US-01's review found five real defects
this way.

### Merging is no longer humans-only

Connor lifted that rule on 2026-09-09: "i give you permission to merge your own
prs". Branch protection wants one approving review and GitHub forbids
self-approval, so the route is `gh pr merge <n> --squash --admin
--delete-branch` (`enforce_admins` is false on this repo). **Merge only what is
actually green**, and keep commenting on the issue when a PR opens and merges.

He also lifted the two-worker cap, globally: `~/.local/bin/ai-task` no longer
hard-fails at three sibling panes (set `AI_TASK_MAX_PANES` to reinstate one),
and the rule in `~/.claude/CLAUDE.md` was rewritten to match.

### The US-01 security review produced five tracked issues

The review of US-01 found real defects rather than style notes. All five were
filed and all but #80 are closed: **#79** stale verdict (fixed, #88), **#80**
the leak proof did not observe deferred exfiltration (fixed in #98, rides on
#97), **#81** no client CSP (fixed, #95), **#82** 36x36 touch targets below
768px (fixed, #93), **#83** `findBreachCount` returned the first match rather
than the maximum, plus an overstated privacy comment (fixed, #89).

Take future security reviews equally seriously. Every finding was reproducible
by execution.

## Agents that were running when this session ended

Three, all Claude, all with their own worktree. **Read their panes before
restarting anything.**

| Agent            | Pane    | Worktree                                      | Doing                   |
| ---------------- | ------- | --------------------------------------------- | ----------------------- |
| `impl-soteria`   | `w5:pF` | `/home/connor/Work/CS330/soteria-us20`        | US-20 (#26), on #105    |
| `impl-soteria-3` | `w5:pG` | `/home/connor/Work/CS330/soteria-us16`        | US-16 (#27), on #105    |
| `review-soteria` | `w5:pH` | `/home/connor/Work/CS330/soteria-review-us14` | Security review of #105 |

Both implementation branches are stacked on `feat/US-14-google-signin`, so they
must merge that branch in whenever it moves, and their PRs are based on it rather
than on `main`.

There are also stale worktrees under `/home/connor/Work/CS330/` from Phase 2
(`soteria-fix79`, `-fix80`, `-fix82`, `-fix83`, `-fix84`, `-fix90`, `-fix94`,
`-fix99`, `-fix101`, `-us02`, `-us03`, `-us04`, `-us05`, `-csp`, `-fix75`). All
are pushed and merged; `git worktree remove` them.

## What to do next, in dependency order

1. **Read the security review on #105 and act on it.** Do not merge until you
   have. Findings on US-14 are the lead's to fix, not the reviewer's.
2. **Merge #105.** It unblocks both workers and every remaining phase — every
   downstream issue depends on #25 either directly or through #51.
3. **Then the workers' PRs** for #26 and #27, rebasing each onto `main`.
4. **US-17 (#28), the scoring engine, is the lead's** per the plan, and it needs
   US-16's question set — the worker was told to report its question ids and
   categories. #29 and #30 then follow from #28.
5. **US-14 has two unverifiable claims** that a human must close out. Nothing
   here has run against real Google or a real database: token verification is
   tested against a stubbed `OAuth2Client`, so the first real sign-in will be the
   first exercise of `upsertGoogleUser`. And production is still unprovisioned,
   so `infra/deploy.sh`'s new `GOOGLE_CLIENT_ID` / `SESSION_SECRET` settings are
   an unexercised code path.
6. **The Azure provisioning task below is still outstanding** and still
   human-only. It has been outstanding since Phase 1, and US-14 added two
   secrets to it.

## The traps this session hit, so you do not repeat them

1. **`@soteria/shared` must stay browser-safe.** It is "types and pure rule
   modules used by both" tiers. `shared/src/catalog.ts` once called
   `readFileSync` at module scope, which made _every_ browser import of the
   package fail at load and rendered the page blank. `shared/src/browser-safety.test.ts`
   now walks the real import graph from `index.ts` and fails if any reachable
   module imports a Node built-in. If you add anything to `shared/`, it must pass
   that guard.
2. **Give every agent its own `git worktree`, created and `npm install`ed before
   you launch it.** Three agents once shared one checkout and a worker's
   `git checkout -b` switched the branch under the lead mid-edit.
3. **Never `git reset --hard` with uncommitted work in the lead tree.** Doing
   this cost three small edits that had to be redone. Commit first, then rebase.
4. **Codex may be rate-limited.** Both Codex workers hit an account-wide usage
   limit at the start of Phase 1; Claude workers were used instead, so those
   commits carry `AI-Assisted: Claude`. Check before planning around Terra/Luna.
5. **Stack PRs rather than waiting on merges,** and say at the top of the body
   what each is stacked on. Expect to merge the base back in when it moves.
6. **Write tests that fail for the right reason.** Several of this session's own
   tests passed vacuously until checked: one asserted a URL did not contain
   "password" (it does — `pwnedpasswords.com`), one passed `undefined` for a
   Web Crypto provider and silently hit the default parameter instead of
   simulating an insecure context, and a regression guard's regex did not
   actually match `from "node:fs"` and would have guarded nothing. After writing
   a guard, break the thing it guards and confirm it fails.
7. **Playwright silently tested the wrong worktree for most of Phase 2** (#84).
   `client/playwright.config.ts` hardcoded port 5173 with
   `reuseExistingServer: true`, so a run in one worktree attached to another
   worktree's dev server and verified source it was not testing. The config now
   derives a per-worktree port from a hash of `cwd`, scans upward for a free one,
   and sets `reuseExistingServer: false`. Two follow-on traps came out of this:
   the derived port must be _probed_, not trusted (three worktrees collided on
   5368, #94), the probe must bind **both** `127.0.0.1` and `[::1]` or it reports
   a squatted port free, and the chosen port must be pinned into
   `process.env.SOTERIA_E2E_PORT` because Playwright evaluates the config in the
   main process _and_ in every worker.
8. **`getByText` matches case-insensitive substrings.** "Not found in known
   breaches" matches a locator for "Found in known breaches". Use
   `getByRole("heading", { name, exact: true })` for verdict assertions.
9. **An aborted request fires no `response` event**, so `waitForResponse` hangs
   for the full timeout precisely when an abort-based fix is working. Poll a
   handler-completion flag instead, and treat a throwing `route.fulfill` as the
   passing path.
10. **Chromium strips `Set-Cookie` from the response headers it reports to
    Playwright.** Any anonymity proof built on `headersArray()` is blind;
    `context.cookies()` is the real detector. Also, a cookie fulfilled on a
    cross-origin stub is rejected outright, so that probe proves nothing either.
    Both facts are documented in `client/e2e/support/anonymity.ts`.
11. **Four EFF large-wordlist entries are hyphenated** — `drop-down`, `felt-tip`,
    `t-shirt`, `yo-yo` — and `-` is an offered passphrase separator. Three tests
    split a phrase on its separator and asserted each fragment was a list entry,
    which flaked ~10% of shared-suite runs (#99). `passphrase.test.ts` now has a
    `segment()` helper that recovers the words actually drawn. **A single green
    run does not clear a flake**: the first fix for #99 passed once and then
    failed 6 of 30 runs, which is how the third affected test was found.
12. **Ordinary English words make terrible needles.** The US-03 leak proof
    matched each passphrase word as a substring of every request line, and
    collided with the app's own traffic: `theme` in `/theme-init.js`, `runt` in
    `react_jsx-dev-runtime.js`, and `display`, `family` and `unit` (inside
    `Nunito`) in the Google Fonts query string (#101). The fix subtracts a
    baseline of carriers snapshotted at runtime rather than hand-listing
    exclusions, because a hand-written list goes stale and the flake comes back.
13. **`git checkout <file>` to revert a mutation reverts your real work too.**
    While break-testing US-14 I reverted `AppShell.tsx` to undo an injected
    mutation and lost the account menu with it. Copy the file to /tmp before
    mutating it and copy it back, the way the other probes in this session did.
14. **Run the guards that only CI can run.** `schema.integration.test.ts` needs a
    live SQL Server and skips without `DATABASE_URL`; there is no Docker on this
    machine, so it runs only in CI's `db-migrations` job. It caught US-14's
    `users.token_version` against its credential-column pattern — which is the
    guard working. Do not widen that pattern to pass; add a named exception with
    a reason and pin the column's type, or the exception becomes the hole.
15. **A test can pass because the dependency is strict, not because you are.**
    US-14 pinned the JWT algorithm and had an `alg: none` test to prove it. The
    test stayed green with the pin removed, because jose refuses unsigned tokens
    on its own. An HS512-signed token is the case that actually exercises the
    pin. Mutate, or you are testing your library's reputation.

## The one human-only task still outstanding

**Azure has never been provisioned.** `infra/main.bicep` has never even been
compiled — the `az` CLI is not installed on the agent machine. INF-05's last
acceptance item stays open until a human runs:

```sh
az login
az account set --subscription "<student subscription id>"
az bicep build --file infra/main.bicep   # validate — never yet compiled
./infra/deploy.sh soteria-rg eastus2
```

Then store the six GitHub secrets `docs/deploy.md` names. The deploy workflow's
health gate proves it worked: it fails unless the live `/api/health` reports
`dbConnected: true`. If provisioning turns up template problems, file a
`type:bug` issue rather than fixing them silently.

## Non-negotiable constraints

- One issue per branch and PR. Merging is now allowed (see above), but only
  what is genuinely green, and never a PR whose issue asks for a review it has
  not had.
- Anything not covered by an existing issue gets a new `type:chore` or
  `type:bug` issue _before_ the work starts.
- Every commit ends with `AI-Assisted: Codex` or `AI-Assisted: Claude`.
- Fill the PR template completely; comment on each issue when its PR opens and
  when it merges.
- Never store or log passwords, passphrases, generated credentials, full hashes,
  or secrets. For Phase 2 specifically: password-derived data never reaches the
  Soteria API, and only a 5-character SHA-1 prefix ever reaches HIBP.
- No literal colour, font, radius, or shadow outside
  `client/src/styles/tokens.css` — stylelint enforces this as a required check.
- Before review: lint, typecheck, tests, relevant Playwright, final diff, green
  CI. Request changes on worker PRs rather than silently rewriting them.
