import { OAuth2Client } from "google-auth-library";

import type { AuthConfig } from "./config.js";

/**
 * The parts of a verified Google ID token we use. Nothing else is read, and the
 * token itself is discarded once this has been extracted.
 */
export interface GoogleIdentity {
  /** Google's stable subject identifier; the join key for `users.google_sub`. */
  googleSub: string;
  email: string;
  displayName: string | null;
}

/** Raised for every rejected token. Deliberately says little. */
export class GoogleTokenError extends Error {
  constructor(readonly reason: string) {
    super("That Google sign-in could not be verified.");
    this.name = "GoogleTokenError";
  }
}

/**
 * Verifies a Google ID token and returns the identity it asserts.
 *
 * `verifyIdToken` checks the signature against Google's published keys, the
 * expiry, and — because `audience` is passed — that the token was minted for
 * *this* client id. That last check is the one that matters most: a valid
 * Google token issued to some other application is cryptographically perfect
 * and must still be rejected, or anyone with any Google app could mint
 * credentials for ours.
 *
 * `iss` is checked explicitly as well. The library accepts both of Google's
 * issuer spellings, and asserting it here means the guard is visible at the
 * call site rather than assumed of the dependency.
 */
export async function verifyGoogleIdToken(
  idToken: string,
  config: AuthConfig,
  client = new OAuth2Client(config.googleClientId),
): Promise<GoogleIdentity> {
  let payload;

  try {
    const ticket = await client.verifyIdToken({
      idToken,
      audience: config.googleClientId,
    });

    payload = ticket.getPayload();
  } catch {
    // Signature, expiry and audience failures all land here. The caller turns
    // every one of them into the same 401, so they are not distinguished.
    throw new GoogleTokenError("verification_failed");
  }

  if (payload === undefined) {
    throw new GoogleTokenError("empty_payload");
  }

  if (
    payload.iss !== "https://accounts.google.com" &&
    payload.iss !== "accounts.google.com"
  ) {
    throw new GoogleTokenError("bad_issuer");
  }

  if (payload.aud !== config.googleClientId) {
    throw new GoogleTokenError("bad_audience");
  }

  if (typeof payload.sub !== "string" || payload.sub === "") {
    throw new GoogleTokenError("missing_sub");
  }

  if (typeof payload.email !== "string" || payload.email === "") {
    throw new GoogleTokenError("missing_email");
  }

  // An unverified email would let someone claim an address they do not control,
  // and `users.email` is unique — so it would also let them collide with a real
  // user's row.
  if (payload.email_verified !== true) {
    throw new GoogleTokenError("email_unverified");
  }

  return {
    googleSub: payload.sub,
    email: payload.email,
    displayName:
      typeof payload.name === "string" && payload.name !== ""
        ? payload.name
        : null,
  };
}
