# Soteria handoff

Last updated 2026-09-08 by the Claude Opus lead, restarting the session at the
start of Phase 2. Written for the next lead — read this before touching
anything, then read `docs/plan/IMPLEMENTATION_PLAN.md` sections 2, 3 and 5, and
`docs/plan/AGENT_RUNBOOK.md`.

## Where things stand

**Phase 1 (INF-01..INF-08) is complete and merged.** `main` carries the npm
workspaces scaffold, the seeded design system, the twelve-table Azure SQL schema
with migrations and seeds, the product catalog, the shared HTTP conventions, and
the Azure infrastructure-as-code.

**Phase 2 (anonymous password tools) is in progress.** Issues #19 US-01, #20
US-02, #21 US-03, #22 US-04, #23 US-05, #24 US-15.

### The open PR stack — read this before opening anything

```
main
 └── #70  fix/69-shared-browser-safe   ← the gate. Mergeable, CI green.
      ├── (US-01 #71 already merged into this branch)
      └── #72  feat/US-02-password-generator   ← CONFLICTING, worker is on it
```

**#70 is the one to merge first.** It carries both the `@soteria/shared`
browser-safety fix (#69) _and_ all of US-01, because #71 was merged into it
rather than into `main`. Merging #70 lands US-01 on `main` and closes **#19 and
#69 together**.

### Careful: merging a PR into its base branch does not close its issue

This has now bitten three times (#15, #16, #19). When a stacked PR is merged into
its base branch rather than into `main`, GitHub does not fire its `Closes #n`
link. The issue stays open even though the work is done. Check for this before
assuming an issue is unstarted — verify the files are on `main` first, then close
by hand with a comment saying why.

## Agents that were running when this session ended

**Do not kill these and do not delete their worktrees.** They were left alive
deliberately; they have uncommitted work.

| Agent            | Pane    | Worktree                                   | Doing                    |
| ---------------- | ------- | ------------------------------------------ | ------------------------ |
| `impl-soteria`   | `w5:pB` | `/home/connor/Work/CS330/soteria-us02`     | US-02 (#20), PR #72      |
| `review-soteria` | `w5:pC` | `/home/connor/Work/CS330/soteria-review01` | Security review of US-01 |

Both were started from the old task tab (`w5:t4`). `ai-task status` still lists
them; `herdr pane read <id> --source recent --lines 40` shows what they are
doing. Adopt their output rather than restarting them.

- **PR #72 (US-02) is CONFLICTING.** Its base branch moved when US-01 merged into
  it, and both touch `client/src/App.tsx`, `client/src/main.tsx` and
  `shared/src/index.ts`. The worker was told to merge its base in. If it does not,
  the resolution is straightforward: US-01 owns the `/password-tools` route and
  the `BreachChecker`; US-02 adds a second section to the same page. Keep both.
- **The US-01 security review was retargeted to #70**, because #71 merged while
  the review was running. Expect its findings there, framed as a US-01 review.
  Findings on US-01 are the lead's to fix, not the reviewer's.

## What to do next, in dependency order

1. **Adopt the two running agents.** Read their panes; do not re-launch them.
2. **Address the US-01 security review findings on #70** when they land. The last
   such review found four real defects by executing probes; assume this one is
   also worth acting on rather than acknowledging.
3. **Get #70 merged** (a human merges; agents never do). That unblocks everything.
4. **Then, in this order:** #21 US-03 (needs US-02), #22 US-04 and #23 US-05 (both
   need US-01), #24 US-15 (needs US-01, US-02, US-03).
   - US-04 needs `@zxcvbn-ts/core`, running locally in the browser.
   - US-05 is a `/learn/password-privacy` page plus an inline "How this works"
     disclosure. The `BreachChecker` already links to that route, so the link is
     currently dead — US-05 fixes that.
   - US-15 asserts anonymity: fresh context, zero `Set-Cookie`, no `/api/` calls.
5. Two workers maximum, plus a reviewer slot for `review:security` issues.

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

- One issue per branch and PR; **never merge**. Humans merge.
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
