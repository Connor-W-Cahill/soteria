import { describe, expect, it } from "vitest";

import { safeNext } from "./SignIn";

/**
 * `?next=` comes from the URL, so it is attacker-controlled. An unvalidated
 * redirect target would let a crafted Soteria link bounce a user to another site
 * immediately after they signed in — an open redirect that launders our origin's
 * credibility into someone else's page.
 */
describe("safeNext", () => {
  it("keeps an ordinary in-app path", () => {
    expect(safeNext("/dashboard")).toBe("/dashboard");
    expect(safeNext("/software?tab=all")).toBe("/software?tab=all");
  });

  it("falls back to the dashboard when absent", () => {
    expect(safeNext(null)).toBe("/dashboard");
    expect(safeNext("")).toBe("/dashboard");
  });

  for (const hostile of [
    "https://evil.example/steal",
    "http://evil.example",
    // Protocol-relative: the browser reads this as a different host.
    "//evil.example",
    // Backslashes: some browsers normalise these to forward slashes, so
    // "/\\evil.example" can become "//evil.example".
    "/\\evil.example",
    "/\\/evil.example",
    "\\\\evil.example",
    "javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "mailto:someone@example.com",
  ]) {
    it(`refuses ${JSON.stringify(hostile)}`, () => {
      expect(safeNext(hostile)).toBe("/dashboard");
    });
  }
});
