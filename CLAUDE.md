# FocusOnYourself Backend

Node.js + Express + Prisma + TypeScript REST API for the FocusOnYourself iOS app.

## Commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start with ts-node-dev (hot reload) |
| `npm run build` | Compile TypeScript → `dist/` |
| `npm start` | Run compiled output (`node dist/src/index.js`) |
| `npm run seed` | Run seed.ts directly (idempotent) |
| `npx prisma migrate dev --name <name>` | Apply schema changes + regenerate client |
| `npx prisma generate` | Regenerate Prisma client after schema edit |
| `npx prisma db seed` | Run seed via prisma (same as `npm run seed`) |
| `npx prisma studio` | Browse database in the browser |
| `docker compose up` | Start with Docker (runs migrations + seed automatically) |

## Architecture

### Feature-folder pattern

Each feature lives in `src/{feature}/`:

```
src/{feature}/
├── router.ts   ← Express Router; validates input, calls service, sends response
└── service.ts  ← Business logic and Prisma queries; no Express imports
```

`src/index.ts` mounts each router: `app.use('/api/articles', articlesRouter)`.

**Rule:** `router.ts` never imports Prisma directly — it calls service functions. Service functions never import Express types.

### Middleware

Cross-cutting request concerns live in `src/middleware/`. Currently:
- `authenticate.ts` — validates `Authorization: Bearer <jwt>`, attaches `req.user`
- `rateLimit.ts` — `registerLimiter`, `loginLimiter` (array), `refreshLimiter` for the auth write endpoints

Apply per-route: `router.get('/protected', authenticate, handler)`.

`loginLimiter` is a tuple of two middleware (per-IP, then per-email) — spread it when applying:
`router.post('/login', ...loginLimiter, handler)`.

Behind a reverse proxy (Fly.io, Railway, etc.), `src/index.ts` calls `app.set('trust proxy', 1)` so the limiter reads the real client IP from `X-Forwarded-For`.

### Error handling

Wrap async route handlers with `asyncHandler` from `src/utils/asyncHandler.ts`:

```typescript
import { asyncHandler } from '../utils/asyncHandler'

router.get('/', asyncHandler(async (req, res) => {
  // any thrown error is forwarded to the global error handler
}))
```

Never `try/catch` inside a route handler. The global error middleware in `index.ts` sends the response.

**Throw HTTP errors with `httpError()`** from `src/utils/httpError.ts`:

```typescript
import { httpError } from '../utils/httpError'

throw httpError(404, 'Not found')
```

Don't use `Object.assign(new Error(...), { status })` — `httpError` is the canonical form.

**Domain errors belong in the service, not the router.** If the check is about *what the data means* (user already exists, password doesn't match, record not found, refresh token expired), throw `httpError()` from the service. Routers only check *shape of input* and call the service.

```typescript
// service.ts — owns the 409
export async function registerUser(email: string, password: string) {
  if (await prisma.user.findUnique({ where: { email } })) {
    throw httpError(409, 'Email already in use')
  }
  // ...
}

// router.ts — parses, then calls; no status codes inline
router.post('/register', asyncHandler(async (req, res) => {
  const { email, password } = parseRegisterBody(req.body)
  res.status(201).json(await registerUser(email, password))
}))
```

### Input validation

Each feature exposes `parseXBody` / `parseXQuery` functions (in `router.ts` for tiny features, or a sibling `validate.ts` once a feature has 2+ parsers). A parser either returns typed, validated data or throws `httpError(400, ...)`.

```typescript
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/
const VALID_MOODS = ['rough', 'low', 'okay', 'good', 'great'] as const

function parseCheckInBody(body: any): CheckInInput {
  if (!DATE_REGEX.test(body.dateString)) throw httpError(400, 'dateString must be YYYY-MM-DD')
  if (!VALID_MOODS.includes(body.mood)) throw httpError(400, `mood must be one of ${VALID_MOODS.join(', ')}`)
  // ...
  return { dateString: body.dateString, mood: body.mood, /* ... */ }
}
```

**Rules:**
- No inline `if (...) { res.status(400).json(...); return }` chains in handlers. Parse at the top, then write straight-line logic.
- Shared primitives (`DATE_REGEX`, ISO-date helpers, etc.) live in `src/utils/validation.ts` — don't redeclare them per feature.

### Accessing the authed user

Routes behind `authenticate` get `req.user` typed via `src/types/express.d.ts`. Don't write `req.user!.id` at call sites — use the `getUserId(req)` helper from `src/utils/authedRequest.ts`:

```typescript
router.get('/', authenticate, asyncHandler(async (req, res) => {
  res.json(await getCheckIns(getUserId(req)))
}))
```

`getUserId` throws `httpError(401)` if `req.user` is missing, so the type narrows without `!`.

### Database

Single shared Prisma client instance exported from `src/db.ts`. Import it as:

```typescript
import { prisma } from '../db'
```

Never create a `new PrismaClient()` in a feature file.

### Environment variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `DATABASE_URL` | Yes | SQLite file path, e.g. `file:/app/data/dev.db` |
| `JWT_SECRET` | Yes | Signs access tokens (15 min TTL) |
| `REFRESH_SECRET` | Yes | Signs refresh tokens (30 day TTL) |
| `PORT` | No | HTTP port (defaults to 3005) |

### Auth pattern

- `POST /api/auth/register` / `login` → returns `{ accessToken, refreshToken, expiresAt, user }`
- `POST /api/auth/refresh` → rotates the refresh token, returns a new pair
- `POST /api/auth/logout` → deletes the refresh token server-side
- `GET /api/auth/me` → protected; returns `{ id, email }`

Tokens: access token 15 min, refresh token 30 days (stored server-side in `RefreshToken` table for revocation).

## Adding a new feature

1. Create `src/{feature}/service.ts` — Prisma queries + business logic
2. Create `src/{feature}/router.ts` — Express Router, validate inputs, call service
3. Register in `src/index.ts`: `app.use('/api/{feature}', router)`
4. If a new model is needed: add to `prisma/schema.prisma`, run `npx prisma migrate dev --name add-{feature}`
5. Add seed data in `prisma/seed.ts` if needed (idempotent: check count before inserting)
