import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import { createApp } from "../app.js";
import { SESSION_COOKIE } from "../auth/cookie.js";
import { issueSessionToken } from "../auth/session.js";
import { TEST_AUTH_CONFIG } from "../auth/testing.js";
import type { UserRecord } from "../auth/users.js";

const USER: UserRecord = {
  id: "22222222-2222-4222-8222-222222222222",
  email: "leaving@example.com",
  displayName: "On Their Way Out",
  tokenVersion: 5,
};

interface Overrides {
  user?: UserRecord | undefined;
  bumpVersion?: (id: string) => Promise<number | undefined>;
  deleteAccount?: (id: string, requestId: string | undefined) => Promise<void>;
}

/** An app with the database stubbed, so only the route's own logic is tested. */
function testApp(overrides: Overrides = {}) {
  const user = "user" in overrides ? overrides.user : USER;

  return createApp({
    checkDbConnection: async () => true,
    enableRateLimit: false,
    auth: TEST_AUTH_CONFIG,
    loadSessionUser: async () => user,
    authRouterOptions: {
      verifyIdToken: async () => {
        throw new Error("not used");
      },
      upsertUser: async () => USER,
      bumpVersion: async () => 1,
      audit: async () => {},
    },
    accountRouterOptions: {
      bumpVersion: overrides.bumpVersion ?? (async () => USER.tokenVersion + 1),
      deleteAccount: overrides.deleteAccount ?? (async () => {}),
    },
  });
}

async function cookieFor(user: UserRecord): Promise<string> {
  const token = await issueSessionToken(
    { userId: user.id, tokenVersion: user.tokenVersion },
    TEST_AUTH_CONFIG,
  );

  return `${SESSION_COOKIE}=${token}`;
}

function sessionCookie(response: request.Response): string | undefined {
  const raw = response.headers["set-cookie"];
  const all = Array.isArray(raw) ? raw : raw === undefined ? [] : [raw];

  return all.find((value) => value.startsWith(`${SESSION_COOKIE}=`));
}

describe("DELETE /api/me", () => {
  it("rejects an anonymous caller with 401 and deletes nothing", async () => {
    const deleteAccount = vi.fn(async () => {});

    const response = await request(testApp({ deleteAccount }))
      .delete("/api/me")
      .send({ confirmation: "DELETE" })
      .expect(401);

    expect(response.body.error.code).toBe("unauthorized");
    expect(deleteAccount).not.toHaveBeenCalled();
  });

  it("rejects a missing confirmation with the validation envelope", async () => {
    const deleteAccount = vi.fn(async () => {});

    const response = await request(testApp({ deleteAccount }))
      .delete("/api/me")
      .set("Cookie", await cookieFor(USER))
      .send({})
      .expect(400);

    expect(response.body.error.code).toBe("validation_failed");
    expect(deleteAccount).not.toHaveBeenCalled();
  });

  it("rejects the wrong confirmation word, any case, with 400", async () => {
    const deleteAccount = vi.fn(async () => {});
    const app = testApp({ deleteAccount });

    for (const confirmation of ["delete", "DELETE ", "yes", "DELET"]) {
      const response = await request(app)
        .delete("/api/me")
        .set("Cookie", await cookieFor(USER))
        .send({ confirmation })
        .expect(400);

      expect(response.body.error.code).toBe("validation_failed");
    }

    expect(deleteAccount).not.toHaveBeenCalled();
  });

  it("rejects an unknown extra field", async () => {
    await request(testApp())
      .delete("/api/me")
      .set("Cookie", await cookieFor(USER))
      .send({ confirmation: "DELETE", alsoWipeBackups: true })
      .expect(400);
  });

  it("revokes the session, then deletes, then clears the cookie", async () => {
    const bumpVersion = vi.fn(async () => USER.tokenVersion + 1);
    const deleteAccount = vi.fn(async () => {});

    const response = await request(testApp({ bumpVersion, deleteAccount }))
      .delete("/api/me")
      .set("Cookie", await cookieFor(USER))
      .send({ confirmation: "DELETE" })
      .expect(204);

    expect(bumpVersion).toHaveBeenCalledWith(USER.id);
    expect(deleteAccount).toHaveBeenCalledWith(USER.id, expect.any(String));

    // The order is the point of US-20: the token version must be bumped before
    // any row is deleted, so a cookie in flight during the delete is already
    // dead and cannot act on a half-deleted account.
    const bumpOrder = bumpVersion.mock.invocationCallOrder[0] ?? 0;
    const deleteOrder = deleteAccount.mock.invocationCallOrder[0] ?? 0;
    expect(bumpOrder).toBeLessThan(deleteOrder);

    // And the cookie is only cleared once the delete has succeeded.
    expect(sessionCookie(response)).toContain(`${SESSION_COOKIE}=;`);
  });

  it("does not delete when the revocation bump fails", async () => {
    const deleteAccount = vi.fn(async () => {});
    const bumpVersion = vi.fn(async () => {
      throw new Error("bump failed");
    });

    const response = await request(testApp({ bumpVersion, deleteAccount }))
      .delete("/api/me")
      .set("Cookie", await cookieFor(USER))
      .send({ confirmation: "DELETE" })
      .expect(500);

    expect(deleteAccount).not.toHaveBeenCalled();
    expect(response.body.error.code).toBe("internal_error");
  });

  it("does not clear the cookie when the delete fails", async () => {
    const deleteAccount = vi.fn(async () => {
      throw new Error("delete failed");
    });

    const response = await request(testApp({ deleteAccount }))
      .delete("/api/me")
      .set("Cookie", await cookieFor(USER))
      .send({ confirmation: "DELETE" })
      .expect(500);

    // Clearing the cookie is the last step; a failed delete must not reach it,
    // or the browser would look signed out while its data was still present.
    expect(sessionCookie(response)).toBeUndefined();
  });
});
