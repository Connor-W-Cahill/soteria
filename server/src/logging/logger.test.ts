import { Writable } from "node:stream";

import pino from "pino";
import { describe, expect, it } from "vitest";

import {
  REDACTED_FIELD_PATTERN,
  REDACTION_PLACEHOLDER,
  loggerOptions,
  redact,
} from "./logger.js";

/** Captures everything a pino logger writes, so tests can assert on the bytes. */
function captureLogger() {
  const lines: string[] = [];
  const sink = new Writable({
    write(chunk, _encoding, callback) {
      lines.push(String(chunk));
      callback();
    },
  });

  return { logger: pino({ ...loggerOptions, level: "info" }, sink), lines };
}

describe("redact", () => {
  it("replaces any field whose name looks like a secret", () => {
    expect(
      redact({
        email: "a@example.test",
        password: "hunter2",
        passphrase: "correct horse battery staple",
        sha1Hash: "ABCDEF",
        apiKey: "k",
        nested: { userToken: "t", note: "kept" },
      }),
    ).toEqual({
      email: "a@example.test",
      password: REDACTION_PLACEHOLDER,
      passphrase: REDACTION_PLACEHOLDER,
      sha1Hash: REDACTION_PLACEHOLDER,
      apiKey: REDACTION_PLACEHOLDER,
      nested: { userToken: REDACTION_PLACEHOLDER, note: "kept" },
    });
  });

  it("walks arrays", () => {
    expect(redact([{ password: "x" }, { ok: 1 }])).toEqual([
      { password: REDACTION_PLACEHOLDER },
      { ok: 1 },
    ]);
  });

  it("stops recursing rather than looping on a cyclic object", () => {
    const cyclic: Record<string, unknown> = { name: "root" };
    cyclic.self = cyclic;

    expect(() => redact(cyclic)).not.toThrow();
  });

  it.each([
    "password",
    "Password",
    "user_passphrase",
    "sessionToken",
    "authorization",
    "sha1_hash",
    "clientSecret",
    "apiKey",
    "credential",
  ])("matches %s", (field) => {
    expect(REDACTED_FIELD_PATTERN.test(field)).toBe(true);
  });
});

describe("the configured logger", () => {
  it("never writes a password that a caller passes in", () => {
    const { logger, lines } = captureLogger();

    logger.info(
      {
        body: { email: "a@example.test", password: "hunter2" },
        headers: { authorization: "Bearer abc.def.ghi" },
      },
      "inbound request",
    );

    const output = lines.join("");

    expect(output).not.toContain("hunter2");
    expect(output).not.toContain("abc.def.ghi");
    expect(output).toContain(REDACTION_PLACEHOLDER);
    expect(output).toContain("a@example.test");
  });

  it("redacts a password nested several levels deep", () => {
    const { logger, lines } = captureLogger();

    logger.warn(
      { req: { body: { account: { newPassword: "s3cret-value" } } } },
      "deep",
    );

    expect(lines.join("")).not.toContain("s3cret-value");
  });
});
