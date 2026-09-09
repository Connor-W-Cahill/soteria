import { describe, expect, it } from "vitest";

import { CONFIRM_WORD, DELETED_DATA, isConfirmed } from "./Settings";

/**
 * The delete button unlocks only on an exact, case-sensitive match of the
 * confirmation word. A near miss must not arm a destructive, irreversible
 * action.
 */
describe("isConfirmed", () => {
  it("accepts only the exact word", () => {
    expect(isConfirmed("DELETE")).toBe(true);
  });

  for (const near of ["delete", "Delete", " DELETE", "DELETE ", "DELET", ""]) {
    it(`rejects ${JSON.stringify(near)}`, () => {
      expect(isConfirmed(near)).toBe(false);
    });
  }

  it("is the word the label tells the user to type", () => {
    expect(isConfirmed(CONFIRM_WORD)).toBe(true);
  });
});

describe("DELETED_DATA", () => {
  it("names every category of stored data and the account itself", () => {
    const all = DELETED_DATA.join(" ").toLowerCase();

    for (const thing of [
      "questionnaire",
      "score",
      "coach",
      "software",
      "cve",
      "alert",
      "recommendation",
      "notification",
      "account",
    ]) {
      expect(all, thing).toContain(thing);
    }
  });
});
