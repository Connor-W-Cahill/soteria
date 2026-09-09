/**
 * Random password generator — pure, browser-safe, dependency-free.
 *
 * Privacy: this module only computes a string. It performs no I/O — no `fetch`,
 * no storage, no logging. The generated value never leaves the caller.
 *
 * Randomness: every character index is drawn from `crypto.getRandomValues` with
 * rejection sampling, so there is no modulo bias even when the alphabet size
 * does not divide 256. See {@link randomInt}.
 */

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 64;

export const UPPERCASE = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
export const LOWERCASE = "abcdefghijklmnopqrstuvwxyz";
export const DIGITS = "0123456789";
/** Printable ASCII punctuation, minus space, quotes, backslash and backtick
 * (they are awkward in shells, CSV and copy/paste). */
export const SYMBOLS = "!#$%&()*+,-./:;<=>?@[]^_{|}~";

/** Characters that are easy to misread in common fonts. Removed when the
 * caller asks to avoid ambiguous characters. */
export const AMBIGUOUS = "Il1|O0o";

export type CharacterClass = "uppercase" | "lowercase" | "digits" | "symbols";

export interface PasswordOptions {
  /** Total length. Must be an integer in [8, 64]. */
  length: number;
  uppercase: boolean;
  lowercase: boolean;
  digits: boolean;
  symbols: boolean;
  /** Drop characters that are easy to confuse (I l 1 | O 0 o). */
  avoidAmbiguous: boolean;
}

const CLASS_ALPHABETS: Record<CharacterClass, string> = {
  uppercase: UPPERCASE,
  lowercase: LOWERCASE,
  digits: DIGITS,
  symbols: SYMBOLS,
};

function stripAmbiguous(alphabet: string): string {
  return [...alphabet].filter((ch) => !AMBIGUOUS.includes(ch)).join("");
}

/**
 * Uniformly distributed integer in the half-open range [0, max).
 *
 * `crypto.getRandomValues` fills a byte with a uniform value in [0, 255].
 * Taking that byte `% max` biases toward the low indices whenever `max` does
 * not divide 256. We reject any byte at or above the largest multiple of `max`
 * that fits in a byte and draw again, which makes the result exactly uniform.
 *
 * @param max exclusive upper bound, 1..256
 */
export function randomInt(max: number): number {
  if (!Number.isInteger(max) || max < 1 || max > 256) {
    throw new RangeError(
      `randomInt: max must be an integer in 1..256, got ${max}`,
    );
  }
  // Largest multiple of `max` that is <= 256; bytes >= this are rejected.
  const ceiling = 256 - (256 % max);
  const buffer = new Uint8Array(1);
  for (;;) {
    crypto.getRandomValues(buffer);
    const byte = buffer[0] as number;
    if (byte < ceiling) {
      return byte % max;
    }
  }
}

function activeClasses(options: PasswordOptions): CharacterClass[] {
  const classes: CharacterClass[] = [];
  if (options.uppercase) classes.push("uppercase");
  if (options.lowercase) classes.push("lowercase");
  if (options.digits) classes.push("digits");
  if (options.symbols) classes.push("symbols");
  return classes;
}

/**
 * Generate a random password.
 *
 * Character-class guarantee: every class the caller enables appears at least
 * once. This is done by **generate-then-check-and-retry** rather than by
 * placing required characters at fixed spots: each draw is an independent
 * uniform sample over the alphabet, and rejecting the (rare) draws that miss a
 * class leaves the output uniform over exactly the set of valid passwords. For
 * the supported lengths a retry is almost never needed.
 *
 * @throws RangeError if `length` is not an integer in [8, 64], or is too short
 *   to fit one character from every enabled class.
 * @throws Error if no class is enabled, or avoiding ambiguous characters would
 *   empty an enabled class.
 */
export function generatePassword(options: PasswordOptions): string {
  const { length, avoidAmbiguous } = options;

  if (!Number.isInteger(length)) {
    throw new RangeError(`length must be an integer, got ${length}`);
  }
  if (length < PASSWORD_MIN_LENGTH || length > PASSWORD_MAX_LENGTH) {
    throw new RangeError(
      `length must be between ${PASSWORD_MIN_LENGTH} and ${PASSWORD_MAX_LENGTH}, got ${length}`,
    );
  }

  const classes = activeClasses(options);
  if (classes.length === 0) {
    throw new Error("at least one character class must be enabled");
  }

  const classAlphabets = classes.map((name) => {
    const alphabet = avoidAmbiguous
      ? stripAmbiguous(CLASS_ALPHABETS[name])
      : CLASS_ALPHABETS[name];
    if (alphabet.length === 0) {
      throw new Error(
        `the "${name}" class is empty after removing ambiguous characters`,
      );
    }
    return alphabet;
  });

  if (length < classAlphabets.length) {
    throw new RangeError(
      `length ${length} is too short to include every one of the ${classAlphabets.length} selected classes`,
    );
  }

  const alphabet = classAlphabets.join("");

  // Retry ceiling: a safety net, not an expected path. Missing a class after a
  // full-length uniform draw is exponentially unlikely for these lengths.
  const MAX_ATTEMPTS = 10_000;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const chars: string[] = [];
    for (let i = 0; i < length; i++) {
      chars.push(alphabet[randomInt(alphabet.length)] as string);
    }
    const password = chars.join("");
    const satisfiesEveryClass = classAlphabets.every((classAlphabet) =>
      chars.some((ch) => classAlphabet.includes(ch)),
    );
    if (satisfiesEveryClass) {
      return password;
    }
  }

  /* istanbul ignore next -- unreachable for supported inputs */
  throw new Error(
    "could not generate a password satisfying the class constraints",
  );
}
