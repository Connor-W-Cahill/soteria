import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { DEV_CSP, PROD_CSP, STATIC_HEADERS } from "./csp.mjs";
import { swaConfig } from "./scripts/gen-swa-config.mjs";

function directives(csp: string): Map<string, string[]> {
  return new Map(
    csp.split(";").map((part) => {
      const [name, ...values] = part.trim().split(/\s+/);
      return [name, values];
    }),
  );
}

describe("production CSP", () => {
  const prod = directives(PROD_CSP);

  it("limits connect-src to the app origin and HIBP, and nothing else", () => {
    expect(prod.get("connect-src")).toEqual([
      "'self'",
      "https://api.pwnedpasswords.com",
    ]);
  });

  it("allows no inline or remote script", () => {
    expect(prod.get("script-src")).toEqual(["'self'"]);
  });

  it("carries the hardening directives from the issue", () => {
    expect(prod.get("default-src")).toEqual(["'self'"]);
    expect(prod.get("object-src")).toEqual(["'none'"]);
    expect(prod.get("base-uri")).toEqual(["'none'"]);
    expect(prod.get("frame-ancestors")).toEqual(["'none'"]);
  });

  it("names the font origins actually used by the client", () => {
    // index.html loads the stylesheet from googleapis and the faces from gstatic.
    expect(prod.get("style-src")).toContain("https://fonts.googleapis.com");
    expect(prod.get("font-src")).toContain("https://fonts.gstatic.com");
  });

  it("has no dev-only allowance", () => {
    expect(PROD_CSP).not.toContain("unsafe-inline");
    expect(PROD_CSP).not.toContain("ws:");
    expect(PROD_CSP).not.toContain("localhost");
    expect(PROD_CSP).not.toMatch(/\*/);
  });
});

describe("dev CSP", () => {
  it("keeps the same third-party connect-src allowlist as production", () => {
    const dev = directives(DEV_CSP).get("connect-src") ?? [];
    // Everything prod allows, dev also allows; dev adds only localhost/ws.
    for (const source of directives(PROD_CSP).get("connect-src") ?? []) {
      expect(dev).toContain(source);
    }
    expect(
      dev.filter(
        (s) => !s.startsWith("ws://") && !s.startsWith("http://localhost"),
      ),
    ).toEqual(["'self'", "https://api.pwnedpasswords.com"]);
  });

  it("adds inline allowances only where Vite needs them", () => {
    const dev = directives(DEV_CSP);
    expect(dev.get("script-src")).toContain("'unsafe-inline'");
    expect(dev.get("style-src")).toContain("'unsafe-inline'");
  });
});

describe("staticwebapp.config.json", () => {
  const committed = readFileSync(
    fileURLToPath(
      new URL("./public/staticwebapp.config.json", import.meta.url),
    ),
    "utf8",
  );

  it("serves the production CSP verbatim", () => {
    const parsed = JSON.parse(committed);
    expect(parsed.globalHeaders["content-security-policy"]).toBe(PROD_CSP);
  });

  it("matches gen-swa-config.mjs (run `npm run csp:gen` if this fails)", () => {
    expect(JSON.parse(committed)).toEqual(swaConfig);
  });

  it("sends the deployed document the same hardening headers as helmet does for the API", () => {
    expect(STATIC_HEADERS["x-content-type-options"]).toBe("nosniff");
    expect(STATIC_HEADERS["referrer-policy"]).toBe("no-referrer");
  });
});
