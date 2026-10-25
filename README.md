# TechScribe

A Medium-style technical publishing platform. It currently includes freemium
reading, Google/GitHub/magic-link auth, basic story publishing, admin tools,
and server-side paywall enforcement.

## 📚 Documentation

- **[ARCHITECTURE.md](ARCHITECTURE.md)** — High-level and low-level design
- **[API.md](API.md)** — Complete API reference
- **[CONTRIBUTING.md](CONTRIBUTING.md)** — How to contribute
- **[SECURITY.md](SECURITY.md)** — Security policy and best practices
- **[DEPLOY.md](DEPLOY.md)** — Deployment guide for all platforms
- **[CHANGELOG.md](CHANGELOG.md)** — Version history and changes

---

## 📋 Table of Contents

- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Local Development](#local-development)
- [Docker](#docker)
- [Railway Deployment](#railway-deployment)
- [Database](#database)
- [API Routes](#api-routes)
- [Paywall](#paywall)
- [Cost Estimate](#cost-at--10k-mau)

---

## Architecture

```text
┌──────────────────────────────────────────────────────────────┐
│                        Browser                               │
│         Next.js 16 · React 19 · TypeScript · Tailwind 4     │
└─────────────────────────┬────────────────────────────────────┘
                          │ HTTPS
                          ▼
┌──────────────────────────────────────────────────────────────┐
│              Next.js App Router (SSR + API routes)           │
│                                                              │
│  Pages (SSR/SSG)          API Routes         Middleware      │
│  ├── / (feed)             ├── /api/auth      └── auth check  │
│  ├── /[user]/[slug]       ├── /api/articles      + paywall   │
│  ├── /[username]          ├── /api/admin                     │
│  ├── /new-story           ├── /api/articles                  │
│  └── /me/*                ├── /api/auth                      │
│                           └── /api/health                    │
└────────┬──────────────────────────┬─────────────────────────┘
         │                          │
   ┌─────▼──────┐           ┌───────▼──────────────┐
   │ Vercel Blob│           │   External SaaS       │
   │ (images)   │           │   Resend  (email)     │
   └────────────┘           │   Stripe  (payments)  │
                            │   Google/GitHub OAuth │
                            └───────────────────────┘
                                       │
                       ┌───────────────▼───────────────┐
                       │      PostgreSQL 16             │
                       │  (Railway managed / Docker)    │
                       └───────────────────────────────┘
```

### Request path — article read

```text
Browser → CDN (ISR cache, 60s TTL)
       → cache miss: Next.js SSR → Prisma → PostgreSQL
       → middleware:
            article.memberOnly = false  → render full content
            article.memberOnly = true
              └── valid session + ACTIVE subscription → render full
              └── free quota available (<5 views/30d) → render full + record view
              └── quota exceeded → render ~300-word excerpt + paywall CTA
                                   (full content never reaches the client)
```

---

## Tech Stack

| Layer         | Choice                                          |
| ------------- | ----------------------------------------------- |
| Framework     | Next.js 16 (App Router)                         |
| Language      | TypeScript (strict, no `any`)                   |
| Styling       | Tailwind CSS 4                                  |
| ORM           | Prisma 7 + `@prisma/adapter-pg`                 |
| Database      | PostgreSQL 16                                   |
| Auth          | NextAuth v5 — Google, GitHub, Resend magic-link |
| Editor        | Basic contenteditable story editor              |
| Payments      | Stripe SDK installed; subscription routes TODO  |
| Email         | Resend + React Email                            |
| Image storage | Vercel Blob                                     |
| OG images     | `@vercel/og` (edge-native)                      |
| Validation    | Zod                                             |
| State         | Zustand (editor UI only)                        |

---

## Local Development

### Prerequisites

- Node.js 22+
- Docker + Docker Compose (for the database)

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Fill in `.env`. At minimum for local dev you need:

```env
DATABASE_URL=postgresql://techscribe:techscribe@localhost:5432/techscribe
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<run: openssl rand -base64 32>
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
```

### 3. Start the database

```bash
docker compose up db -d
```

### 4. Run migrations and generate the Prisma client

```bash
npm run db:migrate
```

### 5. Start the dev server

```bash
npm run dev
```

App is at `http://localhost:3000`.

---

## Docker

Build and run the full stack (app + Postgres) locally with Docker Compose:

```bash
docker compose up --build
```

The entrypoint runs `prisma migrate deploy` before starting the server, so the database is always in sync on container start.

To run the app only (against an external database):

```bash
docker build \
  --build-arg DATABASE_URL=postgresql://... \
  -t techscribe .

docker run \
  -e DATABASE_URL=postgresql://... \
  -e NEXTAUTH_SECRET=... \
  -p 3000:3000 \
  techscribe
```

### Image layers

| Stage     | Purpose                                                      |
| --------- | ------------------------------------------------------------ |
| `deps`    | Production `node_modules` only                               |
| `builder` | Full install → `prisma generate` → `next build` (standalone) |
| `runner`  | Copies `.next/standalone` + static assets — no build tooling |

The final image uses Next.js standalone output plus production dependencies, so
the Prisma CLI is available for startup migrations without a network download.

---

## Railway Deployment

### One-time setup

1. Create a new Railway project.
2. Add a **PostgreSQL** plugin — Railway injects `DATABASE_URL` automatically.
3. Add a new **service** from your GitHub repo.
4. Railway detects `Dockerfile` via `railway.toml` and uses it to build.

### Environment variables (Railway service settings)

```text
NEXTAUTH_URL          https://your-app.up.railway.app
NEXTAUTH_SECRET       <openssl rand -base64 32>
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
GITHUB_CLIENT_ID
GITHUB_CLIENT_SECRET
RESEND_API_KEY
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
BLOB_READ_WRITE_TOKEN
```

`DATABASE_URL` is injected automatically from the linked Postgres plugin — do not set it manually.

### Deploy

Push to `main`. Railway builds via the `Dockerfile`, runs `prisma migrate deploy` on startup, then starts `node server.js`.

Health check endpoint: `GET /api/health` → `{ "status": "ok" }`

---

## Database

### Scripts

```bash
npm run db:migrate        # create + apply a new migration (dev)
npm run db:migrate:deploy # apply pending migrations (CI/production)
npm run db:generate       # regenerate Prisma client without migrating
npm run db:studio         # open Prisma Studio at localhost:5555
```

### Schema overview

```text
User ──< Article ──< Comment (threaded)
     ──< Clap     (per article, up to 50)
     ──< Bookmark
     ──< Follow   (follower ↔ following)
     ──  Subscription (one Stripe sub per user)

Article ──< ArticleTag >── Tag
        ──< ArticleView   (paywall quota tracking)
```

Full-text search uses a `tsvector` GIN index added via a raw migration alongside the initial schema (see `ARCHITECTURE.md §5.2`).

---

## API Routes

| Method | Path                         | Auth      | Description                      |
| ------ | ---------------------------- | --------- | -------------------------------- |
| GET    | `/api/articles`              | —         | Paginated feed (`?tag=&cursor=`) |
| POST   | `/api/articles`              | session   | Create draft                     |
| PATCH  | `/api/articles/[id]`         | author    | Update                           |
| DELETE | `/api/articles/[id]`         | author    | Delete                           |
| POST   | `/api/articles/[id]/publish` | author    | Publish / unpublish              |
| POST   | `/api/auth/magic-link`       | Turnstile | Request email sign-in            |
| POST   | `/api/auth/oauth-turnstile`  | Turnstile | Pre-authorize OAuth sign-in      |
| GET    | `/api/admin/me`              | admin     | Current admin profile            |
| GET    | `/api/admin/users`           | admin     | List users                       |
| PATCH  | `/api/admin/users/[id]`      | admin     | Update user                      |
| DELETE | `/api/admin/users/[id]`      | admin     | Delete user                      |
| GET    | `/api/admin/articles`        | admin     | List all articles                |
| POST   | `/api/admin/articles`        | admin     | Create admin article             |
| GET    | `/api/health`                | —         | Health check                     |

---

## Paywall

Soft paywall — 5 member-only articles per `visitorId` per 30-day rolling window. Bypass-able by design (incognito, cleared cookies). This is a conversion nudge, not DRM.

**Critical:** the full article body is never serialized into the HTML for unauthorized requests. Only a `~300`-word plain-text excerpt is returned. No CSS blur tricks.

---

## Planned Stripe Webhooks

Stripe dependencies are installed, but checkout, portal, and webhook routes are
not implemented yet. When subscriptions are added, verify Stripe signatures and
deduplicate webhook events before updating `Subscription` rows.

---

## Cost at < 10k MAU

| Service                  | Plan                | Cost        |
| ------------------------ | ------------------- | ----------- |
| Railway (app + Postgres) | Hobby               | ~$10/mo     |
| Resend                   | Free (3k emails/mo) | $0          |
| Stripe                   | 2.9% + $0.30/txn    | per-use     |
| Vercel Blob              | Hobby (1 GB)        | $0          |
| **Total fixed**          |                     | **~$10/mo** |
