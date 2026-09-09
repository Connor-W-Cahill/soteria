import type { MeResponse, SessionUser } from "@soteria/shared";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

/**
 * Session state for the client (US-14).
 *
 * The hard constraint this module exists to satisfy is US-15: `/password-tools`
 * and `/learn` must make **no `/api/` call**, set **no cookie**, and contact **no
 * origin outside the fonts/HIBP allowlist** for a visitor who has not signed in.
 * A provider that simply fetched `GET /api/me` on mount would break all three —
 * every anonymous visitor to the password tools would hit the Soteria backend,
 * which is exactly what ADR-0007 and the privacy page promise does not happen.
 *
 * So the probe is *gated on evidence that a session might exist*. The session
 * cookie is `httpOnly`, so script cannot read it; instead sign-in writes a
 * one-bit hint to `localStorage` and sign-out removes it. A browser that has
 * never signed in has no hint, makes no request, and stays anonymous by
 * construction rather than by the backend happening to answer `{ user: null }`.
 *
 * The hint is deliberately worthless: a literal `"1"`, no id, no email, no
 * token. It never leaves the browser, it cannot authenticate anything, and if it
 * is stale the probe returns `{ user: null }` and it is cleared. Anyone who can
 * read it already has the machine.
 */
export type SessionStatus = "anonymous" | "authenticated";

export interface Session {
  status: SessionStatus;
  user: SessionUser | null;
  /** True while the `/api/me` probe is outstanding. */
  loading: boolean;
  /** Exchange a Google ID token for a session cookie. */
  signIn: (credential: string) => Promise<void>;
  signOut: () => Promise<void>;
  /**
   * Delete this account and every row it owns (US-20). The server revokes the
   * session before it deletes, so on return this browser is signed out.
   */
  deleteAccount: () => Promise<void>;
}

/** Set when a session is established, removed when it ends. Value is meaningless. */
export const SESSION_HINT_KEY = "soteria.session-hint";

function readHint(): boolean {
  try {
    return window.localStorage.getItem(SESSION_HINT_KEY) === "1";
  } catch {
    // Private windows and blocked site data both throw. No hint means no probe,
    // which is the safe direction: the visitor is treated as anonymous.
    return false;
  }
}

function writeHint(present: boolean): void {
  try {
    if (present) window.localStorage.setItem(SESSION_HINT_KEY, "1");
    else window.localStorage.removeItem(SESSION_HINT_KEY);
  } catch {
    // Not being able to remember is not an error; it only costs a signed-in
    // visitor their avatar until they act.
  }
}

const API_BASE = import.meta.env.VITE_API_URL ?? "";

/** `credentials: "include"` so the session cookie is sent and accepted. */
async function apiJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...init.headers },
  });

  if (!response.ok) {
    throw new Error(
      `${init.method ?? "GET"} ${path} failed: ${response.status}`,
    );
  }

  return response.status === 204
    ? (undefined as T)
    : ((await response.json()) as T);
}

const SessionContext = createContext<Session | undefined>(undefined);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  // Only a browser that has signed in before starts out loading. Everyone else
  // renders as anonymous immediately, having made no request.
  const [loading, setLoading] = useState(() => readHint());
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!readHint()) return;

    let cancelled = false;

    apiJson<MeResponse>("/api/me")
      .then((body) => {
        if (cancelled) return;
        setUser(body.user);
        // A hint with no session behind it is stale; stop probing on every load.
        if (body.user === null) writeHint(false);
      })
      .catch(() => {
        // A network failure is not proof the session is gone, so the hint stays.
        if (!cancelled) setUser(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async (credential: string) => {
    const body = await apiJson<MeResponse>("/api/auth/google", {
      method: "POST",
      body: JSON.stringify({ credential }),
    });

    setUser(body.user);
    writeHint(body.user !== null);
  }, []);

  const signOut = useCallback(async () => {
    try {
      await apiJson<void>("/api/auth/logout", { method: "POST" });
    } finally {
      // Local state is cleared even if the call failed: the cookie may already be
      // gone, and leaving the UI signed in would be a lie either way.
      setUser(null);
      writeHint(false);
    }
  }, []);

  const deleteAccount = useCallback(async () => {
    try {
      await apiJson<void>("/api/me", {
        method: "DELETE",
        body: JSON.stringify({ confirmation: "DELETE" }),
      });
    } finally {
      // Cleared even if the response never arrived: the server bumps
      // token_version before it deletes, so by the time this call is in flight
      // the cookie is already dead. Leaving the UI signed in would be a lie, and
      // a stale hint self-heals anyway — the next `/api/me` probe returns
      // `{ user: null }` and removes it. Same shape as `signOut`.
      setUser(null);
      writeHint(false);
    }
  }, []);

  const value = useMemo<Session>(
    () => ({
      status: user === null ? "anonymous" : "authenticated",
      user,
      loading,
      signIn,
      signOut,
      deleteAccount,
    }),
    [user, loading, signIn, signOut, deleteAccount],
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

/** The current session. Anonymous, with no I/O, until this browser signs in. */
export function useSession(): Session {
  const session = useContext(SessionContext);

  if (session === undefined) {
    throw new Error("useSession must be used inside a SessionProvider");
  }

  return session;
}
