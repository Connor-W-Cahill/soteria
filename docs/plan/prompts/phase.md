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
