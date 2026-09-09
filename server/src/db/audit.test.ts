import { describe, expect, it } from "vitest";

import { AUDIT_ACTIONS, recordAuditEvent, toAuditRow } from "./audit.js";

describe("toAuditRow", () => {
  const now = new Date("2026-09-08T12:00:00.000Z");

  it("defaults actor, outcome, and the nullable columns", () => {
    expect(toAuditRow({ action: "auth.sign_in" }, now)).toEqual({
      user_id: null,
      actor: "user",
      action: "auth.sign_in",
      outcome: "success",
      request_id: null,
      occurred_at: now,
    });
  });

  it("keeps an explicit user, actor, outcome, and request id", () => {
    expect(
      toAuditRow(
        {
          action: "job.cve_refresh",
          userId: "u-1",
          actor: "job",
          outcome: "failure",
          requestId: "r-1",
        },
        now,
      ),
    ).toMatchObject({
      user_id: "u-1",
      actor: "job",
      outcome: "failure",
      request_id: "r-1",
    });
  });

  it("produces a row with no payload column, whatever the caller passes", () => {
    const row = toAuditRow({
      action: "account.delete",
      // @ts-expect-error the audit API deliberately has nowhere to put content
      payload: { password: "hunter2" },
    });

    expect(Object.keys(row).sort()).toEqual([
      "action",
      "actor",
      "occurred_at",
      "outcome",
      "request_id",
      "user_id",
    ]);
    expect(JSON.stringify(row)).not.toContain("hunter2");
  });

  it("covers the auth, deletion, dismissal, and job events INF-08 requires", () => {
    expect(AUDIT_ACTIONS).toEqual(
      expect.arrayContaining([
        "auth.sign_in",
        "account.delete",
        "recommendation.dismiss",
        "alert.dismiss",
        "job.cve_refresh",
      ]),
    );
  });
});

describe("recordAuditEvent", () => {
  it("swallows a database failure so a user action still succeeds", async () => {
    const failing = (() => ({
      insert: () => Promise.reject(new Error("db down")),
    })) as unknown as Parameters<typeof recordAuditEvent>[1];

    await expect(
      recordAuditEvent({ action: "auth.sign_in" }, failing),
    ).resolves.toBeUndefined();
  });

  it("inserts exactly the mapped row", async () => {
    const inserted: unknown[] = [];
    const fake = ((table: string) => {
      expect(table).toBe("audit_log");
      return {
        insert: (row: unknown) => {
          inserted.push(row);
          return Promise.resolve([1]);
        },
      };
    }) as unknown as Parameters<typeof recordAuditEvent>[1];

    await recordAuditEvent(
      { action: "account.delete", actor: "system", userId: null },
      fake,
    );

    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toMatchObject({
      action: "account.delete",
      actor: "system",
      user_id: null,
    });
  });
});
