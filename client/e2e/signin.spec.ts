import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { recordAnonymity } from "./support/anonymity";

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

/**
 * US-14 sign-in, from the browser's side.
 *
 * There is no real Google here and no database: the point of these tests is the
 * behaviour Soteria controls — where an unauthenticated visitor is sent, what
 * `?next=` is allowed to do, and that the Google script is confined to this one
 * page. The token verification, cookie flags and revocation are covered by
 * `server/src/auth/routes.test.ts`, which can assert them exactly.
 */
test.describe("US-14 sign in with Google", () => {
  test("an account-only route redirects to /signin with a next parameter", async ({
    page,
  }) => {
    await page.goto("/dashboard");

    await expect(page).toHaveURL(/\/signin\?next=%2Fdashboard$/);
    await expect(
      page.getByRole("heading", { name: "Sign in", exact: true }),
    ).toBeVisible();
  });

  test("every account-only route redirects, and the tools do not", async ({
    page,
  }) => {
    for (const path of ["/questionnaire", "/software", "/recommendations"]) {
      await page.goto(path);
      await expect(page).toHaveURL(
        new RegExp(`/signin\\?next=${encodeURIComponent(path)}`),
      );
    }

    // The anonymous tools stay reachable with no session and no prompt.
    for (const path of ["/password-tools", "/learn/password-privacy"]) {
      await page.goto(path);
      await expect(page).toHaveURL(new RegExp(`${path}$`));
    }
  });

  test("says the password tools need no account", async ({ page }) => {
    await page.goto("/signin");

    await expect(
      page.getByText(/password tools do not need an account/i),
    ).toBeVisible();
  });

  test("does not contact Google until the sign-in page is opened", async ({
    page,
    context,
  }) => {
    // ADR-0013: the GIS script is loaded by /signin alone, so an anonymous
    // visitor to the tools never talks to accounts.google.com. This is the test
    // that holds that line — accounts.google.com is deliberately absent from
    // the anonymity helper's allowlist.
    const recorder = recordAnonymity(context);

    await page.goto("/password-tools");
    await page.getByRole("button", { name: "Generate" }).first().click();
    await page.waitForLoadState("networkidle");

    expect(
      recorder.requests.filter((r) => r.url.includes("google.com")),
    ).toEqual([]);

    await recorder.settle(page);
  });

  test("loads the Google script only on /signin", async ({ page }) => {
    const seen: string[] = [];
    page.on("request", (request) => seen.push(request.url()));

    await page.goto("/signin");
    // The script is injected on mount; give the browser a moment to request it.
    await page.waitForTimeout(1000);

    // The request may fail (no client id configured in CI, and the CSP is what
    // permits it), but it must be *attempted* from this page — otherwise this
    // test would pass just as well if the button had silently stopped working.
    expect(
      seen.some((url) => url.startsWith("https://accounts.google.com/gsi/")),
    ).toBe(true);
  });

  test("has no axe violations", async ({ page }) => {
    await page.goto("/signin");
    const results = await new AxeBuilder({ page }).withTags(WCAG).analyze();

    expect(results.violations).toEqual([]);
  });

  test("no horizontal scroll at 375px", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 780 });
    await page.goto("/signin");

    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    );

    expect(overflow).toBe(false);
  });
});
