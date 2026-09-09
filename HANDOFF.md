# Soteria handoff

Written by Claude Opus as Phase 1 lead on 2026-09-08, after taking over from
Codex Sol mid-phase.

## State: Phase 1 is complete and merged

Every `INF-03`..`INF-08` issue shipped. All of it is on `main` at `9f31f96`.

| Issue                                   | PR        | Merged as |
| --------------------------------------- | --------- | --------- |
| #13 INF-03 Seeded design system         | #65       | `a18281c` |
| #14 INF-04 Data model and migrations    | #61       | `f6083ee` |
| #15 INF-05 Thin Azure deployment        | #64 → #62 | `9f31f96` |
| #16 INF-06 Architecture and design docs | #66 → #62 | `9f31f96` |
| #17 INF-07 Product catalog              | #63       | `6bae0f3` |
| #18 INF-08 Shared conventions           | #62       | `9f31f96` |

#64 and #66 were merged into the INF-08 branch rather than into `main`, so their
`Closes` links never fired; #15 and #16 were closed by hand.

`main` carries the scaffold, the seeded design system, the twelve-table schema
with migrations and seeds, the product catalog, the shared HTTP conventions, and
the Azure infrastructure-as-code.

## The one thing still outstanding

**Provision Azure.** This is the acceptance item no agent can complete
(`AGENT_RUNBOOK.md`, "Human steps that agents cannot do", item 1). The `az` CLI
is not installed on the agent machine and **nothing exists in Azure yet**, so
`infra/main.bicep` has never been compiled, let alone deployed:

```sh
az login
az account set --subscription "<student subscription id>"
az bicep build --file infra/main.bicep   # validate — never yet compiled
./infra/deploy.sh soteria-rg eastus2
```

Then store the six GitHub secrets `docs/deploy.md` names. The deploy workflow's
health gate is what proves it worked: it fails unless the live `/api/health`
reports `dbConnected: true`. If provisioning turns up template problems, file a
`type:bug` issue rather than fixing them silently.

## Next objective: Phase 2, anonymous password tools

Issues #19 US-01, #20 US-02, #21 US-03, #22 US-04, #23 US-05, #24 US-15
(milestone Sprint 1). Everything Phase 2 depends on is merged.

Dependency order, which decides who can start when:

- **#19 US-01** (breach check) and **#20 US-02** (generator) depend only on
  INF-03 and can start immediately.
- **#21 US-03** (passphrase) needs US-02.
- **#22 US-04** (explain results) and **#23 US-05** (explain privacy) need US-01.
- **#24 US-15** (anonymous use) needs US-01, US-02, and US-03.

US-01 is lead-owned and carries `review:security`; budget a reviewer slot for it
(see lesson 4). The invariant it must hold: SHA-1 is computed in the browser,
only the first 5 hex characters go to `api.pwnedpasswords.com/range/{prefix}`
with `Add-Padding: true`, and the Soteria API is never in the path.
`docs/architecture/adr/0007-browser-only-hibp-breach-check.md` specifies this,
including the Playwright test that asserts no request carries the password or the
full hash.

## Lessons that should change how later phases are run

1. **Give every agent its own `git worktree`.** All three agents initially shared
   `/home/connor/Work/CS330/soteria`, and a worker's `git checkout -b` switched
   the branch under the lead mid-edit. Nothing committed was lost, but the
   pattern does not survive two concurrent workers. Create the worktree and run
   `npm install` in it _before_ launching the worker, and say so in the prompt.
2. **Codex may be unavailable.** Both Codex workers hit an account-wide usage
   limit on launch and switching models did not help, so Claude workers were used
   instead. Those commits carry `AI-Assisted: Claude`. Check availability before
   planning a phase around Terra and Luna.
3. **Stack PRs rather than waiting on merges.** Agents cannot merge, so a
   dependent issue must branch from its dependency's branch and target it as the
   PR base. GitHub retargets to `main` as the chain merges. Say which PR is
   stacked on which, at the top of the body. Expect to merge `main` back in when
   the base moves — Phase 1's stack needed one such merge with five conflicts.
4. **Budget a worker slot for `review:security`.** The fresh Opus review of #62
   found four defects by executing probes rather than reading, including a rate
   limiter that was a silent no-op in production and a request body written to
   the log verbatim. The existing tests passed for the wrong reason. Give the
   reviewer its own worktree and tell it to verify by execution.
5. **Make invariants testable, not just documented.** The patterns that worked:
   `tokens.test.ts` re-runs `derive-seed.mjs` so a hand-tuned token fails CI; the
   schema integration test scans `INFORMATION_SCHEMA.COLUMNS` for
   credential-shaped column names; `audit_log.action` carries a database CHECK
   constraint rather than only a TypeScript union. A documented invariant with no
   test is a claim, and Phase 1 shipped two claims that were false.
6. **Verify a worker's external research, don't take the summary.** INF-07's CPE
   identifiers were re-checked against the live NVD dictionary before the PR was
   accepted, including the two products the worker said it had dropped. The
   claims held, but the check is what made them worth trusting.

## Non-negotiable constraints

- One issue per branch and PR; never merge. Humans merge.
- Every commit ends with `AI-Assisted: Codex` or `AI-Assisted: Claude`.
- Fill the PR template completely; comment on each issue when its PR opens and
  when it merges.
- Never store or log passwords, passphrases, generated credentials, full hashes,
  or secrets.
- No literal color, font, radius, or shadow outside
  `client/src/styles/tokens.css` — stylelint enforces this and it is a required
  check.
- Before review: lint, typecheck, tests, relevant Playwright, final diff, green
  CI. Request changes on worker PRs rather than silently rewriting them.
