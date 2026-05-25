# Auth Rate Limiting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add rate limiting to the three auth write endpoints (`/register`, `/login`, `/refresh`) using `express-rate-limit`, with per-IP throttling everywhere and an extra per-email layer on `/login`.

**Architecture:** A new `src/middleware/rateLimit.ts` exports three named middleware. `loginLimiter` is a tuple of two limiters (IP + email) applied via spread. All limiters route 429s through the existing `httpError` helper so the global error middleware renders them. `app.set('trust proxy', 1)` in `src/index.ts` makes the limiter honor `X-Forwarded-For` when deployed behind a platform proxy.

**Tech Stack:** Node.js, Express, TypeScript, express-rate-limit v7

**Spec:** `docs/superpowers/specs/2026-05-25-auth-rate-limiting-design.md`

**Testing approach:** Per the spec, no automated tests in this plan — Vitest is a separate future task. Each task ends with `npm run build` for type-safety, and the final task runs three manual curl verifications.

---

## File overview

| Path                          | Action  | Purpose |
|-------------------------------|---------|---------|
| `package.json` / lockfile     | Modify  | Add `express-rate-limit` dependency |
| `src/middleware/rateLimit.ts` | Create  | Three exported limiters (register/login/refresh) |
| `src/auth/router.ts`          | Modify  | Apply limiters to the three routes |
| `src/index.ts`                | Modify  | Add `app.set('trust proxy', 1)` |
| `CLAUDE.md`                   | Modify  | Add "Rate limiting" note under Middleware |

---

### Task 1: Install `express-rate-limit`

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] **Step 1: Install the dependency**

Run:
```bash
npm install express-rate-limit@^7
```

Expected: `package.json` gains `"express-rate-limit": "^7.x.x"` under `dependencies`.

- [ ] **Step 2: Verify it installed**

Run:
```bash
node -e "console.log(require('express-rate-limit').version || 'loaded')"
```

Expected: prints `loaded` (or a version number) with no error.

- [ ] **Step 3: Verify the project still type-checks**

Run:
```bash
npm run build
```

Expected: exit code 0, no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add express-rate-limit dependency"
```

---

### Task 2: Create the rate-limit middleware

**Files:**
- Create: `src/middleware/rateLimit.ts`

- [ ] **Step 1: Create the file**

Create `src/middleware/rateLimit.ts` with this exact content:

```typescript
import rateLimit from 'express-rate-limit'
import type { Request, Response, NextFunction } from 'express'
import { httpError } from '../utils/httpError'

const FIFTEEN_MINUTES = 15 * 60 * 1000
const ONE_HOUR = 60 * 60 * 1000

function tooManyRequests(_req: Request, _res: Response, next: NextFunction): void {
  next(httpError(429, 'Too many requests, try again later'))
}

const skipInTests = (): boolean => process.env.NODE_ENV === 'test'

export const registerLimiter = rateLimit({
  windowMs: ONE_HOUR,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: skipInTests,
  handler: tooManyRequests,
})

const loginByIp = rateLimit({
  windowMs: FIFTEEN_MINUTES,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: skipInTests,
  skipSuccessfulRequests: true,
  handler: tooManyRequests,
})

const loginByEmail = rateLimit({
  windowMs: FIFTEEN_MINUTES,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: skipInTests,
  skipSuccessfulRequests: true,
  keyGenerator: (req: Request): string =>
    typeof req.body?.email === 'string' ? req.body.email : 'unknown',
  handler: tooManyRequests,
})

export const loginLimiter = [loginByIp, loginByEmail]

export const refreshLimiter = rateLimit({
  windowMs: FIFTEEN_MINUTES,
  limit: 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: skipInTests,
  handler: tooManyRequests,
})
```

- [ ] **Step 2: Verify it type-checks**

Run:
```bash
npm run build
```

Expected: exit code 0, no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add src/middleware/rateLimit.ts
git commit -m "feat: add rate-limit middleware for auth endpoints"
```

---

### Task 3: Apply limiters in the auth router

**Files:**
- Modify: `src/auth/router.ts`

- [ ] **Step 1: Add the import**

In `src/auth/router.ts`, add this import beside the other middleware imports near the top of the file (the file currently imports from `'../middleware/authenticate'`):

```typescript
import { registerLimiter, loginLimiter, refreshLimiter } from '../middleware/rateLimit'
```

- [ ] **Step 2: Apply `registerLimiter` to `/register`**

In `src/auth/router.ts`, change the `/register` route from:

```typescript
router.post('/register', asyncHandler(async (req, res) => {
```

to:

```typescript
router.post('/register', registerLimiter, asyncHandler(async (req, res) => {
```

- [ ] **Step 3: Apply `loginLimiter` to `/login`**

In `src/auth/router.ts`, change the `/login` route from:

```typescript
router.post('/login', asyncHandler(async (req, res) => {
```

to:

```typescript
router.post('/login', ...loginLimiter, asyncHandler(async (req, res) => {
```

Note the **spread** (`...loginLimiter`) — `loginLimiter` is a two-element array (IP limiter, email limiter) and both run in sequence.

- [ ] **Step 4: Apply `refreshLimiter` to `/refresh`**

In `src/auth/router.ts`, change the `/refresh` route from:

```typescript
router.post('/refresh', asyncHandler(async (req, res) => {
```

to:

```typescript
router.post('/refresh', refreshLimiter, asyncHandler(async (req, res) => {
```

Leave `/logout` and `/me` untouched.

- [ ] **Step 5: Verify the project type-checks**

Run:
```bash
npm run build
```

Expected: exit code 0, no TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add src/auth/router.ts
git commit -m "feat: apply rate limiters to register/login/refresh"
```

---

### Task 4: Trust the reverse proxy

**Files:**
- Modify: `src/index.ts`

- [ ] **Step 1: Add `trust proxy` setting**

In `src/index.ts`, find this block (around lines 11–15):

```typescript
const app = express()
const PORT = Number(process.env.PORT) || 3005

app.use(morgan('tiny'))
app.use(express.json())
```

Insert a new line directly after `const app = express()`:

```typescript
const app = express()
app.set('trust proxy', 1)
const PORT = Number(process.env.PORT) || 3005

app.use(morgan('tiny'))
app.use(express.json())
```

- [ ] **Step 2: Verify it type-checks**

Run:
```bash
npm run build
```

Expected: exit code 0, no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add src/index.ts
git commit -m "chore: trust the first proxy hop so rate limiter sees real client IP"
```

---

### Task 5: Manual verification

**Files:** none — runtime checks against the dev server.

- [ ] **Step 1: Start the dev server in one terminal**

Run:
```bash
npm run dev
```

Expected: log line `FocusOnYourself backend running on http://localhost:3005`. Leave it running.

- [ ] **Step 2: Confirm IP limit fires on `/login`**

In a second terminal, run:

```bash
for i in {1..11}; do
  curl -sX POST localhost:3005/api/auth/login \
    -H 'Content-Type: application/json' \
    -d '{"email":"ratelimit-test@example.com","password":"wrongpassword1"}' \
    -w '%{http_code}\n' -o /dev/null
done
```

Expected output: ten lines of `401`, then `429` on the eleventh request.

- [ ] **Step 3: Confirm per-email limit fires independently of IP**

Still in the second terminal:

```bash
for i in {1..6}; do
  curl -sX POST localhost:3005/api/auth/login \
    -H 'Content-Type: application/json' \
    -H "X-Forwarded-For: 10.0.0.$i" \
    -d '{"email":"email-lock-test@example.com","password":"wrongpassword1"}' \
    -w '%{http_code}\n' -o /dev/null
done
```

Expected output: five lines of `401`, then `429` on the sixth — even though every request comes from a different forwarded IP. This proves the per-email counter is independent.

- [ ] **Step 4: Confirm successful logins do NOT burn the counter**

First register a user we can actually log in as:

```bash
curl -sX POST localhost:3005/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"success-test@example.com","password":"correctpassword1"}' \
  -w '\nstatus: %{http_code}\n'
```

Expected: `201` and a JSON body with `accessToken`, `refreshToken`, `user`.

Then hit `/login` nine times with the correct password:

```bash
for i in {1..9}; do
  curl -sX POST localhost:3005/api/auth/login \
    -H 'Content-Type: application/json' \
    -d '{"email":"success-test@example.com","password":"correctpassword1"}' \
    -w '%{http_code}\n' -o /dev/null
done
```

Expected output: nine lines of `200`, no `429`. Confirms `skipSuccessfulRequests` is working.

- [ ] **Step 5: Stop the dev server**

In the first terminal, press `Ctrl+C`. Expected: process exits cleanly.

- [ ] **Step 6: Note — no commit for this task**

Manual verification produces no file changes. Skip to Task 6.

---

### Task 6: Document the middleware in CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update the Middleware section**

In `CLAUDE.md`, find the "Middleware" subsection that currently reads:

```markdown
### Middleware

Cross-cutting request concerns live in `src/middleware/`. Currently:
- `authenticate.ts` — validates `Authorization: Bearer <jwt>`, attaches `req.user`

Apply per-route: `router.get('/protected', authenticate, handler)`.
```

Replace it with:

```markdown
### Middleware

Cross-cutting request concerns live in `src/middleware/`. Currently:
- `authenticate.ts` — validates `Authorization: Bearer <jwt>`, attaches `req.user`
- `rateLimit.ts` — `registerLimiter`, `loginLimiter` (array), `refreshLimiter` for the auth write endpoints

Apply per-route: `router.get('/protected', authenticate, handler)`.

`loginLimiter` is a tuple of two middleware (per-IP, then per-email) — spread it when applying:
`router.post('/login', ...loginLimiter, handler)`.

Behind a reverse proxy (Fly.io, Railway, etc.), `src/index.ts` calls `app.set('trust proxy', 1)` so the limiter reads the real client IP from `X-Forwarded-For`.
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: document rate-limit middleware in CLAUDE.md"
```

---

## Done criteria

- `git log --oneline` shows five commits for tasks 1, 2, 3, 4, 6 (task 5 has no commit).
- `npm run build` exits 0.
- Manual verification in Task 5 produced the expected 401/429/200 patterns.
- `CLAUDE.md` describes the new middleware.
