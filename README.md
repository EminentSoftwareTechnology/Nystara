# Nystara

Nystara is a long-form blogging platform built with Next.js 16. Readers browse
and read stories, comment, react and rate. Writers draft in a Word-style editor
with document themes, image uploads and video embeds, and can mark stories as
members-only behind a server-side soft paywall. Accounts sign in with Google,
GitHub, an email link or a passkey, and must set up a second factor. A separate
admin console manages users and articles.

## Documentation

| Document | What it covers |
| --- | --- |
| [ARCHITECTURE.md](ARCHITECTURE.md) | System design, request pipeline, data model and how each feature works |
| [API.md](API.md) | Every HTTP endpoint, with request/response shapes, limits and errors |
| [DEPLOY.md](DEPLOY.md) | Production deployment (Railway, Docker), environment variables, operations |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Local setup, coding standards, tests and the pull request process |
| [SECURITY.md](SECURITY.md) | Security policy, implemented controls and operator requirements |
| [SECURITY_REVIEW.md](SECURITY_REVIEW.md) | The October 2026 security review and later addenda |
| [CHANGELOG.md](CHANGELOG.md) | What changed, release by release |

## What is implemented

### Reading

- **Home feed** (`/`): latest and most-clapped stories in tabs, plus the top tags.
- **Article page** (`/{username}/{slug}`): hero with cover, author, read time and
  tags; the story rendered from its structured document; share bar; like/dislike
  and 1–5 star rating; threaded comments (one reply level); "What's trending"
  and "Most viewed today" sidebar; back-to-top button. Open Graph and Twitter
  card metadata are generated per story.
- **Author profile** (`/{username}`): bio, follower counts and published stories.
- **Soft paywall**: members-only stories are free for 5 reads per reader per
  rolling 30 days. After that, the server sends a 300-word excerpt only. The full
  body never reaches the browser.
- **Member participation**: signed-in members can comment, react and rate.

### Writing

- **Story editor** (`/new-story`, `/editor/{id}`): Tiptap editor with a ribbon
  (Home / Insert / Design tabs), a styles gallery, fonts, sizes, line spacing,
  alignment, lists, quotes, code blocks, links and dividers.
- **Document themes**: six themes (Classic, Modern, Editorial, Elegant, Bold,
  Technical), saved per story and applied on the published page.
- **Images**: inline images and covers uploaded to Cloudflare R2. The browser
  shrinks large photos first; the server checks file signatures, optionally
  scans with ClamAV, strips metadata, resizes and re-encodes to WebP.
- **Video**: YouTube and Vimeo links become click-to-load previews.
- **Drafts**: explicit "Save draft" to the server, plus a copy in the browser's
  local storage so a closed tab or crash does not lose writing.
- **AI editor** (`/ai-editor`): private, account-backed writing conversations with
  follow-up questions, conversation history/deletion, starter prompts, and copy or
  append-to-story actions through the OpenAI Responses API. Supports up to three
  text, Markdown, CSV, JSON, PDF, PNG or JPEG attachments, totalling 500 KB per
  message. Premium membership is required in production; development users can
  test without a subscription. Limited to 30 requests per user per day.

AI messages and attachments remain in PostgreSQL until the conversation or account
is deleted. Account export includes separate paginated `aiConversations` and
`aiMessages` sections, including attachment data. Messages and attached material
are sent to OpenAI with `store: false`; [provider abuse-monitoring retention](https://developers.openai.com/api/docs/guides/your-data)
may still apply. Review suggestions before publishing. Requests include up to 12
recent messages, capped at 60,000 text characters and 500 KB of previous attachment
data, plus the new message and its attachments. No remote file URLs are fetched.
- **Writer pages**: Stories, Stats, Audience, Library, Following and Find writers
  under `/me/*`.

### Accounts and security

- Sign-in with Google, GitHub, an email link (Resend locally and in staging/production) or a passkey. Sign-in and sign-up are separate flows.
- Email links open a confirmation page first, so mail scanners cannot use up the
  one-time token.
- **Required account setup**: every reader account must have a display name and
  at least one second factor (passkey or authenticator app) before it can use the
  app. Ten single-use recovery codes are issued with the first factor.
- Security settings at `/me/security`; profile and appearance at `/settings`.
- Data export (`GET /api/me/export`) and self-service account deletion
  (`DELETE /api/me`).
- Hardened request pipeline: same-origin checks on every API write, per-IP rate
  limits backed by Redis, a 1 MiB streamed body limit, a per-request CSP nonce and
  `private, no-store` caching. Details are in [SECURITY.md](SECURITY.md).

### Admin console

`/admin` has its own email-and-password sign-in (with optional passkey or
authenticator second factor, or passkey-only sign-in). It includes a dashboard,
user management (search, role changes, erasure), article management (create,
edit, publish, delete), profile/password, security and appearance settings.

### Interface

- App shell with a desktop sidebar, and a bottom tab bar plus "More" sheet on
  touch devices; installable as a web app (manifest included).
- Light, dark, sand and system themes, remembered in a cookie.
- Public pages: About, Features, Why blog, Contact, Privacy, Terms, Cookies.

## Not implemented yet

These appear in the schema or UI but have no working server path. Do not
advertise them as features.

- **Billing**: Stripe is installed and `Subscription` rows are honoured, but there
  is no checkout, customer portal or webhook. Premium access is granted only by
  writing a `Subscription` row directly.
- **Notifications inbox**: the header Notifications bell has no inbox yet.
- **Search**: the `search_vector` full-text column and GIN index exist; there is
  no search endpoint or UI.
- **OG image generation**, sitemap and RSS.
- **Server autosave**: drafts save to the server only when the writer saves.

## Tech stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router, `proxy.ts`, standalone output), React 19 |
| Language | TypeScript (strict, no `any`) |
| Styling | Tailwind CSS 4, CSS custom properties for site and story themes |
| Database | PostgreSQL 16 through Prisma 7 with `@prisma/adapter-pg` |
| Rate limiting | Redis 7 (required in production) |
| Auth | Auth.js (NextAuth v5) database sessions; WebAuthn via SimpleWebAuthn; TOTP via `otpauth` |
| Admin auth | Separate HS256 JWT cookie (`jose`) and bcrypt passwords |
| Editor | Tiptap 3 (StarterKit, text align, text style, image, placeholder, custom video node) |
| Images | Cloudflare R2 through the AWS S3 SDK; `sharp` for re-encoding; optional ClamAV |
| Email | Resend (local, staging and production); optional Mailpit capture |
| Bot protection | Cloudflare Turnstile |
| AI | OpenAI Responses API (direct `fetch`, no SDK) |
| Validation | Zod 4 |
| Tests | Node test runner with `tsx`; Playwright for browser checks |

## Quick start

Requirements: Node 22.12+, and Podman (with `podman compose` or `podman-compose`)
or Docker Compose v2.

```bash
./start.sh            # same as ./start.sh dev
```

The launcher:

1. Installs locked dependencies when needed.
2. Creates `.env.local` from `.env.example` with random secrets if no env file
   exists (file mode 600).
3. Starts local PostgreSQL and Redis (loopback only). Mailpit starts only with `EMAIL_PROVIDER=smtp`.
4. Generates the Prisma client and applies migrations. It never resets or seeds.
5. Starts Next.js on <http://localhost:6100> and opens the browser.

| Service | Local address |
| --- | --- |
| App | `http://localhost:6100` |
| PostgreSQL | `127.0.0.1:5442` (user/password/db `nystara`) |
| Redis | `127.0.0.1:6389` |
| Optional Mailpit inbox | <http://localhost:8035> (SMTP on `127.0.0.1:1035`; `EMAIL_PROVIDER=smtp`) |

Other modes: `./start.sh prod` (local production build; needs real Turnstile
keys, Redis and `MFA_ENCRYPTION_KEY`), `./start.sh docker` (full Compose stack),
`./start.sh --help`. Set `CONTAINER_ENGINE=docker` to prefer Docker over Podman.

Notes:

- Set `RESEND_API_KEY` and a verified `EMAIL_FROM` in `.env.local`, then sign in
  with the email link in your inbox. In development,
  Turnstile is skipped when no secret key is set.
- `HOST` defaults to `127.0.0.1`. If you change `PORT`, also set `NEXTAUTH_URL` to
  the same origin, or API writes fail the same-origin check.
- Remote databases need `ALLOW_REMOTE_MIGRATE=1`.
- `dev.sh` is an older helper that uses ports 6000/5432; prefer `start.sh`.

### Seed data

```bash
# First administrator (password: 12+ characters, at most 72 UTF-8 bytes)
ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='a-long-unique-password' npm run db:seed

# Demo content: 50 users (user1@example.test … user50@example.test), 260
# stories across every status, avatars, 50 lists, highlights, reading activity,
# comments, ratings, follows, topic follows and example AI conversations.
npm run db:seed:demo
```

The demo seeder is safe to re-run and refuses to run with `NODE_ENV=production`.
Demo users still go through account setup (name and second factor) on first
sign-in. Handles are `demo-user1` through `demo-user50`; activity emails are disabled.
The seeder writes illustrated avatars to `public/demo/avatars` and only replaces
its own demo story slugs. Scheduled demo stories are one week ahead.

### Daily global AI newsroom

```bash
# Apply schema changes first; this never resets the database.
node --env-file-if-exists=.env.local node_modules/prisma/build/index.js migrate deploy
npm run db:generate

# Create 200 profiles and their follows without paid AI calls.
npm run db:seed:newsroom -- --profiles-only

# Smoke test one researched article, then complete today's 250 slots.
npm run db:seed:newsroom -- --max-articles=1 --concurrency=1
npm run db:seed:newsroom
```

The newsroom has 100 publishing authors and 100 readers from 20 countries, with
unique `newsroom-user-{n}@newsroom.nystara.invalid` addresses. The reserved
`.invalid` domain guarantees they never belong to a real person. `isSynthetic` blocks interactive
sign-in and all outbound email. OpenAI generates articles and reviews; it does
not authenticate users. The seed writes through the encrypted application client.
Every generated article and review discloses its AI/simulated origin. Existing
posts, comments, ratings and follows are preserved on reruns. The trusted job
acts under each managed author ID; it does not create login sessions, bypass
MFA, or send authentication mail to fictional Gmail identifiers.

Each UTC date has 250 stable slots: 50 authors publish two articles and 50 publish
three. Each author covers different topics per day, rotating topics daily.
Topics are science, technology, travel, home, health, finance, AI, robotics,
software engineering and environment. Live Responses API web search researches
recent global developments and records its sources; this is a news signal, not
a verified worldwide popularity ranking. Political topics are excluded by the
prompt, a structured non-political declaration and a limited keyword check;
these checks do not replace human editorial review.

Articles must contain 2,000–6,000 words (10+ minutes at 200 words/minute), useful
sections and bullets, an illustrated high-level design/process flow, colorful
theme headings, a sourced YouTube/Vimeo video verified through provider oEmbed,
and linked research sources. Six simulated reviews per article include stars,
likes and dislikes. Health and finance content is educational only. Images are
generated WebP covers and diagrams. Local development uses `public/demo/newsroom`;
production uploads to the configured R2 bucket under `stories/<authorId>/`. Both
uploads must finish before the article and engagement are committed. Ephemeral
worker files are never used as production article URLs.

The worker bundles fonts for diagram labels. Production media uses versioned
filenames; a rerun repairs the earlier unversioned newsroom images without
changing article text, comments, ratings or follows. Existing topic tags are
reused by name or slug, including legacy tags with noncanonical slugs.

Set `OPENAI_API_KEY` and a model supporting web search and structured outputs
(`NEWSROOM_OPENAI_MODEL` overrides `OPENAI_MODEL`). This is a paid operation:
up to ten topic research calls, ten fallback video searches and 250 article calls
per day. `--max-articles=1..250`
caps new articles per invocation; `--concurrency=1..16` controls parallel calls
(default four). `NewsroomRun` records daily attempt/status/count metadata, and
`NewsroomResearch` persists topic research in PostgreSQL so container restarts
can resume without repeating paid research. Local caches stay ignored in
`.cache/newsroom` and `public/demo/newsroom`. A PostgreSQL advisory lock prevents
overlapping runs.
An article and all its reviews commit together. Failures preserve completed slots;
transient provider failures/invalid output receive at most one paid retry (so
API calls can be up to twice the base count). Persistent failures record `FAILED`
and exit nonzero. Rerun the same `--date=YYYY-MM-DD` to fill missing slots without
replacing content or duplicating engagement. Past dates use current research as
of the requested date; future dates are rejected. Existing unrelated users and
articles are preserved; profile identity collisions stop the run.

On macOS, explicitly install the optional daily schedule:

```bash
node --import tsx scripts/install-newsroom-schedule.mts
# To disable it:
launchctl bootout gui/$(id -u)/com.nystara.newsroom
```

The launch agent checks hourly and starts once at **07:00 Europe/London**, including
British Summer Time. It stores no credentials in the plist; the child reads this
checkout's `.env.local`. Logs are in `.cache/newsroom/daily.log`. A database-backed scheduled-attempt
record prevents automatic paid retries after failure; resume manually using the
same seed date without `--scheduled`. The machine, logged-in user session, PostgreSQL and network must
be available at the scheduled time; missed runs are not backfilled. Review the
launch agent if the checkout or Node binary moves. No schedule is installed by
migrations, builds or deployments. Production and non-loopback databases require `NEWSROOM_ENABLED=1`.


### Production / Railway job

Set `NODE_ENV=production` and `NEWSROOM_ENABLED=1` on a **separate cron service**
using the same `DATABASE_URL` and `DATA_ENCRYPTION_KEY` as the web app. Supply
`OPENAI_API_KEY`, `OPENAI_MODEL` (or `NEWSROOM_OPENAI_MODEL`), and all five `R2_*`
variables listed in `.env.example`. Production article generation fails before
paid calls or user writes if R2 configuration is missing. A profiles-only run needs no R2.

```bash
# Manual production seed (reads environment variables; never resets data)
npm run db:seed:newsroom
# Resume a partial date explicitly
npm run db:seed:newsroom -- --date=2026-10-29
```

Create a separate Railway service and set these service settings directly:

| Setting | Value |
| --- | --- |
| Dockerfile path | `Dockerfile.newsroom` |
| Pre-deploy command | `npx prisma migrate deploy` |
| Start command | `node --import tsx scripts/daily-newsroom.mts` |
| Cron schedule | `0 * * * *` |
| Restart policy | `NEVER` |
| Healthcheck / public domain | none |

Railway's deprecated Config as Code is not used for this new service. The job
applies additive migrations before deployment and then runs on hourly UTC cron. The wrapper exits at other hours and starts
once at 07:00 Europe/London, handling GMT/BST. It needs no public domain, web
healthcheck, browser session, OAuth client credentials, or persistent disk. The
image includes the TypeScript runtime required by the job. Do not run both a Mac
scheduler and hosted scheduler against the same database.

Deploy the committed worker source using the upload helper (pass the actual
Railway project, environment and worker service IDs):

```bash
bash scripts/deploy-newsroom.sh --project PROJECT_ID --environment ENVIRONMENT_ID --service WORKER_SERVICE_ID
```

It uploads only committed files and excludes the root `railway.toml`/`railway.json`
belonging to the web service. Otherwise that legacy web config can override the
worker Dockerfile/start command. Secrets and local caches are never uploaded.
Use this helper for worker updates and configuration changes. Railway's redeploy
action can rebuild from the attached repository and reapply the web configuration.

After deployment, verify `NewsroomRun.status`, `articleCount`, worker logs, R2
images and the public article page. A completed date has 250 articles and 1,500
simulated reviews/ratings. Stop scheduling or unset `NEWSROOM_ENABLED` to disable
new generation; published content and engagement remain intact. Resume failures
manually after inspecting logs; an interrupted scheduled attempt does not
silently trigger repeated paid runs. No human-user content is modified.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js dev server, production build, production server |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Unit and component tests (`tests/*.test.ts(x)`) |
| `npm run test:integration` | PostgreSQL/Redis/browser tests (`tests/*.integration.ts`); needs `TEST_DATABASE_URL` and `TEST_REDIS_URL` |
| `npm run db:migrate` | Create and apply a migration (development) |
| `npm run db:migrate:deploy` | Apply pending migrations (CI/production) |
| `npm run db:generate` | Regenerate the Prisma client |
| `npm run db:studio` | Prisma Studio |
| `npm run db:seed` / `db:seed:demo` | Admin seed / demo content |
| `npm run db:cleanup` | Delete reader views older than 30 days and expired sessions, tokens and passkey challenges. Run daily. |

Email templates, the preview gallery, Resend tests and unsubscribe checks: [EMAILS.md](EMAILS.md).

## Environment variables

[.env.example](.env.example) lists every variable. The essentials:

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | yes | PostgreSQL connection string |
| `NEXTAUTH_URL` | yes | Canonical origin. Used for same-origin checks, passkey RP ID and share links |
| `NEXTAUTH_SECRET` | yes | Auth.js secret; also signs reader cookies and HMACs rate-limit keys |
| `ADMIN_JWT_SECRET` | yes | 32+ random characters for admin JWTs |
| `MFA_ENCRYPTION_KEY` | yes (prod) | 32 random bytes, base64. Encrypts authenticator-app secrets |
| `REDIS_URL` | yes (prod) | Shared rate limits; production fails closed without it |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | yes (prod) | Real keys; test keys are rejected in production |
| `GOOGLE_*`, `GITHUB_*` | optional | OAuth providers |
| `RESEND_API_KEY` | email | Resend delivery in local, staging and production |
| `EMAIL_FROM` | email | Sender address on a domain verified in Resend |
| `EMAIL_SERVER` | optional | Local SMTP capture with `EMAIL_PROVIDER=smtp` |
| `EMAIL_PROVIDER` | optional | Defaults to Resend; `smtp` enables development-only capture |
| `R2_*` | for uploads | Cloudflare R2 bucket, keys and public URL |
| `CLAMAV_HOST`, `CLAMAV_PORT` | optional | Upload virus scanning (fails closed when set) |
| `OPENAI_API_KEY` | for AI editor | Server-only OpenAI Responses API credential; never use a `NEXT_PUBLIC_` key |
| `OPENAI_MODEL` | optional | OpenAI model; defaults to `gpt-4.1-mini` |
| `STRIPE_SECRET_KEY` | for erasure of subscribers | Used only to cancel a subscription during account erasure |
| `TRUST_PROXY_IP` | optional | `1` only behind an ingress that overwrites `X-Forwarded-For` |

[DEPLOY.md](DEPLOY.md) explains each one in production terms.

## Project layout

```text
app/
  (public)/            Home feed and marketing/legal pages
  (auth)/              login, signup, verify (email link), mfa (challenge + setup), sign-in-error
  [username]/          Author profile and [slug] article page
  new-story/, editor/  Story editor (create / edit)
  ai-editor/           AI editor page
  me/                  Writer workspace: stories, stats, audience, library, following, security, help
  settings/            Profile and appearance
  admin/               Admin login and (console)/ pages
  api/                 Route handlers (see API.md)
components/            UI: article, editor, layout, security, auth, admin, marketing, theme
lib/                   Server logic: auth, mfa/, paywall, engagement, media, rate limits, validation
prisma/                Schema, migrations, seed and demo seed
proxy.ts               Request pipeline: rate limits, CSRF, body limits, CSP, admin guard, reader cookie
scripts/               cleanup.ts and the launcher's env loader
tests/                 Unit, component and integration tests
```
