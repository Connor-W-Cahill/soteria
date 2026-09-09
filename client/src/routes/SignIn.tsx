import { useCallback, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";

import { Card } from "../components";
import { GoogleSignInButton } from "../features/auth/GoogleSignInButton";
import { useSession } from "../session";

/**
 * Returns a safe in-app destination for `?next=`, or the dashboard.
 *
 * `next` arrives from the URL, so it is attacker-controlled. Only a single
 * absolute in-app path is accepted: anything protocol-relative (`//evil.example`),
 * absolute (`https://evil.example`), or backslash-prefixed — which some browsers
 * normalise to `/` — would be an open redirect that laundered our origin's
 * credibility into someone else's page.
 */
export function safeNext(raw: string | null): string {
  if (raw === null || raw === "") return "/dashboard";
  if (!raw.startsWith("/")) return "/dashboard";
  if (raw.startsWith("//") || raw.startsWith("/\\")) return "/dashboard";
  if (raw.includes("\\")) return "/dashboard";

  return raw;
}

/** `/signin`. The only page in the app that loads anything from Google. */
export default function SignIn() {
  const { status, loading, signIn } = useSession();
  const location = useLocation();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const next = safeNext(new URLSearchParams(location.search).get("next"));

  const onCredential = useCallback(
    (credential: string) => {
      setError(null);
      setBusy(true);

      signIn(credential)
        .then(() => navigate(next, { replace: true }))
        .catch(() => {
          setError("That sign-in could not be completed. Please try again.");
        })
        .finally(() => setBusy(false));
    },
    [signIn, navigate, next],
  );

  if (!loading && status === "authenticated") {
    return <Navigate to={next} replace />;
  }

  return (
    <div className="signin">
      <h1>Sign in</h1>
      <Card title="Sign in with Google">
        <p className="signin__lede">
          Soteria uses your Google account so you never create another password.
          Signing in saves your questionnaire answers, software profile and
          progress.
        </p>
        <p className="signin__lede">
          The password tools do not need an account. They run entirely in your
          browser whether you sign in or not.
        </p>

        {busy ? <p role="status">Signing you in…</p> : null}
        {error === null ? null : (
          <p className="signin__error" role="alert">
            {error}
          </p>
        )}

        <GoogleSignInButton onCredential={onCredential} onError={setError} />
      </Card>
    </div>
  );
}
