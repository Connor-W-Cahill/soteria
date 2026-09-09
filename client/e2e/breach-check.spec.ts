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

    await page.getByRole("link", { name: "Dashboard" }).click();
    await page.getByRole("link", { name: "Password Tools" }).click();

    await expect(page.getByLabel("Password to check")).toHaveValue("");
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
