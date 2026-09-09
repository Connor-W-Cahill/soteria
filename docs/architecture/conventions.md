# API conventions

Delivered by **INF-08**. Every route added in Phase 2 and later uses these four
pieces. They live in `server/src/http/` and `server/src/logging/`, and the app
wires them in `server/src/app.ts`.

## 1. The error envelope

Every error response body is exactly:

```json
{ "error": { "code": "not_found", "message": "That resource does not exist." } }
```

`details` is added only for validation failures. Nothing else is ever sent on an
error path, so a stack trace, a SQL message, or an echoed request body cannot
reach a client.

| Code                | Status | When                                                      |
| ------------------- | ------ | --------------------------------------------------------- |
| `bad_request`       | 400    | The request is well-formed but wrong for this route.      |
| `validation_failed` | 400    | A zod schema rejected the body, query, or params.         |
| `unauthorized`      | 401    | No valid session cookie (US-14).                          |
| `forbidden`         | 403    | Signed in, but not allowed to touch this resource.        |
| `not_found`         | 404    | Unknown route, or a resource the caller may not see.      |
| `payload_too_large` | 413    | The request body exceeded the 100 KB limit.               |
| `rate_limited`      | 429    | An `express-rate-limit` ceiling was hit.                  |
| `internal_error`    | 500    | Anything unexpected. The cause is logged, never returned. |

Throw `ApiError` (or one of `ApiError.badRequest` / `.unauthorized` /
`.forbidden` / `.notFound`) from a route and let it propagate. `notFoundHandler`
and `errorHandler` are mounted last in `createApp()` and must stay there.

## 2. Request validation

```ts
router.post(
  "/api/software",
  validate({ body: addSoftwareSchema }),
  (request, response) => {
    const { productId } = validated<AddSoftware>(request).body;
    // ...
  },
);
```

Rules:

- **Every** body, query, and params a route reads is declared in a zod schema.
- Handlers read input from `validated(request)`, never from `request.body`
  directly. `validated()` throws if the route forgot its `validate()`
  middleware, so the omission fails loudly in tests rather than silently.
- Validation failures return field **paths and messages only**. The value that
  failed is never echoed — a validation error on a field that happens to carry a
  secret must not print the secret back. `zodDetails()` enforces this and a test
  asserts it.
- Use `.strict()` on object schemas so unexpected properties are rejected rather
  than ignored.
- **Never interpolate a value into a `refine` / `superRefine` message.** zod's
  built-in messages omit the received value, but a custom message is free text
  and `zodDetails()` keeps it verbatim — so a refinement whose message
  interpolates the received value would echo a secret straight back to the
  client. Describe the rule, not the input. This is the one place where the "never the value" invariant rests on
  the schema author rather than on the middleware.

### Body-parser failures

`express.json()` attaches the **raw request body** to a parse failure as an own
enumerable `body` property. `bodyParserError()` translates any `entity.*` error
into `bad_request` (400) or `payload_too_large` (413) before it can reach the
generic 500 branch, and the error handler logs only `serializeError(error)`,
never the raw object. Both are covered by tests.

## 3. Logging and redaction

`server/src/logging/logger.ts` exports the single pino logger. Two layers keep
secrets out of it:

1. A `formatters.log` hook walks every logged object and replaces the value of
   any key matching
   `password|passphrase|secret|token|authorization|hash|credential|cookie|apikey|api_key|connectionstring|bindings`
   with `[redacted]`, at any depth and inside arrays. Pino's built-in `redact`
   only understands fixed paths, so this catches fields nobody anticipated.
2. Pino's path-based `redact` covers the well-known headers as a second layer.

`requestLog()` emits one line per request with method, route, status, duration,
and the correlation id — and nothing else. **Request bodies and query strings are
never logged at all.** The redaction list is the safety net, not the policy. It
fires on `close` rather than `finish`, so an aborted connection still produces a
line (recorded with status `499`).

Three specific holes the walk closes, each found by breaking it:

- Exceeding the depth cap yields `[truncated]`, never the untouched subtree.
- A `toJSON` method is dropped, so `JSON.stringify` cannot emit a shape the walk
  never inspected.
- `Date`, `Buffer`, `Map`, and `Set` are rendered as scalars instead of being
  walked into `{}` or one key per byte, and the result object has a null
  prototype so a key named `__proto__` is stored as data.

### Errors are serialised by allowlist, not filtered by key name

An `Error`'s `message`, `name`, and `stack` are **non-enumerable**, so a key walk
returns `{}` — the diagnostic is lost. Meanwhile whatever a driver attached
_enumerably_ rides along: knex puts `sql` and `bindings` on a query error, and
`bindings` is an array of parameter values. `serializeError()` therefore emits
`type`, `message`, `code`, and (outside production) `stack`, and drops
everything else wholesale. **Always log `serializeError(error)`, never a bare
error object.**

### What is not redacted

The log _message_ string is not scanned — `formatters.log` only sees the merged
object. `logger.info({ ok: 1 }, "user password is " + secret)` would write the
secret. Log messages are static strings; put variable data in the object.

`server/src/logging/logger.test.ts` proves the invariant: a logged request body
containing `password` never appears in the logger's output bytes.

Soteria's architecture is the real defence here. Password-derived data never
leaves the browser — strength scoring is local, and the breach check sends a
5-character SHA-1 prefix straight from the browser to HIBP — so the API is not
in the path of any secret it could log.

## 4. Correlation ids

`requestId()` assigns every request an id, echoes it in the `x-request-id`
response header, and attaches it to every log line and every `audit_log` row.
An inbound `x-request-id` is trusted only if it matches `[A-Za-z0-9._-]{1,60}`,
so a caller cannot inject text into the logs.

## 5. Rate limiting

Three ceilings, all returning the `rate_limited` envelope:

| Helper                 | Window | Limit | Use                                               |
| ---------------------- | ------ | ----- | ------------------------------------------------- |
| `globalRateLimit()`    | 1 min  | 120   | Mounted on the whole app.                         |
| `publicRateLimit()`    | 1 min  | 30    | Unauthenticated endpoints.                        |
| `sensitiveRateLimit()` | 15 min | 10    | Sign-in, account deletion, internal job triggers. |

`app.set("trust proxy", 1)` is set because the API sits behind Azure App
Service. That alone is **not** enough: App Service appends the client to
`X-Forwarded-For` as `ip:port`, so `req.ip` is `203.0.113.5:41234` — a value
that changes on every TCP connection, which would give each request its own
bucket and make the limiter a silent no-op. (express-rate-limit does detect the
malformed address, but its validation checks are disabled when
`NODE_ENV=production`, which is exactly where this runs.) `clientKey()`
therefore strips the port and keys on the address alone; the tests send the real
Azure header shape and assert the 429 arrives.

Two known limits, recorded as decisions rather than surprises:

- **Ceilings are per instance.** The default `MemoryStore` is in-process, so on
  scale-out the effective limit multiplies by the instance count. Fine at one
  instance; a shared store is the fix if the API ever scales horizontally.
- **A shared egress address shares a bucket.** With a correct key, a classroom
  or office behind one NAT counts as one client. `sensitiveRateLimit()` at
  10 per 15 minutes will be felt there once sign-in lands (US-14); revisit the
  number then.

## 6. The audit log

`recordAuditEvent()` in `server/src/db/audit.ts` appends to `audit_log`:

```ts
await recordAuditEvent({
  action: "account.delete",
  userId: null,
  actor: "user",
  requestId: requestIdOf(response),
});
```

- `action` is a value from the `AUDIT_ACTIONS` union, covering auth events,
  deletions, dismissals, and refresh jobs. Adding a new action means extending
  that union, so the set stays reviewable.
- **There is no payload parameter and no payload column.** The trail records
  that something happened, never what was in it. A test asserts the produced row
  has exactly the six expected keys.
- The write never throws. An audit failure is logged; it must not turn a
  successful user action into a 500.
- `audit_log.user_id` is `ON DELETE SET NULL`, so the record of an account
  deletion survives the deletion without identifying anyone
  (see [`data-model.md`](data-model.md)).
- `audit_log.action` carries a database `CHECK` constraint listing the same
  vocabulary (migration `20260908120000_audit_action_check`). The union is a
  compile-time guard; the constraint is what makes "no free text in the trail"
  true of the database itself. Extending `AUDIT_ACTIONS` means adding a
  migration, by design.
