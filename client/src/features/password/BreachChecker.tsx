import { useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router-dom";

import { Button, Card, IconButton } from "../../components";
import { checkPassword, type BreachStatus } from "./breach-check";
import {
  estimateStrength,
  type StrengthResult,
  type StrengthScore,
} from "./strength-check";
import { PrivacyExplainer } from "./PrivacyExplainer";

/**
 * US-01 + US-04: check a password against Have I Been Pwned and estimate its
 * strength, without the password leaving the browser.
 *
 * Both checks run locally: the breach check sends only a 5-character SHA-1
 * prefix to HIBP (see `breach-check.ts`), and the strength check runs entirely
 * in the page with zxcvbn and makes no network request at all (see
 * `strength-check.ts`). The password lives in component state only, is cleared
 * on unmount, and is never written to storage, a log, or the Soteria API.
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

/** Which of the five severity tints a score sits in. */
const SCORE_TONE: Record<StrengthScore, string> = {
  0: "critical",
  1: "critical",
  2: "medium",
  3: "low",
  4: "none",
};

function StrengthCard({
  result,
  failed,
}: {
  result: StrengthResult | null;
  failed: boolean;
}) {
  return (
    <Card className="pw-analysis__card">
      <h3 className="pw-analysis__card-title">Strength (estimated locally)</h3>
      <p className="pw-result__body">
        Worked out by your browser using a password-strength library. Your
        password is not sent anywhere for this.
      </p>

      {failed ? (
        <p className="pw-result__body">
          The strength check could not load this time. The breach check still
          works.
        </p>
      ) : null}

      {result ? (
        <>
          <p className="pw-analysis__headline">
            {result.label}
            <span className="pw-result__body"> — {result.score} out of 4</span>
          </p>
          <div
            className={`pw-strength__meter pw-strength__meter--${SCORE_TONE[result.score]}`}
            aria-hidden="true"
          >
            {[0, 1, 2, 3, 4].map((segment) => (
              <span
                key={segment}
                className={
                  segment <= result.score
                    ? "pw-strength__seg pw-strength__seg--on"
                    : "pw-strength__seg"
                }
              />
            ))}
          </div>
          <p className="pw-result__body">
            Estimated time for an attacker to guess it: {result.crackTime}.
          </p>
          {result.warning ? (
            <p className="pw-strength__warning">{result.warning}</p>
          ) : null}
          {result.suggestions.length > 0 ? (
            <>
              <p className="pw-strength__suggest-lead">To make it stronger:</p>
              <ul className="pw-strength__suggest">
                {result.suggestions.map((suggestion) => (
                  <li key={suggestion}>{suggestion}</li>
                ))}
              </ul>
            </>
          ) : null}
        </>
      ) : null}
    </Card>
  );
}

function BreachCard({ status }: { status: BreachStatus | null }) {
  return (
    <Card className="pw-analysis__card">
      <h3 className="pw-analysis__card-title">
        Breach status (from Have I Been Pwned)
      </h3>
      <p className="pw-result__body">
        Have I Been Pwned is a public record of passwords that have appeared in
        data breaches.
      </p>

      {status === null ? (
        <p className="pw-result__body">Checking…</p>
      ) : status.state === "error" ? (
        <>
          <p className="pw-analysis__headline">Breach status unavailable</p>
          <p className="pw-result__body">
            {ERROR_TEXT[status.reason] ?? ERROR_TEXT.offline}
          </p>
        </>
      ) : status.state === "breached" ? (
        <>
          <p className="pw-analysis__headline">Found in known breaches</p>
          <p className="pw-result__body">
            This password appears{" "}
            <strong>{status.count.toLocaleString()}</strong>{" "}
            {status.count === 1 ? "time" : "times"} in Have I Been Pwned&rsquo;s
            collection of breached passwords. Stop using it anywhere you have
            it, starting with your email account.
          </p>
        </>
      ) : (
        <>
          <p className="pw-analysis__headline">Not found in known breaches</p>
          <p className="pw-result__body">
            This password is not in Have I Been Pwned&rsquo;s collection. That
            does not mean it is hard to guess — check the estimate above.
          </p>
        </>
      )}
    </Card>
  );
}

type VerdictTone = "unsafe" | "weak" | "ok" | "caution";

function verdictFor(
  strength: StrengthResult | null,
  breach: BreachStatus | null,
): { tone: VerdictTone; title: string; body: string } {
  if (breach?.state === "breached") {
    return {
      tone: "unsafe",
      title: "Do not use this password",
      body: "It has appeared in a known data breach, so it is already on the lists attackers try first. A good strength score does not change that — once a password has leaked, it stays unsafe.",
    };
  }

  if (breach === null || breach.state === "error") {
    return {
      tone: "caution",
      title: "Breach status could not be checked",
      body: strength
        ? `The strength check still ran and rates this password "${strength.label}". Try the breach check again in a moment.`
        : "Try again in a moment.",
    };
  }

  // breach.state === "safe"
  if (strength && strength.score >= 3) {
    return {
      tone: "ok",
      title: "This password looks strong",
      body: `It did not appear in the breach data, and the strength check rates it "${strength.label}". Only use it in one place.`,
    };
  }

  return {
    tone: "weak",
    title: "This password is weak",
    body: strength
      ? `It did not appear in the breach data, but the strength check rates it "${strength.label}". The suggestions below will help.`
      : "It did not appear in the breach data, but it is easy to guess.",
  };
}

export function BreachChecker() {
  const [password, setPassword] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [breach, setBreach] = useState<BreachStatus | null>(null);
  const [strength, setStrength] = useState<StrengthResult | null>(null);
  const [strengthFailed, setStrengthFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const inputId = useId();
  const requestRef = useRef(0);

  // Clear every trace of the password when the component goes away, so
  // navigating off the page does not leave it in a retained React tree.
  useEffect(() => {
    return () => {
      setPassword("");
      setBreach(null);
      setStrength(null);
      setStrengthFailed(false);
    };
  }, []);

  function clearResults() {
    setBreach(null);
    setStrength(null);
    setStrengthFailed(false);
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (password === "" || busy) {
      return;
    }

    const request = ++requestRef.current;

    setBusy(true);
    clearResults();

    const [breachOutcome, strengthOutcome] = await Promise.allSettled([
      checkPassword(password),
      estimateStrength(password),
    ]);

    // Ignore results that a newer check has superseded.
    if (request !== requestRef.current) {
      return;
    }

    setBreach(
      breachOutcome.status === "fulfilled"
        ? breachOutcome.value
        : { state: "error", reason: "offline" },
    );

    if (strengthOutcome.status === "fulfilled") {
      setStrength(strengthOutcome.value);
    } else {
      setStrengthFailed(true);
    }

    setBusy(false);
  }

  const hasResult = breach !== null || strength !== null || strengthFailed;
  const verdict = hasResult ? verdictFor(strength, breach) : null;

  return (
    <section className="pw-tool" aria-labelledby="pw-check-heading">
      <h2 id="pw-check-heading">Check a password</h2>
      <p className="pw-tool__lede">
        This checks two separate things: how hard the password is to guess, and
        whether it has turned up in a known data breach. Your password is hashed
        in this browser; only the first five characters of that hash are sent to
        Have I Been Pwned. Soteria&rsquo;s own server never sees it.{" "}
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
                clearResults();
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

      <div className="pw-analysis">
        <div aria-live="polite" aria-atomic="true">
          {hasResult && verdict ? (
            <div className={`pw-verdict pw-verdict--${verdict.tone}`}>
              <p className="pw-verdict__title">{verdict.title}</p>
              <p className="pw-verdict__body">{verdict.body}</p>
            </div>
          ) : null}
        </div>
        {hasResult ? (
          <div className="pw-analysis__cards">
            <StrengthCard result={strength} failed={strengthFailed} />
            <BreachCard status={breach} />
          </div>
        ) : null}
      </div>
    </section>
  );
}
