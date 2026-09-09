import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/**
 * US-05: the password-privacy explanation.
 *
 * Two acceptance surfaces: the `/learn/password-privacy` page and the inline
 * "How this works" disclosure above the breach checker. Plus the fix from
 * issue #83: the checker's link used to be a raw <a> pointing at a route that
 * did not exist, so it hard-reloaded onto the "coming soon" placeholder.
 */

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

const REQUIRED_POINTS = [
  /SHA-1/,
  /first five characters/,
  /Add-Padding/,
  /IP address/,
  /never receives your password/i,
  /saved, logged, or stored/i,
];

test.describe("US-05 password privacy", () => {
  test("the /learn/password-privacy route renders (not the placeholder)", async ({
    page,
  }) => {
    await page.goto("/learn/password-privacy");

    await expect(
      page.getByRole("heading", {
        name: "How the password breach check protects your privacy",
      }),
    ).toBeVisible();
    await expect(page.getByText("is coming soon")).toHaveCount(0);

    for (const point of REQUIRED_POINTS) {
      await expect(page.getByText(point).first()).toBeVisible();
    }

    // HIBP's API docs are linked.
    await expect(
      page.getByRole("link", { name: "Pwned Passwords range API" }),
    ).toHaveAttribute("href", /haveibeenpwned\.com\/API\/v3/);
  });

  test("the checker link resolves in-app instead of dead-ending on the placeholder", async ({
    page,
  }) => {
    await page.goto("/password-tools");

    await page
      .getByRole("link", { name: "Read more about password privacy" })
      .click();

    await expect(page).toHaveURL(/\/learn\/password-privacy$/);
    await expect(
      page.getByRole("heading", {
        name: "How the password breach check protects your privacy",
      }),
    ).toBeVisible();
    await expect(page.getByText("is coming soon")).toHaveCount(0);
  });

  test("the inline disclosure is a real disclosure that opens and closes", async ({
    page,
  }) => {
    await page.goto("/password-tools");

    const summary = page.locator("details.pw-privacy__disclosure summary");
    const body = page.getByText(
      "When you check a password, the work happens on your own device.",
    );

    await expect(body).toBeHidden();
    await summary.click();
    await expect(body).toBeVisible();
    await summary.click();
    await expect(body).toBeHidden();
  });

  test("disclosure is keyboard reachable and toggles with the keyboard", async ({
    page,
  }) => {
    await page.goto("/password-tools");
    const disclosure = page.locator("details.pw-privacy__disclosure");

    await disclosure.locator("summary").focus();
    await expect(disclosure.locator("summary")).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(disclosure).toHaveJSProperty("open", true);
  });

  for (const theme of ["light", "dark"] as const) {
    test(`no axe violations on the page (${theme})`, async ({ page }) => {
      await page.goto("/learn/password-privacy");
      if (theme === "dark") {
        await page.evaluate(() => {
          localStorage.setItem("soteria-theme", "dark");
          document.documentElement.dataset.theme = "dark";
        });
        await page.reload();
      }
      const results = await new AxeBuilder({ page }).withTags(WCAG).analyze();
      expect(results.violations).toEqual([]);
    });

    test(`no axe violations with the disclosure open (${theme})`, async ({
      page,
    }) => {
      await page.goto("/password-tools");
      if (theme === "dark") {
        await page.evaluate(() => {
          localStorage.setItem("soteria-theme", "dark");
          document.documentElement.dataset.theme = "dark";
        });
        await page.reload();
      }
      await page.locator("details.pw-privacy__disclosure summary").click();
      const results = await new AxeBuilder({ page }).withTags(WCAG).analyze();
      expect(results.violations).toEqual([]);
    });
  }

  test("no horizontal scroll on the page", async ({ page }) => {
    await page.goto("/learn/password-privacy");
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    );
    expect(overflow).toBe(false);
  });

  test("no horizontal scroll with the disclosure open", async ({ page }) => {
    await page.goto("/password-tools");
    await page.locator("details.pw-privacy__disclosure summary").click();
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    );
    expect(overflow).toBe(false);
  });
});
