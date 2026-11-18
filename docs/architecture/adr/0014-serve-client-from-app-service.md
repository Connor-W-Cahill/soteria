# 0014 — Serve the client from the App Service (one origin)

## Status

Accepted (issue #111, 2026-11-18). Supersedes
[0005](0005-azure-swa-app-service-hosting.md) on client hosting; 0005's API and
database choices stand.

## Context

[ADR-0005](0005-azure-swa-app-service-hosting.md) (INF-05) put the client on a
Static Web App (`*.azurestaticapps.net`) and the API on an App Service
(`*.azurewebsites.net`). Both suffixes are on the Public Suffix List, so every
API call from the client was **cross-site**.

US-14 ([ADR-0006](0006-google-identity-no-passwords.md)) keeps the session in an
httpOnly `SameSite=Lax` cookie, and `SameSite=Lax` is the CSRF control for every
state-changing route. A `Lax` cookie is neither stored from a cross-site
response nor sent on a cross-site fetch. The independent security review of
#105 reproduced the result in Chromium: `POST /api/auth/google` answered 200, the
client rendered as signed in, the cookie jar stayed empty, and the next
navigation was anonymous — a silent failure with no error anywhere.

The options were:

1. `SameSite=None` on the cookie. Rejected: it deletes the CSRF control, and
   third-party cookie restrictions block it in several browsers anyway.
2. A Static Web Apps linked backend, which proxies `/api` through the SWA origin.
   Rejected: it needs the Standard tier (about $9/month) and the project budget
   is the free tiers.
3. Serve the client from the App Service, so client and API share one origin.

## Decision

Option 3, chosen by the project owner.

- `infra/main.bicep` provisions no Static Web App. The App Service is the site.
- `.github/workflows/deploy.yml` builds the client with `VITE_API_URL` empty
  (relative, same-origin calls) and ships `client/dist` inside the API bundle
  as `public/`.
- `server/src/http/client.ts` serves the build: static files, hashed
  `/assets/*` with immutable caching, and an `index.html` fallback for client
  routes. It never answers `/api/*`, so API 404s keep their JSON envelope.
- Every client response carries the headers in `security-headers.json`,
  generated from `client/csp.mjs` (the single source of the production CSP) and
  copied into the build. The API **refuses to start** in production if the file
  is missing or lacks any of the CSP, `X-Content-Type-Options`,
  `Referrer-Policy` and `X-Frame-Options`, so a document can never go out with
  the API's own `default-src 'none'` policy or with none.
- helmet's `Cross-Origin-Opener-Policy` becomes `same-origin-allow-popups`,
  because the server now sends the document and Google sign-in's popup needs it.
- `WEB_ORIGIN` and the App Service CORS block are kept, pointed at the site's
  own origin. Same-origin makes them inert; removing a working fail-closed
  restriction is not something to do in the same change.

## Consequences

- The session cookie works in production with `SameSite=Lax` intact, and the
  CSP's `connect-src` needs no API origin: `'self'` covers it.
- The API is no longer a pure JSON process. That is contained in one module and
  mounted after every API route.
- No CDN in front of the client. Static assets are small and content-hashed, so
  browser caching covers most of what the SWA CDN gave.
- Client asset requests count against the API's global rate limit. The limit is
  generous enough for page loads; revisit if it ever bites.
- One fewer resource and two fewer GitHub secrets (`VITE_API_URL`,
  `AZURE_STATIC_WEB_APPS_API_TOKEN`).
- The Google OAuth client's _Authorised JavaScript origins_ must list the App
  Service origin rather than the SWA one.
