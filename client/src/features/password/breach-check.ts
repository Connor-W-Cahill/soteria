import { findBreachCount, rangeUrlFor, splitDigest } from "@soteria/shared";

/**
 * The browser half of the k-anonymity breach check (US-01).
 *
 * The password is hashed here and immediately discarded. Only the first five
 * hex characters of the SHA-1 digest are transmitted, and only to
 * `api.pwnedpasswords.com` — the Soteria API is never called. See
 * `docs/architecture/adr/0007-browser-only-hibp-breach-check.md`.
 */

export type BreachStatus =
  | { state: "safe" }
  | { state: "breached"; count: number }
  | { state: "error"; reason: BreachErrorReason };

export type BreachErrorReason =
  "offline" | "service-unavailable" | "insecure-context";

/** Thrown internally; never carries the password or the digest. */
class BreachCheckError extends Error {
  readonly reason: BreachErrorReason;

  constructor(reason: BreachErrorReason) {
    super(`Breach check failed: ${reason}`);
    this.name = "BreachCheckError";
    this.reason = reason;
  }
}

/**
 * SHA-1 of `password`, as uppercase hex.
 *
 * SHA-1 is not a security choice here — it is the digest HIBP's corpus is keyed
 * on. Its weakness is irrelevant because the digest is never stored, never
 * transmitted in full, and never used to authenticate anything.
 */
export async function sha1Hex(
  password: string,
  subtle: SubtleCrypto | undefined = globalThis.crypto?.subtle,
): Promise<string> {
  if (subtle === undefined) {
    // Web Crypto is unavailable outside a secure context. Failing loudly is the
    // only safe option: a JS fallback would be slower and no more trustworthy,
    // and sending the password to the server is forbidden outright.
    throw new BreachCheckError("insecure-context");
  }

  const bytes = new TextEncoder().encode(password);
  const digest = await subtle.digest("SHA-1", bytes);

  // Wipe the plaintext bytes we control. The original string is immutable and
  // left to the garbage collector; this is hygiene, not a guarantee.
  bytes.fill(0);

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

export interface BreachCheckOptions {
  fetchImpl?: typeof fetch;
  subtle?: SubtleCrypto | undefined;
  signal?: AbortSignal;
}

/**
 * Returns whether `password` appears in HIBP's corpus, without the password or
 * its full digest leaving this function.
 */
export async function checkPassword(
  password: string,
  options: BreachCheckOptions = {},
): Promise<BreachStatus> {
  const doFetch = options.fetchImpl ?? globalThis.fetch;

  try {
    const digest = await sha1Hex(password, options.subtle);
    const { prefix, suffix } = splitDigest(digest);

    const response = await doFetch(rangeUrlFor(prefix), {
      method: "GET",
      // Ask HIBP to pad the response so its size does not leak how many
      // suffixes share this prefix.
      headers: { "Add-Padding": "true" },
      // No credentials, no referrer. HIBP still sees the request's Origin —
      // mandatory for the preflight that the custom Add-Padding header triggers —
      // plus the caller's IP and user agent. What it learns nothing about beyond
      // the 5-character prefix is the password itself.
      credentials: "omit",
      referrerPolicy: "no-referrer",
      cache: "no-store",
      ...(options.signal === undefined ? {} : { signal: options.signal }),
    });

    if (!response.ok) {
      throw new BreachCheckError("service-unavailable");
    }

    const count = findBreachCount(await response.text(), suffix);

    return count > 0 ? { state: "breached", count } : { state: "safe" };
  } catch (error) {
    if (error instanceof BreachCheckError) {
      return { state: "error", reason: error.reason };
    }

    // A network failure, a CORS rejection, or an abort. The cause is
    // deliberately not logged: an error object from fetch can carry the request
    // URL, which contains the digest prefix.
    return { state: "error", reason: "offline" };
  }
}
