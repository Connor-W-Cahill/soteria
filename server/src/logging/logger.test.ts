import { Writable } from "node:stream";

import pino from "pino";
import { describe, expect, it } from "vitest";

import {
  CYCLE_PLACEHOLDER,
  REDACTED_FIELD_PATTERN,
  REDACTION_PLACEHOLDER,
  TRUNCATION_PLACEHOLDER,
  loggerOptions,
  redact,
  serializeError,
} from "./logger.js";

/** Wraps `inner` in `depth` levels of plain object. */
function nest(depth: number, inner: unknown): unknown {
  let value = inner;

  for (let level = 0; level < depth; level += 1) {
    value = { level: value };
  }

  return value;
}

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

  it("marks a cycle rather than looping or relying on the depth cap", () => {
    const cyclic: Record<string, unknown> = { name: "root" };
    cyclic.self = cyclic;

    expect(redact(cyclic)).toEqual({ name: "root", self: CYCLE_PLACEHOLDER });
  });

  // Security review finding 4a: the depth cap used to return the untouched
  // subtree, so a secret below it was emitted verbatim.
  it("truncates past the depth cap instead of emitting the raw subtree", () => {
    const deep = redact(nest(12, { password: "hunter2" }));

    expect(JSON.stringify(deep)).not.toContain("hunter2");
    expect(JSON.stringify(deep)).toContain(TRUNCATION_PLACEHOLDER);
  });

  it("still redacts a secret sitting exactly at the depth boundary", () => {
    for (const depth of [7, 8, 9]) {
      expect(
        JSON.stringify(redact(nest(depth, { password: "hunter2" }))),
      ).not.toContain("hunter2");
    }
  });

  // Security review finding 4b: a toJSON method survived the walk and ran at
  // serialise time, emitting a shape redaction never inspected.
  it("drops toJSON so it cannot resurrect an uninspected shape", () => {
    const value = redact({ o: { toJSON: () => ({ password: "hunter2" }) } });

    expect(JSON.stringify(value)).not.toContain("hunter2");
  });

  // Security review finding 5: these used to collapse to {} or explode per byte.
  it("renders dates, buffers, maps, and sets without mangling them", () => {
    const when = new Date("2026-09-08T12:00:00.000Z");
    const value = redact({
      when,
      blob: Buffer.from("ab"),
      map: new Map([["a", 1]]),
      set: new Set([1, 2]),
    }) as Record<string, unknown>;

    expect(value.when).toBe("2026-09-08T12:00:00.000Z");
    expect(value.blob).toBe("[buffer 2 bytes]");
    expect(value.map).toBe("[map 1 entries]");
    expect(value.set).toBe("[set 2 entries]");
  });

  // Security review finding 6: assigning a key named __proto__ invoked the
  // prototype setter, so the field vanished and the result got a chosen proto.
  it("stores a __proto__ key as data rather than invoking the setter", () => {
    const value = redact(JSON.parse('{"__proto__":{"polluted":true},"ok":1}'));

    expect(Object.getPrototypeOf(value as object)).toBe(null);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});

// Security review finding 3: an Error's message and stack are non-enumerable,
// so the old key walk returned {} — and whatever a driver attached enumerably
// (knex's sql and bindings) rode along untouched.
describe("serializeError", () => {
  it("keeps the diagnostic fields that a key walk cannot see", () => {
    const serialized = serializeError(new TypeError("boom"));

    expect(serialized.type).toBe("TypeError");
    expect(serialized.message).toBe("boom");
  });

  it("drops driver state attached to a query error, bindings included", () => {
    const error = Object.assign(new Error("insert failed"), {
      sql: "insert into users (email, pw_hash) values (?,?)",
      bindings: ["a@b.c", "hunter2"],
      config: { connectionString: "Server=s;Password=hunter2" },
    });

    const serialized = JSON.stringify(serializeError(error));

    expect(serialized).not.toContain("hunter2");
    expect(serialized).not.toContain("bindings");
    expect(serialized).not.toContain("connectionString");
    expect(serialized).toContain("insert failed");
  });

  it("handles a thrown non-Error", () => {
    expect(serializeError("just a string")).toEqual({
      type: "NonError",
      message: "just a string",
    });
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

  it("logs a usable error instead of an empty object", () => {
    const { logger, lines } = captureLogger();

    logger.error({ err: new RangeError("out of range") }, "failed");

    expect(lines.join("")).toContain("out of range");
    expect(lines.join("")).toContain("RangeError");
  });

  it("never writes the bindings of a failed database query", () => {
    const { logger, lines } = captureLogger();

    logger.error(
      {
        err: Object.assign(new Error("insert failed"), {
          sql: "insert into users values (?,?)",
          bindings: ["a@b.c", "hunter2"],
        }),
      },
      "db",
    );

    expect(lines.join("")).not.toContain("hunter2");
  });

  it("never writes a raw request body attached to a parse failure", () => {
    const { logger, lines } = captureLogger();

    logger.error(
      {
        err: Object.assign(new SyntaxError("Unexpected end of JSON input"), {
          type: "entity.parse.failed",
          body: '{"password":"hunter2"',
          status: 400,
        }),
      },
      "parse",
    );

    expect(lines.join("")).not.toContain("hunter2");
  });
});
