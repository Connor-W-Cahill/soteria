import { jwtVerify, SignJWT } from "jose";

import type { AuthConfig } from "./config.js";

/**
 * Our own session token: a compact HS256 JWT carried in an httpOnly cookie.
 *
 * The Google ID token is used exactly once, to establish who the user is, and is
 * then discarded. It is never stored and never put in a cookie: it is a
 * third-party credential with its own audience and lifetime, and holding onto it
 * would mean holding a token that can be replayed against Google.
 *
 * Claims are deliberately minimal — a user id and a token version. No email, no
 * display name, no Google subject: a cookie is the one piece of our state that
 * sits on a machine we do not control, so it carries an opaque key to our own
 * row and nothing that identifies the person if it leaks.
 */
export const SESSION_ALGORITHM = "HS256";
export const SESSION_ISSUER = "soteria";
export const SESSION_AUDIENCE = "soteria-web";
/** 7 days, per US-14. */
export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

export interface SessionClaims {
  /** `users.id`. */
  userId: string;
  /** `users.token_version` as of issuance. */
  tokenVersion: number;
}

export async function issueSessionToken(
  claims: SessionClaims,
  config: AuthConfig,
  now = new Date(),
): Promise<string> {
  const issuedAt = Math.floor(now.getTime() / 1000);

  return new SignJWT({ tv: claims.tokenVersion })
    .setProtectedHeader({ alg: SESSION_ALGORITHM })
    .setSubject(claims.userId)
    .setIssuer(SESSION_ISSUER)
    .setAudience(SESSION_AUDIENCE)
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + SESSION_TTL_SECONDS)
    .sign(config.sessionSecret);
}

/**
 * Verifies a session token's signature, issuer, audience and expiry.
 *
 * Returns `undefined` for every kind of bad token rather than throwing or
 * distinguishing them: a caller that cannot tell "expired" from "forged" from
 * "malformed" cannot leak that distinction to an attacker, and none of the three
 * changes what we do, which is to treat the request as anonymous.
 *
 * The algorithm is pinned. Without `algorithms`, a token claiming `alg: none`
 * or an asymmetric algorithm could be accepted against a key it was not signed
 * with — the classic JWT confusion bug.
 */
export async function verifySessionToken(
  token: string,
  config: AuthConfig,
): Promise<SessionClaims | undefined> {
  try {
    const { payload } = await jwtVerify(token, config.sessionSecret, {
      algorithms: [SESSION_ALGORITHM],
      issuer: SESSION_ISSUER,
      audience: SESSION_AUDIENCE,
    });

    const userId = payload.sub;
    const tokenVersion = payload.tv;

    if (typeof userId !== "string" || userId === "") return undefined;
    if (typeof tokenVersion !== "number" || !Number.isInteger(tokenVersion)) {
      return undefined;
    }

    return { userId, tokenVersion };
  } catch {
    return undefined;
  }
}
