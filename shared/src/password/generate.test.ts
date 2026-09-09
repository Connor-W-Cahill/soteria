import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AMBIGUOUS,
  DIGITS,
  generatePassword,
  LOWERCASE,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PasswordOptions,
  randomInt,
  SYMBOLS,
  UPPERCASE,
} from "./generate";

const ALL_ON: PasswordOptions = {
  length: 20,
  uppercase: true,
  lowercase: true,
  digits: true,
  symbols: true,
  avoidAmbiguous: false,
};

describe("randomInt — rejection sampling / no modulo bias", () => {
  it("stays within [0, max)", () => {
    for (let i = 0; i < 2000; i++) {
      const n = randomInt(7);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(7);
    }
  });

  it("rejects out-of-range args", () => {
    expect(() => randomInt(0)).toThrow(RangeError);
    expect(() => randomInt(257)).toThrow(RangeError);
    expect(() => randomInt(3.5)).toThrow(RangeError);
  });

  it("is uniform for an alphabet size that does not divide 256", () => {
    // 95 = number of printable ASCII glyphs; 256 % 95 === 66, so a naive
    // `byte % 95` would hit indices 0..65 three times per 256 bytes and
    // 66..94 only twice — a ~50% over-representation of the low half.
    const max = 95;
    const samples = 400_000;
    const counts = new Array<number>(max).fill(0);
    for (let i = 0; i < samples; i++) {
      const idx = randomInt(max);
      counts[idx] = (counts[idx] ?? 0) + 1;
    }

    const expected = samples / max;
    const sigma = Math.sqrt(expected * (1 - 1 / max));

    // Max deviation bound: ~9 sigma tolerance (vanishing flake probability),
    // yet modulo bias here would be ~50% of `expected` ≈ 46 sigma.
    for (let i = 0; i < max; i++) {
      expect(Math.abs((counts[i] ?? 0) - expected)).toBeLessThan(9 * sigma);
    }

    // Chi-square goodness-of-fit as a second, independent check.
    const chiSquare = counts.reduce(
      (acc, c) => acc + (c - expected) ** 2 / expected,
      0,
    );
    // df = 94; P(chi2 > 160) < 1e-4, while modulo bias would push it into the
    // thousands.
    expect(chiSquare).toBeLessThan(160);

    // The low half must not be systematically busier than the high half.
    const lowHalf = counts.slice(0, 47).reduce((a, b) => a + b, 0);
    const highHalf = counts.slice(47).reduce((a, b) => a + b, 0);
    const perItemLow = lowHalf / 47;
    const perItemHigh = highHalf / (max - 47);
    expect(Math.abs(perItemLow - perItemHigh) / expected).toBeLessThan(0.05);
  });
});

describe("generatePassword — length bounds", () => {
  it("produces a password of the requested length", () => {
    for (const length of [8, 15, 32, 64]) {
      expect(generatePassword({ ...ALL_ON, length })).toHaveLength(length);
    }
  });

  it("enforces the 8..64 bounds in the pure function", () => {
    expect(() =>
      generatePassword({ ...ALL_ON, length: PASSWORD_MIN_LENGTH - 1 }),
    ).toThrow(RangeError);
    expect(() =>
      generatePassword({ ...ALL_ON, length: PASSWORD_MAX_LENGTH + 1 }),
    ).toThrow(RangeError);
    expect(() => generatePassword({ ...ALL_ON, length: 16.5 })).toThrow(
      RangeError,
    );
  });
});

describe("generatePassword — character-class guarantees", () => {
  const has = (pw: string, alphabet: string) =>
    [...pw].some((c) => alphabet.includes(c));

  it("includes at least one character from every enabled class", () => {
    const combos: Array<Partial<PasswordOptions>> = [
      { uppercase: true, lowercase: true, digits: true, symbols: true },
      { uppercase: true, lowercase: false, digits: true, symbols: false },
      { uppercase: false, lowercase: true, digits: false, symbols: true },
      { uppercase: false, lowercase: false, digits: true, symbols: false },
    ];
    for (const combo of combos) {
      const opts = { ...ALL_ON, length: 8, ...combo } as PasswordOptions;
      for (let trial = 0; trial < 300; trial++) {
        const pw = generatePassword(opts);
        if (opts.uppercase) expect(has(pw, UPPERCASE)).toBe(true);
        if (opts.lowercase) expect(has(pw, LOWERCASE)).toBe(true);
        if (opts.digits) expect(has(pw, DIGITS)).toBe(true);
        if (opts.symbols) expect(has(pw, SYMBOLS)).toBe(true);
      }
    }
  });

  it("never emits a character from a disabled class", () => {
    const opts: PasswordOptions = {
      ...ALL_ON,
      length: 40,
      symbols: false,
      digits: false,
    };
    for (let trial = 0; trial < 200; trial++) {
      const pw = generatePassword(opts);
      expect(has(pw, SYMBOLS)).toBe(false);
      expect(has(pw, DIGITS)).toBe(false);
    }
  });

  it("omits ambiguous characters when asked", () => {
    const opts: PasswordOptions = {
      ...ALL_ON,
      length: 64,
      avoidAmbiguous: true,
    };
    for (let trial = 0; trial < 200; trial++) {
      const pw = generatePassword(opts);
      for (const ch of AMBIGUOUS) {
        expect(pw.includes(ch)).toBe(false);
      }
    }
  });

  it("rejects an impossible configuration", () => {
    expect(() =>
      generatePassword({
        length: 12,
        uppercase: false,
        lowercase: false,
        digits: false,
        symbols: false,
        avoidAmbiguous: false,
      }),
    ).toThrow();
  });
});

describe("generatePassword — distribution sanity", () => {
  it("uses the whole alphabet roughly evenly across many passwords", () => {
    const opts: PasswordOptions = { ...ALL_ON, length: 64 };
    const alphabet = UPPERCASE + LOWERCASE + DIGITS + SYMBOLS;
    const counts = new Map<string, number>();
    const passwords = 4000;
    for (let i = 0; i < passwords; i++) {
      for (const ch of generatePassword(opts)) {
        counts.set(ch, (counts.get(ch) ?? 0) + 1);
      }
    }
    const total = passwords * opts.length;
    const expected = total / alphabet.length;
    for (const ch of alphabet) {
      const c = counts.get(ch) ?? 0;
      // Every glyph should appear; none should be wildly over/under-used.
      expect(c).toBeGreaterThan(expected * 0.8);
      expect(c).toBeLessThan(expected * 1.2);
    }
  });

  it("does not repeat itself", () => {
    const opts: PasswordOptions = { ...ALL_ON, length: 24 };
    const seen = new Set<string>();
    for (let i = 0; i < 500; i++) {
      seen.add(generatePassword(opts));
    }
    expect(seen.size).toBe(500);
  });
});

describe("generatePassword — no I/O, nothing persisted", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("performs no network or storage side effects", () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const store: Record<string, unknown> = {};
    const localStorageSpy = {
      setItem: vi.fn((k: string, v: string) => {
        store[k] = v;
      }),
      getItem: vi.fn(),
      removeItem: vi.fn(),
    };
    vi.stubGlobal("localStorage", localStorageSpy);
    vi.stubGlobal("sessionStorage", localStorageSpy);
    const xhrSpy = vi.fn();
    vi.stubGlobal("XMLHttpRequest", xhrSpy);

    const pw = generatePassword({ ...ALL_ON, length: 32 });

    expect(pw).toHaveLength(32);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(xhrSpy).not.toHaveBeenCalled();
    expect(localStorageSpy.setItem).not.toHaveBeenCalled();
    expect(localStorageSpy.getItem).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });
});
