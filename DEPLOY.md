# Deploying Nystara

This guide covers production deployment. The app is a Next.js standalone server
in a Docker image. It needs PostgreSQL 16 and Redis 7, and runs migrations on
startup.

Read [SECURITY.md](SECURITY.md) and [SECURITY_REVIEW.md](SECURITY_REVIEW.md)
before your first launch. They list operator duties the code cannot do for you.

## Contents

- [What you need](#what-you-need)
- [Environment variables](#environment-variables)
- [Google and GitHub sign-in](#google-and-github-sign-in)
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
| Cloudflare Turnstile | Bot checks on sign-in and admin login | Real keys; the documented test keys are rejected in production |
| Resend | Sign-in emails | Verify the sending domain (SPF/DKIM). Set `EMAIL_FROM` to a verified sender; the default is `Nystara <noreply@nystara.com>` |
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
| `DATA_ENCRYPTION_KEY` | `openssl rand -base64 32` (exactly 32 bytes). Encrypts personal-data columns and keys the email lookup hash. **Back it up with the database:** losing or changing it makes stored emails, OAuth tokens, highlights and AI chats unreadable and blocks sign-in |
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

`EMAIL_FROM` applies to all email delivery. Resend is the default locally and in
staging/production; set `RESEND_API_KEY` in each environment. Development-only:
`EMAIL_PROVIDER=smtp` and `EMAIL_SERVER` (optional Mailpit), `PORT`, `HOST`,
`POSTGRES_PASSWORD` (local Compose), `ADMIN_EMAIL` / `ADMIN_PASSWORD` (seed).

---

## Google and GitHub sign-in

Both providers are already integrated through Auth.js in `auth.config.ts`.
The login and signup interfaces offer Google; the legacy GitHub button has been removed.
Credentials alone are insufficient: register the exact callback for the app's
`NEXTAUTH_URL` in the provider console. These are the current local and staging
values:

| Environment | Homepage / origin | Google callback | GitHub callback |
| --- | --- | --- | --- |
| Local | `http://localhost:6100` | `http://localhost:6100/api/auth/callback/google` | `http://localhost:6100/api/auth/callback/github` |
| Railway staging | `https://nystara-uat.up.railway.app` | `https://nystara-uat.up.railway.app/api/auth/callback/google` | `https://nystara-uat.up.railway.app/api/auth/callback/github` |

### Google

1. Open [Google Auth Platform → Clients](https://console.cloud.google.com/auth/clients)
   in the project that owns the configured `GOOGLE_CLIENT_ID`.
2. Select the matching **Web application** client. If creating one, configure
   Branding and Audience, then create a Web application client.
3. Under **Authorized redirect URIs**, enter the complete Google callback above.
   If the same client serves local and staging, register both callbacks. An
   origin alone does not authorize a callback path.
4. If using Authorized JavaScript origins, enter only the homepage / origin.
   Local development uses **HTTP**, not HTTPS. Keep `localhost` consistent with
   `NEXTAUTH_URL`; `127.0.0.1` is a different hostname.
5. Save. Put the matching client ID and secret in `.env.local` for development
   and the Railway staging app service's variables. Restart the local server
   and redeploy staging after changing credentials. If the consent screen is
   in Testing, add the intended sign-in accounts under Audience → Test users.
6. Retry from `/login` after completing its CAPTCHA. Google settings may take
   time to propagate. New accounts continue to `/mfa` for required setup.

`Error 400: redirect_uri_mismatch` means Google's registered redirect differs
from the request's `redirect_uri`. Match the protocol, hostname, port, path and
trailing slash exactly. This app uses `/api/auth/callback/google`; the old
`/api/v1/auth/google/callback` path does not match. Adding the URL to JavaScript
origins does not fix a missing redirect URI. See
[Google's web-server OAuth guide](https://developers.google.com/identity/protocols/oauth2/web-server#authorization-errors-redirect-uri-mismatch).

### GitHub

Use a GitHub **OAuth App** for this existing provider integration. Prefer
separate apps for local development and staging to keep credentials isolated.

1. In GitHub, open your profile → **Settings → Developer settings → OAuth Apps
   → New OAuth App**. For organization ownership, start in the organization's
   settings instead. Follow the official
   [OAuth App registration guide](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app).
2. Name the app `Nystara Local` or `Nystara Staging`. Set **Homepage URL** to the
   corresponding homepage above and **Authorization callback URL** to its
   GitHub callback. Device flow is not needed for this web sign-in.
3. Register the application. Copy its **Client ID**, then choose **Generate a
   new client secret** on the application's settings page. GitHub documents
   [where to find these credentials](https://docs.github.com/en/rest/authentication/authenticating-to-the-rest-api).
4. Set these server-only variables, using each environment's own credentials:

   ```dotenv
   GITHUB_CLIENT_ID=<OAuth App Client ID>
   GITHUB_CLIENT_SECRET=<OAuth App client secret>
   ```

5. Restart local development or redeploy Railway staging. Complete the CAPTCHA
   on `/login`, choose **Continue with GitHub**, and authorize the app. Verify
   the callback returns to Nystara and then `/mfa` or account setup.

A personal access token is not an OAuth client secret. Keep secrets out of
`NEXT_PUBLIC_*` variables, source control, screenshots and chat.

If an email already belongs to a Nystara account created through another
provider, Auth.js can return `OAuthAccountNotLinked`. Sign in with the original
method. Nystara does not yet expose a social-account linking screen; do not
enable automatic email-based linking simply to bypass this protection. See
[Auth.js account-linking errors](https://authjs.dev/reference/core/errors#oauthaccountnotlinked).

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

### Separate production environment

Keep production PostgreSQL and Redis on their own persistent volumes. Copy staging's
provider settings, but point database/cache references at the production services and
generate fresh `NEXTAUTH_SECRET`, `ADMIN_JWT_SECRET`, `MFA_ENCRYPTION_KEY` and
`DATA_ENCRYPTION_KEY` before creating production accounts. This setup starts with an
empty database; it does not copy staging users or sessions. Preserve the new encryption
keys with the production backups.

When sharing staging's R2 bucket, set `R2_KEY_PREFIX=production/` on the production
web app and newsroom worker before uploading anything. Images, ownership validation
and account erasure use this isolated directory. Leave staging's prefix unchanged.
Changing the prefix after publishing requires a separate media migration.

Attach the intended hostname to the production web service in Railway and add the
exact DNS records returned by Railway. Set `NEXTAUTH_URL` to its HTTPS origin.
Register that origin and `/api/auth/callback/google` with the existing Google OAuth
client, and allow the hostname in the existing Turnstile widget. Copied credentials
alone do not register a new hostname. DNS/certificate verification must finish before
testing authentication or enrolling passkeys on the final domain.

The separate newsroom worker uses the production app's database, encryption and
provider variable references. Deploy it with `scripts/deploy-newsroom.sh`, not the
web service's root Railway config. Enable `NEWSROOM_ENABLED=1` and hourly cron
`0 * * * *` after the initial production migration; its wrapper publishes only at
07:00 Europe/London. A profiles-only bootstrap creates the 200 fictional profiles
without paid article generation. Schedule `npm run db:cleanup` daily in a separate
maintenance job using the web deployment's environment.

### Article access and monthly active users

Article pages and engagement APIs require a fully set-up, MFA-verified account.
The login/signup, Google, email-link and passkey flows preserve the article return
path. Browsing article titles and discovery lists remains public; article bodies,
sharing controls, comments, reviews, reactions and ratings require sign-in.

The admin dashboard counts unique real users with foreground signed-in activity
in each UTC calendar month, including the current month and eleven previous months.
Activity collection starts at deployment; historical zeroes do not represent
measured inactivity before this release. A user is stored at most once per UTC day;
the endpoint derives identity and date on the server. No activity cookie, IP or
page path is stored. Fictional profiles do not count. Activity dates are included in
user export, cascade on account deletion, and are pruned by `npm run db:cleanup`.

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
`NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `ADMIN_JWT_SECRET`, `DATA_ENCRYPTION_KEY`,
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
| `10_digests_field_encryption` | `Subscriber` (digest emails), `User.emailHash`, `VerificationToken.identifierHash`. **After deploying, run `npm run db:encrypt` once** to encrypt existing rows; it is idempotent and safe to re-run. Until it finishes, existing users can't be found by email |

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

It deletes reader views older than 30 days, expired sessions, verification
tokens and passkey challenges, and digest signups left unconfirmed for 7 days. This repository does not schedule it. Use a cron
job, a Railway cron service or your platform's scheduler. Older views stop
counting toward historical view totals.

Digest emails (daily, weekly, monthly) need a second job, hourly or daily:

```bash
npm run digests
```

Each confirmed subscriber gets at most one digest per period, so extra runs are
harmless. Nothing is sent for a period with no new, read or trending stories.

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
- [ ] Hourly or daily `npm run digests` scheduled.
- [ ] `DATA_ENCRYPTION_KEY` stored in a secrets manager next to the database backups.
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
