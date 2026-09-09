# 0010 — GitHub Actions cron for all scheduled work

## Status

Accepted (implementation plan section 2, 2026-09-08).

## Context

Two features need work to happen on a schedule with no user present: the CVE
refresh + alert generation job (US-31, every 6 hours) and the stretch email
digest (US-32/33, daily). The API runs on an App Service F1 tier with no
"Always On", so an in-process `setInterval` timer would not survive the instance
idling out.

## Decision

- Scheduled work is triggered by **GitHub Actions `schedule` (cron) workflows**
  that make an authenticated HTTP call to an internal endpoint.
- The endpoint (`POST /api/internal/refresh`, and later `/api/internal/digest`)
  is protected by an `INTERNAL_JOB_SECRET` shared secret and the
  `sensitiveRateLimit()` ceiling.
- The job body is idempotent, writes an `audit_log` row, and on failure sets the
  CVE freshness error surfaced by US-34.

## Consequences

- Scheduled work runs regardless of whether the App Service instance is warm; the
  cron call itself wakes it.
- No always-on compute cost; stays within the free tier.
- The internal endpoints are a small privileged surface: secret-guarded,
  rate-limited, audit-logged, and never exposed in client code or CORS.
- Schedule precision is "roughly every 6 hours", which is fine for CVE data that
  NVD itself updates in batches.
- If GitHub Actions is unavailable the data simply ages; US-34's stale indicator
  makes that visible rather than silent.
