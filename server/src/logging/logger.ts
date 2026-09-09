import pino, { type LoggerOptions } from "pino";

/**
 * Field names that must never reach a log sink. The list is matched
 * case-insensitively against every key in a logged object, at any depth.
 *
 * Soteria's privacy charter forbids storing or logging passwords, passphrases,
 * generated credentials, and full hashes. The API is not in the path of any
 * password-derived data by design; this redaction is the belt to that
 * architectural braces, so a future route cannot leak one by accident.
 */
export const REDACTED_FIELD_PATTERN =
  /password|passphrase|secret|token|authorization|hash|credential|cookie|apikey|api_key|connectionstring|connection_string|bindings|binding/i;

export const REDACTION_PLACEHOLDER = "[redacted]";
export const TRUNCATION_PLACEHOLDER = "[truncated]";
export const CYCLE_PLACEHOLDER = "[circular]";

const MAX_DEPTH = 8;

/**
 * Values that are already a safe scalar rendering. Walking them with
 * `Object.entries` is wrong: a Date has no own enumerable keys and would
 * collapse to `{}`, and a Buffer would expand to one key per byte.
 */
function renderOpaque(value: object): unknown | undefined {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value instanceof RegExp) {
    return value.toString();
  }

  if (Buffer.isBuffer(value)) {
    return `[buffer ${value.byteLength} bytes]`;
  }

  if (value instanceof Map) {
    return `[map ${value.size} entries]`;
  }

  if (value instanceof Set) {
    return `[set ${value.size} entries]`;
  }

  return undefined;
}

/**
 * Recursively replaces the value of any key whose name matches
 * `REDACTED_FIELD_PATTERN`. Pino's own `redact` option only understands fixed
 * paths, so this walks the object instead and therefore also covers fields
 * nobody anticipated.
 *
 * Three properties this walk must hold, each of which was a real hole found in
 * security review:
 *
 * - Exceeding the depth cap yields a placeholder, never the untouched subtree.
 * - A `toJSON` method is dropped, so `JSON.stringify` cannot resurrect a shape
 *   this walk never inspected.
 * - Cycles terminate on a marker rather than on the depth cap.
 */
export function redact(
  value: unknown,
  depth = 0,
  seen = new WeakSet(),
): unknown {
  if (value === null || typeof value !== "object") {
    return value;
  }

  if (seen.has(value)) {
    return CYCLE_PLACEHOLDER;
  }

  if (depth >= MAX_DEPTH) {
    return TRUNCATION_PLACEHOLDER;
  }

  const opaque = renderOpaque(value);

  if (opaque !== undefined) {
    return opaque;
  }

  seen.add(value);

  try {
    if (Array.isArray(value)) {
      return value.map((item) => redact(item, depth + 1, seen));
    }

    if (value instanceof Error) {
      return serializeError(value);
    }

    // A null-prototype target so a key literally named `__proto__` is stored as
    // data rather than invoking the prototype setter.
    const result: Record<string, unknown> = Object.create(null) as Record<
      string,
      unknown
    >;

    for (const [key, item] of Object.entries(
      value as Record<string, unknown>,
    )) {
      // Never carry a serialiser hook across: it would run after this walk and
      // emit a shape that was never redacted.
      if (key === "toJSON") {
        continue;
      }

      result[key] = REDACTED_FIELD_PATTERN.test(key)
        ? REDACTION_PLACEHOLDER
        : redact(item, depth + 1, seen);
    }

    return result;
  } finally {
    seen.delete(value);
  }
}

export interface SerializedError {
  type: string;
  message: string;
  code?: string;
  stack?: string;
}

/**
 * Explicit allowlist serialiser for errors.
 *
 * An `Error`'s `message`, `name`, and `stack` are non-enumerable, so a generic
 * key walk returns `{}` and loses the whole diagnostic. Worse, whatever a driver
 * *did* attach enumerably rides along: knex puts `sql` and `bindings` on a query
 * error, and `bindings` is an array of parameter values — a password among them
 * if one were ever bound. mssql/tedious attach connection config.
 *
 * So: emit these four fields and nothing else. Attached driver state is dropped
 * wholesale rather than filtered by key name.
 */
function isSerializedError(value: unknown): value is SerializedError {
  return (
    typeof value === "object" &&
    value !== null &&
    !(value instanceof Error) &&
    typeof (value as SerializedError).type === "string" &&
    typeof (value as SerializedError).message === "string"
  );
}

export function serializeError(error: unknown): SerializedError {
  // `formatters.log` runs before pino's serialisers, so an error inside a logged
  // object has already been through this function by the time the `err`
  // serialiser sees it. Recognise our own output and pass it through rather than
  // flattening it to "[object Object]".
  if (isSerializedError(error)) {
    return error;
  }

  if (!(error instanceof Error)) {
    return { type: "NonError", message: String(error) };
  }

  const code = (error as { code?: unknown }).code;

  return {
    type: error.name,
    message: error.message,
    ...(typeof code === "string" ? { code } : {}),
    // A stack can name internal paths; useful in development, noise in prod.
    ...(process.env.NODE_ENV === "production"
      ? {}
      : { stack: error.stack ?? "" }),
  };
}

export const loggerOptions: LoggerOptions = {
  // Vitest sets NODE_ENV=test; keep the suite's output readable.
  level:
    process.env.LOG_LEVEL ??
    (process.env.NODE_ENV === "test" ? "silent" : "info"),
  serializers: {
    err: serializeError,
    error: serializeError,
  },
  // Applied to every log call, after the serialisers above.
  formatters: {
    log: (object) => redact(object) as Record<string, unknown>,
  },
  // Belt and braces: pino's own path-based redaction for the well-known places.
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "res.headers['set-cookie']",
      "password",
      "passphrase",
      "*.password",
      "*.passphrase",
    ],
    censor: REDACTION_PLACEHOLDER,
  },
};

export const logger = pino(loggerOptions);
