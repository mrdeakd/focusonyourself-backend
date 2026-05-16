# FocusOnYourself Backend

REST API backend for the FocusOnYourself iOS app. Serves all content — articles, meditation sessions, affirmations, and narration audio URLs — from a SQLite database, replacing the bundled JSON and MP3 assets that previously shipped inside the app.

---

## What It Serves

| Endpoint | Description |
|----------|-------------|
| `GET /api/articles/daily?date=YYYY-MM-DD` | 4 deterministically selected articles for the given date |
| `GET /api/meditations?category=morning` | All meditation sessions with nested steps, optionally filtered by category |
| `GET /api/affirmations/batch?categories=confidence,mindfulness&count=10` | Random batch of affirmations filtered by one or more categories |
| `GET /api/narration-map` | Full instruction → Supabase CDN URL map for meditation narration audio |
| `GET /health` | Health check (returns 200) |

---

## Tech Stack

### Runtime & Framework
| Technology | Usage |
|-----------|-------|
| **Node.js 20** | JavaScript runtime |
| **TypeScript** | Type-safe codebase — `Article`, `MeditationSession`, and response shapes mirror Swift structs |
| **Express.js** | HTTP server and routing |
| **Morgan** | HTTP request logging (`tiny` format) |

### Database
| Technology | Usage |
|-----------|-------|
| **Prisma 7** | ORM — schema definition, migrations, typed query client |
| **SQLite** | Local database (file at `/app/data/dev.db` inside Docker) |
| **`@prisma/adapter-libsql`** | Prisma 7 adapter for libsql/SQLite connections |

### Infrastructure
| Technology | Usage |
|-----------|-------|
| **Docker** | Containerised runtime (`node:20-slim` + OpenSSL) |
| **Docker Compose** | Local development orchestration — single `docker compose up` starts everything |
| **Supabase Storage** | CDN hosting for 135 narration MP3 files |

### Algorithms
| | |
|--|--|
| **Seeded daily article shuffle** | DJB2 hash of date string → xorshift-64 RNG → Fisher-Yates shuffle, ported from the original Swift implementation for identical results |
| **Affirmation shuffle** | `seedrandom`-based random shuffle per request (result cached on iOS for the day) |

---

## Architecture

```
src/
├── index.ts              # Express app — mounts morgan, routes, health check
├── db.ts                 # Shared Prisma client (libsql adapter)
└── routes/
    ├── articles.ts       # Daily article selection with seeded shuffle
    ├── meditations.ts    # Sessions + nested steps, category filter
    ├── affirmations.ts   # Random batch with multi-category filter
    └── narrationMap.ts   # Instruction → Supabase URL map

prisma/
├── schema.prisma         # Article, MeditationSession, MeditationStep,
│                         # Affirmation, NarrationEntry models
├── seed.ts               # Idempotent seed from bundled JSON files
├── prisma.config.ts      # Prisma 7 datasource + seed command config
├── migrations/           # SQL migration history
├── articles.json         # 40 articles (source of truth)
├── meditations.json      # 24 sessions with steps
├── affirmations.json     # ~27,000 affirmations across 6 categories
└── narration_map.json    # 135 instruction → filename mappings
```

---

## Database Schema

```prisma
model Article           { id, title, topic, readTimeMinutes, body }
model MeditationSession { id, title, category, durationMinutes, isPro, steps[] }
model MeditationStep    { id, order, instruction?, silenceDurationSeconds?, session }
model Affirmation       { id, quote, category }
model NarrationEntry    { id, instruction @unique, audioUrl }
```

---

## Getting Started

**Prerequisites:** Docker Desktop installed and running.

```bash
# Start the server (builds image, runs migrations, seeds DB, starts Express)
docker compose up

# Force rebuild after code changes
docker compose up --build

# Stop (preserves the database volume)
docker compose down

# Stop and wipe the database
docker compose down -v
```

Server runs on **http://localhost:3005**

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `file:/app/data/dev.db` | SQLite file path inside the container |
| `SUPABASE_AUDIO_URL` | — | Base URL for Supabase Storage narration MP3s |
| `PORT` | `3005` | HTTP port |

For local development outside Docker, copy `.env` and set `DATABASE_URL=file:./prisma/dev.db`.

---

## Local Development (without Docker)

```bash
npm install

# Run migrations + seed
DATABASE_URL="file:./prisma/dev.db" npx prisma migrate dev
DATABASE_URL="file:./prisma/dev.db" npx prisma db seed

# Start with hot reload
npm run dev
```

---

## Useful Commands

| Command | What it does |
|---------|-------------|
| `docker compose up` | Start server (foreground, logs visible) |
| `docker compose up -d` | Start server in background |
| `docker compose logs -f` | Follow logs of background container |
| `npx prisma studio` | Open web UI to browse the database |
| `npx prisma migrate dev --name <name>` | Create a new migration after schema changes |
| `npm run build` | Compile TypeScript → `dist/` |

---

## Requirements

- **Node.js 20+**
- **Docker Desktop** (recommended for running locally)
- **Supabase account** with a public storage bucket containing the 135 narration MP3s (for the narration map endpoint)
