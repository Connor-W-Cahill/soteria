import pino, { type LoggerOptions } from "pino";

/**
 * Field names that must never reach a log sink. The list is matched
 * case-insensitively against every key in a logged object, at any depth, and
 * against query-string and header names.
 *
 * Soteria's privacy charter forbids storing or logging passwords, passphrases,
 * generated credentials, and full hashes. The API is not in the path of any
 * password-derived data by design; this redaction is the belt to that
 * architectural braces, so a future route cannot leak one by accident.
 */
export const REDACTED_FIELD_PATTERN =
  /password|passphrase|secret|token|authorization|hash|credential|cookie|apikey|api_key/i;

export const REDACTION_PLACEHOLDER = "[redacted]";

/**
 * Recursively replaces the value of any key whose name matches
 * `REDACTED_FIELD_PATTERN`. Pino's own `redact` option only understands fixed
 * paths, so this walks the object instead and therefore also covers fields
 * nobody anticipated.
 */
export function redact(value: unknown, depth = 0): unknown {
  if (depth > 8 || value === null || typeof value !== "object") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => redact(item, depth + 1));
  }

  const result: Record<string, unknown> = {};

  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    result[key] = REDACTED_FIELD_PATTERN.test(key)
      ? REDACTION_PLACEHOLDER
      : redact(item, depth + 1);
  }

  return result;
}

export const loggerOptions: LoggerOptions = {
  // Vitest sets NODE_ENV=test; keep the suite's output readable.
  level:
    process.env.LOG_LEVEL ??
    (process.env.NODE_ENV === "test" ? "silent" : "info"),
  // Applied to every log call, including pino-http's automatic request logs.
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
