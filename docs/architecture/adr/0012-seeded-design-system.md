# 0012 — Visual design derived from a fixed seed

## Status

Accepted (implementation plan section 2, 2026-09-08).

## Context

Much of the UI is built by agents. Without a fixed reference, each contributor
(human or agent) would apply its own default palette, spacing, and component
style, and the app would drift into an incoherent look over many small pull
requests. The course also expects a deliberate, documented design.

## Decision

- Every visual token — colours (OKLCH), type scale and fonts, one 6 px radius,
  no shadows, 4 px spacing unit, the split-header app shell — is derived
  **mechanically from seed `3080478562`** by `docs/design/derive-seed.mjs` and
  recorded in [`DESIGN_SEED.md`](../../design/DESIGN_SEED.md).
- Tokens are generated once into `client/src/styles/tokens.css` as CSS custom
  properties. Components import tokens only.
- A lint rule fails CI on any literal hex/rgb/oklch colour, radius, or font name
  outside `tokens.css`.
- Non-negotiable accessibility overlays (WCAG 2.2 AA contrast, 2 px focus ring,
  44 px touch targets, 375 px reflow) take precedence over any seeded token and
  are verified by axe in CI.

## Consequences

- The look is reproducible and reviewable: anyone can re-run the script and get
  the same tokens, and the seed is printed in the site footer.
- UI pull requests are checkable against an objective standard rather than
  taste; "introduces a literal colour" is a concrete review failure.
- Changing the look is a deliberate act: change the seed once, re-run the script,
  update the doc, open a "Reseed design" chore. Individual tokens are never
  hand-tuned.
- The constraint set (no shadows, one radius, compact density) is intentionally
  narrow so components stay consistent.
