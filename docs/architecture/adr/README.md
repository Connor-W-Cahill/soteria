# Architecture decision records

These ADRs record the architecture decisions that were **already made** in
[`docs/plan/IMPLEMENTATION_PLAN.md`](../../plan/IMPLEMENTATION_PLAN.md) section 2
("Architecture decisions (fixed, so agents do not re-decide them)"). They exist so
that the reasoning behind each fixed choice is reviewable and so the course
Milestone 3 submission has a standard artifact. They do **not** open the decisions
for re-litigation; changing one means changing the plan first.

One ADR per row of that table that carries a real trade-off. Rows that are pure
consequence of another decision (for example the privacy invariants, which follow
from the auth and breach-check choices) are covered in the ADR that causes them.

| ADR                                                | Decision                                                 | Status   |
| -------------------------------------------------- | -------------------------------------------------------- | -------- |
| [0001](0001-monorepo-npm-workspaces.md)            | npm-workspaces monorepo (`client` / `server` / `shared`) | Accepted |
| [0002](0002-react-vite-frontend.md)                | React 18 + Vite + TypeScript frontend                    | Accepted |
| [0003](0003-node-express-backend.md)               | Node 22 + Express 5 + TypeScript backend                 | Accepted |
| [0004](0004-azure-sql-knex-mssql.md)               | Azure SQL Database via Knex + `mssql`                    | Accepted |
| [0005](0005-azure-swa-app-service-hosting.md)      | Azure Static Web Apps + App Service (Linux) hosting      | Accepted |
| [0006](0006-google-identity-no-passwords.md)       | Google Identity sign-in; Soteria stores no passwords     | Accepted |
| [0007](0007-browser-only-hibp-breach-check.md)     | Browser-to-HIBP k-anonymity breach check                 | Accepted |
| [0008](0008-client-side-strength-zxcvbn.md)        | Client-side password strength with `@zxcvbn-ts/core`     | Accepted |
| [0009](0009-nvd-cve-api-external-data.md)          | NVD CVE API 2.0 as the required external live data       | Accepted |
| [0010](0010-github-actions-cron-scheduled-work.md) | GitHub Actions cron for all scheduled work               | Accepted |
| [0011](0011-testing-stack.md)                      | Vitest + Supertest + Playwright + axe testing stack      | Accepted |
| [0012](0012-seeded-design-system.md)               | Visual design derived from a fixed seed                  | Accepted |

## Format

Each record uses the same headings: **Title**, **Status**, **Context**,
**Decision**, **Consequences**. Keep them short; link to
[`data-model.md`](../data-model.md), [`conventions.md`](../conventions.md), and
[`deploy.md`](../../deploy.md) rather than restating what they already say.

## Superseding a decision

Add a new ADR that states what changes and why, set the old record's status to
`Superseded by NNNN`, and update section 2 of the implementation plan in the same
pull request.
