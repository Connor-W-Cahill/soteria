/**
 * EFF-wordlist passphrase generator (US-03) — pure, browser-safe, dependency-free.
 *
 * Privacy: this module only computes a string from `crypto.getRandomValues`. It
 * performs no I/O — no `fetch`, no storage, no logging. The wordlist is a
 * bundled JSON module, never read from disk (a `readFileSync` behind the shared
 * barrel once blanked the whole app — see `browser-safety.test.ts` / #69).
 *
 * Randomness: word and digit indices are drawn with rejection sampling from a
 * 16-bit slice of `crypto.getRandomValues`, so there is no modulo bias even
 * though 65536 is not a multiple of 7776. See {@link uniformIndex}.
 */

import wordlistFile from "./eff-large.json" with { type: "json" };

interface WordlistFile {
  words: string[];
  license: string;
  attribution: string;
  wordCount: number;
}

const wordlist = wordlistFile as WordlistFile;

/** The EFF large wordlist (7,776 words), reproduced verbatim. CC BY 3.0 US. */
export const EFF_LARGE_WORDLIST: readonly string[] = Object.freeze([
  ...wordlist.words,
]);

/** 7,776 — the size of the EFF large wordlist. */
export const EFF_LARGE_WORDLIST_SIZE = EFF_LARGE_WORDLIST.length;

export const EFF_LARGE_WORDLIST_LICENSE = wordlist.license;
export const EFF_LARGE_WORDLIST_ATTRIBUTION = wordlist.attribution;

export const PASSPHRASE_MIN_WORDS = 3;
export const PASSPHRASE_MAX_WORDS = 8;

/** Separator choices offered in the UI. The pure function accepts any string. */
export const PASSPHRASE_SEPARATORS = [
  { value: "-", label: "Hyphen  -" },
  { value: ".", label: "Period  ." },
  { value: " ", label: "Space" },
  { value: "_", label: "Underscore  _" },
  { value: ",", label: "Comma  ," },
] as const;

export interface PassphraseOptions {
  /** Number of words. Must be an integer in [3, 8]. */
  words: number;
  /** String placed between words. Any string; the UI offers a fixed set. */
  separator: string;
  /** Upper-case the first letter of every word (a formatting choice: adds no entropy). */
  capitalize: boolean;
  /** Append one uniformly random digit (0–9) to the end (adds log2(10) bits). */
  includeDigit: boolean;
}

const DIGITS_COUNT = 10;
const SIXTEEN_BIT_RANGE = 0x1_0000;

/**
 * A refilled pool of CSPRNG 16-bit words. Drawing one value at a time from
 * `crypto.getRandomValues` is correct but slow under heavy sampling (the
 * distribution tests pull ~10^6 values); a pool keeps the entropy source
 * identical while amortising the call.
 */
const POOL_SIZE = 1024;
const pool = new Uint16Array(POOL_SIZE);
let poolNext = POOL_SIZE;

function nextRandom16(): number {
  if (poolNext >= POOL_SIZE) {
    crypto.getRandomValues(pool);
    poolNext = 0;
  }
  return pool[poolNext++] as number;
}

/**
 * Uniformly distributed integer in [0, bound).
 *
 * `crypto.getRandomValues` gives uniform 16-bit values in [0, 65535]. Taking
 * that value `% bound` over-represents the low `65536 % bound` indices whenever
 * `bound` does not divide 65536 (it does not, for 7776). We reject any value at
 * or above the largest multiple of `bound` that fits in 16 bits and draw again,
 * which makes the result exactly uniform.
 *
 * A 16-bit source (not 32-bit) is deliberate: with `bound = 7776` the discarded
 * region is 3328/65536 ≈ 5%, large enough that a distribution test can actually
 * catch a missing rejection step.
 *
 * @param bound exclusive upper bound, an integer in 1..65536
 */
export function uniformIndex(bound: number): number {
  if (!Number.isInteger(bound) || bound < 1 || bound > SIXTEEN_BIT_RANGE) {
    throw new RangeError(
      `uniformIndex: bound must be an integer in 1..65536, got ${bound}`,
    );
  }
  const ceiling = SIXTEEN_BIT_RANGE - (SIXTEEN_BIT_RANGE % bound);
  for (;;) {
    const value = nextRandom16();
    if (value < ceiling) {
      return value % bound;
    }
  }
}

function capitalizeWord(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/**
 * Bits of entropy in a passphrase built with these options.
 *
 * `words * log2(7776)` from the word choices (~12.925 bits each), plus
 * `log2(10)` (~3.322 bits) if a random digit is appended. Capitalization is a
 * fixed transformation and contributes nothing.
 */
export function passphraseEntropyBits(
  options: Pick<PassphraseOptions, "words" | "includeDigit">,
): number {
  return (
    options.words * Math.log2(EFF_LARGE_WORDLIST_SIZE) +
    (options.includeDigit ? Math.log2(DIGITS_COUNT) : 0)
  );
}

/**
 * Generate a passphrase.
 *
 * Each word is an independent uniform draw from the 7,776-word list (with
 * replacement — repeats are possible and do not reduce entropy). When
 * `includeDigit` is set, a uniformly random digit is appended to the last word.
 *
 * @throws RangeError if `words` is not an integer in [3, 8].
 * @throws TypeError if `separator` is not a string.
 */
export function generatePassphrase(options: PassphraseOptions): string {
  const { words, separator, capitalize, includeDigit } = options;

  if (!Number.isInteger(words)) {
    throw new RangeError(`words must be an integer, got ${words}`);
  }
  if (words < PASSPHRASE_MIN_WORDS || words > PASSPHRASE_MAX_WORDS) {
    throw new RangeError(
      `words must be between ${PASSPHRASE_MIN_WORDS} and ${PASSPHRASE_MAX_WORDS}, got ${words}`,
    );
  }
  if (typeof separator !== "string") {
    throw new TypeError("separator must be a string");
  }

  const chosen: string[] = [];
  for (let i = 0; i < words; i++) {
    const word = EFF_LARGE_WORDLIST[
      uniformIndex(EFF_LARGE_WORDLIST_SIZE)
    ] as string;
    chosen.push(capitalize ? capitalizeWord(word) : word);
  }

  if (includeDigit) {
    const digit = uniformIndex(DIGITS_COUNT);
    chosen[chosen.length - 1] = `${chosen[chosen.length - 1]}${digit}`;
  }

  return chosen.join(separator);
}
