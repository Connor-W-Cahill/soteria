import { useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router-dom";

import { Button, Card, IconButton } from "../../components";
import { checkPassword, type BreachStatus } from "./breach-check";
import { PrivacyExplainer } from "./PrivacyExplainer";

/**
 * US-01: check a password against Have I Been Pwned without it leaving the
 * browser. The password lives in component state only, is cleared on unmount,
 * and is never written to storage, a log, or the Soteria API.
 */

const ERROR_TEXT: Record<string, string> = {
  offline:
    "Could not reach the breach service. Check your connection and try again — the rest of the tools still work.",
  "service-unavailable":
    "The breach service is not responding right now. Try again in a moment — the rest of the tools still work.",
  "insecure-context":
    "This check needs a secure (HTTPS) connection, because the password is hashed in your browser.",
};

function EyeIcon({ off }: { off: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
      {off ? (
        <path
          d="M4 20 20 4"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      ) : null}
    </svg>
  );
}

function ResultCard({ status }: { status: BreachStatus }) {
  if (status.state === "error") {
    return (
      <Card className="pw-result pw-result--error">
        <h3 className="pw-result__title">Breach status unavailable</h3>
        <p className="pw-result__body">
          {ERROR_TEXT[status.reason] ?? ERROR_TEXT.offline}
        </p>
      </Card>
    );
  }

  if (status.state === "breached") {
    return (
      <Card className="pw-result pw-result--breached">
        <h3 className="pw-result__title">Found in known breaches</h3>
        <p className="pw-result__body">
          This password appears <strong>{status.count.toLocaleString()}</strong>{" "}
          {status.count === 1 ? "time" : "times"} in Have I Been Pwned&rsquo;s
          collection of breached passwords. Stop using it anywhere you have it,
          starting with your email account.
        </p>
      </Card>
    );
  }

  return (
    <Card className="pw-result pw-result--safe">
      <h3 className="pw-result__title">Not found in known breaches</h3>
      <p className="pw-result__body">
        This password is not in Have I Been Pwned&rsquo;s collection. That does
        not mean it is strong — a password can be unique and still easy to
        guess.
      </p>
    </Card>
  );
}

export function BreachChecker() {
  const [password, setPassword] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [status, setStatus] = useState<BreachStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const inputId = useId();
  const requestRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  /**
   * Retire the check that is currently in flight, if any.
   *
   * Bumping the counter is what makes the staleness guard in `onSubmit`
   * reachable: without it, a second submit is impossible while `busy` is true,
   * so the counter never advanced and the guard could never be false. Aborting
   * as well means the superseded range request is cancelled rather than merely
   * ignored.
   */
  function supersedeInFlight(): boolean {
    if (abortRef.current === null) {
      return false;
    }

    requestRef.current += 1;
    abortRef.current.abort();
    abortRef.current = null;

    return true;
  }

  // Drop an in-flight check when the component goes away. Note this effect does
  // not clear the password: `setPassword("")` on an unmounting component is
  // discarded by React. The value is gone because the tree is gone, which the
  // navigation test covers.
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, []);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (password === "" || busy) {
      return;
    }

    supersedeInFlight();

    const request = ++requestRef.current;
    const controller = new AbortController();
    abortRef.current = controller;

    setBusy(true);
    setStatus(null);

    const result = await checkPassword(password, { signal: controller.signal });

    // Discard a response that an edit or a newer check has superseded. Rendering
    // it would show a verdict for a password the field no longer holds — and in
    // the dangerous direction, "not found" for a value that was never checked.
    // Whoever superseded this request owns `busy` from here on.
    if (request !== requestRef.current) {
      return;
    }

    abortRef.current = null;
    setBusy(false);
    setStatus(result);
  }

  return (
    <section className="pw-tool" aria-labelledby="pw-check-heading">
      <h2 id="pw-check-heading">Check a password against known breaches</h2>
      <p className="pw-tool__lede">
        Your password is hashed in this browser. Only the first five characters
        of that hash are sent to Have I Been Pwned. Soteria&rsquo;s own server
        never sees it.{" "}
        <Link to="/learn/password-privacy">
          Read more about password privacy
        </Link>
      </p>

      <details className="pw-privacy__disclosure">
        <summary>How this works</summary>
        <PrivacyExplainer />
      </details>

      <form className="pw-tool__form" onSubmit={onSubmit}>
        <div className="sot-field">
          <label className="sot-field__label" htmlFor={inputId}>
            Password to check
          </label>
          <div className="pw-tool__input-row">
            <input
              id={inputId}
              className="sot-input pw-tool__input"
              type={revealed ? "text" : "password"}
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                setStatus(null);

                // Editing the password retires any check still running for the
                // previous value, and releases the control so the new value can
                // be checked straight away.
                if (supersedeInFlight()) {
                  setBusy(false);
                }
              }}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              data-1p-ignore="true"
              data-lpignore="true"
              name="soteria-breach-check"
            />
            <IconButton
              label={revealed ? "Hide password" : "Show password"}
              type="button"
              onClick={() => setRevealed((value) => !value)}
            >
              <EyeIcon off={revealed} />
            </IconButton>
          </div>
        </div>

        <Button type="submit" disabled={password === "" || busy}>
          {busy ? "Checking…" : "Check password"}
        </Button>
      </form>

      <div aria-live="polite" aria-atomic="true">
        {status ? <ResultCard status={status} /> : null}
      </div>
    </section>
  );
}
