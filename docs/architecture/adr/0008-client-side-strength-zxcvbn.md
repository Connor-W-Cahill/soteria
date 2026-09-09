# 0008 — Client-side password strength with `@zxcvbn-ts/core`

## Status

Accepted (implementation plan section 2, 2026-09-08).

## Context

US-04 wants an estimated-strength explanation shown next to the breach result.
Strength estimation needs the candidate password in full. The charter forbids
that value from reaching the Soteria server or any store.

## Decision

- Strength scoring uses **`@zxcvbn-ts/core`** running **in the browser only**.
- The UI shows the library's 0–4 score, its crack-time estimate, and its
  warning/suggestions rewritten in plain language.
- The presentation layer that turns a `zxcvbn` result into card copy lives in
  `@soteria/shared` so it is unit-tested once; the `zxcvbn` call itself is
  client-only glue.
- Results are shown in a card explicitly labelled "Strength (estimated locally)",
  separate from the "Breach status (from Have I Been Pwned)" card, so a strong
  but breached password is still flagged unsafe.

## Consequences

- No password-derived data leaves the browser for strength, matching the same
  rule as the breach check (see [0007](0007-browser-only-hibp-breach-check.md)).
- `@zxcvbn-ts` ships a sizeable dictionary; it is loaded lazily on the password
  tools route so it does not weigh down first paint elsewhere.
- Strength is an estimate, not a guarantee; the copy says so and always pairs it
  with the breach result rather than presenting a single verdict.
- Because the module is pure and client-side, the anonymous tools (US-15) run it
  with no session and set no cookies.
