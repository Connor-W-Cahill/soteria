import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.describe("/dev/kit accessibility", () => {
  test("has no axe violations (light)", async ({ page }) => {
    await page.goto("/dev/kit");
    await expect(
      page.getByRole("heading", { name: "Design system kit" }),
    ).toBeVisible();
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(results.violations).toEqual([]);
  });

  test("has no axe violations (dark)", async ({ page }) => {
    await page.goto("/dev/kit");
    await page.evaluate(() => {
      localStorage.setItem("soteria-theme", "dark");
      document.documentElement.dataset.theme = "dark";
    });
    await page.reload();
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(results.violations).toEqual([]);
  });

  test("no horizontal scroll at 375px", async ({ page }) => {
    await page.goto("/dev/kit");
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    );
    expect(overflow).toBe(false);
  });
});
