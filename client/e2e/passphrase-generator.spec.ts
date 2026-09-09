import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

/** Scope every query to the passphrase card so the sibling generators on
 * /password-tools cannot satisfy or break these assertions. */
function ppgen(page: Page) {
  return page.locator(".sot-ppgen");
}

test.describe("US-03 passphrase generator", () => {
  for (const theme of ["light", "dark"] as const) {
    test(`has no axe violations (${theme})`, async ({ page }) => {
      await page.goto("/password-tools");
      if (theme === "dark") {
        await page.evaluate(() => {
          document.documentElement.dataset.theme = "dark";
        });
      }
      await ppgen(page).getByRole("button", { name: "Generate" }).click();
      const results = await new AxeBuilder({ page })
        .include(".sot-ppgen")
        .withTags(WCAG)
        .analyze();
      expect(results.violations).toEqual([]);
    });
  }

  test("no horizontal scroll at 375px", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 780 });
    await page.goto("/password-tools");
    await ppgen(page).getByRole("slider").fill("8");
    await ppgen(page).getByRole("button", { name: "Generate" }).click();
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    );
    expect(overflow).toBe(false);
  });

  test("generates a passphrase that never leaves the browser", async ({
    page,
    context,
  }) => {
    // Record on the CONTEXT, not the page: this also catches service-worker
    // traffic and any post-verdict beacon a page-level recorder would miss.
    const requests: string[] = [];
    context.on("request", (req) => {
      requests.push(`${req.method()} ${req.url()} ${req.postData() ?? ""}`);
    });

    await page.goto("/password-tools");
    const card = ppgen(page);
    const output = card.getByLabel("Generated passphrase");
    await expect(output).toHaveValue("");

    await card.getByRole("slider").fill("5");
    await card.getByRole("button", { name: "Generate" }).click();

    const seen = new Set<string>();
    for (let i = 0; i < 6; i++) {
      await card.getByRole("button", { name: "Generate" }).click();
      const value = await output.inputValue();
      expect(value.split("-")).toHaveLength(5);
      expect(value).toMatch(/^[a-z-]+(-[a-z-]+){4}$/);
      seen.add(value);
    }
    expect(seen.size).toBeGreaterThan(1);

    // Let any in-flight request settle, then assert none carried a passphrase
    // (the whole phrase, and each 4+-letter word, which are distinctive tokens).
    await page.waitForLoadState("networkidle");
    for (const value of seen) {
      for (const entry of requests) {
        expect(entry).not.toContain(value);
        for (const word of value.split("-")) {
          if (word.length >= 4) expect(entry).not.toContain(word);
        }
      }
    }

    // Nothing persisted anywhere.
    const storage = await page.evaluate(() => ({
      local: { ...localStorage },
      session: { ...sessionStorage },
    }));
    for (const value of seen) {
      expect(JSON.stringify(storage)).not.toContain(value);
    }
  });

  test("word count, separator, capitalization and digit", async ({ page }) => {
    await page.goto("/password-tools");
    const card = ppgen(page);
    const output = card.getByLabel("Generated passphrase");

    // 8 words, space separator, capitalized, trailing digit.
    await card.getByRole("slider").fill("8");
    await card.getByLabel("Separator").selectOption(" ");
    await card.getByLabel("Capitalize each word").check();
    await card.getByLabel("Append a random digit").check();
    await card.getByRole("button", { name: "Generate" }).click();

    const value = await output.inputValue();
    const parts = value.split(" ");
    expect(parts).toHaveLength(8);
    for (const part of parts) expect(part[0]).toMatch(/[A-Z]/);
    expect(parts[7]).toMatch(/[0-9]$/);

    // 3 words, hyphen, plain.
    await card.getByRole("slider").fill("3");
    await card.getByLabel("Separator").selectOption("-");
    await card.getByLabel("Capitalize each word").uncheck();
    await card.getByLabel("Append a random digit").uncheck();
    await card.getByRole("button", { name: "Generate" }).click();
    const plain = await output.inputValue();
    expect(plain.split("-")).toHaveLength(3);
    expect(plain).toMatch(/^[a-z-]+(-[a-z-]+){2}$/);
  });

  test("shows entropy in bits and explains it", async ({ page }) => {
    await page.goto("/password-tools");
    const card = ppgen(page);

    await card.getByRole("slider").fill("6");
    // 6 * log2(7776) ≈ 77.5 -> rounded 78
    await expect(card.getByText(/≈\s*78 bits of entropy/)).toBeVisible();
    await expect(
      card.getByText(/7,776 chosen uniformly at random/),
    ).toBeVisible();

    await card.getByRole("slider").fill("3");
    await expect(card.getByText(/≈\s*39 bits of entropy/)).toBeVisible();
  });

  test("copy announces via a live region", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto("/password-tools");
    const card = ppgen(page);

    await card.getByRole("button", { name: "Generate" }).click();
    const value = await card.getByLabel("Generated passphrase").inputValue();

    await card
      .getByRole("button", { name: "Copy passphrase to clipboard" })
      .click();

    const region = page.getByRole("region", { name: "Notifications" });
    await expect(
      region.getByText("Passphrase copied to your clipboard."),
    ).toBeVisible();

    const clip = await page.evaluate(() => navigator.clipboard.readText());
    expect(clip).toBe(value);
  });
});
