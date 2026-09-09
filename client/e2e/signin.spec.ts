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

  test("the session hint gates the backend probe in both directions", async ({
    page,
    context,
  }) => {
    // Finding 9 of the security review: the US-15 anonymity property rests on
    // this one localStorage key, and the suite only ever exercised the
    // hint-ABSENT direction. So "the password tools contact nobody" was an
    // untested claim about the hint-present path, which a prior sign-in on a
    // shared machine or an extension can flip.
    //
    // Both directions are pinned here. What the hint-present path is ALLOWED to
    // do is call /api/me and nothing else — no Google origin, no other endpoint.
    const calls: string[] = [];
    context.on("request", (request) => {
      const url = new URL(request.url());
      if (
        url.pathname.startsWith("/api/") ||
        url.hostname.endsWith("google.com")
      ) {
        calls.push(`${request.method()} ${url.origin}${url.pathname}`);
      }
    });

    // Absent: no backend call at all.
    await page.goto("/password-tools");
    await page.waitForLoadState("networkidle");
    expect(calls, "hint absent must contact no backend").toEqual([]);

    // Present: /api/me, and only /api/me. The route is fulfilled here because no
    // API runs in the e2e environment, and an unanswered probe is not the path
    // under test: session.tsx deliberately KEEPS the hint on a network failure
    // (a failure is not proof the session is gone) and clears it only on a
    // successful `{ user: null }`. Without the stub this test would assert the
    // error branch while claiming to test the success branch.
    await context.route("**/api/me", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ user: null }),
      }),
    );
    await page.evaluate(() =>
      window.localStorage.setItem("soteria.session-hint", "1"),
    );
    await page.reload();
    await page.waitForLoadState("networkidle");

    expect(calls.length, "hint present must probe the session").toBeGreaterThan(
      0,
    );
    expect(
      [...new Set(calls.map((call) => call.split(" ")[1]))],
      `hint present may call /api/me and nothing else, saw ${JSON.stringify(calls)}`,
    ).toEqual([`${new URL(page.url()).origin}/api/me`]);

    // And a hint with no session behind it is cleared, so it probes once and
    // stops rather than calling the backend on every future load.
    expect(
      await page.evaluate(() =>
        window.localStorage.getItem("soteria.session-hint"),
      ),
    ).toBeNull();
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
