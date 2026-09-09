import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  EFF_LARGE_WORDLIST,
  EFF_LARGE_WORDLIST_ATTRIBUTION,
  EFF_LARGE_WORDLIST_LICENSE,
  EFF_LARGE_WORDLIST_SIZE,
  generatePassphrase,
  PASSPHRASE_MAX_WORDS,
  PASSPHRASE_MIN_WORDS,
  PASSPHRASE_SEPARATORS,
  passphraseEntropyBits,
  type PassphraseOptions,
  uniformIndex,
} from "./passphrase";

const WORDS = new Set(EFF_LARGE_WORDLIST);

/**
 * Segment `phrase` into exactly `words` wordlist entries joined by `separator`,
 * returning them with their original casing, or null if it cannot be done.
 *
 * Splitting on the separator is NOT a valid way to do this, because the EFF list
 * contains four hyphenated entries — drop-down, felt-tip, t-shirt, yo-yo — and
 * "-" is an offered separator. `"t-shirt-abacus".split("-")` yields three pieces,
 * two of which are not words, so a split-based test failed about 10% of runs
 * against a perfectly correct generator (#99).
 *
 * Matching is done on a lower-cased copy so capitalized phrases segment too;
 * lower-casing preserves length, so the offsets still index the original.
 *
 * Module-scoped on purpose. #99 put it inside one describe and fixed only the
 * three sites in that block; three more lived in other describes where it was
 * not even in scope, and each surfaced as a separate flake investigation (#108).
 * The guard test at the bottom of this file now fails if a split-based count is
 * reintroduced anywhere in it.
 *
 * A near-identical copy lives in client/e2e/support/passphrase.ts for the
 * Playwright suite, which cannot import a test-only module across workspaces.
 * Change both.
 */
export function segmentPassphrase(
  phrase: string,
  separator: string,
  words: number,
): string[] | null {
  const lower = phrase.toLowerCase();

  const solve = (from: number, remaining: number): string[] | null => {
    if (remaining === 1) {
      return WORDS.has(lower.slice(from)) ? [phrase.slice(from)] : null;
    }

    for (
      let at = lower.indexOf(separator, from);
      at !== -1;
      at = lower.indexOf(separator, at + 1)
    ) {
      if (WORDS.has(lower.slice(from, at))) {
        const rest = solve(at + separator.length, remaining - 1);

        if (rest !== null) {
          return [phrase.slice(from, at), ...rest];
        }
      }
    }

    return null;
  };

  return solve(0, words);
}

const BASE: PassphraseOptions = {
  words: 6,
  separator: "-",
  capitalize: false,
  includeDigit: false,
};

describe("EFF large wordlist", () => {
  it("is the official 7,776-word list, verbatim", () => {
    expect(EFF_LARGE_WORDLIST_SIZE).toBe(7776);
    expect(EFF_LARGE_WORDLIST).toHaveLength(7776);
    expect(new Set(EFF_LARGE_WORDLIST).size).toBe(7776);
    expect(EFF_LARGE_WORDLIST[0]).toBe("abacus");
    expect(EFF_LARGE_WORDLIST[7775]).toBe("zoom");

    // Pinned digest of the words (newline-joined). Any substitution, reordering
    // or typo in the bundled JSON changes this.
    const digest = createHash("sha256")
      .update(EFF_LARGE_WORDLIST.join("\n"))
      .digest("hex");
    expect(digest).toBe(
      "abae49761b88f3f1ba31ef944bea1f61b795a3cd7e1cfb7d276ed45bf77967ba",
    );
  });

  it("carries its licence note", () => {
    expect(EFF_LARGE_WORDLIST_LICENSE).toBe("CC-BY-3.0-US");
    expect(EFF_LARGE_WORDLIST_ATTRIBUTION).toMatch(
      /Electronic Frontier Foundation/,
    );
  });

  it("cannot be mutated by a caller", () => {
    expect(() => {
      (EFF_LARGE_WORDLIST as string[])[0] = "hacked";
    }).toThrow();
    expect(EFF_LARGE_WORDLIST[0]).toBe("abacus");
  });

  it("offers only separators that are single, unambiguous characters", () => {
    for (const { value } of PASSPHRASE_SEPARATORS) {
      expect(value).toHaveLength(1);
    }
  });
});

describe("uniformIndex — rejection sampling / no modulo bias", () => {
  it("stays within [0, bound)", () => {
    for (let i = 0; i < 5000; i++) {
      const n = uniformIndex(7776);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(7776);
    }
  });

  it("rejects out-of-range bounds", () => {
    expect(() => uniformIndex(0)).toThrow(RangeError);
    expect(() => uniformIndex(65_537)).toThrow(RangeError);
    expect(() => uniformIndex(7.5)).toThrow(RangeError);
  });

  it("is uniform over 7776 — a value the 16-bit source does not divide", () => {
    // 65536 % 7776 === 3328, so a naive `value % 7776` would hit indices
    // 0..3327 nine times per 65536 draws and the rest eight times — a ~12.5%
    // over-representation of the low ~43% of the list.
    const bound = 7776;
    const samples = 900_000;
    const counts = new Array<number>(bound).fill(0);
    for (let i = 0; i < samples; i++) {
      const idx = uniformIndex(bound);
      counts[idx] = (counts[idx] ?? 0) + 1;
    }

    const expected = samples / bound; // ~115.7
    const sigma = Math.sqrt(expected * (1 - 1 / bound));

    // Max-deviation bound. ~5 sigma per bucket is generous against flake
    // (7776 buckets => expect the worst to sit near 4 sigma), but the modulo
    // bias would push the low buckets ~12.5% ≈ 1.35 per draw ≈ 13 sigma high.
    let maxDev = 0;
    for (let i = 0; i < bound; i++) {
      maxDev = Math.max(maxDev, Math.abs((counts[i] ?? 0) - expected));
    }
    expect(maxDev).toBeLessThan(6 * sigma);

    // Chi-square goodness of fit. df = 7775; the ~99.9th percentile is ≈ 8090.
    const chiSquare = counts.reduce(
      (acc, c) => acc + (c - expected) ** 2 / expected,
      0,
    );
    expect(chiSquare).toBeLessThan(8300);

    // The rejected region is the low 3328 indices, so that is exactly where a
    // missing rejection step shows up: compare per-bucket rates of the two
    // halves of the discard boundary.
    const lowRate =
      counts.slice(0, 3328).reduce((a, b) => a + b, 0) / 3328 / expected;
    const highRate =
      counts.slice(3328).reduce((a, b) => a + b, 0) / (bound - 3328) / expected;
    expect(Math.abs(lowRate - highRate)).toBeLessThan(0.03);
  });
});

describe("generatePassphrase — word count bounds", () => {
  it("returns the requested number of words", () => {
    for (const words of [3, 4, 6, 8]) {
      const phrase = generatePassphrase({ ...BASE, words, separator: "-" });
      // Not split("-").length — see segmentPassphrase.
      expect(segmentPassphrase(phrase, "-", words), phrase).not.toBeNull();
    }
  });

  it("enforces the 3..8 bound in the pure function", () => {
    expect(() =>
      generatePassphrase({ ...BASE, words: PASSPHRASE_MIN_WORDS - 1 }),
    ).toThrow(RangeError);
    expect(() =>
      generatePassphrase({ ...BASE, words: PASSPHRASE_MAX_WORDS + 1 }),
    ).toThrow(RangeError);
    expect(() => generatePassphrase({ ...BASE, words: 5.5 })).toThrow(
      RangeError,
    );
  });

  it("rejects a non-string separator", () => {
    expect(() =>
      generatePassphrase({
        ...BASE,
        separator: 5 as unknown as string,
      }),
    ).toThrow(TypeError);
  });
});

describe("generatePassphrase — formatting", () => {
  const wordSet = new Set(EFF_LARGE_WORDLIST);

  it("segments correctly, including hyphenated entries (guards the helper)", () => {
    expect(wordSet.has("t-shirt")).toBe(true);
    expect(wordSet.has("yo-yo")).toBe(true);

    // A hyphenated entry inside a hyphen-separated phrase is still one word.
    expect(segmentPassphrase("t-shirt-abacus-zoom", "-", 3)).toEqual([
      "t-shirt",
      "abacus",
      "zoom",
    ]);
    // Capitalized, and with two hyphenated entries. This is the deterministic
    // cover for #99: it does not depend on a hyphenated word being drawn.
    expect(segmentPassphrase("T-shirt-Abacus-Zoom-Yo-yo", "-", 4)).toEqual([
      "T-shirt",
      "Abacus",
      "Zoom",
      "Yo-yo",
    ]);
    // And it must not accept just anything.
    expect(segmentPassphrase("abacus-notaword-zoom", "-", 3)).toBeNull();
    expect(segmentPassphrase("abacus-zoom", "-", 3)).toBeNull();
  });

  it("joins with the chosen separator and draws every word from the list", () => {
    for (const { value } of PASSPHRASE_SEPARATORS) {
      for (let trial = 0; trial < 50; trial++) {
        const phrase = generatePassphrase({
          ...BASE,
          words: 5,
          separator: value,
        });

        expect(segmentPassphrase(phrase, value, 5), phrase).not.toBeNull();
      }
    }
  });

  it("capitalizes the first letter of every word when asked", () => {
    for (const { value } of PASSPHRASE_SEPARATORS) {
      for (let trial = 0; trial < 50; trial++) {
        const phrase = generatePassphrase({
          ...BASE,
          words: 4,
          separator: value,
          capitalize: true,
        });
        const drawn = segmentPassphrase(phrase, value, 4);

        expect(drawn, phrase).not.toBeNull();

        for (const word of drawn ?? []) {
          const entry = word.toLowerCase();

          expect(wordSet.has(entry), phrase).toBe(true);
          // Pins the contract exactly: capitalizeWord upper-cases charAt(0) and
          // nothing else, so a hyphenated entry becomes T-shirt, never T-Shirt.
          // Every list entry is lower-case, so this is the whole transformation.
          expect(word, phrase).toBe(entry[0]?.toUpperCase() + entry.slice(1));
        }
      }
    }
  });

  it("appends exactly one digit to the last word when asked", () => {
    for (let trial = 0; trial < 100; trial++) {
      const phrase = generatePassphrase({
        ...BASE,
        words: 3,
        separator: ".",
        includeDigit: true,
      });
      const parts = phrase.split(".");
      expect(parts).toHaveLength(3);
      const last = parts[2] as string;
      expect(last).toMatch(/^[a-z-]+[0-9]$/);
      expect(wordSet.has(last.slice(0, -1))).toBe(true);
      // The earlier words are untouched.
      expect(wordSet.has(parts[0] as string)).toBe(true);
    }
  });

  it("without a digit, every word is a bare list entry", () => {
    for (let trial = 0; trial < 50; trial++) {
      const phrase = generatePassphrase({ ...BASE, words: 6 });
      // Four list entries are hyphenated (drop-down, felt-tip, t-shirt, yo-yo)
      // and "-" is BASE's separator, so a naive split fragments them. segment
      // recovers the six drawn entries instead.
      const drawn = segmentPassphrase(phrase, "-", 6);

      expect(drawn, phrase).not.toBeNull();

      for (const word of drawn ?? []) {
        expect(wordSet.has(word), phrase).toBe(true);
      }
    }
  });
});

describe("generatePassphrase — distribution sanity", () => {
  it("uses the whole wordlist roughly evenly", () => {
    const counts = new Map<string, number>();
    const phrases = 20_000;
    const wordsPer = 8;
    for (let i = 0; i < phrases; i++) {
      for (const word of generatePassphrase({
        ...BASE,
        words: wordsPer,
        separator: " ",
      }).split(" ")) {
        counts.set(word, (counts.get(word) ?? 0) + 1);
      }
    }
    const total = phrases * wordsPer;
    const expected = total / EFF_LARGE_WORDLIST_SIZE; // ~20.6

    let used = 0;
    let min = Infinity;
    let max = 0;
    for (const word of EFF_LARGE_WORDLIST) {
      const c = counts.get(word) ?? 0;
      if (c > 0) used++;
      min = Math.min(min, c);
      max = Math.max(max, c);
    }
    // Almost every word should appear at least once at this sample size...
    expect(used).toBeGreaterThan(EFF_LARGE_WORDLIST_SIZE * 0.97);
    // ...and none should dominate.
    expect(max).toBeLessThan(expected * 3);
  });

  it("does not repeat whole passphrases", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      seen.add(generatePassphrase({ ...BASE, words: 4 }));
    }
    expect(seen.size).toBe(1000);
  });

  it("allows a repeated word within a phrase over enough trials", () => {
    // With 8 draws from 7776, P(a repeat) ≈ 0.0036 per phrase, so ~1 in 280.
    let sawRepeat = false;
    for (let i = 0; i < 20_000 && !sawRepeat; i++) {
      const parts = segmentPassphrase(
        generatePassphrase({ ...BASE, words: 8 }),
        "-",
        8,
      );
      // A hyphenated entry would otherwise fragment into pieces that look like
      // extra words, making a false "repeat" likelier than the stated 1-in-280.
      if (parts !== null && new Set(parts).size < parts.length)
        sawRepeat = true;
    }
    expect(sawRepeat).toBe(true);
  });
});

describe("passphraseEntropyBits", () => {
  it("is log2(7776) per word", () => {
    expect(
      passphraseEntropyBits({ words: 1, includeDigit: false }),
    ).toBeCloseTo(12.925, 3);
    expect(
      passphraseEntropyBits({ words: 6, includeDigit: false }),
    ).toBeCloseTo(77.549, 3);
  });

  it("adds log2(10) for the optional digit", () => {
    const withDigit = passphraseEntropyBits({ words: 6, includeDigit: true });
    const without = passphraseEntropyBits({ words: 6, includeDigit: false });
    expect(withDigit - without).toBeCloseTo(Math.log2(10), 6);
  });
});

describe("generatePassphrase — no I/O, nothing persisted", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("performs no network or storage side effects", () => {
    const fetchSpy = vi.fn();
    const xhrSpy = vi.fn();
    const storage = {
      setItem: vi.fn(),
      getItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    };
    vi.stubGlobal("fetch", fetchSpy);
    vi.stubGlobal("XMLHttpRequest", xhrSpy);
    vi.stubGlobal("localStorage", storage);
    vi.stubGlobal("sessionStorage", storage);
    vi.stubGlobal("navigator", { sendBeacon: vi.fn() });

    const phrase = generatePassphrase({
      ...BASE,
      words: 8,
      includeDigit: true,
    });

    // The last word carries a digit, so it is not a bare list entry; segment the
    // first seven and check the eighth separately.
    const cut = phrase.lastIndexOf("-");
    expect(
      segmentPassphrase(phrase.slice(0, cut), "-", 7),
      phrase,
    ).not.toBeNull();
    expect(phrase.slice(cut + 1)).toMatch(/^[a-z-]+[0-9]$/);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(xhrSpy).not.toHaveBeenCalled();
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(storage.getItem).not.toHaveBeenCalled();
    expect(
      (
        globalThis.navigator as unknown as {
          sendBeacon: ReturnType<typeof vi.fn>;
        }
      ).sendBeacon,
    ).not.toHaveBeenCalled();
  });
});

describe("this test file itself", () => {
  /**
   * The recurrence guard for #99, #101, #102 and #108.
   *
   * That defect was fixed three separate times because each investigation fixed
   * only the sites its failing runs happened to point at: #99 fixed three inside
   * one describe, #102 found two more in the Playwright spec, and #108 found
   * three more here, in describes where the helper was not even in scope. Every
   * one was the same mistake, and every one cost a flake investigation.
   *
   * This assertion would have caught all of them at once, the first time. It
   * reads this file's own source and fails if a passphrase is split on a
   * separator the wordlist can contain, outside a comment.
   */
  it("never counts passphrase words by splitting on a separator", () => {
    const source = readFileSync(fileURLToPath(import.meta.url), "utf8");
    const offenders = source
      .split("\n")
      .map((line, index) => ({ line: line.trim(), number: index + 1 }))
      .filter(({ line }) => !line.startsWith("*") && !line.startsWith("//"))
      .filter(({ line }) => /\.split\(\s*["'`]-["'`]\s*\)/.test(line));

    expect(
      offenders,
      "use segmentPassphrase instead; see its doc comment",
    ).toEqual([]);
  });
});
