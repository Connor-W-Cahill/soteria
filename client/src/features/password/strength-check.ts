/**
 * US-04: local password strength estimation with `@zxcvbn-ts/core`.
 *
 * This runs entirely in the browser. The password is passed straight to zxcvbn
 * and never touches the network — zxcvbn makes no requests, and nothing here
 * calls `fetch`. The language packs, which are large, are loaded with dynamic
 * `import()` so they land in their own chunk instead of the initial route
 * bundle, and only when a strength check is actually run.
 */

import type { ZxcvbnResult } from "@zxcvbn-ts/core";

export type StrengthScore = 0 | 1 | 2 | 3 | 4;

export interface StrengthResult {
  /** zxcvbn's 0–4 score. 0 is trivially guessable, 4 is very strong. */
  score: StrengthScore;
  /** Plain-language name for the score, e.g. "Weak". */
  label: string;
  /**
   * How long zxcvbn estimates the password would resist an offline guessing
   * attack against a slow, salted hash (10k guesses/second), already formatted
   * for display, e.g. "3 hours" or "centuries".
   */
  crackTime: string;
  /** zxcvbn's single headline warning, or null when it has none. */
  warning: string | null;
  /** zxcvbn's actionable suggestions, in plain language. May be empty. */
  suggestions: string[];
}

const SCORE_LABELS: Record<StrengthScore, string> = {
  0: "Very weak",
  1: "Weak",
  2: "Fair",
  3: "Good",
  4: "Strong",
};

type ZxcvbnCheck = (password: string) => ZxcvbnResult;

let checkerPromise: Promise<ZxcvbnCheck> | null = null;

/**
 * Builds the zxcvbn checker once, pulling in the English + common language
 * packs on first use. Subsequent calls reuse the same instance.
 */
async function loadChecker(): Promise<ZxcvbnCheck> {
  if (checkerPromise === null) {
    checkerPromise = (async () => {
      const [core, common, en] = await Promise.all([
        import("@zxcvbn-ts/core"),
        import("@zxcvbn-ts/language-common"),
        import("@zxcvbn-ts/language-en"),
      ]);

      const zxcvbn = new core.ZxcvbnFactory({
        dictionary: { ...common.dictionary, ...en.dictionary },
        graphs: common.adjacencyGraphs,
        translations: en.translations,
      });

      return (password: string) => zxcvbn.check(password);
    })().catch((error) => {
      // Let the next call retry rather than caching a rejected promise.
      checkerPromise = null;
      throw error;
    });
  }

  return checkerPromise;
}

export async function estimateStrength(
  password: string,
): Promise<StrengthResult> {
  const check = await loadChecker();
  const result = check(password);
  const score = result.score as StrengthScore;

  return {
    score,
    label: SCORE_LABELS[score],
    crackTime: result.crackTimes.offlineSlowHashingXPerSecond.display,
    warning: result.feedback.warning ?? null,
    suggestions: result.feedback.suggestions,
  };
}
