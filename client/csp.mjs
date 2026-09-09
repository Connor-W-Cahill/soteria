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
 */

/** Directives common to both policies, in a fixed order. */
const COMMON = {
  "default-src": ["'self'"],
  "base-uri": ["'none'"],
  "object-src": ["'none'"],
  "frame-ancestors": ["'none'"],
  "form-action": ["'none'"],
  "img-src": ["'self'", "data:"],
  "font-src": ["'self'", "https://fonts.gstatic.com"],
  // The one directive that enforces ADR-0007. Identical dev and prod.
  "connect-src": ["'self'", "https://api.pwnedpasswords.com"],
};

function serialise(directives) {
  return Object.entries(directives)
    .map(([name, values]) => `${name} ${values.join(" ")}`)
    .join("; ");
}

export const PROD_CSP = serialise({
  ...COMMON,
  "script-src": ["'self'"],
  "style-src": ["'self'", "https://fonts.googleapis.com"],
});

export const DEV_CSP = serialise({
  ...COMMON,
  // Vite injects the React refresh preamble as an inline script and CSS as
  // inline <style> in dev; neither exists in the production build.
  "script-src": ["'self'", "'unsafe-inline'"],
  "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
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
