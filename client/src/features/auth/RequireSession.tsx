import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";

import { useSession } from "../../session";

/**
 * Route guard for account-only pages.
 *
 * Redirects to `/signin?next=<the path they wanted>` so a visitor lands back
 * where they were going. `next` is validated on the way out again in SignIn:
 * a redirect target that came from the URL is attacker-controlled, and an
 * unvalidated one is an open redirect.
 *
 * While the session probe is outstanding this renders nothing rather than
 * redirecting, or a signed-in visitor who deep-links to an account page would be
 * bounced to `/signin` before `/api/me` answered.
 */
export function RequireSession({ children }: { children: ReactNode }) {
  const { status, loading } = useSession();
  const location = useLocation();

  if (loading) return null;

  if (status !== "authenticated") {
    const next = `${location.pathname}${location.search}`;

    return <Navigate to={`/signin?next=${encodeURIComponent(next)}`} replace />;
  }

  return <>{children}</>;
}
