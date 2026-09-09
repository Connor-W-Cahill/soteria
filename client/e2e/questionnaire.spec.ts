import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * US-16 posture questionnaire, from the browser's side.
 *
 * There is no backend in the e2e run (the web server is Vite alone), so the
 * session probe and `/api/questionnaire` are faked here. What Soteria's own code
 * has to get right — the multi-step flow, the progress indicator, keyboard
 * operability, save-and-resume, and no axe violations at either theme — is
 * exercised against the real component. The route guard and the PUT validation
 * are covered exactly by `server/src/questionnaire/routes.test.ts` and
 * `client/e2e/signin.spec.ts`.
 */

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

const USER = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "person@example.com",
  displayName: "A Person",
};

/** Install a fake session and a tiny in-memory `/api/questionnaire`. */
async function mockBackend(
  page: Page,
  initialAnswers: Record<string, string> = {},
) {
  const state = { answers: { ...initialAnswers } as Record<string, string> };

  await page.addInitScript(() => {
    try {
      window.localStorage.setItem("soteria.session-hint", "1");
    } catch {
      /* private window */
    }
  });

  await page.route("**/api/me", (route) =>
    route.fulfill({ json: { user: USER } }),
  );

  await page.route("**/api/questionnaire", async (route) => {
    const request = route.request();
    if (request.method() === "PUT") {
      const body = request.postDataJSON() as {
        answers: Record<string, string>;
      };
      state.answers = { ...state.answers, ...body.answers };
    }
    await route.fulfill({
      json: {
        version: Object.keys(state.answers).length > 0 ? "1.0.0" : null,
        answers: state.answers,
        updatedAt: new Date().toISOString(),
      },
    });
  });

  return state;
}

/** Pick the first real option in every visible <select> on the step. */
async function answerStep(page: Page) {
  await expect(page.locator(".sot-qz__heading")).toBeVisible();
  const selects = page.locator(".sot-qz__questions select");
  const count = await selects.count();
  expect(count).toBeGreaterThan(0);
  for (let i = 0; i < count; i++) {
    const select = selects.nth(i);
    const value = await select.locator("option").nth(1).getAttribute("value");
    await select.selectOption(value!);
  }
}

test.describe("US-16 posture questionnaire", () => {
  test("walks all five steps and saves", async ({ page }) => {
    await mockBackend(page);
    await page.goto("/questionnaire");

    await expect(
      page.getByRole("heading", { level: 1, name: "Posture questionnaire" }),
    ).toBeVisible();

    for (let step = 1; step <= 5; step++) {
      await expect(page.getByText(`Step ${step} of 5`)).toBeVisible();
      await answerStep(page);
      const label = step === 5 ? "Save answers" : "Next";
      await page.getByRole("button", { name: label }).click();
    }

    await expect(
      page.getByRole("heading", { name: /your answers are saved/i }),
    ).toBeVisible();
  });

  test("progress indicator advances with completed sections", async ({
    page,
  }) => {
    await mockBackend(page);
    await page.goto("/questionnaire");

    const bar = page.getByRole("progressbar", {
      name: "Questionnaire progress",
    });
    await expect(bar).toHaveAttribute("aria-valuenow", "0");

    await answerStep(page);
    await page.getByRole("button", { name: "Next" }).click();

    await expect(page.getByText("Step 2 of 5")).toBeVisible();
    await expect(bar).toHaveAttribute("aria-valuenow", "1");
  });

  test("is operable with the keyboard only", async ({ page }) => {
    await mockBackend(page);
    await page.goto("/questionnaire");
    await expect(page.getByText("Step 1 of 5")).toBeVisible();

    // Drive the selects and the Next button with the keyboard alone.
    const selects = page.locator(".sot-qz__questions select");
    const count = await selects.count();
    for (let i = 0; i < count; i++) {
      const select = selects.nth(i);
      await select.focus();
      await expect(select).toBeFocused();
      const value = await select.locator("option").nth(1).getAttribute("value");
      await select.selectOption(value!);
    }

    const next = page.getByRole("button", { name: "Next" });
    await next.focus();
    await expect(next).toBeFocused();
    await page.keyboard.press("Enter");

    await expect(page.getByText("Step 2 of 5")).toBeVisible();
    // Focus was moved to the new step's heading, not left on a vanished button.
    await expect(page.locator(".sot-qz__heading")).toBeFocused();
  });

  test("save-and-resume keeps answers across a reload", async ({ page }) => {
    await mockBackend(page);
    await page.goto("/questionnaire");

    await answerStep(page);
    await page.getByRole("button", { name: "Save & finish later" }).click();
    await expect(page.getByText(/progress saved/i)).toBeVisible();

    await page.reload();
    await expect(page.getByText("Step 1 of 5")).toBeVisible();

    // Every select on step 1 comes back with a chosen value.
    const selects = page.locator(".sot-qz__questions select");
    const count = await selects.count();
    for (let i = 0; i < count; i++) {
      await expect(selects.nth(i)).not.toHaveValue("");
    }
  });

  for (const theme of ["light", "dark"] as const) {
    test(`has no axe violations (${theme})`, async ({ page }) => {
      await mockBackend(page);
      await page.goto("/questionnaire");
      if (theme === "dark") {
        await page.evaluate(() => {
          document.documentElement.dataset.theme = "dark";
        });
      }
      await expect(page.getByText("Step 1 of 5")).toBeVisible();

      const before = await new AxeBuilder({ page })
        .include(".sot-qz-page")
        .withTags(WCAG)
        .analyze();
      expect(before.violations).toEqual([]);

      // Fill the step and re-check with the error/next states live.
      await answerStep(page);
      const after = await new AxeBuilder({ page })
        .include(".sot-qz-page")
        .withTags(WCAG)
        .analyze();
      expect(after.violations).toEqual([]);
    });
  }

  test("no horizontal scroll at 375px", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 780 });
    await mockBackend(page);
    await page.goto("/questionnaire");
    await answerStep(page);

    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    );
    expect(overflow).toBe(false);
  });

  test("controls are at least 44x44 below 768px", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 780 });
    await mockBackend(page);
    await page.goto("/questionnaire");
    await expect(page.getByText("Step 1 of 5")).toBeVisible();

    const controls = page.locator(
      ".sot-qz button:visible, .sot-qz select:visible",
    );
    const count = await controls.count();
    expect(count).toBeGreaterThan(0);

    const undersized: string[] = [];
    for (let i = 0; i < count; i++) {
      const box = await controls.nth(i).boundingBox();
      if (!box || box.height < 44 || box.width < 44) {
        undersized.push(
          `${await controls.nth(i).innerText()} ${Math.round(box?.width ?? 0)}x${Math.round(box?.height ?? 0)}`,
        );
      }
    }
    expect(undersized).toEqual([]);
  });
});
