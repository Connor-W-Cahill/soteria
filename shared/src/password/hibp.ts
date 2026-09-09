/**
 * Pure helpers for the Have I Been Pwned "Pwned Passwords" range API, used by
 * the k-anonymity breach check (US-01).
 *
 * The privacy invariant, from the charter and
 * `docs/architecture/adr/0007-browser-only-hibp-breach-check.md`: SHA-1 is
 * computed in the browser, only the first five hex characters of the digest are
 * ever transmitted, and the Soteria API is never in the path. Nothing in this
 * module accepts a password — it takes a digest the caller already computed, so
 * a password cannot reach the network layer through here even by mistake.
 */

/** How many leading hex characters of the SHA-1 digest HIBP's range API takes. */
export const PREFIX_LENGTH = 5;

export const HIBP_RANGE_URL = "https://api.pwnedpasswords.com/range";

export interface DigestParts {
  /** The 5 hex characters sent to HIBP. Uppercase, as the API returns. */
  prefix: string;
  /** The remaining 35 hex characters, which never leave the browser. */
  suffix: string;
}

/**
 * Splits a full SHA-1 hex digest into the prefix that is sent and the suffix
 * that is not. Throws rather than guessing on a malformed digest: a truncated
 * digest would silently widen the prefix's anonymity set in the wrong direction.
 */
export function splitDigest(digest: string): DigestParts {
  const normalized = digest.trim().toUpperCase();

  if (!/^[0-9A-F]{40}$/.test(normalized)) {
    throw new Error(
      "A SHA-1 digest must be exactly 40 hexadecimal characters.",
    );
  }

  return {
    prefix: normalized.slice(0, PREFIX_LENGTH),
    suffix: normalized.slice(PREFIX_LENGTH),
  };
}

/**
 * Finds the breach count for `suffix` in a HIBP range response.
 *
 * The body is `SUFFIX:COUNT` per line, CRLF-separated. With `Add-Padding: true`
 * HIBP mixes in synthetic entries whose count is exactly `0`; those are padding
 * and must be read as "not found", never as a real zero-count breach. Returns 0
 * when the suffix is absent, which is the same answer for both cases.
 */
export function findBreachCount(body: string, suffix: string): number {
  const target = suffix.trim().toUpperCase();

  // Track the highest count across every matching line rather than returning on
  // the first. HIBP does not currently emit a suffix twice, but if it ever did —
  // or if a padding line for a suffix preceded its real entry — returning early
  // would report a genuine breach as "not found". Taking the maximum costs
  // nothing and removes the assumption.
  let highest = 0;

  for (const rawLine of body.split("\n")) {
    const line = rawLine.trim();

    if (line === "") {
      continue;
    }

    const separator = line.indexOf(":");

    if (separator === -1) {
      continue;
    }

    if (line.slice(0, separator).toUpperCase() !== target) {
      continue;
    }

    const count = Number.parseInt(line.slice(separator + 1), 10);

    // A padded entry is a real line with a zero count; treat it as not found.
    if (Number.isFinite(count) && count > highest) {
      highest = count;
    }
  }

  return highest;
}

export function rangeUrlFor(prefix: string): string {
  if (!/^[0-9A-F]{5}$/.test(prefix)) {
    throw new Error("A HIBP range prefix must be 5 hexadecimal characters.");
  }

  return `${HIBP_RANGE_URL}/${prefix}`;
}
