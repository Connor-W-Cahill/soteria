import { QUESTIONNAIRE_VERSION, QUESTIONS } from "@soteria/shared";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import { createApp } from "../app.js";
import { SESSION_COOKIE } from "../auth/cookie.js";
import { issueSessionToken } from "../auth/session.js";
import { TEST_AUTH_CONFIG } from "../auth/testing.js";
import type { UserRecord } from "../auth/users.js";
import type { QuestionnaireStore, QuestionnaireSubmission } from "./store.js";

const USER: UserRecord = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "person@example.com",
  displayName: "A Person",
  tokenVersion: 0,
};

/** In-memory stand-in for the knex store, with the same merge semantics. */
function fakeStore(): QuestionnaireStore & { seen: string[] } {
  const byUser = new Map<string, QuestionnaireSubmission>();

  return {
    seen: [],
    async latest(userId) {
      return byUser.get(userId) ?? null;
    },
    async save(userId, answers, version) {
      this.seen.push(userId);
      const prev = byUser.get(userId);
      const merged = { ...(prev?.answers ?? {}), ...answers };
      const submission: QuestionnaireSubmission = {
        submissionId: prev?.submissionId ?? "sub-1",
        version,
        answers: merged,
        updatedAt: new Date("2026-09-09T00:00:00.000Z").toISOString(),
      };
      byUser.set(userId, submission);
      return submission;
    },
  };
}

function testApp(
  overrides: {
    user?: UserRecord | undefined;
    store?: QuestionnaireStore;
    recordSnapshot?: (
      userId: string,
      submissionId: string | null,
      scores: unknown,
    ) => Promise<number>;
  } = {},
) {
  const user = "user" in overrides ? overrides.user : USER;
  return createApp({
    checkDbConnection: async () => true,
    enableRateLimit: false,
    auth: TEST_AUTH_CONFIG,
    loadSessionUser: async () => user,
    authRouterOptions: {
      verifyIdToken: async () => ({
        googleSub: "s",
        email: USER.email,
        displayName: USER.displayName,
      }),
      upsertUser: async () => USER,
      bumpVersion: async () => 1,
      audit: async () => {},
    },
    questionnaireRouterOptions: {
      store: overrides.store ?? fakeStore(),
      ...(overrides.recordSnapshot === undefined
        ? { recordSnapshot: async () => 0 }
        : {
            recordSnapshot: overrides.recordSnapshot as never,
          }),
    },
  });
}

async function cookie(): Promise<string> {
  const token = await issueSessionToken(
    { userId: USER.id, tokenVersion: USER.tokenVersion },
    TEST_AUTH_CONFIG,
  );
  return `${SESSION_COOKIE}=${token}`;
}

const pw = QUESTIONS.find((q) => q.id === "pw_reuse")!;
const mfa = QUESTIONS.find((q) => q.id === "mfa_email")!;

describe("GET /api/questionnaire", () => {
  it("401s an anonymous request", async () => {
    await request(testApp({ user: undefined }))
      .get("/api/questionnaire")
      .expect(401);
  });

  it("returns an empty state before the user has answered", async () => {
    const response = await request(testApp())
      .get("/api/questionnaire")
      .set("Cookie", await cookie())
      .expect(200);

    expect(response.body).toEqual({
      version: null,
      answers: {},
      updatedAt: null,
    });
  });

  it("returns the current answers after a save", async () => {
    const app = testApp({ store: fakeStore() });
    const c = await cookie();

    await request(app)
      .put("/api/questionnaire")
      .set("Cookie", c)
      .send({ answers: { [pw.id]: pw.options[0]!.id } })
      .expect(200);

    const response = await request(app)
      .get("/api/questionnaire")
      .set("Cookie", c)
      .expect(200);
    expect(response.body.answers).toEqual({ [pw.id]: pw.options[0]!.id });
    expect(response.body.version).toBe(QUESTIONNAIRE_VERSION);
  });
});

describe("PUT /api/questionnaire", () => {
  it("401s an anonymous request and stores nothing", async () => {
    const store = fakeStore();
    await request(testApp({ user: undefined, store }))
      .put("/api/questionnaire")
      .send({ answers: { [pw.id]: pw.options[0]!.id } })
      .expect(401);

    expect(store.seen).toEqual([]);
  });

  it("saves valid answers and echoes the merged state", async () => {
    const response = await request(testApp())
      .put("/api/questionnaire")
      .set("Cookie", await cookie())
      .send({ answers: { [pw.id]: pw.options[1]!.id } })
      .expect(200);

    expect(response.body.answers).toEqual({ [pw.id]: pw.options[1]!.id });
    expect(response.body.version).toBe(QUESTIONNAIRE_VERSION);
  });

  it("merges across calls (save-and-resume)", async () => {
    const app = testApp({ store: fakeStore() });
    const c = await cookie();

    await request(app)
      .put("/api/questionnaire")
      .set("Cookie", c)
      .send({ answers: { [pw.id]: pw.options[0]!.id } })
      .expect(200);
    const response = await request(app)
      .put("/api/questionnaire")
      .set("Cookie", c)
      .send({ answers: { [mfa.id]: mfa.options[0]!.id } })
      .expect(200);

    expect(response.body.answers).toEqual({
      [pw.id]: pw.options[0]!.id,
      [mfa.id]: mfa.options[0]!.id,
    });
  });

  it("rejects an unknown question key and stores nothing", async () => {
    const store = fakeStore();
    const response = await request(testApp({ store }))
      .put("/api/questionnaire")
      .set("Cookie", await cookie())
      .send({ answers: { not_a_real_question: "whatever" } })
      .expect(400);

    expect(response.body.error.code).toBe("validation_failed");
    expect(response.body.error.details).toContainEqual({
      path: "answers.not_a_real_question",
      message: "Not a question in the current set.",
    });
    expect(store.seen).toEqual([]);
  });

  it("rejects an option the question does not offer and stores nothing", async () => {
    const store = fakeStore();
    const response = await request(testApp({ store }))
      .put("/api/questionnaire")
      .set("Cookie", await cookie())
      .send({ answers: { [pw.id]: "no_such_option" } })
      .expect(400);

    expect(response.body.error.code).toBe("validation_failed");
    expect(response.body.error.details).toContainEqual({
      path: `answers.${pw.id}`,
      message: "Not an option this question offers.",
    });
    expect(store.seen).toEqual([]);
  });

  it("rejects the reserved version key like any unknown question", async () => {
    const store = fakeStore();
    await request(testApp({ store }))
      .put("/api/questionnaire")
      .set("Cookie", await cookie())
      .send({ answers: { __version__: "9.9.9" } })
      .expect(400);

    expect(store.seen).toEqual([]);
  });

  it("never echoes a submitted value in the error details", async () => {
    const secretish = "value-should-not-be-echoed";
    const response = await request(testApp())
      .put("/api/questionnaire")
      .set("Cookie", await cookie())
      .send({ answers: { [pw.id]: secretish } })
      .expect(400);

    expect(JSON.stringify(response.body)).not.toContain(secretish);
  });

  it("rejects a body with unexpected fields", async () => {
    await request(testApp())
      .put("/api/questionnaire")
      .set("Cookie", await cookie())
      .send({ answers: {}, extra: true })
      .expect(400);
  });
});

describe("PUT /api/questionnaire — the US-17 scoring seam", () => {
  it("writes a score snapshot for the saved submission", async () => {
    const recordSnapshot = vi.fn(async () => 5);

    await request(testApp({ recordSnapshot }))
      .put("/api/questionnaire")
      .set("Cookie", await cookie())
      .send({ answers: { [pw.id]: pw.options[0]!.id } })
      .expect(200);

    expect(recordSnapshot).toHaveBeenCalledTimes(1);

    const call = recordSnapshot.mock.calls[0] as unknown as [
      string,
      string | null,
      { categories: unknown[]; overall: number | null },
    ];
    const [userId, submissionId, scores] = call;

    expect(userId).toBe(USER.id);
    expect(submissionId).toBeTruthy();
    // Scored from the answers just saved, not from an empty set.
    expect(scores.categories).toHaveLength(5);
    expect(scores.overall).not.toBeNull();
  });

  it("still saves the answers when the snapshot write fails", async () => {
    // The answers are the source of truth and are already committed by this
    // point. Losing a history point is a smaller harm than telling a user their
    // answers did not save when they did — and the next save writes one anyway.
    const recordSnapshot = vi.fn(async () => {
      throw new Error("score_snapshots insert failed");
    });

    const response = await request(testApp({ recordSnapshot }))
      .put("/api/questionnaire")
      .set("Cookie", await cookie())
      .send({ answers: { [pw.id]: pw.options[0]!.id } })
      .expect(200);

    expect(recordSnapshot).toHaveBeenCalledTimes(1);
    expect(response.body.answers[pw.id]).toBe(pw.options[0]!.id);
  });

  it("does not write a snapshot when the save is rejected", async () => {
    const recordSnapshot = vi.fn(async () => 5);

    await request(testApp({ recordSnapshot }))
      .put("/api/questionnaire")
      .set("Cookie", await cookie())
      .send({ answers: { [pw.id]: "not-an-offered-option" } })
      .expect(400);

    expect(recordSnapshot).not.toHaveBeenCalled();
  });

  it("does not write a snapshot for an anonymous caller", async () => {
    const recordSnapshot = vi.fn(async () => 5);

    await request(testApp({ recordSnapshot }))
      .put("/api/questionnaire")
      .send({ answers: { [pw.id]: pw.options[0]!.id } })
      .expect(401);

    expect(recordSnapshot).not.toHaveBeenCalled();
  });
});
