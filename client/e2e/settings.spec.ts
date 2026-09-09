import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

const SESSION_HINT_KEY = "soteria.session-hint";
const USER = {
  id: "00000000-0000-4000-8000-000000000000",
  email: "leaving@example.com",
  displayName: "Leaving Soon",
};

/**
 * US-20 delete account, from the browser's side.
 *
 * There is no real database here: `/api/me` and `DELETE /api/me` are stubbed so
 * the test exercises what Soteria's client controls — the route guard, the
 * typed confirmation, the copy that must appear, and where the user lands after
 * a delete. The revocation order and the cascade are covered on the server by
 * `server/src/account/routes.test.ts` and `delete.integration.test.ts`.
 */
test.describe("US-20 delete account", () => {
  test("an anonymous visitor to /settings is sent to sign in", async ({
    page,
  }) => {
    await page.goto("/settings");

    await expect(page).toHaveURL(/\/signin\?next=%2Fsettings$/);
  });

  test.describe("with a session", () => {
    test.beforeEach(async ({ page }) => {
      await page.addInitScript((key: string) => {
        window.localStorage.setItem(key, "1");
      }, SESSION_HINT_KEY);

      await page.route("**/api/me", async (route) => {
        if (route.request().method() === "DELETE") {
          await route.fulfill({ status: 204, body: "" });
          return;
        }
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ user: USER }),
        });
      });
      // The local sign-out cleanup posts here; it must not 404 the run.
      await page.route("**/api/auth/logout", (route) =>
        route.fulfill({ status: 204, body: "" }),
      );
    });

    test("states what is deleted and that HIBP must be cancelled directly", async ({
      page,
    }) => {
      await page.goto("/settings");
      await page
        .getByRole("button", { name: "Delete account and all data" })
        .click();

      const dialog = page.getByRole("dialog");
      await expect(dialog).toContainText(/questionnaire answers/i);
      await expect(dialog).toContainText(/recommendations/i);
      await expect(dialog).toContainText(/Have I Been Pwned/i);
      await expect(
        dialog.getByRole("link", { name: /haveibeenpwned/i }),
      ).toHaveAttribute("href", /haveibeenpwned\.com/);
    });

    test("unlocks the delete only after DELETE is typed, then lands on the tools", async ({
      page,
    }) => {
      await page.goto("/settings");
      await page
        .getByRole("button", { name: "Delete account and all data" })
        .click();

      const confirm = page.getByRole("button", {
        name: "Delete account",
        exact: true,
      });
      await expect(confirm).toBeDisabled();

      await page.getByLabel(/Type DELETE to confirm/i).fill("delete");
      await expect(confirm).toBeDisabled();

      await page.getByLabel(/Type DELETE to confirm/i).fill("DELETE");
      await expect(confirm).toBeEnabled();

      await confirm.click();

      await expect(page).toHaveURL(/\/password-tools$/);
    });

    test("has no axe violations", async ({ page }) => {
      await page.goto("/settings");
      const results = await new AxeBuilder({ page }).withTags(WCAG).analyze();

      expect(results.violations).toEqual([]);
    });
  });
});
