import { expect, type BrowserContext, type Page } from "@playwright/test";

/**
 * Traffic recorder for "this flow is anonymous" tests.
 *
 * Built to close the hole documented in issue #80: the earlier breach-check
 * leak test recorded on `page.on("request")` and asserted the instant the
 * verdict rendered, so a `navigator.sendBeacon(...)` on a 1.5s timer slipped
 * past every assertion. This recorder therefore:
 *
 *  - listens on the **context**, not the page, so service-worker and
 *    cross-page traffic is seen;
 *  - is drained only after {@link settle}, which waits out deferred timers and
 *    closes the page so `keepalive` / `pagehide` / beacon traffic is flushed;
 *  - asserts the **absence of a request**, never just the absence of a string
 *    in its body (`request.postData()` is null for a Blob/ArrayBuffer beacon,
 *    so a body scan sees nothing).
 */

export interface SeenRequest {
  url: string;
  method: string;
  resourceType: string;
}

/** Origins a correctly-behaving anonymous page may talk to. */
const ALLOWED_ORIGINS = [
  "https://fonts.googleapis.com",
  "https://fonts.gstatic.com",
  // ADR-0007: the breach check is a direct browser->HIBP k-anonymity call.
  "https://api.pwnedpasswords.com",
];

function isFirstParty(url: string): boolean {
  return (
    url.startsWith("http://localhost") ||
    url.startsWith("http://127.0.0.1") ||
    url.startsWith("data:") ||
    url.startsWith("blob:") ||
    url.startsWith("about:")
  );
}

function isAllowedThirdParty(url: string): boolean {
  return ALLOWED_ORIGINS.some((origin) => url.startsWith(origin));
}

export interface AnonymityRecorder {
  requests: SeenRequest[];
  /**
   * Values seen in a `Set-Cookie` response header.
   *
   * Usually empty even when a cookie is set, because Chromium strips
   * `Set-Cookie` from reported response headers. Do not treat this as the cookie
   * detector; `context.cookies()` is.
   */
  setCookieHeaders: string[];
  /** Wait out deferred exfiltration, close the page, then stop recording. */
  settle: (page: Page, opts?: { quietMs?: number }) => Promise<void>;
  /** Assert nothing about this run betrayed a session or a backend call. */
  assertAnonymous: (context: BrowserContext) => Promise<void>;
}

export function recordAnonymity(context: BrowserContext): AnonymityRecorder {
  const requests: SeenRequest[] = [];
  const setCookieHeaders: string[] = [];

  const onRequest = (request: import("@playwright/test").Request) => {
    requests.push({
      url: request.url(),
      method: request.method(),
      resourceType: request.resourceType(),
    });
  };
  const onResponse = async (response: import("@playwright/test").Response) => {
    try {
      // headersArray() preserves repeated headers and the raw `Set-Cookie`
      // name; the object forms fold or drop it.
      for (const { name, value } of await response.headersArray()) {
        if (name.toLowerCase() === "set-cookie") setCookieHeaders.push(value);
      }
    } catch {
      // Headers can be unavailable if the page is already gone.
    }
  };

  context.on("request", onRequest);
  context.on("response", onResponse);

  return {
    requests,
    setCookieHeaders,

    async settle(page, opts) {
      // Long enough to catch a #80-style beacon on a ~1.5s timer.
      await page.waitForTimeout(opts?.quietMs ?? 2000);
      // Closing flushes keepalive fetches, pagehide handlers and sendBeacon.
      await page.close({ runBeforeUnload: true });
      await new Promise((r) => setTimeout(r, 500));
      context.off("request", onRequest);
      context.off("response", onResponse);
    },

    async assertAnonymous(context) {
      // 1. No Soteria backend call, ever.
      const apiCalls = requests.filter((r) => r.url.includes("/api/"));
      expect(
        apiCalls,
        `unexpected /api/ calls: ${JSON.stringify(apiCalls)}`,
      ).toEqual([]);

      // 2. No request to any origin outside the allowlist.
      const strangers = requests.filter(
        (r) => !isFirstParty(r.url) && !isAllowedThirdParty(r.url),
      );
      expect(
        strangers,
        `unexpected third-party requests: ${JSON.stringify(strangers)}`,
      ).toEqual([]);

      // 3. Nothing set a cookie.
      //
      // context.cookies() is the check that does the work here. The header scan
      // is belt-and-braces and must not be relied on: Chromium does not report
      // Set-Cookie in response headers, so headersArray() sees nothing even when
      // a cookie really is set. Verified by injecting a first-party
      // Set-Cookie — the cookie assertion below caught it and the header
      // assertion above did not.
      expect(setCookieHeaders).toEqual([]);
      expect(await context.cookies()).toEqual([]);

      // 4. No service worker was registered (it could carry traffic later).
      expect(context.serviceWorkers()).toEqual([]);
    },
  };
}

/** Assert no signed-out visitor was pushed into an auth flow. */
export async function expectNoAuthPrompt(page: Page): Promise<void> {
  expect(new URL(page.url()).pathname).not.toMatch(/sign-?in|login|auth/i);
  await expect(page.getByRole("dialog")).toHaveCount(0);
}
