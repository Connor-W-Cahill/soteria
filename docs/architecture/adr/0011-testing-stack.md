# 0011 — Vitest + Supertest + Playwright + axe testing stack

## Status

Accepted (implementation plan section 2, 2026-09-08).

## Context

The course grades a testing report (Milestone 6) and the charter's privacy
invariants can only be trusted if tests enforce them. Soteria has three test
shapes: pure rule logic in `shared/`, HTTP behaviour in `server/`, and user
journeys plus accessibility in `client/`.

## Decision

- **Vitest** for unit tests in all three packages (one runner, Vite-native, fast
  watch mode).
- **Supertest** for API integration tests in `server/`, including a migration
  test that runs against the Docker SQL Server service container in CI.
- **Playwright** for end-to-end journeys in `client/`.
- **`@axe-core/playwright`** for automated accessibility checks on every route.
- Coverage gates land in INF-09: `shared` 90 %, `server` 80 %, `client` 70 %
  lines.

## Consequences

- The privacy invariants become executable tests: no credential-named columns
  (`server`), a logged request body containing `password` never appears in log
  output (`server`), the breach check makes only the HIBP range request
  (`client`), and account deletion leaves zero user rows (`server`).
- One assertion style (`expect`) across unit and integration tests.
- Playwright doubles as the keyboard-only (US-37) and 375 px mobile (US-38)
  audit harness.
- Playwright browsers are a heavier CI dependency; mitigated by running e2e as a
  separate job and keeping unit/integration fast for the common PR loop.
- Recorded NVD fixtures keep e2e and demo runs offline (see
  [0009](0009-nvd-cve-api-external-data.md)).
