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

Apply per-route: `router.get('/protected', authenticate, handler)`.

### Error handling

Wrap async route handlers with `asyncHandler` from `src/utils/asyncHandler.ts`:

```typescript
import { asyncHandler } from '../utils/asyncHandler'

router.get('/', asyncHandler(async (req, res) => {
  // any thrown error is forwarded to the global error handler
}))
```

Never `try/catch` inside a route handler. The global error middleware in `index.ts` sends the response. To control the HTTP status of a thrown error, attach a `.status` property:

```typescript
throw Object.assign(new Error('Not found'), { status: 404 })
```

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
