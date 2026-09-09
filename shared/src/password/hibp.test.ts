import { describe, expect, it } from "vitest";

import {
  HIBP_RANGE_URL,
  PREFIX_LENGTH,
  findBreachCount,
  rangeUrlFor,
  splitDigest,
} from "./hibp.js";

// SHA-1("password"), the canonical example in HIBP's own API documentation.
const PASSWORD_SHA1 = "5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8";

describe("splitDigest", () => {
  it("sends only the first five hex characters", () => {
    const { prefix, suffix } = splitDigest(PASSWORD_SHA1);

    expect(prefix).toBe("5BAA6");
    expect(prefix).toHaveLength(PREFIX_LENGTH);
    expect(suffix).toBe("1E4C9B93F3F0682250B6CF8331B7EE68FD8");
    expect(suffix).toHaveLength(35);
  });

  it("reassembles to the original digest, so nothing is lost or duplicated", () => {
    const { prefix, suffix } = splitDigest(PASSWORD_SHA1);

    expect(prefix + suffix).toBe(PASSWORD_SHA1);
  });

  it("uppercases a lowercase digest, because HIBP returns uppercase", () => {
    expect(splitDigest(PASSWORD_SHA1.toLowerCase()).prefix).toBe("5BAA6");
  });

  it.each([
    ["", "empty"],
    ["5BAA6", "too short"],
    [`${PASSWORD_SHA1}0`, "too long"],
    [PASSWORD_SHA1.replace("5", "Z"), "not hexadecimal"],
  ])("rejects a malformed digest (%s: %s)", (digest) => {
    expect(() => splitDigest(digest)).toThrow(/40 hexadecimal/);
  });
});

describe("findBreachCount", () => {
  const suffix = "1E4C9B93F3F0682250B6CF8331B7EE68FD8";
  const body = [
    "0018A45C4D1DEF81644B54AB7F969B88D65:1",
    `${suffix}:9545824`,
    "011053FD0102E94D6AE2F8B83D76FAF94F6:2",
  ].join("\r\n");

  it("returns the count for a matching suffix", () => {
    expect(findBreachCount(body, suffix)).toBe(9_545_824);
  });

  it("returns 0 when the suffix is absent", () => {
    expect(findBreachCount(body, "F".repeat(35))).toBe(0);
  });

  it("handles CRLF, LF, and a trailing newline identically", () => {
    for (const variant of [body, body.replace(/\r\n/g, "\n"), `${body}\r\n`]) {
      expect(findBreachCount(variant, suffix)).toBe(9_545_824);
    }
  });

  it("matches case-insensitively in both directions", () => {
    expect(findBreachCount(body.toLowerCase(), suffix)).toBe(9_545_824);
    expect(findBreachCount(body, suffix.toLowerCase())).toBe(9_545_824);
  });

  /**
   * With `Add-Padding: true` HIBP injects synthetic entries with a count of
   * exactly 0. Reading one as a real result would tell a user their password
   * "was found, 0 times" — the padding must read as not-found.
   */
  it("treats a padded zero-count entry as not found", () => {
    const padded = [
      `${suffix}:0`,
      "0018A45C4D1DEF81644B54AB7F969B88D65:0",
    ].join("\r\n");

    expect(findBreachCount(padded, suffix)).toBe(0);
  });

  it("ignores blank and malformed lines rather than throwing", () => {
    const messy = ["", "   ", "no-colon-here", `${suffix}:12`, ""].join("\r\n");

    expect(findBreachCount(messy, suffix)).toBe(12);
  });

  it("returns 0 for a non-numeric count rather than NaN", () => {
    expect(findBreachCount(`${suffix}:not-a-number`, suffix)).toBe(0);
  });

  it("does not match a suffix that is merely a prefix of a line", () => {
    const other = `${suffix}AA:5`;

    expect(findBreachCount(other, suffix)).toBe(0);
  });
});

describe("rangeUrlFor", () => {
  it("builds the documented range URL", () => {
    expect(rangeUrlFor("5BAA6")).toBe(`${HIBP_RANGE_URL}/5BAA6`);
  });

  it("refuses anything that is not a 5-character hex prefix", () => {
    for (const bad of ["5BAA", "5BAA61", "5baa6", "../../etc", ""]) {
      expect(() => rangeUrlFor(bad)).toThrow(/5 hexadecimal/);
    }
  });
});
