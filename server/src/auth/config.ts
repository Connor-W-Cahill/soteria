/**
 * Auth configuration, read from the environment once per process.
 *
 * Both values are secrets in the sense that matters here: the client id fixes
 * the audience a Google ID token must carry, and the session secret signs our
 * own cookies. Neither is ever logged, and neither has a default — a missing
 * value fails the process at startup rather than silently disabling a check.
 */
export class AuthConfigError extends Error {
  constructor(name: string, reason: string) {
    super(`${name} is invalid: ${reason}`);
    this.name = "AuthConfigError";
  }
}

export interface AuthConfig {
  /** Google OAuth client id. Also the required `aud` of every ID token. */
  googleClientId: string;
  /** HMAC key for our own session cookies. */
  sessionSecret: Uint8Array;
  /** Whether to set the `Secure` cookie attribute. */
  secureCookies: boolean;
}

/** The shortest secret we accept. 32 bytes is the HS256 block size. */
export const MIN_SESSION_SECRET_BYTES = 32;

export function readAuthConfig(
  env: NodeJS.ProcessEnv = process.env,
): AuthConfig {
  const googleClientId = env.GOOGLE_CLIENT_ID?.trim();

  if (googleClientId === undefined || googleClientId === "") {
    throw new AuthConfigError("GOOGLE_CLIENT_ID", "it is missing or empty");
  }

  const secret = env.SESSION_SECRET?.trim();

  if (secret === undefined || secret === "") {
    throw new AuthConfigError("SESSION_SECRET", "it is missing or empty");
  }

  const bytes = new TextEncoder().encode(secret);

  if (bytes.byteLength < MIN_SESSION_SECRET_BYTES) {
    // The length is safe to report; the value is not.
    throw new AuthConfigError(
      "SESSION_SECRET",
      `it must be at least ${MIN_SESSION_SECRET_BYTES} bytes, got ${bytes.byteLength}`,
    );
  }

  return {
    googleClientId,
    sessionSecret: bytes,
    // Secure cookies everywhere except plain-HTTP local development, where the
    // browser would refuse to store them.
    secureCookies:
      env.NODE_ENV === "production" || env.FORCE_SECURE_COOKIES === "1",
  };
}
