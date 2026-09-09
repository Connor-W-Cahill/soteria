import { useCallback, useId, useRef, useState } from "react";
import {
  generatePassword,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  type PasswordOptions,
} from "@soteria/shared";
import { Button, Card, Checkbox, IconButton, useToast } from "../../components";
import "./password-generator.css";

type ClassKey = "uppercase" | "lowercase" | "digits" | "symbols";

const CLASS_LABELS: Record<ClassKey, string> = {
  uppercase: "Uppercase letters (A–Z)",
  lowercase: "Lowercase letters (a–z)",
  digits: "Digits (0–9)",
  symbols: "Symbols (!#$%…)",
};

const DEFAULT_OPTIONS: PasswordOptions = {
  length: 20,
  uppercase: true,
  lowercase: true,
  digits: true,
  symbols: true,
  avoidAmbiguous: false,
};

function CopyIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
    >
      <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" />
      <path d="M10.5 5.5V4A1.5 1.5 0 0 0 9 2.5H3.5A1.5 1.5 0 0 0 2 4v5.5A1.5 1.5 0 0 0 3.5 11H5" />
    </svg>
  );
}

/**
 * Browser-only random password generator (US-02).
 *
 * The generated value lives in component state only: it is never sent to any
 * server and never written to localStorage, sessionStorage or IndexedDB.
 */
export function PasswordGenerator() {
  const toast = useToast();
  const [options, setOptions] = useState<PasswordOptions>(DEFAULT_OPTIONS);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const outputRef = useRef<HTMLInputElement>(null);

  const lengthId = useId();
  const outputId = useId();

  const noClassSelected =
    !options.uppercase &&
    !options.lowercase &&
    !options.digits &&
    !options.symbols;

  const generate = useCallback(() => {
    try {
      setPassword(generatePassword(options));
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not generate a password.",
      );
      setPassword("");
    }
  }, [options]);

  const copy = useCallback(async () => {
    if (!password) return;
    try {
      await navigator.clipboard.writeText(password);
      toast.push("Password copied to your clipboard.");
    } catch {
      // Clipboard blocked (permissions, insecure context): select the field so
      // the user can copy manually.
      outputRef.current?.select();
      toast.push("Copy blocked — the password is selected, press Ctrl/Cmd+C.", {
        accent: true,
      });
    }
  }, [password, toast]);

  const setClass = (key: ClassKey, value: boolean) =>
    setOptions((prev) => ({ ...prev, [key]: value }));

  return (
    <Card title="Random password generator" className="sot-pwgen">
      <p className="sot-pwgen__lede">
        Generated in your browser with <code>crypto.getRandomValues</code>. The
        password is never sent anywhere and never saved.
      </p>

      <div className="sot-pwgen__output-row">
        <div className="sot-field sot-pwgen__output-field">
          <label className="sot-field__label" htmlFor={outputId}>
            Generated password
          </label>
          <input
            ref={outputRef}
            id={outputId}
            className="sot-input sot-pwgen__output"
            type="text"
            readOnly
            value={password}
            placeholder="Press Generate"
            aria-describedby={error ? `${outputId}-error` : undefined}
            spellCheck={false}
            autoComplete="off"
          />
          {error ? (
            <span
              className="sot-field__hint sot-pwgen__error"
              id={`${outputId}-error`}
            >
              {error}
            </span>
          ) : null}
        </div>
        <IconButton
          label="Copy password to clipboard"
          onClick={copy}
          disabled={!password}
        >
          <CopyIcon />
        </IconButton>
      </div>

      <div className="sot-field sot-pwgen__length">
        <label className="sot-field__label" htmlFor={lengthId}>
          Length: {options.length}
        </label>
        <input
          id={lengthId}
          className="sot-pwgen__slider"
          type="range"
          min={PASSWORD_MIN_LENGTH}
          max={PASSWORD_MAX_LENGTH}
          value={options.length}
          onChange={(e) =>
            setOptions((prev) => ({ ...prev, length: Number(e.target.value) }))
          }
        />
        <span className="sot-field__hint">
          Between {PASSWORD_MIN_LENGTH} and {PASSWORD_MAX_LENGTH} characters.
        </span>
      </div>

      <fieldset className="sot-pwgen__classes">
        <legend className="sot-field__label">Include</legend>
        {(Object.keys(CLASS_LABELS) as ClassKey[]).map((key) => (
          <Checkbox
            key={key}
            label={CLASS_LABELS[key]}
            checked={options[key]}
            onChange={(e) => setClass(key, e.target.checked)}
          />
        ))}
        <Checkbox
          label="Avoid ambiguous characters (I l 1 | O 0 o)"
          checked={options.avoidAmbiguous}
          onChange={(e) =>
            setOptions((prev) => ({
              ...prev,
              avoidAmbiguous: e.target.checked,
            }))
          }
        />
      </fieldset>

      {noClassSelected ? (
        <p className="sot-field__hint sot-pwgen__error" role="alert">
          Select at least one character type.
        </p>
      ) : null}

      <Button onClick={generate} disabled={noClassSelected}>
        Generate
      </Button>
    </Card>
  );
}

export default PasswordGenerator;
