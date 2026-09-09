# 0006 — Google Identity sign-in; Soteria stores no passwords

## Status

Accepted (implementation plan section 2, 2026-09-08).

## Context

US-14 wants returning users to reach their saved posture "without creating
another password". The charter forbids Soteria from ever holding a password,
passphrase, generated credential, or hash. The team needs authentication that
adds no credential store and no password-reset flow.

## Decision

- Sign-in is **Google Identity Services** only. The browser obtains a Google ID
  token; `POST /api/auth/google` verifies it with `google-auth-library` (audience
  = the Soteria client id).
- On success the server upserts a `users` row keyed by Google's stable subject id
  (`google_sub`) and issues its own session as an **httpOnly, Secure,
  SameSite=Lax JWT cookie** (7-day expiry, `token_version` claim for revocation).
- No password column exists in the schema and none may be added; the
  `schema.integration.test.ts` check enforces it (see
  [`data-model.md`](../data-model.md) invariant 1).

## Consequences

- Zero credential storage, zero password-reset surface, zero "forgot password"
  email flow.
- The only identity data at rest is `google_sub`, `email`, and `display_name` —
  an identifier and contact fields, not a secret.
- Soteria depends on Google's availability for login; acceptable because the
  anonymous password tools (US-15) work with no session at all.
- Account deletion (US-20) only has to cascade user-owned rows and bump
  `token_version`; there is no external credential to revoke.
- During development the Google OAuth app is in "testing" status with explicit
  test users; this is documented in `deploy.md`.
- The httpOnly session cookie is why CORS must be an exact-origin allowlist with
  `credentials: true` (see [0005](0005-azure-swa-app-service-hosting.md)).
