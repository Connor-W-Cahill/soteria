import { afterEach, describe, expect, it, vi } from "vitest";

import { estimateStrength } from "./strength-check.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("estimateStrength", () => {
  it("rates a notorious password as very weak, with a warning and suggestions", async () => {
    const result = await estimateStrength("password");

    expect(result.score).toBe(0);
    expect(result.label).toBe("Very weak");
    expect(result.warning).toBeTruthy();
    expect(result.suggestions.length).toBeGreaterThan(0);
    expect(typeof result.crackTime).toBe("string");
    expect(result.crackTime.length).toBeGreaterThan(0);
  });

  it("rates a long random passphrase as strong, with no warning", async () => {
    const result = await estimateStrength("correct-horse-battery-staple-9x");

    expect(result.score).toBe(4);
    expect(result.label).toBe("Strong");
    expect(result.warning).toBeNull();
    expect(result.suggestions).toEqual([]);
  });

  it("maps every score to a distinct plain-language label", async () => {
    const samples: Record<number, string> = {};
    for (const password of [
      "password",
      "password1",
      "helloworld123",
      "Tr0ub4dour&3xY",
      "correct-horse-battery-staple-9x",
    ]) {
      const { score, label } = await estimateStrength(password);
      samples[score] = label;
    }

    // Labels are non-empty and unique per score value we saw.
    const labels = Object.values(samples);
    expect(new Set(labels).size).toBe(labels.length);
    expect(labels.every((label) => label.length > 0)).toBe(true);
  });

  it("makes no network request", async () => {
    const fetchSpy = vi.fn(() => {
      throw new Error("strength estimation must not touch the network");
    });
    vi.stubGlobal("fetch", fetchSpy);

    await estimateStrength("some-test-password-123");

    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
