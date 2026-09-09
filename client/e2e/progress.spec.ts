import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

/**
 * `/progress` (US-19), from the browser's side.
 *
 * `/progress` is behind `RequireSession`, so every test presets the session hint
 * and fulfils `/api/me` — without both, `RequireSession` redirects to `/signin`
 * and the assertions would run against the wrong page.
 *
 * The API is stubbed: what these tests pin is browser-only behaviour — that the
 * SVG trend has a real table alternative reachable by the toggle, that the
 * change log renders, and that both themes are axe-clean.
 */
const USER = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "person@example.com",
  displayName: "A Person",
};

function historyBody() {
  const series = (key: string, points: [string, number][]) => ({
    key,
    points: points.map(([capturedAt, score]) => ({
      capturedAt,
      score,
      rationale: `${score} says hi`,
    })),
  });

  const categories = [
    series("password_hygiene", [
      ["2026-08-01T09:00:00.000Z", 40],
      ["2026-08-20T09:00:00.000Z", 66],
    ]),
    series("breach_preparedness", [["2026-08-20T09:00:00.000Z", 55]]),
    series("multifactor_authentication", [
      ["2026-08-01T09:00:00.000Z", 30],
      ["2026-08-20T09:00:00.000Z", 42],
    ]),
    series("software_exposure", []),
    series("update_habits", [["2026-08-01T09:00:00.000Z", 70]]),
  ];

  return {
    days: 90,
    since: "2026-06-11T00:00:00.000Z",
    categories,
    changes: [
      {
        capturedAt: "2026-08-20T09:00:00.000Z",
        deltas: [
          { key: "password_hygiene", from: 40, to: 66, delta: 26 },
          { key: "multifactor_authentication", from: 30, to: 42, delta: 12 },
        ],
      },
    ],
  };
}

async function signedIn(
  page: Page,
  history: Record<string, unknown> | number,
): Promise<void> {
  await page.route("**/api/me", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ user: USER }),
    }),
  );
  await page.route("**/api/scores/history**", (route) =>
    typeof history === "number"
      ? route.fulfill({ status: history, body: "{}" })
      : route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(history),
        }),
  );
  await page.addInitScript(() => {
    window.localStorage.setItem("soteria.session-hint", "1");
  });
}

test.describe("US-19 progress", () => {
  test("redirects a signed-out visitor to sign in", async ({ page }) => {
    await page.goto("/progress");
    await expect(page).toHaveURL(/\/signin\?next=%2Fprogress$/);
  });

  test("shows the trend and toggles to a data table", async ({ page }) => {
    await signedIn(page, historyBody());
    await page.goto("/progress");

    await expect(
      page.getByRole("heading", { name: "Your progress", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Trend", exact: true }),
    ).toBeVisible();

    // The table is the screen-reader-facing content; it must exist and be
    // reachable, and it must have an accessible name.
    const toggle = page.getByRole("button", { name: /show as table/i });
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    await toggle.click();

    const table = page.getByRole("table", {
      name: /posture score history/i,
    });
    await expect(table).toBeVisible();
    await expect(
      table.getByRole("columnheader", { name: "Password habits" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /show charts/i }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  test("renders the change log in words", async ({ page }) => {
    await signedIn(page, historyBody());
    await page.goto("/progress");

    await expect(
      page.getByRole("heading", { name: "Change log", exact: true }),
    ).toBeVisible();
    await expect(page.getByText(/40 → 66/)).toBeVisible();
    await expect(page.getByText(/\+26 improvement/)).toBeVisible();
    await expect(page.getByText(/\+12 improvement/)).toBeVisible();
  });

  test("shows an empty state when there is no history", async ({ page }) => {
    await signedIn(page, {
      days: 90,
      since: "2026-06-11T00:00:00.000Z",
      categories: [
        "password_hygiene",
        "breach_preparedness",
        "multifactor_authentication",
        "software_exposure",
        "update_habits",
      ].map((key) => ({ key, points: [] })),
      changes: [],
    });
    await page.goto("/progress");

    await expect(
      page.getByRole("heading", { name: /no history yet/i }),
    ).toBeVisible();
  });

  test("shows a retry when history cannot be loaded", async ({ page }) => {
    await signedIn(page, 500);
    await page.goto("/progress");

    await expect(page.getByRole("alert")).toContainText(/could not be loaded/i);
    await expect(
      page.getByRole("button", { name: /try again/i }),
    ).toBeVisible();
  });

  for (const theme of ["light", "dark"] as const) {
    test(`has no axe violations (${theme})`, async ({ page }) => {
      await signedIn(page, historyBody());
      await page.goto("/progress");

      await expect(
        page.getByRole("heading", { name: "Your progress", exact: true }),
      ).toBeVisible();

      if (theme === "dark") {
        await page.evaluate(() => {
          document.documentElement.dataset.theme = "dark";
        });
      }

      const chartView = await new AxeBuilder({ page }).withTags(WCAG).analyze();
      expect(chartView.violations).toEqual([]);

      await page.getByRole("button", { name: /show as table/i }).click();
      const tableView = await new AxeBuilder({ page }).withTags(WCAG).analyze();
      expect(tableView.violations).toEqual([]);
    });
  }

  test("no horizontal scroll at 375px", async ({ page }) => {
    await signedIn(page, historyBody());
    await page.setViewportSize({ width: 375, height: 780 });
    await page.goto("/progress");

    await expect(
      page.getByRole("heading", { name: "Your progress", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: /show as table/i }).click();

    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    );
    expect(overflow).toBe(false);
  });
});
