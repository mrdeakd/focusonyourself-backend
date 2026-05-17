# LEARN.md — FocusOnYourself Backend

A living guide to this project. Updated as new tools and concepts are introduced.

---

## What is…

### Node.js
Node.js is a runtime that lets you run JavaScript (and TypeScript) on a server — outside of a browser. It is built on Chrome's V8 engine and uses an event-driven, non-blocking I/O model, which makes it fast for handling many concurrent requests without spawning a thread per request. Think of it as the engine that powers this backend the same way the iOS runtime powers your Swift app.

### TypeScript
TypeScript is JavaScript with types added on top. It compiles down to plain JavaScript before running. The types catch mistakes at write-time ("this function returns a string, not an Article array"), improve IDE autocomplete, and make the code much easier to read. We use it here so the `Article` type in TypeScript mirrors the `Article` struct in Swift — any shape mismatch between them becomes obvious immediately.

### Express.js
Express is a minimal web framework for Node.js. It gives you a clean way to define HTTP routes and middleware — similar in spirit to how you might think of a router in SwiftUI, but for HTTP requests. An Express app is a pipeline: a request comes in, flows through middleware (logging, JSON parsing), hits a route handler, and gets a response back.

### Morgan
Morgan is HTTP request logging middleware for Express. One line — `app.use(morgan('tiny'))` — and every request prints to the console: method, URL, status code, response size, and response time. Essential for seeing what the iOS app (or Postman) is actually calling.

### Prisma
Prisma is an ORM (Object-Relational Mapper) — a tool that sits between your TypeScript code and your database. Instead of writing raw SQL, you define a schema in `prisma/schema.prisma`, run a migration command, and then query data using a typed JavaScript API (`prisma.article.findMany()`). Prisma generates TypeScript types from your schema automatically. The migration system keeps a history of every schema change as `.sql` files that can be replayed on any machine.

**Prisma 7 change:** The database URL was moved out of `schema.prisma` and into `prisma.config.ts`. The client now requires a database adapter rather than a direct URL connection.

### libsql / PrismaLibSql adapter
`libsql` is the open-source fork of SQLite created by the team behind Turso. In Prisma 7, connecting to a SQLite database requires an adapter. `@prisma/adapter-libsql` bridges Prisma and libsql — you pass it a config with the database URL, and it handles the actual connection. This also means switching from local SQLite to Turso's hosted cloud SQLite in the future is just a URL change.

### SQLite
SQLite is a database engine that stores all data in a single `.db` file on disk — no separate server process needed. It is perfect for learning because it requires zero setup. In Docker, the database file lives in a persistent volume at `/app/data/dev.db` — outside the container filesystem so it survives rebuilds.

### Docker
Docker packages your app and all its dependencies into a lightweight, isolated container. Every time someone runs `docker compose up`, they get the exact same environment regardless of what is installed on their machine. A `Dockerfile` is the recipe for building the container image. A `docker-compose.yml` orchestrates running containers together. A named volume (`db-data`) stores the SQLite file at `/app/data` so data survives container restarts and rebuilds.

**Important:** The volume is mounted at `/app/data` — not `/app/prisma`. Mounting the volume over the `prisma/` directory would overwrite `schema.prisma` and other source files with stale data from previous runs, causing mysterious errors after upgrades.

---

## Why We Chose It

| Tool | Why | Alternative considered |
|---|---|---|
| **TypeScript** | Type-safe `Article` model matches Swift struct; catches shape mismatches at compile time | Plain JS — simpler, but no types |
| **Express.js** | Most-documented Node framework; huge tutorial surface area | Fastify — faster but steeper learning curve |
| **Prisma 7 + SQLite** | Declarative schema, typed queries, migration history, zero DB setup | raw `better-sqlite3` (no migrations), PostgreSQL (requires server) |
| **libsql adapter** | Required by Prisma 7; opens path to Turso hosted SQLite with zero code change | N/A — no alternative in Prisma 7 |
| **Docker** | Single `docker compose up` command; portable; teaches containerisation | Running Node directly — simpler but no Docker learning |
| **Morgan** | One-line logging; shows every request in Docker Desktop or terminal | Writing manual `console.log` in each route |

---

## Project Structure

```
focusonyourself_backend/
├── src/
│   ├── index.ts              # Express app — mounts morgan + routes, starts server on port 3005
│   ├── db.ts                 # Shared Prisma client (libsql adapter, reads DATABASE_URL)
│   └── routes/
│       └── articles.ts       # GET /api/articles/daily — date validation + seeded shuffle
├── prisma/
│   ├── schema.prisma         # Database schema (Article model) — no URL in Prisma 7
│   ├── seed.ts               # Seeds SQLite from articles.json (skips if data exists)
│   ├── articles.json         # Article content (copied from iOS bundle)
│   └── migrations/
│       └── 20260516.../
│           └── migration.sql # SQL generated from schema — applied by Prisma on startup
├── prisma.config.ts          # Prisma 7 config — datasource URL + seed command
├── Dockerfile                # Container recipe: node:20-slim + OpenSSL + build steps
├── docker-compose.yml        # Local dev orchestration: build, port 3005, db-data volume
├── .dockerignore             # Excludes node_modules, dist, .env, *.db from build context
├── .env                      # Local env vars (DATABASE_URL) — never committed
├── .gitignore                # Ignores node_modules, dist, .env, *.db
├── package.json              # Dependencies and npm scripts
└── tsconfig.json             # TypeScript compiler settings
```

---

## Key Config Files

### `package.json` — dependencies and scripts
```json
{
  "scripts": {
    "dev":   "ts-node-dev --respawn --transpile-only src/index.ts",
    "build": "tsc",
    "start": "node dist/src/index.js",
    "seed":  "ts-node prisma/seed.ts"
  },
  "dependencies": {
    "@libsql/client": "...",          // libsql database client
    "@prisma/adapter-libsql": "...",  // Bridges Prisma and libsql
    "@prisma/client": "...",          // Prisma query client (runtime)
    "express": "...",                 // HTTP framework
    "morgan": "...",                  // HTTP request logger
    "seedrandom": "..."               // Seedable RNG for deterministic shuffle
  },
  "devDependencies": {
    "prisma": "...",          // Prisma CLI (schema, migrations)
    "typescript": "...",      // TypeScript compiler
    "ts-node-dev": "..."      // Runs TypeScript directly + hot-reloads on save
  }
}
```

Note: In Prisma 7 the seed command moved out of `package.json` and into `prisma.config.ts`.

### `tsconfig.json` — TypeScript compiler settings
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "CommonJS",
    "outDir": "dist",
    "strict": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*", "prisma/seed.ts"]
}
```

`prisma/seed.ts` is included so it compiles to `dist/prisma/seed.js` — allowing it to run as plain `node` at container startup without the memory overhead of `ts-node`.

### `prisma/schema.prisma` — database schema (Prisma 7)
```prisma
datasource db {
  provider = "sqlite"
  // No url here in Prisma 7 — moved to prisma.config.ts
}

model Article {
  id              String @id
  title           String
  topic           String
  readTimeMinutes Int
  body            String
}
```

### `prisma.config.ts` — Prisma 7 configuration
```typescript
import { defineConfig } from 'prisma/config'

export default defineConfig({
  migrations: {
    seed: 'node ./dist/prisma/seed.js',  // Compiled JS — no ts-node memory overhead
  },
  datasource: {
    url: process.env.DATABASE_URL ?? 'file:/app/data/dev.db',
  },
})
```

### `src/db.ts` — shared Prisma client
```typescript
import { PrismaLibSql } from '@prisma/adapter-libsql'
import { PrismaClient } from '@prisma/client'

const adapter = new PrismaLibSql({
  url: process.env.DATABASE_URL ?? 'file:/app/data/dev.db',
})

export const prisma = new PrismaClient({ adapter })
```

All routes import `prisma` from here — one place to configure the connection.

### `docker-compose.yml` — local dev orchestration
```yaml
services:
  api:
    build: .
    ports:
      - "3005:3005"
    volumes:
      - db-data:/app/data          # Mounts at /app/data, NOT /app/prisma
    environment:
      - DATABASE_URL=file:/app/data/dev.db

volumes:
  db-data:
```

### `Dockerfile` — container recipe
```dockerfile
FROM node:20-slim

# Prisma requires OpenSSL — not included in slim by default
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Build-time placeholder so prisma generate works — overridden at runtime by docker-compose
ENV DATABASE_URL=file:/app/data/dev.db

COPY package*.json ./
RUN npm install

COPY tsconfig.json ./
COPY prisma.config.ts ./
COPY prisma ./prisma/
RUN npx prisma generate      # Re-run with actual schema after it's copied

COPY src ./src/
RUN npm run build            # Compile TypeScript → dist/ (includes dist/prisma/seed.js)

RUN mkdir -p /app/data       # Create data dir before volume mounts

EXPOSE 3005

CMD ["sh", "-c", "npx prisma migrate deploy && npx prisma db seed && node dist/src/index.js"]
```

### `.env` — local environment variables
```
DATABASE_URL="file:./prisma/dev.db"
```
Used when running outside Docker (e.g. `npm run dev`). Docker overrides this via `docker-compose.yml`. Never commit `.env`.

---

## Commands Reference

### Local development
| Command | What it does | When to run |
|---|---|---|
| `npm install` | Installs all dependencies into `node_modules/` | After cloning or adding a dependency |
| `npm run dev` | Starts server with hot-reload (no build step) | Local dev without Docker |
| `npm run build` | Compiles TypeScript → `dist/` | Before production mode |
| `npm run seed` | Runs seed script directly | Manually resetting local data |

### Prisma
| Command | What it does | When to run |
|---|---|---|
| `npx prisma generate` | Generates TypeScript types from `schema.prisma` | After schema changes |
| `npx prisma migrate dev --name <name>` | Creates + applies a new migration | After editing `schema.prisma` |
| `npx prisma migrate deploy` | Applies pending migrations (non-interactive) | Docker startup |
| `npx prisma db seed` | Runs seed via Prisma CLI (reads `prisma.config.ts`) | After a fresh migration |
| `npx prisma studio` | Opens web UI to browse the database | Inspecting data locally |

### Docker
| Command | What it does | When to run |
|---|---|---|
| `docker compose up` | Start container + stream logs (foreground) | Normal dev start |
| `docker compose up -d` | Start container in background | When you don't need live logs |
| `docker compose up --build` | Rebuild image + start | After changing source code |
| `docker compose up --build --no-cache` | Force full rebuild (no Docker layer cache) | After changing base image or Dockerfile structure |
| `docker compose logs -f` | Follow logs of a running background container | When started with `-d` |
| `docker compose down` | Stop container (volume preserved) | End of day |
| `docker compose down -v` | Stop container + delete volume (wipes DB) | Full reset |

---

## How the Endpoint Works

```
iOS app
  │  GET /api/articles/daily?date=2026-05-16
  ▼
Express (src/index.ts)
  │  morgan logs: "GET /api/articles/daily?date=2026-05-16 200 16242 - 95ms"
  │  Matches /api/articles → hands off to articles router
  ▼
Router (src/routes/articles.ts)
  │  Reads `date` query param (defaults to today's UTC date)
  │  Validates YYYY-MM-DD format — returns 400 if invalid
  ▼
dateHash(dateStr)
  │  DJB2 hash over each character of "2026-05-16"
  │  seed = chars.reduce(5381n, (acc, c) => (acc * 31n + BigInt(charCode)) & 0xFFFF...n)
  │  Same date → same seed → same 4 articles every time
  ▼
seededShuffle(articles, seed)
  │  Fisher-Yates shuffle using xorshift-64 RNG
  │  state ^= state << 13, state ^= state >> 7, state ^= state << 17
  ▼
prisma.article.findMany()       (via src/db.ts → PrismaLibSql adapter → SQLite file)
  │  Returns all 40 typed Article objects
  ▼
res.json(shuffled.slice(0, 4))
  │  HTTP 200 with JSON array
  ▼
iOS decodes [Article] via JSONDecoder
```

**Seed algorithm parity:** The hash and xorshift are a deliberate TypeScript port of the Swift code that previously lived in `ArticlesService.swift`. Same date string → same seed → same 4 articles on both platforms.

---

## HTTP Status Codes You'll See

| Code | Meaning | When |
|---|---|---|
| `200` | OK — full response body returned | First request, or after cache expired |
| `304` | Not Modified — use your cached copy | `URLSession` already has the response; server confirms nothing changed. The app still gets correct data — from cache. This is normal and efficient. |
| `400` | Bad Request | `?date=` is not in `YYYY-MM-DD` format |
| `500` | Internal Server Error | Unhandled exception in the route handler |

---

## How iOS Connects

```
HomeScreen.task {}
  │  await viewModel.loadArticles()
  ▼
HomeViewModel.loadArticles()    (async, errors shown as InlineErrorView)
  │  calls articlesService.dailyArticles()
  ▼
ArticlesService                 (Services/ArticlesService.swift)
  │  formats today as "yyyy-MM-dd"
  │  calls networkClient.get("/api/articles/daily?date=2026-05-16")
  ▼
URLSessionNetworkClient         (Networking/URLSessionNetworkClient.swift)
  │  baseURL = http://localhost:3005
  │  builds full URL, calls URLSession.shared.data(from:)
  │  throws NetworkError.badResponse if status ≠ 200
  │  decodes Data as [Article] via JSONDecoder
  ▼
This backend (running via docker compose up)
```

**Why HTTP works on Simulator:** `localhost` is explicitly exempt from Apple's App Transport Security (ATS). No `Info.plist` change needed for Simulator builds.

**Why a protocol:** `ArticlesService` depends on `NetworkClientProtocol`, not the concrete `URLSessionNetworkClient`. Future phases (meditations, affirmations) inject the same singleton — one line in `Container+App.swift` per new service. Also enables mocking in tests.

**Why `loadArticles()` is `async` (not wrapping in `Task`):** The function is called from `.task {}` in `HomeScreen`, which already provides a structured concurrency context. The ViewModel doesn't need to create its own `Task` — it just `await`s directly, keeping cancellation and error propagation clean.

---

## Lessons Learned

### Docker volume mounting
Mounting a volume over a directory that contains source files (like `prisma/`) causes the volume's stale contents to overwrite the image's fresh files on every container start. Always mount volumes over a dedicated data-only directory (`/app/data`), not a source directory.

### Prisma 7 breaking changes
Prisma 7 removed the `url` property from `schema.prisma`. Migration path:
1. Remove `url` from `datasource` block
2. Create `prisma.config.ts` with `datasource.url` and `migrations.seed`
3. Instantiate `PrismaClient` with a `PrismaLibSql` adapter

### `prisma generate` must run after `COPY prisma`
In Docker, `npm install` triggers a `prisma generate` via `@prisma/client`'s postinstall hook — but at that point the schema hasn't been copied yet. Add an explicit `RUN npx prisma generate` step after `COPY prisma ./prisma/` to regenerate with the real schema.

### Docker layer caching during upgrades
`docker compose up --build` uses cached layers. If a base file (like `schema.prisma`) changed in a way the cache doesn't detect, the container will run with stale files. Use `docker compose build --no-cache` for a guaranteed fresh build after major changes like Prisma version upgrades.

### `ts-node` is too heavy for memory-constrained servers
Running `ts-node` at container startup compiles TypeScript on-the-fly, consuming ~200MB RAM. On free-tier servers with 256MB total, this OOM-kills the process. Fix: include seed files in `tsconfig.json` so they compile to plain JS during the Docker build, then run `node` at startup instead. Zero compilation overhead.

### libsql + SQLite uses heavy virtual memory mapping
The libsql adapter memory-maps SQLite files, inflating virtual memory to ~11GB even for small databases. On Linux systems with strict overcommit settings (common on cloud free tiers), the OOM killer fires even when actual RSS usage is low (~74MB). For free-tier cloud deployment, use Turso's hosted libsql instead — it connects over HTTP and has no mmap overhead.

---

## Authentication

### What is bcrypt?

bcrypt is a one-way password hashing function. "One-way" means there is no way to reverse it — you can only *verify* a guess by hashing it again and comparing the output. This is intentional: if your database is ever leaked, the attacker gets password hashes, not passwords.

Why not SHA-256 or MD5? Those are *cryptographic hash functions*, not password hash functions. They are designed to be fast — a modern GPU can compute billions of SHA-256 hashes per second. bcrypt is *deliberately slow* via an adaptive cost factor. At `cost: 12`, one hash takes ~250ms. That makes brute-forcing a leaked database 10 million times harder than with SHA-256.

```typescript
const hash = await bcrypt.hash('mypassword', 12)       // store this in the DB
const valid = await bcrypt.compare('mypassword', hash) // true
const wrong = await bcrypt.compare('wrongpass',  hash) // false
```

The salt (a random value that prevents two identical passwords from producing the same hash) is built into the bcrypt output string — you don't manage it separately.

---

### JWT anatomy

A JWT (JSON Web Token) looks like: `header.payload.signature`

Each part is base64url-encoded. The **header** says which algorithm was used (e.g. `{ "alg": "HS256" }`). The **payload** carries claims:

```json
{ "sub": "cmp9sdbjg0000eu1pvda0cjf9", "iat": 1779023081, "exp": 1779023981 }
```

- `sub` — subject (the user's ID)
- `iat` — issued at (Unix timestamp)
- `exp` — expiry (Unix timestamp)

The **signature** is `HMAC-SHA256(base64url(header) + "." + base64url(payload), secret)`. Anyone who has the secret can verify the signature. Anyone who tampers with the payload will have a signature mismatch.

**Important:** JWTs are *signed*, not *encrypted*. Anyone can decode the payload — never put sensitive data (passwords, PII) inside a JWT. The signature only proves the token was created by someone who knew the secret.

---

### Access token vs refresh token

| | Access token | Refresh token |
|--|--|--|
| **TTL** | 15 minutes | 30 days |
| **Stored** | iOS Keychain (client only) | iOS Keychain **and** server DB |
| **Purpose** | Prove identity on each API request | Exchange for a new access token |
| **Revocable** | No — stateless, valid until expiry | Yes — delete the DB row |

Short-lived access tokens limit the damage if one is leaked — it expires in minutes. Long-lived refresh tokens mean the user doesn't have to log in again every 15 minutes. When a refresh token is used, the server deletes it and issues a new one (*rotation*) — this means a stolen refresh token can only be used once before it's invalidated.

---

### authenticate middleware

Express middleware is a function with the signature `(req, res, next) => void`. It runs before the route handler and can inspect/modify the request or short-circuit with a response.

`authenticate` in `src/middleware/authenticate.ts` does three things:

1. **Extracts** the `Authorization: Bearer <token>` header. Returns 401 if missing or malformed.
2. **Verifies** the JWT signature and expiry with `jwt.verify(token, JWT_SECRET)`. Returns 401 with a specific error (`"Token expired"` vs `"Invalid token"`) depending on the failure reason.
3. **Attaches** `req.user = { id, email }` on success and calls `next()` to pass control to the route handler.

```typescript
// Apply to a single route:
router.get('/me', authenticate, (req, res) => {
  res.json(req.user) // user guaranteed to exist here
})

// Apply to all routes in a router:
router.use(authenticate)
```

The route handler never needs to repeat token validation — the middleware guarantees that if it runs, `req.user` is valid.
