import { afterEach, describe, expect, it, vi } from "vitest";

import { checkPassword, sha1Hex } from "./breach-check.js";

const PASSWORD_SHA1 = "5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8";
const SUFFIX = PASSWORD_SHA1.slice(5);
// Node 22 and every supported browser expose Web Crypto as a global.
const subtle = globalThis.crypto.subtle;

// A secret that is not a substring of the HIBP URL, so "does the URL leak it?"
// assertions cannot pass or fail by accident. (The literal "password" is a
// substring of "pwnedpasswords.com".)
const SECRET = "hunter2-correct-horse";
const SECRET_SHA1 = "9D2AA6B9ABA710A78870C1B86FD2EAB218B8ECB3";

function respondWith(body: string, ok = true) {
  return vi.fn(
    async () => ({ ok, text: async () => body }) as unknown as Response,
  );
}

describe("sha1Hex", () => {
  it("matches the digest HIBP's own documentation uses", async () => {
    await expect(sha1Hex("password", subtle)).resolves.toBe(PASSWORD_SHA1);
  });

  it("handles non-ASCII passwords as UTF-8", async () => {
    const digest = await sha1Hex("pässwörd☃", subtle);

    expect(digest).toMatch(/^[0-9A-F]{40}$/);
  });

  it("fails loudly outside a secure context rather than falling back", async () => {
    // Web Crypto's subtle is undefined outside a secure context. A JS fallback
    // would be no more trustworthy, and sending the password to the server is
    // forbidden outright, so the only correct behaviour is to refuse.
    vi.stubGlobal("crypto", {});

    await expect(sha1Hex("password")).rejects.toThrow(/insecure-context/);
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("checkPassword", () => {
  it("reports a breached password with its count", async () => {
    const fetchImpl = respondWith(`${SUFFIX}:9545824`);

    await expect(
      checkPassword("password", { fetchImpl, subtle }),
    ).resolves.toEqual({ state: "breached", count: 9_545_824 });
  });

  it("reports a password that is not in the corpus as safe", async () => {
    const fetchImpl = respondWith("0018A45C4D1DEF81644B54AB7F969B88D65:3");

    await expect(
      checkPassword("password", { fetchImpl, subtle }),
    ).resolves.toEqual({ state: "safe" });
  });

  it("treats a padded zero-count entry as safe, not as a breach", async () => {
    const fetchImpl = respondWith(`${SUFFIX}:0`);

    await expect(
      checkPassword("password", { fetchImpl, subtle }),
    ).resolves.toEqual({ state: "safe" });
  });

  /**
   * The core privacy assertion of US-01, at the unit level: exactly one request,
   * to HIBP, carrying only the 5-character prefix. The Playwright test in
   * `client/e2e/breach-check.spec.ts` asserts the same thing against the real
   * page and the real network stack.
   */
  it("sends only the 5-character prefix, to HIBP, and nowhere else", async () => {
    const digest = await sha1Hex(SECRET, subtle);
    const fetchImpl = respondWith(`${digest.slice(5)}:1`);

    // Guards the fixture itself: if SHA-1 or the secret ever changes, the
    // leak assertions below would silently stop testing anything.
    expect(digest).toBe(SECRET_SHA1);

    await checkPassword(SECRET, { fetchImpl, subtle });

    expect(fetchImpl).toHaveBeenCalledTimes(1);

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];

    expect(url).toBe(
      `https://api.pwnedpasswords.com/range/${digest.slice(0, 5)}`,
    );
    expect(url).not.toContain(SECRET);
    expect(url).not.toContain(digest.slice(5));
    expect(url).not.toContain(digest);
    expect(init.body).toBeUndefined();
    expect(init.method).toBe("GET");
  });

  it("asks HIBP to pad the response and sends no credentials or referrer", async () => {
    const fetchImpl = respondWith(`${SUFFIX}:1`);

    await checkPassword("password", { fetchImpl, subtle });

    const [, init] = fetchImpl.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];

    expect((init.headers as Record<string, string>)["Add-Padding"]).toBe(
      "true",
    );
    expect(init.credentials).toBe("omit");
    expect(init.referrerPolicy).toBe("no-referrer");
    expect(init.cache).toBe("no-store");
  });

  it("never calls the Soteria API", async () => {
    const fetchImpl = respondWith(`${SUFFIX}:1`);

    await checkPassword("password", { fetchImpl, subtle });

    for (const [url] of fetchImpl.mock.calls as unknown as Array<[string]>) {
      expect(url).not.toContain("/api/");
      expect(new URL(url).host).toBe("api.pwnedpasswords.com");
    }
  });

  it("surfaces an HTTP failure as a non-blocking error", async () => {
    const fetchImpl = respondWith("", false);

    await expect(
      checkPassword("password", { fetchImpl, subtle }),
    ).resolves.toEqual({ state: "error", reason: "service-unavailable" });
  });

  it("surfaces a network failure as a non-blocking error", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });

    await expect(
      checkPassword("password", { fetchImpl, subtle }),
    ).resolves.toEqual({ state: "error", reason: "offline" });
  });

  it("never puts the password or the full digest in a rejection", async () => {
    const fetchImpl = vi.fn(async () => {
      // A real fetch error can carry the request URL; make sure nothing echoes.
      throw new Error(`request to ${PASSWORD_SHA1} failed for hunter2`);
    });

    const result = await checkPassword("hunter2", { fetchImpl, subtle });

    expect(JSON.stringify(result)).not.toContain("hunter2");
    expect(JSON.stringify(result)).not.toContain(PASSWORD_SHA1);
  });
});
