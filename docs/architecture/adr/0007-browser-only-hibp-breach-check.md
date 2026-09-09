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

## Consequences

- HIBP receives a 5-character SHA-1 prefix and can learn nothing about which
  password (or which of the ~hundreds of matching hashes) was checked;
  `Add-Padding` hides the result size from a network observer.
- There is nothing for the Soteria server to log, persist, or leak, which is the
  real reason the logging redaction list in
  [`conventions.md`](../conventions.md) is a safety net rather than the primary
  defence.
- Feature availability depends on HIBP; a failure is shown as a clear,
  non-blocking error and the rest of the tools still work.
- Any sequence diagram that shows a password or full hash reaching the Soteria
  API is wrong by definition (see [`components.md`](../components.md)).
