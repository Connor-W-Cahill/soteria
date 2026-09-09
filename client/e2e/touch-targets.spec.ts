import { expect, test } from "@playwright/test";

/**
 * DESIGN_SEED.md:48 — "Touch targets at least 44x44px at widths below 768px" —
 * and :34 — "Inputs 36px tall on desktop, 44px on touch".
 *
 * Measured against the real rendered page, because axe cannot catch this: WCAG
 * 2.2 AA Target Size (Minimum) is only 24px, so a page can be axe-clean and still
 * violate the seed (#82).
 */

const MIN = 44;
const TOUCH = { width: 375, height: 780 };
const ROUTES = ["/password-tools", "/learn/password-privacy", "/dev/kit"];

test.describe("touch targets below 768px", () => {
  test.use({ viewport: TOUCH });

  for (const route of ROUTES) {
    test(`controls are at least ${MIN}x${MIN} on ${route}`, async ({
      page,
    }) => {
      await page.goto(route);

      // Wait for the ROUTE to render, not just the shell. Without this the
      // enumeration below races the router and sees only the app shell's own
      // buttons — which made the first version of this test miss every control
      // on the page it was supposed to be checking.
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

      const controls = page.locator(
        "button:visible, input:not([type=hidden]):visible, select:visible",
      );
      const count = await controls.count();

      // Guard against the assertion loop passing because it found nothing.
      expect(count).toBeGreaterThan(0);

      const undersized: string[] = [];

      for (let i = 0; i < count; i++) {
        const control = controls.nth(i);

        // The thing a finger has to hit is not always the element itself. A
        // checkbox or radio renders an 18px box, but its clickable target is the
        // label wrapping it, so that is what the seed's 44px applies to. For
        // everything else the element is its own target.
        const box = await control.evaluate((el) => {
          const input = el as HTMLInputElement;
          const usesLabel =
            el.tagName === "INPUT" &&
            (input.type === "checkbox" || input.type === "radio");
          const target = usesLabel ? (el.closest("label") ?? el) : el;
          const rect = target.getBoundingClientRect();

          return { width: rect.width, height: rect.height };
        });

        if (box.height < MIN || box.width < MIN) {
          const label =
            (await control.getAttribute("aria-label")) ??
            (await control.getAttribute("name")) ??
            (await control.getAttribute("type")) ??
            (await control.innerText().catch(() => "")) ??
            "";

          undersized.push(
            `${await control.evaluate((el) => el.tagName.toLowerCase())}` +
              `[${label.trim().slice(0, 40)}] ${Math.round(box.width)}x${Math.round(box.height)}`,
          );
        }
      }

      expect(undersized, `undersized controls on ${route}`).toEqual([]);
    });
  }

  /**
   * Anti-vacuity check for the loop above. The generic enumeration once raced the
   * router and measured only the app shell, so it passed while every control on
   * the page was 36px. This names the three controls #82 measured, so the suite
   * fails if they stop being reached rather than silently checking nothing.
   */
  test("the breach checker's own controls are among those measured", async ({
    page,
  }) => {
    await page.goto("/password-tools");

    for (const control of [
      page.getByLabel("Password to check"),
      page.getByRole("button", { name: "Show password" }),
      page.getByRole("button", { name: "Check password" }),
    ]) {
      const box = await control.boundingBox();

      expect(box).not.toBeNull();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(MIN);
      expect(box?.width ?? 0).toBeGreaterThanOrEqual(MIN);
    }
  });

  test("the desktop control height is unchanged above the breakpoint", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/password-tools");

    const height = await page.evaluate(() =>
      getComputedStyle(document.documentElement)
        .getPropertyValue("--control-height")
        .trim(),
    );

    expect(height).toBe("36px");
  });
});
