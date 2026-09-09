# 0001 — npm-workspaces monorepo

## Status

Accepted (implementation plan section 2, 2026-09-08).

## Context

Soteria has three deployable-or-shared parts: a React single-page app, a Node
REST API, and a body of pure rule logic (password strength presentation, the
scoring engine, the recommendation engine, CVE plain-language templating, the
product catalog types). That rule logic has to run identically in the browser and
on the server, and it is where most of the course's "human-explainable code"
lives, so it needs one home, one test suite, and one review surface.

Options considered: one mixed repository with ad-hoc folders; three separate
repositories with the shared code published as a private package; a single
repository with npm workspaces.

## Decision

One Git repository laid out as an npm-workspaces monorepo with three packages:

- `client/` — `@soteria/client`, the React app.
- `server/` — `@soteria/server`, the Express API.
- `shared/` — `@soteria/shared`, pure TypeScript modules with no I/O, imported by
  both of the others.

Root scripts (`npm run lint`, `npm run typecheck`, `npm test`) fan out across all
three. One `package-lock.json`, one CI workflow.

## Consequences

- Shared rule modules are written once, unit-tested once in `shared/`, and can be
  imported by the client and the server without a publish step.
- A change that spans tiers is one pull request against one issue, which fits the
  "one issue, one branch, one PR" rule.
- `shared/` must stay free of Node- and browser-only APIs; the boundary is a
  review checklist item and is kept honest by `shared/` having no `dom` or
  `node` typings beyond ES2022.
- Separate deployment still works: the deploy pipeline builds each package on its
  own and ships the client to Static Web Apps and the server to App Service (see
  [`deploy.md`](../../deploy.md)).
- Contributors clone and `npm install` once; there is no multi-repo version
  juggling.
