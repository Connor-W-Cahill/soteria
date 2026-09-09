/**
 * The Content-Security-Policy for the Soteria client document (issue #81).
 *
 * This is the control that *enforces* ADR-0007's "the password never leaves the
 * browser" invariant, rather than merely describing it: `connect-src` permits
 * only the app's own origin and HIBP's range API, so an injected
 * `fetch` / `sendBeacon` / `WebSocket` to any other origin is blocked by the
 * browser regardless of whether a test happens to observe it (cf. #80).
 *
 * There are two policies. They differ ONLY in the ways Vite's dev server needs
 * and production must not have:
 *   - dev allows inline `<script>` / `<style>` (the React refresh preamble and
 *     Vite's injected style tags) and the HMR websocket on localhost;
 *   - prod allows neither.
 * `connect-src`'s third-party allowlist ('self' + HIBP) is identical in both,
 * so the deployed site is never weaker than dev on the axis that matters.
 *
 * `PROD` is the single source of truth for the deployed policy: it is served by
 * `vite preview` and asserted byte-for-byte against
 * `public/staticwebapp.config.json` in `csp.test.ts`.
 *
 * The `accounts.google.com` entries below are Google Identity Services (US-14),
 * and they are why the "only HIBP" sentence above needs qualifying: see
 * ADR-0008. In short, `connect-src` gains an origin that a script *may* reach,
 * but nothing password-derived is ever sent to it, and the GIS script is loaded
 * only by `/signin` — never by the anonymous password tools, which is asserted
 * by US-15's anonymity tests rather than merely intended.
 */

/**
 * The Soteria API's origin, when it is not the same origin as the document.
 *
 * US-14 is the first feature whose client must reach Soteria's own backend —
 * every earlier one was browser-only (HIBP direct, local generators) — and the
 * pinned policy did not permit it, so every auth call was refused by the browser
 * before it was made. That was found by an independent security review, not by a
 * test, because the tests pinned the broken list.
 *
 * Derived from `VITE_API_URL` rather than hard-coded, so this stays correct on
 * both sides of the same-origin move tracked as a blocking bug: when the API is
 * served from the document's own origin, `VITE_API_URL` is empty, nothing is
 * added, and `'self'` is the whole answer.
 */
function apiOrigin(env = process.env) {
  const raw = env.VITE_API_URL?.trim();

  if (raw === undefined || raw === "") return [];

  try {
    return [new URL(raw).origin];
  } catch {
    // A malformed value must not silently widen or narrow the policy.
    throw new Error(`VITE_API_URL is not a valid absolute URL: ${raw}`);
  }
}

export const API_ORIGIN = apiOrigin();

/** Directives common to both policies, in a fixed order. */
const COMMON = {
  "default-src": ["'self'"],
  "base-uri": ["'none'"],
  "object-src": ["'none'"],
  "frame-ancestors": ["'none'"],
  "form-action": ["'none'"],
  "img-src": ["'self'", "data:"],
  "font-src": ["'self'", "https://fonts.gstatic.com"],
  // The directive that enforces ADR-0007. Identical dev and prod.
  // HIBP is the only origin that ever receives password-derived data (a
  // 5-character SHA-1 prefix). accounts.google.com is reachable for sign-in
  // only, and only from /signin — ADR-0008.
  "connect-src": [
    "'self'",
    ...API_ORIGIN,
    "https://api.pwnedpasswords.com",
    "https://accounts.google.com",
  ],
  // The GIS credential iframe. 'none' would break sign-in outright.
  "frame-src": ["https://accounts.google.com"],
};

function serialise(directives) {
  return Object.entries(directives)
    .map(([name, values]) => `${name} ${values.join(" ")}`)
    .join("; ");
}

export const PROD_CSP = serialise({
  ...COMMON,
  "script-src": ["'self'", "https://accounts.google.com"],
  // GIS also loads its own stylesheet from accounts.google.com/gsi/style; the
  // e2e CSP test caught this, since the button renders unstyled without it.
  "style-src": [
    "'self'",
    "https://fonts.googleapis.com",
    "https://accounts.google.com",
  ],
});

export const DEV_CSP = serialise({
  ...COMMON,
  // Vite injects the React refresh preamble as an inline script and CSS as
  // inline <style> in dev; neither exists in the production build.
  "script-src": ["'self'", "'unsafe-inline'", "https://accounts.google.com"],
  "style-src": [
    "'self'",
    "'unsafe-inline'",
    "https://fonts.googleapis.com",
    "https://accounts.google.com",
  ],
  // The HMR websocket. Any localhost port, because each worktree's dev server
  // runs on its own (playwright.config.ts).
  "connect-src": [
    ...COMMON["connect-src"],
    "ws://localhost:*",
    "http://localhost:*",
  ],
});

/** Security response headers that accompany the CSP on the deployed document. */
export const STATIC_HEADERS = {
  "content-security-policy": PROD_CSP,
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
  "x-frame-options": "DENY",
};
