# Auth Rate Limiting — Design

**Date:** 2026-05-25
**Status:** Approved, ready for implementation plan

## Context

The auth endpoints (`/api/auth/register`, `/login`, `/refresh`) have no rate limiting today. A single client can issue unlimited login attempts, enabling credential-stuffing and brute-force attacks. Before this backend is deployed to a public URL, we need throttling on the auth write surface.

## Scope

Rate-limited:

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/refresh`

Out of scope:

- `POST /api/auth/logout` — requires a valid token already; low abuse value
- `GET  /api/auth/me` — cheap, already auth-gated
- `/api/checkins`, `/api/articles`, `/api/meditations`, `/api/affirmations`, `/api/narration-map` — feature endpoints, not credential-touching

## Architecture

A new file `src/middleware/rateLimit.ts` exports three named middleware built on the `express-rate-limit` package:

```
registerLimiter  → single express-rate-limit instance (IP-keyed)
loginLimiter     → array of TWO express-rate-limit instances (IP-keyed, then email-keyed),
                   applied in sequence so either limit blocks the request
refreshLimiter   → single express-rate-limit instance (IP-keyed)
```

Routes in `src/auth/router.ts` apply them positionally:

```typescript
router.post('/register', registerLimiter,    asyncHandler(...))
router.post('/login',    ...loginLimiter,    asyncHandler(...))   // spread the pair
router.post('/refresh',  refreshLimiter,     asyncHandler(...))
```

No service-layer changes. The limiters live in middleware because rate limiting is a request-level concern, not domain logic.

### Per-email keying

For `/login`, the second limiter sets `keyGenerator: (req) => req.body?.email ?? 'unknown'`. The body is parsed by `express.json()` (already registered globally before routes) so `req.body` is populated by the time the limiter sees it. If the body is missing or malformed, the email key falls back to `'unknown'` and that bucket gets shared across all bad-payload requests — acceptable; the IP limiter still applies.

## Limits

Starting values (tunable; documented in a constants block at the top of `rateLimit.ts`):

| Route        | Per-IP limit       | Per-email limit    | Notes                                |
|--------------|--------------------|--------------------|--------------------------------------|
| `/register`  | 5 / hour           | —                  | Account creation is rare             |
| `/login`     | 10 / 15 min        | 5 / 15 min         | IP catches one machine; email catches distributed attacks on one account |
| `/refresh`   | 60 / 15 min        | —                  | Apps refresh access tokens often     |

### `/login` only — skipSuccessfulRequests

For both `/login` limiters, set `skipSuccessfulRequests: true`. A correct password should not consume the counter. Effect: real users are never blocked; only failed attempts increment the bucket. `/register` and `/refresh` count all attempts.

## Error response shape

Every limiter overrides `express-rate-limit`'s default response handler:

```typescript
handler: (req, res, next) => next(httpError(429, 'Too many requests, try again later'))
```

This routes the 429 through the existing global error middleware in `src/index.ts`, producing the same `{ error: '...' }` JSON shape as every other error. The library still emits the `RateLimit-*` informational headers and the `Retry-After` header automatically on a hit; we do not need to set those ourselves.

## Reverse proxy

When this backend is deployed behind a platform proxy (Fly.io, Railway, Render), the source IP appears in `X-Forwarded-For`. We add a single line at the top of `src/index.ts`:

```typescript
app.set('trust proxy', 1)
```

This tells Express to read the leftmost entry from `X-Forwarded-For` as the client IP, which is what `express-rate-limit` uses as the default key. Harmless when running locally (no proxy → no header → falls back to socket IP).

## Test-mode skip

Each limiter is created with:

```typescript
skip: () => process.env.NODE_ENV === 'test'
```

This unblocks future Vitest / supertest test runs from accidentally tripping their own limits. Local dev (`npm run dev`, no `NODE_ENV` set) keeps limiters active — useful for spotting bugs early.

## Manual verification

After implementation, three quick curl checks (test suite will come later in a separate task):

1. **IP limit hits.** Eleven failed logins from the same IP — the 11th returns 429.
   ```
   for i in {1..11}; do
     curl -sX POST localhost:3005/api/auth/login \
       -H 'Content-Type: application/json' \
       -d '{"email":"a@b.co","password":"wrongpass"}' \
       -w '%{http_code}\n' -o /dev/null
   done
   ```
2. **Email limit hits independently.** Six failed logins for the same email while rotating `X-Forwarded-For` (with `trust proxy` enabled) — the 6th returns 429 despite different IPs.
3. **Success does not burn the counter.** Nine successful logins in a row all return 200; no lockout.

## Files affected

| Path                            | Change   |
|---------------------------------|----------|
| `package.json`                  | Add `express-rate-limit` dependency |
| `src/middleware/rateLimit.ts`   | New file — three exported limiters |
| `src/auth/router.ts`            | Apply limiters to `/register`, `/login`, `/refresh` |
| `src/index.ts`                  | Add `app.set('trust proxy', 1)` |
| `CLAUDE.md`                     | Add a short "Rate limiting" subsection under Middleware |

## Dependencies

- `express-rate-limit` ^7.x (CommonJS-compatible, fits current `tsconfig` `module: "CommonJS"`)

No new dev dependencies.

## Out of scope (YAGNI)

- **Redis / shared store.** In-memory is correct for single-instance SQLite. Revisit when deploying to multi-region or horizontally-scaled setups.
- **Per-user dynamic limits.** Fixed numbers are fine to start.
- **CAPTCHAs / account lockout.** Different mechanism, different problem. Add only if abuse persists past basic rate limiting.
- **Limiting feature endpoints.** Not in this spec; revisit if/when usage data shows abuse.
- **Automated tests.** Future task (Vitest + supertest is the next learning step).
