import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const GENERATED = /^[\x21-\x7e]{8,64}$/;

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

/** Scope every query to the password card. /password-tools also hosts the
 * breach checker (US-01) and the passphrase generator (US-03), which have their
 * own "Generate" button and range slider. */
function pwgen(page: Page) {
  return page.locator(".sot-pwgen");
}

test.describe("US-02 random password generator", () => {
  for (const theme of ["light", "dark"] as const) {
    test(`has no axe violations (${theme})`, async ({ page }) => {
      await page.goto("/password-tools");
      if (theme === "dark") {
        await page.evaluate(() => {
          document.documentElement.dataset.theme = "dark";
        });
      }
      await pwgen(page).getByRole("button", { name: "Generate" }).click();
      const results = await new AxeBuilder({ page })
        .include(".sot-pwgen")
        .withTags(WCAG)
        .analyze();
      expect(results.violations).toEqual([]);
    });
  }

  test("no horizontal scroll at 375px", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 780 });
    await page.goto("/password-tools");
    await pwgen(page).getByRole("button", { name: "Generate" }).click();
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    );
    expect(overflow).toBe(false);
  });

  test("generates, and the value never leaves the browser", async ({
    page,
  }) => {
    const requests: string[] = [];
    page.on("request", (req) => {
      requests.push(`${req.method()} ${req.url()} ${req.postData() ?? ""}`);
    });

    await page.goto("/password-tools");
    const card = pwgen(page);
    const output = card.getByLabel("Generated password");
    await expect(output).toHaveValue("");

    await card.getByRole("button", { name: "Generate" }).click();
    const value = await output.inputValue();
    expect(value).toMatch(GENERATED);
    expect(value.length).toBe(20);

    // Regenerate a few times: distinct values, still in range.
    const seen = new Set<string>([value]);
    for (let i = 0; i < 5; i++) {
      await card.getByRole("button", { name: "Generate" }).click();
      seen.add(await output.inputValue());
    }
    expect(seen.size).toBeGreaterThan(1);

    // No request anywhere may carry a generated password.
    for (const gen of seen) {
      for (const entry of requests) {
        expect(entry).not.toContain(gen);
      }
    }

    // Nothing persisted.
    const storage = await page.evaluate(() => ({
      local: { ...localStorage },
      session: { ...sessionStorage },
    }));
    for (const gen of seen) {
      expect(JSON.stringify(storage)).not.toContain(gen);
    }
  });

  test("length bound and character-class toggles", async ({ page }) => {
    await page.goto("/password-tools");
    const card = pwgen(page);
    const output = card.getByLabel("Generated password");

    await card.getByRole("slider").fill("64");
    await card.getByLabel(/Lowercase letters/).uncheck();
    await card.getByLabel(/Digits/).uncheck();
    await card.getByLabel(/Symbols/).uncheck();

    await card.getByRole("button", { name: "Generate" }).click();
    const value = await output.inputValue();
    expect(value.length).toBe(64);
    expect(value).toMatch(/^[A-Z]+$/);

    // Turning everything off disables Generate and warns.
    await card.getByLabel(/Uppercase letters/).uncheck();
    await expect(card.getByRole("button", { name: "Generate" })).toBeDisabled();
    await expect(
      card.getByText("Select at least one character type."),
    ).toBeVisible();
  });

  test("copy button announces via a live region", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto("/password-tools");
    const card = pwgen(page);

    await card.getByRole("button", { name: "Generate" }).click();
    const value = await card.getByLabel("Generated password").inputValue();

    await card
      .getByRole("button", { name: "Copy password to clipboard" })
      .click();

    const region = page.getByRole("region", { name: "Notifications" });
    await expect(
      region.getByText("Password copied to your clipboard."),
    ).toBeVisible();

    const clip = await page.evaluate(() => navigator.clipboard.readText());
    expect(clip).toBe(value);
  });
});
