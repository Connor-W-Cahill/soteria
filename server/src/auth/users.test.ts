import { describe, expect, it, vi } from "vitest";

import { ApiError } from "../http/errors.js";
import { upsertGoogleUser } from "./users.js";
import type { GoogleIdentity } from "./google.js";

const IDENTITY: GoogleIdentity = {
  googleSub: "google-subject-123",
  email: "person@example.com",
  displayName: "A Person",
};

/**
 * A knex stand-in whose `transaction` throws whatever a test hands it. The real
 * collision needs a live SQL Server, which this machine does not have, so the
 * driver's error shape is reproduced from the message SQL Server actually emits
 * (error 2627, naming the constraint and echoing the duplicate value).
 */
function dbThrowing(error: unknown) {
  return {
    transaction: vi.fn(async () => {
      throw error;
    }),
  } as unknown as Parameters<typeof upsertGoogleUser>[1];
}

function uniqueViolation(number: number, message: string): Error {
  return Object.assign(new Error(message), { number });
}

describe("upsertGoogleUser — email collision (review finding 5)", () => {
  const EMAIL_COLLISION =
    "Violation of UNIQUE KEY constraint 'users_email_unique'. Cannot insert duplicate key in object 'dbo.users'. The duplicate key value is (person@example.com).";

  for (const number of [2627, 2601]) {
    it(`turns SQL Server error ${number} on email into a conflict`, async () => {
      // Two reachable cases: a returning user whose Google email changed onto an
      // address already held by another row, and a new google_sub carrying a
      // recycled address (a recreated Workspace account keeps the old email).
      // Unhandled, either one 500s on every attempt — a permanent lockout.
      const error = await upsertGoogleUser(
        IDENTITY,
        dbThrowing(uniqueViolation(number, EMAIL_COLLISION)),
      ).catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).code).toBe("conflict");
      expect((error as ApiError).status).toBe(409);
    });
  }

  it("never echoes the colliding address", async () => {
    // The driver's message contains it; ours is shown to whoever asked.
    let error: ApiError | undefined;

    try {
      await upsertGoogleUser(
        IDENTITY,
        dbThrowing(uniqueViolation(2627, EMAIL_COLLISION)),
      );
    } catch (caught) {
      error = caught as ApiError;
    }

    expect(error).toBeInstanceOf(ApiError);
    expect(error?.message).not.toContain("person@example.com");
    expect(error?.message).not.toContain("users_email_unique");
    expect(error?.message).toContain("already linked");
  });

  it("does not claim an email collision for a google_sub collision", async () => {
    // A google_sub duplicate is a different bug — the upsert matches on that
    // column, so hitting it means the lookup failed — and mislabelling it as an
    // email conflict would send the user chasing the wrong account.
    const error = await upsertGoogleUser(
      IDENTITY,
      dbThrowing(
        uniqueViolation(
          2627,
          "Violation of UNIQUE KEY constraint 'users_google_sub_unique'.",
        ),
      ),
    ).catch((caught: unknown) => caught);

    expect(error).not.toBeInstanceOf(ApiError);
  });

  it("rethrows an unrelated database error untouched", async () => {
    const original = uniqueViolation(1205, "Transaction was deadlocked");
    const error = await upsertGoogleUser(IDENTITY, dbThrowing(original)).catch(
      (caught: unknown) => caught,
    );

    expect(error).toBe(original);
  });

  it("rethrows a non-object failure untouched", async () => {
    const error = await upsertGoogleUser(IDENTITY, dbThrowing("nope")).catch(
      (caught: unknown) => caught,
    );

    expect(error).toBe("nope");
  });
});
