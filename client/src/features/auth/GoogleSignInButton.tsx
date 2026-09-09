import { useEffect, useRef, useState } from "react";

/**
 * The Google Identity Services button.
 *
 * The GIS script is loaded **here**, on demand, and nowhere else. That is a
 * privacy requirement, not a performance one: US-15 asserts that an anonymous
 * visitor to `/password-tools` or `/learn` contacts no origin outside the
 * fonts/HIBP allowlist, so `accounts.google.com` must not be fetched by the app
 * shell. This component is only ever rendered on `/signin`, so a visitor who
 * never tries to sign in never talks to Google at all.
 *
 * See ADR-0008 for the CSP directives this requires.
 */
const GIS_SRC = "https://accounts.google.com/gsi/client";

interface CredentialResponse {
  credential?: string;
}

interface GoogleIdentityApi {
  accounts: {
    id: {
      initialize: (options: {
        client_id: string;
        callback: (response: CredentialResponse) => void;
        auto_select?: boolean;
      }) => void;
      renderButton: (
        parent: HTMLElement,
        options: Record<string, unknown>,
      ) => void;
    };
  };
}

function loadScript(): Promise<void> {
  const existing = document.querySelector<HTMLScriptElement>(
    `script[src="${GIS_SRC}"]`,
  );

  if (existing !== null) {
    return existing.dataset.loaded === "1"
      ? Promise.resolve()
      : new Promise((resolve, reject) => {
          existing.addEventListener("load", () => resolve());
          existing.addEventListener("error", () =>
            reject(new Error("Google sign-in could not be loaded.")),
          );
        });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = GIS_SRC;
    script.async = true;
    script.addEventListener("load", () => {
      script.dataset.loaded = "1";
      resolve();
    });
    script.addEventListener("error", () =>
      reject(new Error("Google sign-in could not be loaded.")),
    );
    document.head.append(script);
  });
}

export interface GoogleSignInButtonProps {
  /** Called with the Google ID token. Never stored; handed straight to the API. */
  onCredential: (credential: string) => void;
  onError: (message: string) => void;
}

export function GoogleSignInButton({
  onCredential,
  onError,
}: GoogleSignInButtonProps) {
  const host = useRef<HTMLDivElement>(null);
  const [unavailable, setUnavailable] = useState<string | null>(null);
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "";

  useEffect(() => {
    if (clientId === "") {
      setUnavailable(
        "Google sign-in is not configured in this environment (VITE_GOOGLE_CLIENT_ID).",
      );
      return;
    }

    let cancelled = false;

    loadScript()
      .then(() => {
        if (cancelled || host.current === null) return;

        const google = (window as unknown as { google?: GoogleIdentityApi })
          .google;

        if (google === undefined) {
          setUnavailable("Google sign-in could not be loaded.");
          return;
        }

        google.accounts.id.initialize({
          client_id: clientId,
          callback: (response) => {
            if (
              typeof response.credential !== "string" ||
              response.credential === ""
            ) {
              onError("Google did not return a credential. Please try again.");
              return;
            }

            onCredential(response.credential);
          },
          // No One Tap and no automatic sign-in: a session must follow a
          // deliberate click, so landing on /signin never silently authenticates.
          auto_select: false,
        });

        google.accounts.id.renderButton(host.current, {
          type: "standard",
          theme: "outline",
          size: "large",
          text: "signin_with",
          shape: "rectangular",
        });
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setUnavailable(
            error instanceof Error
              ? error.message
              : "Google sign-in could not be loaded.",
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [clientId, onCredential, onError]);

  if (unavailable !== null) {
    return (
      <p className="signin__unavailable" role="status">
        {unavailable}
      </p>
    );
  }

  return <div ref={host} className="signin__google" />;
}
