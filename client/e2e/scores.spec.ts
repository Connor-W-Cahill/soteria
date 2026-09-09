import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

/**
 * `/scores` (US-17), from the browser's side.
 *
 * There is no API in the e2e environment, so `/api/scores` is fulfilled with
 * fixtures. That is the point here: the arithmetic is covered exhaustively by
 * `shared/src/scoring/engine.test.ts`, and what these tests pin is the thing only
 * a browser can show — that the page renders five cards, that a missing score
 * does not become a zero, and that a provisional category says so.
 *
 * `/scores` is behind `RequireSession`, so every test presets the session hint
 * and fulfils `/api/me`. Without both, `RequireSession` redirects to `/signin`
 * and the assertions would be made against the wrong page.
 */
const CATEGORY_NAMES = [
  "Password habits",
  "Breach preparedness",
  "Multi-factor authentication",
  "Software exposure",
  "Update habits",
];

const USER = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "person@example.com",
  displayName: "A Person",
};

function categoryScores(
  overrides: Partial<
    Record<string, { score: number | null; provisional?: boolean }>
  > = {},
) {
  const keys = [
    "password_hygiene",
    "breach_preparedness",
    "multifactor_authentication",
    "software_exposure",
    "update_habits",
  ] as const;

  return keys.map((key) => {
    const override = overrides[key];

    return {
      key,
      score: override === undefined ? 80 : override.score,
      answered: 3,
      total: 3,
      provisional: override?.provisional ?? key === "software_exposure",
      contributions: [
        {
          sourceId: `${key}_q1`,
          label: "A question",
          delta: 3,
          maxDelta: 4,
          reason: "You answered something worth 3 of 4 points here.",
        },
      ],
    };
  });
}

async function signedInWithScores(
  page: Page,
  body: Record<string, unknown>,
): Promise<void> {
  await page.route("**/api/me", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ user: USER }),
    }),
  );
  await page.route("**/api/scores", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    }),
  );
  await page.addInitScript(() => {
    window.localStorage.setItem("soteria.session-hint", "1");
  });
}

test.describe("US-17 posture scores", () => {
  test("shows five category cards and the overall score", async ({ page }) => {
    await signedInWithScores(page, {
      categories: categoryScores(),
      overall: 80,
      provisional: true,
      version: "1.0.0",
      updatedAt: "2026-09-09T12:00:00.000Z",
    });

    await page.goto("/scores");

    await expect(
      page.getByRole("heading", { name: "Your posture score", exact: true }),
    ).toBeVisible();

    for (const name of CATEGORY_NAMES) {
      await expect(page.getByText(name, { exact: true })).toBeVisible();
    }

    await expect(page.getByText("out of 100")).toBeVisible();
  });

  test("renders a missing score as an em dash, never as a zero", async ({
    page,
  }) => {
    // The distinction the engine works to preserve must survive to the screen: a
    // user who has answered nothing in a category must not be shown a 0.
    await signedInWithScores(page, {
      categories: categoryScores({
        update_habits: { score: null },
      }).map((category) =>
        category.key === "update_habits"
          ? { ...category, answered: 0, contributions: [] }
          : category,
      ),
      overall: 60,
      provisional: true,
      version: "1.0.0",
      updatedAt: "2026-09-09T12:00:00.000Z",
    });

    await page.goto("/scores");

    const card = page
      .locator(".sot-spark")
      .filter({ hasText: "Update habits" });

    await expect(card).toContainText("—");
    await expect(card).not.toContainText("0");
    await expect(card).toContainText(/not answered yet/i);
  });

  test("says when a category is provisional", async ({ page }) => {
    await signedInWithScores(page, {
      categories: categoryScores(),
      overall: 80,
      provisional: true,
      version: "1.0.0",
      updatedAt: "2026-09-09T12:00:00.000Z",
    });

    await page.goto("/scores");

    await expect(
      page.locator(".sot-spark").filter({ hasText: "Software exposure" }),
    ).toContainText(/provisional/i);
    await expect(page.getByRole("note")).toContainText(
      /known vulnerabilities in the software you list/i,
    );
  });

  test("offers the questionnaire when there is no score yet", async ({
    page,
  }) => {
    await signedInWithScores(page, {
      categories: categoryScores({
        password_hygiene: { score: null },
        breach_preparedness: { score: null },
        multifactor_authentication: { score: null },
        software_exposure: { score: null },
        update_habits: { score: null },
      }),
      overall: null,
      provisional: true,
      version: null,
      updatedAt: null,
    });

    await page.goto("/scores");

    await expect(
      page.getByRole("heading", { name: /no score yet/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /start the questionnaire/i }),
    ).toBeVisible();
  });

  test("offers a retry when the scores cannot be loaded", async ({ page }) => {
    await page.route("**/api/me", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ user: USER }),
      }),
    );
    await page.route("**/api/scores", (route) =>
      route.fulfill({ status: 500, body: "{}" }),
    );
    await page.addInitScript(() => {
      window.localStorage.setItem("soteria.session-hint", "1");
    });

    await page.goto("/scores");

    await expect(page.getByRole("alert")).toContainText(/could not be loaded/i);
    await expect(
      page.getByRole("button", { name: /try again/i }),
    ).toBeVisible();
  });

  test("redirects a signed-out visitor to sign in", async ({ page }) => {
    await page.goto("/scores");

    await expect(page).toHaveURL(/\/signin\?next=%2Fscores$/);
  });

  for (const theme of ["light", "dark"] as const) {
    test(`has no axe violations (${theme})`, async ({ page }) => {
      await signedInWithScores(page, {
        categories: categoryScores(),
        overall: 80,
        provisional: true,
        version: "1.0.0",
        updatedAt: "2026-09-09T12:00:00.000Z",
      });

      await page.goto("/scores");

      if (theme === "dark") {
        await page.evaluate(() => {
          document.documentElement.dataset.theme = "dark";
        });
      }

      await expect(
        page.getByRole("heading", { name: "Your posture score", exact: true }),
      ).toBeVisible();

      const results = await new AxeBuilder({ page }).withTags(WCAG).analyze();

      expect(results.violations).toEqual([]);
    });
  }

  test("no horizontal scroll at 375px", async ({ page }) => {
    await signedInWithScores(page, {
      categories: categoryScores(),
      overall: 80,
      provisional: true,
      version: "1.0.0",
      updatedAt: "2026-09-09T12:00:00.000Z",
    });

    await page.setViewportSize({ width: 375, height: 780 });
    await page.goto("/scores");

    await expect(
      page.getByRole("heading", { name: "Your posture score", exact: true }),
    ).toBeVisible();

    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    );

    expect(overflow).toBe(false);
  });
});

/**
 * US-18 — the disclosure of what makes up each category score.
 *
 * The arithmetic and the reason strings are the engine's; these tests pin the
 * browser-only behaviour: that a real disclosure button toggles `aria-expanded`,
 * that the reason strings reach the screen verbatim, that the improvement hint
 * links somewhere, and that the `no_cve_data` note is not rendered as
 * "0 of 0 points".
 */
function scoresWithContributions() {
  return categoryScores().map((category) => {
    if (category.key === "password_hygiene") {
      return {
        ...category,
        score: 50,
        contributions: [
          {
            sourceId: "pw_reuse",
            label: "How do you handle passwords across your accounts?",
            delta: 1,
            maxDelta: 4,
            reason:
              'You answered "A few passwords I reuse", worth 1 of 4 points here.',
          },
          {
            sourceId: "pw_length",
            label: "How long are the passwords you choose?",
            delta: 4,
            maxDelta: 4,
            reason:
              'You answered "16 characters or more", which is the strongest option for this question.',
          },
        ],
      };
    }

    if (category.key === "software_exposure") {
      return {
        ...category,
        contributions: [
          {
            sourceId: "sw_auto_update",
            label: "Are automatic updates enabled on your main computer?",
            delta: 2,
            maxDelta: 4,
            reason:
              'You answered "For the operating system only", worth 2 of 4 points here.',
          },
          {
            sourceId: "software_exposure.no_cve_data",
            label: "Known vulnerabilities in your software",
            delta: 0,
            maxDelta: 0,
            reason:
              "This category will also account for known vulnerabilities affecting the software you list. That check is not part of this build yet, so this score reflects your answers only.",
          },
        ],
      };
    }

    return category;
  });
}

const CONTRIB_BODY = {
  categories: scoresWithContributions(),
  overall: 70,
  provisional: true,
  version: "1.0.0",
  updatedAt: "2026-09-09T12:00:00.000Z",
};

test.describe("US-18 score contribution disclosure", () => {
  test("each card discloses its contributions behind a button", async ({
    page,
  }) => {
    await signedInWithScores(page, CONTRIB_BODY);
    await page.goto("/scores");

    const card = page
      .locator(".sot-spark")
      .filter({ hasText: "Password habits" });
    const toggle = card.getByRole("button", {
      name: /how this score is calculated/i,
    });

    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(
      card.getByText('You answered "A few passwords I reuse", worth 1 of 4'),
    ).toBeHidden();

    await toggle.click();

    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(
      card.getByText(
        'You answered "A few passwords I reuse", worth 1 of 4 points here.',
        { exact: true },
      ),
    ).toBeVisible();
    await expect(
      card.getByText("1 of 4 points", { exact: true }),
    ).toBeVisible();
    await expect(
      card.getByRole("link", { name: /open the password tools/i }),
    ).toBeVisible();
    // The perfect answer is flagged, not linked to an improvement.
    await expect(card.getByText(/already the strongest answer/i)).toBeVisible();
  });

  test("the button controls the panel it toggles", async ({ page }) => {
    await signedInWithScores(page, CONTRIB_BODY);
    await page.goto("/scores");

    const card = page
      .locator(".sot-spark")
      .filter({ hasText: "Password habits" });
    const toggle = card.getByRole("button", {
      name: /how this score is calculated/i,
    });

    const panelId = await toggle.getAttribute("aria-controls");
    expect(panelId).toBeTruthy();

    const panel = page.locator(`[id="${panelId}"]`);
    await expect(panel).toBeHidden();

    await toggle.click();
    await expect(panel).toBeVisible();
  });

  test("opens with Enter and closes with Space", async ({ page }) => {
    await signedInWithScores(page, CONTRIB_BODY);
    await page.goto("/scores");

    const toggle = page
      .locator(".sot-spark")
      .filter({ hasText: "Password habits" })
      .getByRole("button", { name: /how this score is calculated/i });

    await toggle.focus();
    await page.keyboard.press("Enter");
    await expect(toggle).toHaveAttribute("aria-expanded", "true");

    await page.keyboard.press(" ");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  test("renders the no-CVE-data note as a note, not as 0 of 0 points", async ({
    page,
  }) => {
    await signedInWithScores(page, CONTRIB_BODY);
    await page.goto("/scores");

    const card = page
      .locator(".sot-spark")
      .filter({ hasText: "Software exposure" });

    await card
      .getByRole("button", { name: /how this score is calculated/i })
      .click();

    await expect(
      card.getByText(/known vulnerabilities affecting the software you list/i),
    ).toBeVisible();
    await expect(card.getByText(/0 of 0 points/)).toHaveCount(0);
  });

  for (const theme of ["light", "dark"] as const) {
    test(`stays axe-clean with a panel open (${theme})`, async ({ page }) => {
      await signedInWithScores(page, CONTRIB_BODY);
      await page.goto("/scores");

      if (theme === "dark") {
        await page.evaluate(() => {
          document.documentElement.dataset.theme = "dark";
        });
      }

      await page
        .locator(".sot-spark")
        .filter({ hasText: "Password habits" })
        .getByRole("button", { name: /how this score is calculated/i })
        .click();

      await expect(
        page.getByText(/already the strongest answer/i),
      ).toBeVisible();

      const results = await new AxeBuilder({ page }).withTags(WCAG).analyze();

      expect(results.violations).toEqual([]);
    });
  }

  test("no horizontal scroll at 375px with a panel open", async ({ page }) => {
    await signedInWithScores(page, CONTRIB_BODY);
    await page.setViewportSize({ width: 375, height: 780 });
    await page.goto("/scores");

    await page
      .locator(".sot-spark")
      .filter({ hasText: "Software exposure" })
      .getByRole("button", { name: /how this score is calculated/i })
      .click();

    await expect(
      page.getByText(/known vulnerabilities affecting the software you list/i),
    ).toBeVisible();

    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    );

    expect(overflow).toBe(false);
  });
});
