import { EFF_LARGE_WORDLIST } from "@soteria/shared";

const WORDS = new Set(EFF_LARGE_WORDLIST);

/** Recover the words actually drawn for `phrase`.
 *
 * Counting words with `phrase.split(separator)` is wrong whenever the separator
 * can occur inside a word, and it can: four EFF large-wordlist entries are
 * hyphenated (`drop-down`, `felt-tip`, `t-shirt`, `yo-yo`) and `-` is an offered
 * separator. A naive split then returns one fragment too many and fails on a
 * perfectly correct passphrase — see #99 and #102.
 *
 * This backtracks over separator positions, keeping only splits where every
 * piece is a real list entry, so asserting the result is non-null is strictly
 * stronger than counting fragments. Matching is case-insensitive so a
 * capitalized phrase segments too; the returned pieces keep their original case.
 *
 * Returns `null` when no segmentation into `words` list entries exists.
 */
export function segmentPassphrase(
  phrase: string,
  separator: string,
  words: number,
): string[] | null {
  const lower = phrase.toLowerCase();

  const solve = (from: number, remaining: number): string[] | null => {
    if (remaining === 1) {
      return WORDS.has(lower.slice(from)) ? [phrase.slice(from)] : null;
    }

    for (
      let at = lower.indexOf(separator, from);
      at !== -1;
      at = lower.indexOf(separator, at + 1)
    ) {
      if (!WORDS.has(lower.slice(from, at))) continue;
      const rest = solve(at + separator.length, remaining - 1);
      if (rest !== null) return [phrase.slice(from, at), ...rest];
    }

    return null;
  };

  return solve(0, words);
}
