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

## 3. Logging and redaction

`server/src/logging/logger.ts` exports the single pino logger. Two layers keep
secrets out of it:

1. A `formatters.log` hook walks every logged object and replaces the value of
   any key matching
   `password|passphrase|secret|token|authorization|hash|credential|cookie|apikey|api_key`
   with `[redacted]`, at any depth and inside arrays. Pino's built-in `redact`
   only understands fixed paths, so this catches fields nobody anticipated.
2. Pino's path-based `redact` covers the well-known headers as a second layer.

`requestLog()` emits one line per request with method, route, status, duration,
and the correlation id — and nothing else. **Request bodies and query strings are
never logged at all.** The redaction list is the safety net, not the policy.

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
Service, so the limiter keys on the real client address rather than the proxy's.

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
