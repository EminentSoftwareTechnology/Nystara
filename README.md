# Nystara

A Medium-style technical publishing platform. It currently includes freemium
reading, Google/GitHub/magic-link auth, basic story publishing, admin tools,
and server-side paywall enforcement. The writing desk supports document formatting,
saved drafts, R2 image uploads, video previews, and subscription-gated AI editing.

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
Browser → Next.js dynamic rendering (private, no-store) → Prisma → PostgreSQL
       → server-side article access check:
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
| Image storage | Cloudflare R2 (story images)                     |
| Validation    | Zod                                             |
| State         | Zustand (editor UI only)                        |

---

## Local Development

Use Node 22.12+ and Podman with `podman-compose` (or Docker Compose v2). The launcher prefers Podman when both have a Compose provider; set `CONTAINER_ENGINE=docker` to select Docker.

```bash
./start.sh
```

The launcher installs locked dependencies, creates a private `.env.local` with random signing secrets if no env file exists, starts loopback-only PostgreSQL, Redis, and Mailpit, generates Prisma, applies migrations, and starts development on port 6100. Local sign-in email is captured by Mailpit at [http://localhost:8035](http://localhost:8035); its SMTP server listens on `127.0.0.1:1035`. It parses env files as dotenv data. Existing process variables override env files; `.env.local` overrides `.env`. It does not seed or reset your database.

Configure Google/GitHub credentials to use those sign-in flows. Development magic-link emails are captured locally; production uses Resend. Development can use Turnstile test keys; production rejects them. Seed the first administrator only after setting `ADMIN_EMAIL` and `ADMIN_PASSWORD` (12+ characters, at most 72 UTF-8 bytes) in the environment:

```bash
npm run db:seed
PORT=6001 ./start.sh dev
./start.sh prod
./start.sh --help
```

`HOST` defaults to `127.0.0.1`. Set it explicitly if LAN access is required. If you override `PORT`, set `NEXTAUTH_URL` to the same local origin so same-origin write checks continue to pass. Remote databases require `ALLOW_REMOTE_MIGRATE=1`; startup never resets or seeds them automatically. `prod` builds locally and requires production CAPTCHA keys and Redis. Keep development infrastructure credentials for local use only.

## Docker

```bash
./start.sh docker
```

This full Compose stack runs with the selected Docker or Podman engine. Set `POSTGRES_PASSWORD` to a random hex value, `NEXTAUTH_URL` to the browser-visible origin, strong signing secrets, and real Turnstile site/secret keys. The site key is a public build argument; database URLs and signing secrets are runtime variables. Existing database volumes retain their original password; changing an env value does not rotate an existing database credential.

For an existing database or hosted deployment, use the runtime variables in [.env.example](.env.example). Production requires `REDIS_URL` for shared rate limits. Leave `TRUST_PROXY_IP=0` until you verify that ingress appends/overwrites the forwarding header and blocks direct app access. With it disabled, clients share conservative aggregate buckets. Use a dedicated limiter Redis with bounded memory and `noeviction`, so eviction cannot reset blocked buckets.

The container runs as a non-root user and applies migrations before serving. Schedule `npm run db:cleanup` daily from an environment with development tools installed to delete reading records older than 30 days and expired sessions/tokens. Reading metrics reflect retained records. Retention cleanup is not automatically scheduled by this repository.

See [SECURITY_REVIEW.md](SECURITY_REVIEW.md) for findings, validation and deployment limits.

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

## Writing desk and media

`/new-story` creates a story; `/editor/[id]` reopens an owned draft. Save draft
persists the structured document, plain-text search/excerpt content, subtitle,
cover, and member-only setting. Published pages render document nodes through a
fixed React renderer; legacy plain-text stories remain readable. Save before
leaving the editor. There is no automatic save or cross-device conflict resolution.

### Cloudflare R2

Set `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`,
and `R2_PUBLIC_URL` in the server environment. Create an R2 bucket and a
bucket-scoped Object Read & Write token. Copy the account ID and public HTTPS
custom-domain URL from Cloudflare; do not expose access keys in `NEXT_PUBLIC_*`
variables. Existing Vercel image URLs remain readable.

The app sends images through authenticated `POST /api/media` to R2 using the S3
SDK. JPEG, PNG and WebP files are limited to 600 KB and checked against their
file signatures. Each user can upload 50 images per day. Browser-to-R2 CORS is
unnecessary because uploads go through the application server.

Objects use `stories/{userId}/{randomId}.{extension}`. Uploaded images are public,
including images inserted into unpublished drafts; do not upload confidential
media. Removing an image from a story does not delete its object. Account erasure deletes the user’s image prefix before removing database records;
storage failures stop erasure so it can be retried. Public caches may retain images
for up to an hour; purge the configured CDN when immediate removal is required.
Orphan cleanup for removed story images is not automated.

Video links support public YouTube and Vimeo videos. The server requests metadata
only from their fixed oEmbed endpoints, rejects redirects, and validates thumbnail
hosts. Readers see a thumbnail and explicitly load the player on click. Providers
may restrict embedding or remove videos later.

### Premium AI editor

Set `OPENAI_API_KEY` and `OPENAI_MODEL` to a Responses API model available to your
OpenAI project. `POST /api/ai/editor` checks the database subscription on every
request: only ACTIVE or TRIALING subscriptions with an unexpired period qualify.
Checkout and subscription provisioning remain unimplemented; the editor never
grants membership based on client input.

Actions include polish, shorten, expand, outline, title suggestions, and editorial
feedback. The user explicitly sends a selection or draft of up to 12,000 characters
to OpenAI and reviews suggestions before insertion. Requests use `store: false`,
a 45-second timeout, and at most 2,000 output tokens. Each user gets 30 requests
per day through the shared Redis limiter; attempts count even when upstream fails.
Production requires Redis and fails closed when the limiter is unavailable.
Provider billing and retention policies still apply. Suggestions are not fact-checked.

With missing service credentials, upload and AI routes return 503 and the editor
keeps the story intact. Live provider verification requires configured credentials.

---

## Cost at < 10k MAU

| Service                  | Plan                | Cost        |
| ------------------------ | ------------------- | ----------- |
| Railway (app + Postgres) | Hobby               | ~$10/mo     |
| Resend                   | Free (3k emails/mo) | $0          |
| Stripe                   | 2.9% + $0.30/txn    | per-use     |
| Vercel Blob              | Hobby (1 GB)        | $0          |
| **Total fixed**          |                     | **~$10/mo** |
