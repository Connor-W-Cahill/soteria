import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { API_ORIGIN, DEV_CSP, PROD_CSP, STATIC_HEADERS } from "./csp.mjs";
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

  it("permits the API origin when it is a separate origin", () => {
    // Finding 2 of the US-14 security review: US-14 is the first feature whose
    // client must reach Soteria's own backend, and the pinned policy forbade it,
    // so every auth call was blocked before it was sent. The entry is derived
    // from VITE_API_URL, so it is empty — and 'self' suffices — once the API is
    // served from the document's origin.
    expect(API_ORIGIN.length).toBeLessThanOrEqual(1);

    for (const origin of API_ORIGIN) {
      expect(prod.get("connect-src")).toContain(origin);
    }
  });

  it("limits connect-src to the app origin, HIBP and Google sign-in, and nothing else", () => {
    // The exact list, not a `toContain`: this test exists to fail when a new
    // third-party origin is added, so that ADR-0007's promise is re-argued
    // rather than quietly widened. accounts.google.com was added by US-14 and
    // is justified in ADR-0008; it never receives password-derived data.
    expect(prod.get("connect-src")).toEqual([
      "'self'",
      ...API_ORIGIN,
      "https://api.pwnedpasswords.com",
      "https://accounts.google.com",
    ]);
  });

  it("is the only password-data destination in connect-src", () => {
    // The claim the privacy page makes: HIBP is the one third party that ever
    // sees anything derived from a password. Sign-in is a separate flow on a
    // separate page and carries no password material at all.
    const thirdParties = (prod.get("connect-src") ?? []).filter(
      (source) => source !== "'self'" && !API_ORIGIN.includes(source),
    );

    expect(thirdParties).toContain("https://api.pwnedpasswords.com");
    expect(thirdParties).toHaveLength(2);
  });

  it("allows no inline script, and remote script only from Google sign-in", () => {
    expect(prod.get("script-src")).toEqual([
      "'self'",
      "https://accounts.google.com",
    ]);
    expect(prod.get("script-src")).not.toContain("'unsafe-inline'");
  });

  it("frames only the Google sign-in origin", () => {
    expect(prod.get("frame-src")).toEqual(["https://accounts.google.com"]);
  });

  it("allows the fonts and Google sign-in stylesheets, and no others", () => {
    expect(prod.get("style-src")).toEqual([
      "'self'",
      "https://fonts.googleapis.com",
      "https://accounts.google.com",
    ]);
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
    ).toEqual([
      "'self'",
      ...API_ORIGIN,
      "https://api.pwnedpasswords.com",
      "https://accounts.google.com",
    ]);
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
