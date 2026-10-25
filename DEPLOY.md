# Deploying Nystara

This guide covers production deployment. The app is a Next.js standalone server
in a Docker image. It needs PostgreSQL 16 and Redis 7, and runs migrations on
startup.

Read [SECURITY.md](SECURITY.md) and [SECURITY_REVIEW.md](SECURITY_REVIEW.md)
before your first launch. They list operator duties the code cannot do for you.

## Contents

- [What you need](#what-you-need)
- [Environment variables](#environment-variables)
- [Railway](#railway)
- [Docker on your own host](#docker-on-your-own-host)
- [Other platforms](#other-platforms)
- [Migrations](#migrations)
- [First administrator](#first-administrator)
- [Scheduled maintenance](#scheduled-maintenance)
- [Launch checklist](#launch-checklist)
- [Rollback and backups](#rollback-and-backups)
- [Troubleshooting](#troubleshooting)

---

## What you need

| Dependency | Why | Notes |
| --- | --- | --- |
| PostgreSQL 16 | Primary data store | Private network, TLS and authentication |
| Redis 7 | Rate limits shared across replicas | **Required in production**: without it, limited requests are denied. Use a dedicated instance with bounded memory and `maxmemory-policy noeviction` |
| Cloudflare Turnstile | Bot checks on sign-in, admin login and guest comments | Real keys; the documented test keys are rejected in production |
| Resend | Sign-in emails | Verify the sending domain (SPF/DKIM). The sender is `noreply@nystara.com` (`auth.config.ts`) |
| Google and/or GitHub OAuth apps | Optional social sign-in | Callback URLs: `{NEXTAUTH_URL}/api/auth/callback/google` and `/github` |
| Cloudflare R2 | Image uploads | Bucket-scoped Object Read & Write token; public custom domain or `r2.dev` URL |
| ClamAV (`clamd`) | Optional upload scanning | Reachable over TCP; uploads fail closed when configured but unreachable |
| OpenAI | Optional AI editor | Responses API model available to your project |
| Stripe | Optional; used only to cancel a subscription during account erasure | No checkout or webhooks exist yet |

---

## Environment variables

All of these are runtime variables except `NEXT_PUBLIC_TURNSTILE_SITE_KEY`,
which is inlined at build time and must be passed as a Docker build argument.

### Required

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | `postgresql://user:password@host:5432/db` |
| `REDIS_URL` | `redis://…` or `rediss://…` |
| `NEXTAUTH_URL` | The exact public origin, for example `https://nystara.example.com`. API writes must come from this origin; passkeys are bound to its hostname; share links and the `__Secure-` cookie prefix depend on it |
| `NEXTAUTH_SECRET` | `openssl rand -base64 32`. Also signs reader cookies and keys the rate limiter |
| `ADMIN_JWT_SECRET` | `openssl rand -base64 32`, different from `NEXTAUTH_SECRET`. At least 32 characters |
| `MFA_ENCRYPTION_KEY` | `openssl rand -base64 32` (must decode to exactly 32 bytes). Encrypts authenticator-app secrets. Changing it disables existing authenticator-app enrolments |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Build argument |
| `TURNSTILE_SECRET_KEY` | Runtime secret |
| `RESEND_API_KEY` | Required for email sign-in in production |

### Optional

| Variable | Enables |
| --- | --- |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google sign-in |
| `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | GitHub sign-in |
| `R2_ACCOUNT_ID` (32 hex characters), `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL` (HTTPS) | Image uploads. Without them uploads return 503. If `R2_BUCKET_NAME` is set, the rest must be valid or account erasure fails |
| `CLAMAV_HOST`, `CLAMAV_PORT` (default 3310) | Upload virus scanning |
| `OPENAI_API_KEY`, `OPENAI_MODEL` | AI editor |
| `STRIPE_SECRET_KEY` | Cancelling subscriptions during erasure. Needed as soon as any `Subscription` row is not `CANCELED` |
| `TRUST_PROXY_IP` | `1` only if your ingress appends or overwrites `X-Forwarded-For` **and** direct access to the app is blocked. With `0` (default) all clients share one per-IP bucket; per-user and per-email limits still apply |
| `STRIPE_WEBHOOK_SECRET`, `BLOB_READ_WRITE_TOKEN` | Reserved; not read by current code |

Development-only: `EMAIL_SERVER`, `EMAIL_FROM` (Mailpit), `PORT`, `HOST`,
`POSTGRES_PASSWORD` (local Compose), `ADMIN_EMAIL` / `ADMIN_PASSWORD` (seed).

---

## Railway

`railway.toml` builds with the `Dockerfile`, starts with
`./docker-entrypoint.sh node server.js` (migrations, then the server), checks
`/api/health` with a 300-second timeout, and restarts on failure up to 3 times.

1. Create a project and add the GitHub repository as a service.
2. Add a **PostgreSQL** service and reference its `DATABASE_URL` in the app.
3. Add a **Redis** service. Set its memory limit and
   `maxmemory-policy noeviction`, and reference its URL as `REDIS_URL`.
4. Set every [required variable](#required) on the app service. Add
   `NEXT_PUBLIC_TURNSTILE_SITE_KEY` so it is available at build time.
5. Add a domain and set `NEXTAUTH_URL` to exactly that origin.
6. Deploy. Each push to the connected branch redeploys.
7. [Seed the first administrator](#first-administrator) and
   [schedule cleanup](#scheduled-maintenance).

Leave `TRUST_PROXY_IP=0` until you have confirmed how Railway's edge sets
`X-Forwarded-For` for your service and that the app cannot be reached directly.

---

## Docker on your own host

### Build and run the image

```bash
docker build \
  --build-arg NEXT_PUBLIC_TURNSTILE_SITE_KEY=0x4AAAA… \
  -t nystara:$(git rev-parse --short HEAD) .

docker run -d --name nystara -p 3000:3000 \
  --env-file /etc/nystara/production.env \
  nystara:<tag>
```

The image (`node:22-alpine`) has three stages:

| Stage | Contents |
| --- | --- |
| `deps` | Production `node_modules` |
| `builder` | Full install, `prisma generate`, `next build` (standalone) |
| `runner` | Standalone server, static assets, Prisma schema, config and CLI for migrations. Runs as UID 1001 on port 3000 |

The entrypoint runs `prisma migrate deploy` before `node server.js`. It never
resets or seeds.

### Full stack with Compose

`./start.sh docker` (or `docker compose up --build`) runs `docker-compose.yml`:
PostgreSQL 16, Redis 7 (128 MB, `noeviction`) and the app on `${PORT:-6100}`.
The database and Redis listen on `127.0.0.1` only.

Set in your shell or `.env`: `POSTGRES_PASSWORD` (random hex),
`NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `ADMIN_JWT_SECRET`,
`NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`, and any optional
provider keys.

`docker-compose.yml` does not pass `MFA_ENCRYPTION_KEY`, the `R2_*`,
`CLAMAV_*` or `OPENAI_*` variables to the app container. Add them to the `app`
service's `environment` before relying on authenticator apps, uploads, scanning
or the AI editor in this stack.

An existing database volume keeps the password it was created with; changing
`POSTGRES_PASSWORD` later does not rotate it.

### Edge requirements

The app's rate limiter does not stop volumetric attacks. Put a reverse proxy,
CDN or WAF in front that:

- terminates TLS and redirects HTTP to HTTPS (the app sends HSTS);
- enforces connection, request-rate, body-size and timeout limits;
- blocks direct access to the app container;
- if you enable `TRUST_PROXY_IP=1`, overwrites `X-Forwarded-For` with the real
  client address.

---

## Other platforms

The app needs a long-running Node.js server, outbound TCP to Redis and
PostgreSQL (and ClamAV if used), and `sharp`'s native binaries. Any container
platform works. Serverless hosts such as Vercel have not been tested; if you try
one, make sure `proxy.ts` can reach Redis, set `REDIS_URL`, and run
`npm run db:migrate:deploy` as a release step because there is no entrypoint.

---

## Migrations

- On container start, `docker-entrypoint.sh` applies pending migrations.
- Manually: `DATABASE_URL=… npm run db:migrate:deploy`.
- Create new migrations locally with `npm run db:migrate`, commit the folder under
  `prisma/migrations/`, and never edit an applied migration.

| Migration | Change |
| --- | --- |
| `0_init` | Base schema |
| `1_search_vector` | Generated `tsvector` column and GIN index on articles |
| `2_admin_role` | `role` and `passwordHash` on users |
| `3_query_indexes` | Feed and lookup indexes |
| `4_gdpr_cascade_and_fk_indexes` | Cascading deletes and foreign-key indexes |
| `5_security_review` | `sessionVersion`; comment parent `ON DELETE SET NULL`; comment and view indexes. Existing admin sessions must sign in again |
| `6_mfa_passkeys` | Passkeys, recovery codes, auth challenges, TOTP columns, `Session.mfaVerifiedAt` |
| `7_article_engagement` | `ArticleFeedback` (rating CHECK 1–5), guest comments (`guestName`, nullable author), `Article.theme`, comment `(articleId, createdAt)` index |

Account setup is enforced in code, not by a migration: any existing reader
without a display name or a second factor is sent to `/mfa` to finish setup on
their next visit.

---

## First administrator

Run once from a machine with the dev dependencies installed and network access
to the database:

```bash
DATABASE_URL=… ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD='…' npm run db:seed
```

The password must be 12+ characters and at most 72 UTF-8 bytes. Re-running the
seed resets the password, keeps the admin role and revokes existing admin
sessions. Sign in at `/admin/login`, then add a passkey or authenticator under
**Security**.

---

## Scheduled maintenance

Run daily, from an environment with the dev dependencies (the TypeScript runner
`tsx`) and `DATABASE_URL`:

```bash
npm run db:cleanup
```

It deletes reader views older than 30 days and expired sessions, verification
tokens and passkey challenges. This repository does not schedule it. Use a cron
job, a Railway cron service or your platform's scheduler. Older views stop
counting toward historical view totals.

Collect the app's stdout: security audit events are single JSON lines such as
`{"event":"admin_login","outcome":"denied","timestamp":"…"}`. Alert on spikes
of `denied`.

---

## Launch checklist

### Configuration

- [ ] `NEXTAUTH_URL` is the exact public origin (scheme, host, no trailing path).
- [ ] `NEXTAUTH_SECRET`, `ADMIN_JWT_SECRET` and `MFA_ENCRYPTION_KEY` are unique,
      random and stored only in the platform's secret store.
- [ ] Real Turnstile keys; the site key was present at build time.
- [ ] `REDIS_URL` points at a private, authenticated Redis with `noeviction`.
- [ ] OAuth apps list only production callback URLs.
- [ ] Resend domain verified.
- [ ] `TRUST_PROXY_IP` left at `0` unless the ingress behaviour is verified.

### Smoke test

- [ ] `curl https://…/api/health` returns `{"status":"ok"}`.
- [ ] Sign up by email: the link opens the confirmation page, then account setup
      asks for a name and a second factor.
- [ ] Sign in with Google/GitHub and with a passkey.
- [ ] Write a story, upload an image, add a video, save, publish, view it.
- [ ] As a guest, comment (Turnstile) and like/rate.
- [ ] A members-only story shows the excerpt after five members-only reads in a
      private window.
- [ ] Admin login works, with and without MFA.
- [ ] A cross-origin `POST` to any `/api/*` route returns `403`.

### Operations

- [ ] Daily `npm run db:cleanup` scheduled.
- [ ] Database backups enabled and a restore tested.
- [ ] Logs collected; alerts on `denied` audit events and on 5xx rates.
- [ ] Uptime monitor on `/api/health`, plus separate checks for the database and
      Redis (the health route checks neither).
- [ ] Privacy, terms and cookie pages reviewed for your organisation, with a real
      contact address.

---

## Rollback and backups

- **Railway**: open Deployments, choose a previous successful deployment and
  redeploy it.
- **Docker**: tag every image with its commit and run the previous tag.
- Migrations are forward-only. Rolling back code across a migration needs a
  database restore or a manual reverse migration. Check the migration table
  above before rolling back.
- **Backups**: enable your provider's automated PostgreSQL backups, or run
  `pg_dump "$DATABASE_URL" | gzip > nystara_$(date +%Y%m%d).sql.gz` on a schedule
  and keep copies off the host. Account erasure does not remove data from
  existing backups; set a backup retention period that fits your privacy policy.

---

## Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| Every API write returns `403` | `NEXTAUTH_URL` does not match the browser's origin (scheme, host and port) |
| Many requests return `429` or limited routes always fail | Redis unreachable (production fails closed), or `TRUST_PROXY_IP=0` behind heavy shared traffic |
| Sign-in loops back to `/mfa` | The account still needs a display name or a second factor; this is expected until setup is finished |
| Authenticator codes stop working after a deploy | `MFA_ENCRYPTION_KEY` changed or is missing; users can sign in with a passkey or a recovery code and re-enrol |
| Passkeys fail on a new domain | Passkeys are bound to the hostname of `NEXTAUTH_URL`; users must register new ones for the new domain |
| Uploads return 503 | R2 variables missing or invalid, or ClamAV configured but unreachable |
| Account erasure fails | R2 configured but unreachable, or a live subscription and no `STRIPE_SECRET_KEY` |
| Admin login fails for a seeded admin | Turnstile misconfigured, or the password was changed (sessions revoked); re-run the seed to reset |
| Container exits on start | A migration failed; check logs from `prisma migrate deploy` |
