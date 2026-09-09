# Soteria Agent Runbook

How to execute `IMPLEMENTATION_PLAN.md` with the Herdr `ai-task` topology. Run
these from a Herdr pane (`HERDR_ENV=1`). Models: lead = `gpt-5.6-sol`, impl =
`gpt-5.6-terra`, tests/search = `gpt-5.6-luna`, review = Claude `opus`.

Before Phase 0, in `~/.codex/config.toml` consider `model_reasoning_effort = "high"`
for the hard items listed in the plan (section 3); `low` is the current default.

## Phase 0: GitHub bootstrap

```sh
cd /home/connor/Work/CS330/soteria
ai-task start soteria-phase0-github --project /home/connor/Work/CS330/soteria --prompt "$(cat docs/plan/prompts/phase0.md)"
```

Prompt (`docs/plan/prompts/phase0.md`) is included below and in the prompts folder.

## Phases 1–11

Each phase: start a tab with Sol, then add workers as the phase table in the plan
says. Sol decides when to add them; two sibling panes max.

```sh
ai-task start soteria-phase1-foundation --project /home/connor/Work/CS330/soteria --prompt "$(sed 's/PHASE/1/g' docs/plan/prompts/phase.md)"
ai-task worker impl  --prompt "Work only on the issue Sol assigns you in this tab. Follow docs/plan/IMPLEMENTATION_PLAN.md section 5 and docs/design/DESIGN_SEED.md. Open a PR; do not merge."
ai-task worker tests --prompt "Work only on the issue Sol assigns you. Prefer fixtures, unit tests, docs, and catalog research. Open a PR; do not merge."
ai-task review --prompt "$(cat docs/plan/prompts/review.md)"     # only for review:security issues
ai-task status
ai-task finish --yes                                             # after the phase's PRs are merged or HANDOFF.md is written
```

Substitute the phase number (2 … 11) in the sed and a tab name like `soteria-phase2-password-tools`.

To hand a hard phase to Opus instead of Sol (allowed for INF-05, US-14, US-17,
US-24, US-27, US-31):

```sh
ai-task start soteria-phase6-cve --project /home/connor/Work/CS330/soteria --lead claude --prompt "$(sed 's/PHASE/6/g' docs/plan/prompts/phase.md)"
```

## Human steps that agents cannot do

1. Azure: sign in to the student subscription once (`az login`) and paste the
   subscription id into `.env` when Sol asks in INF-05. Approve the resource
   group creation.
2. Google Cloud: create the OAuth client id for US-14 (Sol writes the exact
   steps in `docs/deploy.md`); add teammates as test users.
3. NVD: request a free API key (https://nvd.nist.gov/developers/request-an-api-key)
   and add it as the `NVD_API_KEY` GitHub secret and App Service setting.
4. Review and merge every PR. Agents are not allowed to merge.
5. Invite teammates as collaborators after INF-01.

## Prompt: phase0.md

```
You are Codex Sol, lead for Soteria (CS330 group project). Read, in order:
docs/plan/IMPLEMENTATION_PLAN.md, docs/plan/ISSUE_BACKLOG.md, docs/plan/issues.json,
docs/design/DESIGN_SEED.md. Do NOT implement application code in this tab.

Objective: complete INF-01 exactly as its acceptance criteria state.

1. `git init` here, add a .gitignore (node, .env, dist), commit the docs/ folder
   with message "docs: implementation plan, issue backlog, design seed".
2. Using the GitHub MCP server (`mcp_servers.github`), create the private repo
   Connor-W-Cahill/soteria with default branch main; push. If the MCP is
   unavailable, use `gh repo create Connor-W-Cahill/soteria --private --source . --push`.
3. Create every label and milestone from issues.json (colors, due dates).
4. Create the 10 epics, then the 48 issues, in the order they appear. Each issue
   body = the `body` field plus a trailing "Part of #<epic number>" line and
   "Depends on: #<n>, #<n>" resolved to real issue numbers. Apply labels and the
   milestone. After all issues exist, edit each epic body to list its children
   as a task list (- [ ] #n).
5. Add .github/ISSUE_TEMPLATE/story.yml and bug.yml, .github/pull_request_template.md
   (sections: Summary, Linked issue, Acceptance checklist, AI assistance
   [tool, what it influenced, verification performed], Screenshots),
   CODEOWNERS, CONTRIBUTING.md. Commit on branch infra/INF-01-bootstrap, open a
   PR that closes the INF-01 issue, and stop. Do not merge.
6. Enable branch protection on main: PR required, 1 approval, status check "ci"
   required (it will exist after INF-02), no force pushes. Create a GitHub
   Project "Soteria" with Backlog/Ready/In progress/In review/Done and add all
   issues to Backlog.
7. Write a comment on the INF-01 issue summarizing what was created and any
   step that failed, then report to the user.
```

## Prompt: phase.md

```
You are the lead for Soteria phase PHASE (see the phase table in
docs/plan/IMPLEMENTATION_PLAN.md section 3). Read the plan, the design seed, and
the backlog entries for this phase's issues. Check `gh issue list --milestone`
and the GitHub Project for current state before starting.

Rules: one issue per branch and PR; PR template fully filled including the AI
assistance section; commits end with "AI-Assisted: Codex" (or Claude); never
merge; never store or log password material; never introduce a literal color,
font, radius, or shadow outside client/src/styles/tokens.css; follow the fixed
architecture decisions in plan section 2 without re-deciding them.

Process: take the lead-owned issues yourself. For each worker-owned issue in
this phase, when its dependencies are merged, delegate it with `ai-task worker
impl|tests --prompt "<issue key>: <one-paragraph brief with file scope and the
acceptance checklist>"`. Two workers max. Integrate worker branches by reviewing
their PRs and requesting changes; do not rewrite their work silently. Comment on
each issue when its PR opens and when it merges. Run lint, typecheck, tests, and
the relevant Playwright suite before declaring any issue ready for human review.
For issues labeled review:security, request Opus review with `ai-task review`
before asking the human to merge.

When every issue in the phase has an open or merged PR and CI is green, write
a short phase summary comment on the epic issue, update HANDOFF.md if anything
is unfinished, and report to the user with the list of PRs awaiting human merge.
```

## Prompt: review.md

```
You are Claude Opus acting as security and architecture reviewer for Soteria.
Read docs/plan/IMPLEMENTATION_PLAN.md sections 2 and 5 and the issue named by
the lead. Review the open PR for that issue with `gh pr diff`. Check: the
privacy invariants (no password/hash/credential in storage, logs, or requests
to Soteria; deletion cascade), auth/session handling, input validation, rate
limiting, dependency choices, correctness of any matching or scoring logic
against its tests, and adherence to the design seed for UI. Post findings as a
PR review with `gh pr review --request-changes` or `--comment`; never approve on
behalf of the human, and never merge. Report a one-paragraph summary to the lead.
```
