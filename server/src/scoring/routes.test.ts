import { CATEGORY_KEYS, MAX_OPTION_WEIGHT, QUESTIONS } from "@soteria/shared";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import { createApp } from "../app.js";
import { TEST_AUTH_CONFIG } from "../auth/testing.js";
import { SESSION_COOKIE } from "../auth/cookie.js";
import { issueSessionToken } from "../auth/session.js";
import type { UserRecord } from "../auth/users.js";
import type { QuestionnaireStore } from "../questionnaire/store.js";
import type { ScoringRouterOptions } from "./routes.js";

const USER: UserRecord = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "person@example.com",
  displayName: "A Person",
  tokenVersion: 1,
};

function bestAnswers(): Record<string, string> {
  const answers: Record<string, string> = {};

  for (const question of QUESTIONS) {
    const best = question.options.find(
      (option) => option.weight === MAX_OPTION_WEIGHT,
    );

    if (best === undefined) throw new Error(`no best for ${question.id}`);

    answers[question.id] = best.id;
  }

  return answers;
}

function storeReturning(
  answers: Record<string, string> | null,
): QuestionnaireStore {
  return {
    latest: vi.fn(async () =>
      answers === null
        ? null
        : {
            submissionId: "22222222-2222-4222-8222-222222222222",
            version: "1.0.0",
            answers,
            updatedAt: "2026-09-09T12:00:00.000Z",
          },
    ),
    save: vi.fn(),
  } as unknown as QuestionnaireStore;
}

function testApp(
  store: QuestionnaireStore,
  readHistory?: ScoringRouterOptions["readHistory"],
) {
  return createApp({
    checkDbConnection: async () => true,
    enableRateLimit: false,
    auth: TEST_AUTH_CONFIG,
    loadSessionUser: async () => USER,
    authRouterOptions: {
      verifyIdToken: async () => {
        throw new Error("not used");
      },
      upsertUser: async () => USER,
      bumpVersion: async () => 2,
      audit: async () => {},
    },
    scoringRouterOptions:
      readHistory === undefined ? { store } : { store, readHistory },
  });
}

async function cookie(): Promise<string> {
  const token = await issueSessionToken(
    { userId: USER.id, tokenVersion: USER.tokenVersion },
    TEST_AUTH_CONFIG,
  );

  return `${SESSION_COOKIE}=${token}`;
}

describe("GET /api/scores", () => {
  it("requires a session", async () => {
    const response = await request(testApp(storeReturning(bestAnswers())))
      .get("/api/scores")
      .expect(401);

    expect(response.body.error.code).toBe("unauthorized");
  });

  it("returns every category and the overall score", async () => {
    const response = await request(testApp(storeReturning(bestAnswers())))
      .get("/api/scores")
      .set("Cookie", await cookie())
      .expect(200);

    expect(response.body.categories.map((c: { key: string }) => c.key)).toEqual(
      [...CATEGORY_KEYS],
    );
    expect(response.body.overall).toBe(100);
    expect(response.body.version).toBe("1.0.0");
    expect(response.body.updatedAt).toBe("2026-09-09T12:00:00.000Z");
  });

  it("reports nulls rather than zeros for a user who has answered nothing", async () => {
    // A new account must not be told its posture is 0 before it answers.
    const response = await request(testApp(storeReturning(null)))
      .get("/api/scores")
      .set("Cookie", await cookie())
      .expect(200);

    expect(response.body.overall).toBeNull();
    expect(response.body.version).toBeNull();
    expect(response.body.updatedAt).toBeNull();

    for (const category of response.body.categories) {
      expect(category.score, category.key).toBeNull();
    }
  });

  it("marks software exposure provisional until US-24 exists", async () => {
    const response = await request(testApp(storeReturning(bestAnswers())))
      .get("/api/scores")
      .set("Cookie", await cookie())
      .expect(200);

    const software = response.body.categories.find(
      (c: { key: string }) => c.key === "software_exposure",
    );

    expect(software.provisional).toBe(true);
    expect(response.body.provisional).toBe(true);
  });

  it("carries the contributions US-18 needs", async () => {
    const response = await request(testApp(storeReturning(bestAnswers())))
      .get("/api/scores")
      .set("Cookie", await cookie())
      .expect(200);

    for (const category of response.body.categories) {
      expect(category.contributions.length, category.key).toBeGreaterThan(0);

      for (const contribution of category.contributions) {
        expect(contribution.sourceId).toBeTruthy();
        expect(contribution.reason.length).toBeGreaterThan(20);
      }
    }
  });

  it("never returns anything a user typed", async () => {
    // Answers are option ids only, so there is nothing free-text to leak — but
    // this asserts it of the response rather than trusting the input contract.
    const response = await request(testApp(storeReturning(bestAnswers())))
      .get("/api/scores")
      .set("Cookie", await cookie())
      .expect(200);

    const body = JSON.stringify(response.body);

    expect(body).not.toContain(USER.email);
    expect(body).not.toContain(USER.id);
  });

  it("rejects unexpected query parameters", async () => {
    const response = await request(testApp(storeReturning(bestAnswers())))
      .get("/api/scores?debug=1")
      .set("Cookie", await cookie())
      .expect(400);

    expect(response.body.error.code).toBe("validation_failed");
  });

  it("computes on read rather than reading a stored score", async () => {
    // score_snapshots is history, not a cache. The store is asked for answers;
    // nothing asks for a previously computed score.
    const store = storeReturning(bestAnswers());

    await request(testApp(store))
      .get("/api/scores")
      .set("Cookie", await cookie())
      .expect(200);

    expect(store.latest).toHaveBeenCalledWith(USER.id);
  });
});

describe("GET /api/scores/history", () => {
  const emptyHistory = (days: number) =>
    vi.fn(async () => ({
      days,
      since: "2026-06-01T00:00:00.000Z",
      categories: [],
      changes: [],
    }));

  it("requires a session", async () => {
    const response = await request(
      testApp(storeReturning(null), emptyHistory(90)),
    )
      .get("/api/scores/history")
      .expect(401);

    expect(response.body.error.code).toBe("unauthorized");
  });

  it("defaults to a 90-day window when days is omitted", async () => {
    const readHistory = vi.fn(async (_userId: string, days: number) => ({
      days,
      since: "x",
      categories: [],
      changes: [],
    }));

    const response = await request(testApp(storeReturning(null), readHistory))
      .get("/api/scores/history")
      .set("Cookie", await cookie())
      .expect(200);

    expect(readHistory).toHaveBeenCalledWith(USER.id, 90);
    expect(response.body.days).toBe(90);
  });

  it("accepts a bounded days value", async () => {
    const readHistory = emptyHistory(7);

    await request(testApp(storeReturning(null), readHistory))
      .get("/api/scores/history?days=7")
      .set("Cookie", await cookie())
      .expect(200);

    expect(readHistory).toHaveBeenCalledWith(USER.id, 7);
  });

  it("rejects days above the maximum", async () => {
    const readHistory = emptyHistory(90);

    const response = await request(testApp(storeReturning(null), readHistory))
      .get("/api/scores/history?days=100000")
      .set("Cookie", await cookie())
      .expect(400);

    expect(response.body.error.code).toBe("validation_failed");
    expect(readHistory).not.toHaveBeenCalled();
  });

  it("rejects a zero, negative or non-integer days value", async () => {
    const readHistory = emptyHistory(90);
    const app = testApp(storeReturning(null), readHistory);

    for (const bad of ["0", "-5", "3.5", "abc"]) {
      await request(app)
        .get(`/api/scores/history?days=${bad}`)
        .set("Cookie", await cookie())
        .expect(400);
    }

    expect(readHistory).not.toHaveBeenCalled();
  });

  it("rejects unexpected query parameters", async () => {
    const response = await request(
      testApp(storeReturning(null), emptyHistory(90)),
    )
      .get("/api/scores/history?days=30&all=1")
      .set("Cookie", await cookie())
      .expect(400);

    expect(response.body.error.code).toBe("validation_failed");
  });
});
