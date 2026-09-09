# 0013 — CSP allowances for Google Identity Services

## Status

Accepted (US-14, 2026-09-09).

## Context

[ADR-0007](0007-browser-only-hibp-breach-check.md) makes the password tools'
privacy promise enforceable rather than merely stated: `connect-src` in
`client/csp.mjs` lists exactly `'self'` and `https://api.pwnedpasswords.com`, so
an injected `fetch` / `sendBeacon` / `WebSocket` to any other origin is blocked
by the browser whether or not a test observes it. That file calls `connect-src`
"the one directive that enforces ADR-0007", and `csp.test.ts` asserts the list
exactly so a new origin cannot be added quietly.

US-14 signs users in with Google Identity Services, which cannot work under that
policy. GIS loads a script from `accounts.google.com`, renders its button in an
iframe from the same origin, and calls back to it. Widening the directive that
ADR-0007 leans on is an architecture decision, so it is recorded here instead of
being made inside a feature branch.

## Decision

- `script-src`, `style-src`, `frame-src` and `connect-src` each gain exactly
  `https://accounts.google.com`. No wildcard, no other Google origin, and no
  `'unsafe-inline'` in production. `style-src` is on that list because GIS loads
  its own stylesheet from `accounts.google.com/gsi/style` — an omission the
  end-to-end CSP test caught, rather than something read off the documentation.
- **The GIS script is loaded lazily, by `/signin` alone.** `client/src/features/
auth/GoogleSignInButton.tsx` injects the `<script>` tag when it mounts, and it
  is only ever rendered on that route. Nothing in the app shell references
  Google, so a visitor who never tries to sign in never contacts Google.
- **The session probe is gated too.** `GET /api/me` fires only when
  `localStorage` holds the one-bit hint that sign-in writes, so an anonymous
  visitor to `/password-tools` makes no Soteria API call either. The hint is the
  literal `"1"` — no id, no email, no token — because the session cookie is
  `httpOnly` and script cannot see it.
- The dev and production policies keep the same third-party allowlist, as before.

## Consequences

- ADR-0007's substantive claim is unchanged: **HIBP is still the only third
  party that ever receives password-derived data**, and still only a 5-character
  SHA-1 prefix. `accounts.google.com` is reachable by script but is never sent
  anything derived from a password, and the pages that handle passwords do not
  load it at all. The statements on `/learn/password-privacy` stay accurate.
- The anonymity guarantee is preserved _by construction and asserted by test_
  rather than by relaxing a test to fit the feature. US-15's Playwright checks —
  no `/api/` call, no cookie, no origin outside the fonts/HIBP allowlist — still
  pass unmodified against the anonymous tool pages, and `accounts.google.com` is
  deliberately **not** added to that helper's allowlist, so a stray Google
  request from a tool page fails the suite.
- `csp.test.ts` now pins the exact `connect-src`, `script-src`, `style-src` and
  `frame-src` lists and asserts that HIBP is
  still the only password-data destination, so the next origin someone wants to
  add fails a test and has to be argued for the same way.
- The cost is one more origin that could serve script if Google were compromised.
  It is accepted because the alternative below is worse, and because the tools
  that touch passwords never load it.

## Alternatives considered

- **A separate document or origin for signed-in pages**, leaving the anonymous
  CSP untouched. Rejected: it doubles the deployment surface and the build, and
  splits routing across two apps, to protect pages that already do not load
  Google.
- **Server-side OAuth code flow** instead of GIS, keeping the browser out of it.
  This would avoid the `script-src` and `frame-src` entries, but ADR-0006 already
  fixed Google Identity as the sign-in mechanism, and the code flow needs a
  server-side redirect endpoint and state store that the Static Web Apps
  deployment does not have. Worth revisiting if the auth surface grows.
