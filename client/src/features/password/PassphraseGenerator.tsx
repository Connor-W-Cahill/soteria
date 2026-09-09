import { useCallback, useId, useMemo, useRef, useState } from "react";
import {
  EFF_LARGE_WORDLIST_SIZE,
  generatePassphrase,
  PASSPHRASE_MAX_WORDS,
  PASSPHRASE_MIN_WORDS,
  PASSPHRASE_SEPARATORS,
  passphraseEntropyBits,
  type PassphraseOptions,
} from "@soteria/shared";
import {
  Button,
  Card,
  Checkbox,
  IconButton,
  Select,
  useToast,
} from "../../components";
import "./passphrase-generator.css";

const DEFAULT_OPTIONS: PassphraseOptions = {
  words: 5,
  separator: "-",
  capitalize: false,
  includeDigit: false,
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
 * Browser-only EFF-wordlist passphrase generator (US-03).
 *
 * The passphrase lives in component state only: it is never sent to any server
 * and never written to localStorage, sessionStorage or IndexedDB.
 */
export function PassphraseGenerator() {
  const toast = useToast();
  const [options, setOptions] = useState<PassphraseOptions>(DEFAULT_OPTIONS);
  const [passphrase, setPassphrase] = useState("");
  const outputRef = useRef<HTMLInputElement>(null);

  const wordsId = useId();
  const outputId = useId();

  const entropyBits = useMemo(() => passphraseEntropyBits(options), [options]);

  const generate = useCallback(() => {
    setPassphrase(generatePassphrase(options));
  }, [options]);

  const copy = useCallback(async () => {
    if (!passphrase) return;
    try {
      await navigator.clipboard.writeText(passphrase);
      toast.push("Passphrase copied to your clipboard.");
    } catch {
      outputRef.current?.select();
      toast.push(
        "Copy blocked — the passphrase is selected, press Ctrl/Cmd+C.",
        { accent: true },
      );
    }
  }, [passphrase, toast]);

  return (
    <Card title="Passphrase generator" className="sot-ppgen">
      <p className="sot-ppgen__lede">
        A memorable phrase, each word picked in your browser with{" "}
        <code>crypto.getRandomValues</code> from the 7,776-word EFF wordlist. It
        is never sent anywhere and never saved.
      </p>

      <div className="sot-ppgen__output-row">
        <div className="sot-field sot-ppgen__output-field">
          <label className="sot-field__label" htmlFor={outputId}>
            Generated passphrase
          </label>
          <input
            ref={outputRef}
            id={outputId}
            className="sot-input sot-ppgen__output"
            type="text"
            readOnly
            value={passphrase}
            placeholder="Press Generate"
            spellCheck={false}
            autoComplete="off"
          />
        </div>
        <IconButton
          label="Copy passphrase to clipboard"
          onClick={copy}
          disabled={!passphrase}
        >
          <CopyIcon />
        </IconButton>
      </div>

      <p className="sot-ppgen__entropy" aria-live="polite">
        <strong>≈ {Math.round(entropyBits)} bits of entropy.</strong> Each word
        is one of {EFF_LARGE_WORDLIST_SIZE.toLocaleString()} chosen uniformly at
        random, so every word adds about{" "}
        {Math.log2(EFF_LARGE_WORDLIST_SIZE).toFixed(1)} bits — more words means
        an exponentially harder guess.
      </p>

      <div className="sot-field sot-ppgen__words">
        <label className="sot-field__label" htmlFor={wordsId}>
          Words: {options.words}
        </label>
        <input
          id={wordsId}
          className="sot-ppgen__slider"
          type="range"
          min={PASSPHRASE_MIN_WORDS}
          max={PASSPHRASE_MAX_WORDS}
          value={options.words}
          onChange={(e) =>
            setOptions((prev) => ({ ...prev, words: Number(e.target.value) }))
          }
        />
        <span className="sot-field__hint">
          Between {PASSPHRASE_MIN_WORDS} and {PASSPHRASE_MAX_WORDS} words.
        </span>
      </div>

      <Select
        label="Separator"
        value={options.separator}
        onChange={(e) =>
          setOptions((prev) => ({ ...prev, separator: e.target.value }))
        }
      >
        {PASSPHRASE_SEPARATORS.map((sep) => (
          <option key={sep.label} value={sep.value}>
            {sep.label}
          </option>
        ))}
      </Select>

      <fieldset className="sot-ppgen__options">
        <legend className="sot-field__label">Options</legend>
        <Checkbox
          label="Capitalize each word"
          checked={options.capitalize}
          onChange={(e) =>
            setOptions((prev) => ({ ...prev, capitalize: e.target.checked }))
          }
        />
        <Checkbox
          label="Append a random digit"
          checked={options.includeDigit}
          onChange={(e) =>
            setOptions((prev) => ({ ...prev, includeDigit: e.target.checked }))
          }
        />
      </fieldset>

      <Button onClick={generate}>Generate</Button>
    </Card>
  );
}

export default PassphraseGenerator;
