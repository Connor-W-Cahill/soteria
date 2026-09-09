/**
 * Session state for the client.
 *
 * Soteria's password tools (US-01/02/03) are usable with no account, so the app
 * must render and behave correctly for an anonymous visitor. Until Google
 * sign-in ships (US-14), there is no session mechanism at all: every visitor is
 * anonymous and this module makes **no network request and reads no cookie** —
 * that is what keeps `/password-tools` and `/learn` free of `Set-Cookie`
 * headers and `/api/` calls (US-15).
 *
 * US-14 will replace {@link useSession}'s body with a `GET /api/me` query and
 * flip authenticated visitors to `"authenticated"`; nothing else here needs to
 * change.
 */

export type SessionStatus = "anonymous" | "authenticated";

export interface Session {
  status: SessionStatus;
}

/** The current session. Always anonymous until US-14. Performs no I/O. */
export function useSession(): Session {
  return { status: "anonymous" };
}
