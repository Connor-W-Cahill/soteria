# 0002 — React 18 + Vite + TypeScript frontend

## Status

Accepted (implementation plan section 2, 2026-09-08).

## Context

The course brief (`ProjectBrainstorming.txt`) mandates a React frontend. Within
that constraint the team still chooses the build tool, language strictness,
routing, and server-state handling. The app is a handful of authenticated pages
plus anonymous password tools; it is not content-heavy and does not need
server-side rendering or a meta-framework.

## Decision

- **React 18** with **Vite** as the dev server and bundler.
- **TypeScript in `strict` mode** across the package.
- **React Router** for client-side routing.
- **TanStack Query** for all server state (fetching, caching, refetch on focus).
- **Plain CSS with design tokens** — no CSS-in-JS, no utility framework. Tokens
  come from the design seed (see [0012](0012-seeded-design-system.md)).

## Consequences

- Vite gives fast local iteration and a simple static build that drops straight
  onto Azure Static Web Apps with no Node runtime on the client tier.
- No SSR means no Node server for the frontend, which keeps the hosting split
  clean (see [0005](0005-azure-swa-app-service-hosting.md)).
- TanStack Query removes hand-rolled fetch/loading/error state and makes the
  "single aggregate `GET /api/dashboard`" pattern (US-35) easy to cache.
- `strict` TypeScript plus shared types from `@soteria/shared` means the client
  and server agree on request and response shapes at compile time.
- Plain CSS + tokens keeps the seeded look enforceable with a lint rule that
  bans literal colors, radii, and fonts outside `tokens.css`.
- The team owns more wiring (router, query client, error boundaries) than a
  meta-framework would provide; acceptable for an app this size.
