import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { segmentPassphrase } from "./support/passphrase";

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
    const origins = new Set<string>();
    // The parts of a request that can carry data the page chose to send, as
    // opposed to a path or query fixed by the build. Kept as a set so the
    // baseline snapshot below can subtract the ones the app shell always makes.
    const carriers = new Set<string>();
    context.on("request", (req) => {
      const url = new URL(req.url());
      origins.add(url.origin);
      requests.push(`${req.method()} ${req.url()} ${req.postData() ?? ""}`);
      carriers.add(`${url.search} ${url.hash} ${req.postData() ?? ""}`);
    });

    await page.goto("/password-tools");
    const card = ppgen(page);
    const output = card.getByLabel("Generated passphrase");
    await expect(output).toHaveValue("");

    // Everything requested up to this point is the app shell loading itself:
    // module graph, fonts, icons. Those URLs are fixed by the build, so they are
    // the baseline the word-level assertion subtracts. Snapshotting instead of
    // hand-listing them is what keeps that assertion from flaking (#101): the
    // font stylesheet's own query string contains the wordlist entries
    // "display", "family" and "unit" (inside "Nunito"), and Vite's asset paths
    // contain "theme" and "runt". A hand-written allowlist would have to
    // enumerate those forever; a baseline cannot go stale.
    await page.waitForLoadState("networkidle");
    const baseline = new Set(carriers);

    await card.getByRole("slider").fill("5");
    await card.getByRole("button", { name: "Generate" }).click();

    const seen = new Set<string>();
    for (let i = 0; i < 6; i++) {
      await card.getByRole("button", { name: "Generate" }).click();
      const value = await output.inputValue();
      // Not value.split("-").length: hyphenated wordlist entries make that
      // count wrong (#102). Segmenting also proves each word is a list entry.
      expect(segmentPassphrase(value, "-", 5), value).not.toBeNull();
      expect(value).toMatch(/^[a-z-]+(-[a-z-]+){4}$/);
      seen.add(value);
    }
    expect(seen.size).toBeGreaterThan(1);

    // Let any in-flight request settle, then assert none carried a passphrase.
    await page.waitForLoadState("networkidle");

    // The page talks to its own origin and the two Google Fonts origins the app
    // shell loads, and nowhere else. This is what actually forecloses
    // exfiltration to a stranger: with no third-party request, there is no
    // channel out regardless of how the data were encoded. The font origins are
    // allow-listed by exact origin, so a beacon to any other host fails here —
    // the same allowlist e2e/support/anonymity.ts uses, minus HIBP, which the
    // passphrase generator never contacts.
    const novel = [...carriers].filter((carrier) => !baseline.has(carrier));

    const allowed = new Set([
      new URL(page.url()).origin,
      "https://fonts.googleapis.com",
      "https://fonts.gstatic.com",
    ]);
    expect([...origins].filter((origin) => !allowed.has(origin))).toEqual([]);

    for (const value of seen) {
      // A five-word phrase is a distinctive token, so the whole request line —
      // method, full URL and body — can be searched for it with no risk of a
      // coincidental match.
      for (const entry of requests) {
        expect(entry, entry).not.toContain(value);
      }

      // Individual words are ordinary English, so matching them against whole
      // request lines produces false positives (see the baseline comment above).
      // They are matched only against query string, hash and body — the channels
      // a page fills in per request — and only for carriers that did not already
      // appear while the shell was loading. Exfiltration by URL path, or to a
      // third party, is foreclosed by the whole-phrase and origin assertions
      // rather than by this one.
      for (const word of value.split("-")) {
        if (word.length < 4) continue;
        for (const carrier of novel) {
          expect(carrier, carrier).not.toContain(word);
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
    expect(segmentPassphrase(plain, "-", 3), plain).not.toBeNull();
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
