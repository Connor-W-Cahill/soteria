import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/**
 * US-01's core acceptance criterion: the password never leaves the browser.
 *
 * These tests assert it against the real page and the real network stack, by
 * recording every request the page makes — not just the ones we expect. The
 * unit tests in `src/features/password/breach-check.test.ts` assert the same
 * property at the module level.
 */

const SECRET = "hunter2-correct-horse";
// SHA-1(SECRET). The first five characters are the only part that may be sent.
const SECRET_SHA1 = "9D2AA6B9ABA710A78870C1B86FD2EAB218B8ECB3";
const PREFIX = SECRET_SHA1.slice(0, 5);
const SUFFIX = SECRET_SHA1.slice(5);

interface SeenRequest {
  url: string;
  method: string;
  body: string | null;
  headers: Record<string, string>;
}

/**
 * Records every request the page makes and stubs the HIBP range endpoint, so no
 * test traffic reaches the real service.
 */
async function instrument(page: import("@playwright/test").Page) {
  const requests: SeenRequest[] = [];

  page.on("request", (request) => {
    requests.push({
      url: request.url(),
      method: request.method(),
      body: request.postData(),
      headers: request.headers(),
    });
  });

  await page.route("https://api.pwnedpasswords.com/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/plain",
      // A padded zero entry plus the real hit, as HIBP returns with Add-Padding.
      body: [`${SUFFIX}:4821`, "0018A45C4D1DEF81644B54AB7F969B88D65:0"].join(
        "\r\n",
      ),
    });
  });

  return requests;
}

/** Requests the app itself makes: the dev server's modules, HMR, source maps. */
function isAppAsset(url: string): boolean {
  return (
    url.startsWith("http://localhost") ||
    url.startsWith("http://127.0.0.1") ||
    url.startsWith("data:") ||
    url.startsWith("blob:")
  );
}

/**
 * Google Fonts. The design seed requires Sora / Nunito Sans / Red Hat Mono to be
 * loaded from Google Fonts (DESIGN_SEED.md, "Implementation contract"), so these
 * origins are expected third-party traffic on every page. They are listed
 * explicitly rather than ignored loosely: the assertions below still require
 * that no request to them — or to anywhere else — carries password-derived data.
 */
const FONT_ORIGINS = [
  "https://fonts.googleapis.com",
  "https://fonts.gstatic.com",
];

function isFontAsset(url: string): boolean {
  return FONT_ORIGINS.some((origin) => url.startsWith(origin));
}

/**
 * A result card's heading, matched exactly.
 *
 * `getByText` is a case-insensitive substring match, so "Found in known
 * breaches" also matches the "Not found in known breaches" card — which makes
 * any assertion that one is absent while the other is present quietly wrong.
 * Matching the heading by exact name is what keeps the negative assertions
 * meaningful.
 */
function verdict(page: import("@playwright/test").Page, title: string) {
  return page.getByRole("heading", { name: title, exact: true });
}

test.describe("US-01 private breach check", () => {
  test("sends only the 5-character hash prefix, and only to HIBP", async ({
    page,
  }) => {
    const requests = await instrument(page);

    await page.goto("/password-tools");
    await page.getByLabel("Password to check").fill(SECRET);
    await page.getByRole("button", { name: "Check password" }).click();
    await expect(page.getByText("Found in known breaches")).toBeVisible();

    const external = requests.filter(
      (request) => !isAppAsset(request.url) && !isFontAsset(request.url),
    );

    // Exactly one request left the app beyond the seed's font CDN, and it went
    // to HIBP's range endpoint carrying only the 5-character prefix.
    expect(external).toHaveLength(1);
    expect(external[0]?.url).toBe(
      `https://api.pwnedpasswords.com/range/${PREFIX}`,
    );
    expect(external[0]?.method).toBe("GET");
    expect(external[0]?.headers["add-padding"]).toBe("true");

    // The font requests are the only other third-party traffic, and they are
    // triggered by the stylesheet, not by the check.
    const thirdParty = requests.filter((request) => !isAppAsset(request.url));
    expect(
      thirdParty.filter((request) => isFontAsset(request.url)).length,
    ).toBe(thirdParty.length - 1);

    // Nothing anywhere — app assets included — carries the password, the full
    // digest, or the suffix.
    for (const request of requests) {
      const haystack = `${request.url}\n${request.body ?? ""}\n${JSON.stringify(request.headers)}`;

      expect(haystack).not.toContain(SECRET);
      expect(haystack).not.toContain(SECRET_SHA1);
      expect(haystack).not.toContain(SUFFIX);
      expect(haystack.toLowerCase()).not.toContain(SUFFIX.toLowerCase());
    }
  });

  test("never calls the Soteria API", async ({ page }) => {
    const requests = await instrument(page);

    await page.goto("/password-tools");
    await page.getByLabel("Password to check").fill(SECRET);
    await page.getByRole("button", { name: "Check password" }).click();
    await expect(page.getByText("Found in known breaches")).toBeVisible();

    for (const request of requests) {
      expect(new URL(request.url).pathname).not.toMatch(/^\/api\//);
    }
  });

  test("stores nothing in the browser", async ({ page }) => {
    await instrument(page);

    await page.goto("/password-tools");
    await page.getByLabel("Password to check").fill(SECRET);
    await page.getByRole("button", { name: "Check password" }).click();
    await expect(page.getByText("Found in known breaches")).toBeVisible();

    const stored = await page.evaluate(() => ({
      local: JSON.stringify(localStorage),
      session: JSON.stringify(sessionStorage),
      cookie: document.cookie,
    }));

    expect(stored.local).not.toContain(SECRET);
    expect(stored.session).not.toContain(SECRET);
    expect(stored.cookie).not.toContain(SECRET);
    expect(stored.session).toBe("{}");
  });

  test("reports a password that is not in the corpus", async ({ page }) => {
    await page.route("https://api.pwnedpasswords.com/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "text/plain",
        body: "0018A45C4D1DEF81644B54AB7F969B88D65:9",
      });
    });

    await page.goto("/password-tools");
    await page.getByLabel("Password to check").fill(SECRET);
    await page.getByRole("button", { name: "Check password" }).click();

    await expect(page.getByText("Not found in known breaches")).toBeVisible();
  });

  test("shows a clear, non-blocking error when HIBP fails", async ({
    page,
  }) => {
    await page.route("https://api.pwnedpasswords.com/**", (route) =>
      route.fulfill({ status: 503, body: "" }),
    );

    await page.goto("/password-tools");
    await page.getByLabel("Password to check").fill(SECRET);
    await page.getByRole("button", { name: "Check password" }).click();

    await expect(page.getByText("Breach status unavailable")).toBeVisible();
    // Non-blocking: the form is still usable afterwards.
    await expect(
      page.getByRole("button", { name: "Check password" }),
    ).toBeEnabled();
  });

  test("masks the password and offers a labelled show/hide toggle", async ({
    page,
  }) => {
    await instrument(page);
    await page.goto("/password-tools");

    const field = page.getByLabel("Password to check");
    await field.fill(SECRET);
    await expect(field).toHaveAttribute("type", "password");
    await expect(field).toHaveAttribute("autocomplete", "off");

    await page.getByRole("button", { name: "Show password" }).click();
    await expect(field).toHaveAttribute("type", "text");

    await page.getByRole("button", { name: "Hide password" }).click();
    await expect(field).toHaveAttribute("type", "password");
  });

  test("clears the password when navigating away", async ({ page }) => {
    await instrument(page);
    await page.goto("/password-tools");
    await page.getByLabel("Password to check").fill(SECRET);

    // "Learn" rather than "Dashboard": US-15 (#24) hides account-only tabs from a
    // signed-out visitor, and Dashboard is one of them. Learn and Password Tools
    // both stay visible signed out, so this navigation works either way and the
    // test's intent — leave the page, come back, field is empty — is unchanged.
    await page.getByRole("link", { name: "Learn", exact: true }).click();
    await page.getByRole("link", { name: "Password Tools" }).click();

    await expect(page.getByLabel("Password to check")).toHaveValue("");
  });

  /**
   * Holds the range response open until `release()` is called.
   *
   * `settled()` resolves once the handler has finished trying to deliver that
   * response. It deliberately does not wait on a Playwright `response` event: a
   * request the page has aborted never produces one, so waiting for a response
   * would hang forever exactly when the fix is working.
   */
  async function heldRangeResponse(page: import("@playwright/test").Page) {
    let release: (() => void) | undefined;
    let delivered = false;

    const held = new Promise<void>((resolve) => {
      release = resolve;
    });

    await page.route("https://api.pwnedpasswords.com/**", async (route) => {
      await held;

      try {
        await route.fulfill({
          status: 200,
          contentType: "text/plain",
          // SECRET is breached, so a wrongly-rendered verdict says so loudly.
          body: [
            `${SUFFIX}:4821`,
            "0018A45C4D1DEF81644B54AB7F969B88D65:0",
          ].join("\r\n"),
        });
      } catch {
        // The page aborted the request, so there is nothing left to fulfil.
        // That is the passing path, not an error.
      }

      delivered = true;
    });

    return {
      release: () => release?.(),
      settled: async () => {
        await expect.poll(() => delivered, { timeout: 10_000 }).toBe(true);
      },
    };
  }

  test("discards a verdict for a password the user replaced mid-check", async ({
    page,
  }) => {
    const range = await heldRangeResponse(page);

    await page.goto("/password-tools");
    const field = page.getByLabel("Password to check");

    await field.fill(SECRET);
    await page.getByRole("button", { name: "Check password" }).click();
    await expect(page.getByRole("button", { name: "Checking…" })).toBeVisible();

    // Replace the password while the check for the old value is still running.
    await field.fill("a-completely-different-password");

    // Let the superseded response be delivered, then give React a moment to
    // apply anything it caused. Without this settle the assertions below could
    // run before the response was processed at all, and would prove nothing.
    range.release();
    await range.settled();
    await page.waitForTimeout(500);

    // The response belongs to a password the field no longer holds, so no
    // verdict may be rendered. "Found" would be wrong; "Not found" is the
    // dangerous direction, telling the user a value was cleared when it was
    // never checked. Assert all three cards are absent.
    await expect(verdict(page, "Found in known breaches")).toHaveCount(0);
    await expect(verdict(page, "Not found in known breaches")).toHaveCount(0);
    await expect(verdict(page, "Breach status unavailable")).toHaveCount(0);
    await expect(field).toHaveValue("a-completely-different-password");
  });

  test("releases the control as soon as the password is edited mid-check", async ({
    page,
  }) => {
    const range = await heldRangeResponse(page);

    await page.goto("/password-tools");
    const field = page.getByLabel("Password to check");

    await field.fill(SECRET);
    await page.getByRole("button", { name: "Check password" }).click();
    await expect(page.getByRole("button", { name: "Checking…" })).toBeVisible();

    await field.fill("a-completely-different-password");

    // The edited value can be checked immediately; the user is not made to wait
    // on a request whose result has already been discarded.
    await expect(
      page.getByRole("button", { name: "Check password" }),
    ).toBeEnabled();

    range.release();
  });

  test("still reports the newest verdict after a superseded check", async ({
    page,
  }) => {
    // Guards against over-correcting: superseding must discard the stale result
    // without suppressing the one that replaces it.
    let calls = 0;

    await page.route("https://api.pwnedpasswords.com/**", async (route) => {
      calls += 1;
      const first = calls === 1;
      if (first) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
      await route.fulfill({
        status: 200,
        contentType: "text/plain",
        body: first
          ? `${SUFFIX}:4821`
          : "0018A45C4D1DEF81644B54AB7F969B88D65:9",
      });
    });

    await page.goto("/password-tools");
    const field = page.getByLabel("Password to check");

    await field.fill(SECRET);
    await page.getByRole("button", { name: "Check password" }).click();
    await field.fill("a-completely-different-password");
    await page.getByRole("button", { name: "Check password" }).click();

    await expect(verdict(page, "Not found in known breaches")).toBeVisible();
    await expect(verdict(page, "Found in known breaches")).toHaveCount(0);
  });

  test("has no axe violations", async ({ page }) => {
    await instrument(page);
    await page.goto("/password-tools");
    await page.getByLabel("Password to check").fill(SECRET);
    await page.getByRole("button", { name: "Check password" }).click();
    await expect(page.getByText("Found in known breaches")).toBeVisible();

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();

    expect(results.violations).toEqual([]);
  });
});
