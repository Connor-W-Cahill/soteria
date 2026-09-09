import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/**
 * US-04: the password analysis surface shows strength and breach status as two
 * separate cards, and a strong-but-breached password is unmistakably unsafe.
 *
 * SHA-1("correct-horse-battery-staple-9x") =
 *   C34C282E5F8F17390301C29696D4EEDB60A6D81B
 * zxcvbn scores that password 4 ("Strong"). The suffix below is used to fake a
 * HIBP hit for it.
 */
const STRONG = "correct-horse-battery-staple-9x";
const STRONG_SUFFIX = "82E5F8F17390301C29696D4EEDB60A6D81B";

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

/** Fake HIBP: `hit` true → the password's suffix is present with a real count. */
async function stubHibp(page: import("@playwright/test").Page, hit: boolean) {
  await page.route("https://api.pwnedpasswords.com/**", async (route) => {
    const body = hit
      ? [`${STRONG_SUFFIX}:24051`, "0018A45C4D1DEF81644B54AB7F969B88D65:0"]
      : ["0018A45C4D1DEF81644B54AB7F969B88D65:0"];
    await route.fulfill({
      status: 200,
      contentType: "text/plain",
      body: body.join("\r\n"),
    });
  });
}

async function run(page: import("@playwright/test").Page, value: string) {
  await page.goto("/password-tools");
  await page.getByLabel("Password to check").fill(value);
  await page.getByRole("button", { name: "Check password" }).click();
}

test.describe("US-04 password analysis", () => {
  test("shows two separately titled result cards", async ({ page }) => {
    await stubHibp(page, false);
    await run(page, STRONG);

    await expect(
      page.getByRole("heading", { name: "Strength (estimated locally)" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", {
        name: "Breach status (from Have I Been Pwned)",
      }),
    ).toBeVisible();
  });

  test("a strong BUT breached password is flagged unsafe", async ({ page }) => {
    await stubHibp(page, true);
    await run(page, STRONG);

    // The breach card confirms the hit and the strength card still says Strong…
    await expect(page.getByText("Found in known breaches")).toBeVisible();
    await expect(
      page.locator(".pw-analysis__card", { hasText: "Strength" }),
    ).toContainText("Strong");

    // …and the overall verdict is unambiguously "do not use".
    const verdict = page.locator(".pw-verdict");
    await expect(verdict).toHaveClass(/pw-verdict--unsafe/);
    await expect(verdict).toContainText("Do not use this password");
    await expect(verdict).toContainText(
      "A good strength score does not change that",
    );
  });

  test("a strong, unbreached password reads as strong", async ({ page }) => {
    await stubHibp(page, false);
    await run(page, STRONG);

    const verdict = page.locator(".pw-verdict");
    await expect(verdict).toHaveClass(/pw-verdict--ok/);
    await expect(verdict).toContainText("This password looks strong");
    await expect(page.getByText("Not found in known breaches")).toBeVisible();
  });

  test("a strong password is never called safe when breach status is unknown", async ({
    page,
  }) => {
    // HIBP is down: strength is known (Strong) but breach status is absent.
    await page.route("https://api.pwnedpasswords.com/**", (route) =>
      route.fulfill({ status: 503, body: "" }),
    );
    await run(page, STRONG);

    await expect(
      page.locator(".pw-analysis__card").filter({
        has: page.getByRole("heading", {
          name: "Strength (estimated locally)",
        }),
      }),
    ).toContainText("Strong");

    const verdict = page.locator(".pw-verdict");
    await expect(verdict).not.toHaveClass(/pw-verdict--ok/);
    await expect(verdict).toContainText("Breach status could not be checked");
    await expect(verdict).not.toContainText("looks strong");
    await expect(page.getByText("Breach status unavailable")).toBeVisible();
  });

  test("a weak, unbreached password reads as weak with suggestions", async ({
    page,
  }) => {
    await stubHibp(page, false);
    await run(page, "password");

    const verdict = page.locator(".pw-verdict");
    await expect(verdict).toHaveClass(/pw-verdict--weak/);
    await expect(verdict).toContainText("This password is weak");
    await expect(
      page.locator(".pw-analysis__card", { hasText: "Strength" }),
    ).toContainText("To make it stronger:");
  });

  test("the strength check makes no request beyond the HIBP range call", async ({
    page,
  }) => {
    const external: string[] = [];
    page.on("request", (request) => {
      const url = request.url();
      const local =
        url.startsWith("http://localhost") ||
        url.startsWith("http://127.0.0.1") ||
        url.startsWith("data:") ||
        url.startsWith("blob:") ||
        url.startsWith("https://fonts.googleapis.com") ||
        url.startsWith("https://fonts.gstatic.com");
      if (!local) external.push(`${request.method()} ${url}`);
    });

    await stubHibp(page, false);
    await run(page, STRONG);
    await expect(page.getByText("Not found in known breaches")).toBeVisible();

    expect(external).toHaveLength(1);
    expect(external[0]).toMatch(
      /^GET https:\/\/api\.pwnedpasswords\.com\/range\/[0-9A-F]{5}$/,
    );
    // Nothing anywhere carried the password.
    for (const entry of external) expect(entry).not.toContain(STRONG);
  });

  for (const theme of ["light", "dark"] as const) {
    test(`no axe violations with results shown (${theme})`, async ({
      page,
    }) => {
      await stubHibp(page, true);
      await run(page, STRONG);
      await expect(page.getByText("Found in known breaches")).toBeVisible();

      if (theme === "dark") {
        await page.evaluate(() => {
          localStorage.setItem("soteria-theme", "dark");
          document.documentElement.dataset.theme = "dark";
        });
      }

      const results = await new AxeBuilder({ page }).withTags(WCAG).analyze();
      expect(results.violations).toEqual([]);
    });
  }

  test("no horizontal scroll with results shown", async ({ page }) => {
    await stubHibp(page, true);
    await run(page, STRONG);
    await expect(page.getByText("Found in known breaches")).toBeVisible();

    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    );
    expect(overflow).toBe(false);
  });
});
