# 0007 — Browser-to-HIBP k-anonymity breach check

## Status

Accepted (implementation plan section 2, 2026-09-08).

## Context

US-01 wants a user to learn whether a password appears in known breach data
"without the application storing or receiving it". The charter's privacy
invariants say the only third party that may see password-derived data is HIBP,
and only as a short hash prefix.

## Decision

- The breach check runs **entirely in the browser**. The Soteria API is never in
  the path.
- The client computes **SHA-1** of the password with Web Crypto, sends the
  **first 5 hex characters** to
  `https://api.pwnedpasswords.com/range/{prefix}` with the `Add-Padding: true`
  header, and compares the returned suffixes locally to get the breach count.
- The password input is `type=password`, no autocomplete, cleared on navigation.
- A Playwright test intercepts every request during a check and asserts the only
  request is the range call and that no request URL or body contains the password
  or the full hash.
- **The client document is served with a Content-Security-Policy whose
  `connect-src` is `'self' https://api.pwnedpasswords.com` and nothing else.**
  This is the control that _enforces_ this ADR rather than describing it: an
  injected `fetch` / `sendBeacon` / `WebSocket` to any other origin is blocked
  by the browser regardless of whether a test observes it (the Playwright leak
  test was shown bypassable by a delayed `sendBeacon` — issue #80). The policy
  is defined in `client/csp.mjs`; production is served via
  `client/public/staticwebapp.config.json` (Azure Static Web Apps) and mirrored
  by `vite preview`, and the dev server serves a policy that differs only in the
  inline-script/style and HMR-socket allowances Vite needs. See issue #81.

## Consequences

- HIBP receives a 5-character SHA-1 prefix and can learn nothing about which
  password (or which of the ~hundreds of matching hashes) was checked;
  `Add-Padding` hides the result size from a network observer.
- There is nothing for the Soteria server to log, persist, or leak, which is the
  real reason the logging redaction list in
  [`conventions.md`](../conventions.md) is a safety net rather than the primary
  defence.
- The privacy invariant no longer rests on code convention plus a test that only
  observes leaks it happens to be looking at. The CSP `connect-src` is a
  browser-enforced ceiling; the leak test is now a second line that checks the
  code stays well within it.
- Feature availability depends on HIBP; a failure is shown as a clear,
  non-blocking error and the rest of the tools still work.
- Any sequence diagram that shows a password or full hash reaching the Soteria
  API is wrong by definition (see [`components.md`](../components.md)).
