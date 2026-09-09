import { expect, test } from "@playwright/test";

import { expectNoAuthPrompt, recordAnonymity } from "./support/anonymity";

/**
 * US-15: the password tools are fully usable with no account.
 *
 * The load-bearing test records every request on the *context* and only checks
 * it after the page is closed, so deferred exfiltration (a `sendBeacon` on a
 * timer, a `pagehide` handler, a `keepalive` fetch) cannot slip past — the
 * failure mode from issue #80.
 */

const HIBP_SUFFIX = "1E4C9B93F3F0682250B6CF8331B7EE68FD8"; // SHA1("password")[5:]

test.describe("US-15 anonymous password tools", () => {
  test("checker and both generators run with no session, no cookie, no /api/, no service worker", async ({
    browser,
  }) => {
    const context = await browser.newContext(); // fresh: no storage, no cookies
    const recorder = recordAnonymity(context);

    // HIBP is a direct browser call (ADR-0007); stub it so no test traffic
    // leaves and the assertion stays about *our* behaviour.
    await context.route("https://api.pwnedpasswords.com/**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "text/plain",
        body: `${HIBP_SUFFIX}:42\r\n0018A45C4D1DEF81644B54AB7F969B88D65:0`,
      }),
    );

    const page = await context.newPage();
    await page.goto("/password-tools");
    await expectNoAuthPrompt(page);

    // 1. Breach checker.
    await page.getByLabel("Password to check").fill("password");
    await page.getByRole("button", { name: "Check password" }).click();
    await expect(page.getByText("Found in known breaches")).toBeVisible();

    // 2. Random password generator.
    const pwgen = page.locator(".sot-pwgen");
    await pwgen.getByRole("button", { name: "Generate" }).click();
    await expect(pwgen.getByLabel("Generated password")).not.toHaveValue("");

    // 3. Passphrase generator.
    const ppgen = page.locator(".sot-ppgen");
    await ppgen.getByRole("button", { name: "Generate" }).click();
    await expect(ppgen.getByLabel("Generated passphrase")).not.toHaveValue("");

    // Also visit Learn, the other anonymous route.
    await page.getByRole("link", { name: "Learn" }).click();
    await expect(page).toHaveURL(/\/learn$/);

    // Let deferred timers fire, then close the page to flush pagehide/beacon
    // traffic, then judge.
    await recorder.settle(page);
    await recorder.assertAnonymous(context);

    // A service worker could also be registered without any request; check the
    // registration list from a fresh page too.
    const probe = await context.newPage();
    await probe.goto("/password-tools");
    const swCount = await probe.evaluate(async () => {
      if (!("serviceWorker" in navigator)) return 0;
      return (await navigator.serviceWorker.getRegistrations()).length;
    });
    expect(swCount).toBe(0);

    await context.close();
  });

  test("signed-out nav keeps Password Tools and Learn, hides account-only tabs", async ({
    page,
  }) => {
    await page.goto("/password-tools");

    // Viewport-agnostic: the desktop bar (nav "Primary") and the mobile tab bar
    // (nav "Primary mobile") both render the visible items; only one is shown at
    // a time, so assert on the visible link and on DOM presence, not on a
    // single nav.
    const visibleLink = (name: string) =>
      page.getByRole("link", { name, exact: true }).filter({ visible: true });

    await expect(visibleLink("Password Tools")).toHaveCount(1);
    await expect(visibleLink("Learn")).toHaveCount(1);
    // The kept tab really navigates.
    await visibleLink("Learn").click();
    await expect(page).toHaveURL(/\/learn$/);
    await page.goBack();

    for (const hidden of [
      "Dashboard",
      "Questionnaire",
      "Software",
      "Recommendations",
    ]) {
      await expect(
        page.getByRole("link", { name: hidden, exact: true }),
      ).toHaveCount(0);
    }

    // No "signed in" affordances either. The sign-in control is a LINK to
    // /signin, not a button: US-14 loads the Google Identity script lazily on
    // that page alone, so the anonymous tool pages contact no Google origin
    // (ADR-0013). A button that started the flow in place would break the
    // third-party assertion in assertAnonymous.
    const signIn = page.getByRole("link", { name: /sign in with google/i });

    await expect(signIn).toBeVisible();
    await expect(signIn).toHaveAttribute("href", "/signin");
    await expect(
      page.getByRole("button", { name: "Notifications" }),
    ).toHaveCount(0);
    // And no account menu.
    await expect(
      page.getByRole("button", { name: /account menu/i }),
    ).toHaveCount(0);
  });

  test("'/' sends an anonymous visitor to the tools, not a hidden dashboard", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/password-tools$/);
  });
});
