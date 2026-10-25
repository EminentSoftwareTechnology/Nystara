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
- **Guest participation**: readers without an account can comment (with a name
  and a Turnstile check) and vote, identified by a signed 30-day reader cookie.

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
- **AI editor** (`/ai-editor`): polish, shorten, expand, outline, title ideas and
  editorial feedback through the OpenAI Responses API. Premium members only, 30
  requests per day. Suggestions can be copied or appended to the current draft.
- **Writer pages**: Stories, Stats, Audience, Library, Following and Find writers
  under `/me/*`.

### Accounts and security

- Sign-in with Google, GitHub, an email link (Resend in production, Mailpit
  locally) or a passkey. Sign-in and sign-up are separate flows.
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
- **Claps, bookmarks and follows**: shown in feeds, stats and the library, but no
  API creates them. Only the demo seeder fills them. The profile **Follow** button
  and the header **Notifications** bell do nothing.
- **Tag pages**: tag chips link to `/tag/{slug}`, which has no page yet (404).
- **Search**: the `search_vector` full-text column and GIN index exist; there is
  no search endpoint or UI.
- **Email notifications and digests**, OG image generation, sitemap and RSS.
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
| Email | Resend (production), Nodemailer to Mailpit (development) |
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
3. Starts local PostgreSQL, Redis and Mailpit (loopback only).
4. Generates the Prisma client and applies migrations. It never resets or seeds.
5. Starts Next.js on <http://localhost:6100> and opens the browser.

| Service | Local address |
| --- | --- |
| App | `http://localhost:6100` |
| PostgreSQL | `127.0.0.1:5442` (user/password/db `nystara`) |
| Redis | `127.0.0.1:6389` |
| Mailpit inbox | <http://localhost:8035> (SMTP on `127.0.0.1:1035`) |

Other modes: `./start.sh prod` (local production build; needs real Turnstile
keys, Redis and `MFA_ENCRYPTION_KEY`), `./start.sh docker` (full Compose stack),
`./start.sh --help`. Set `CONTAINER_ENGINE=docker` to prefer Docker over Podman.

Notes:

- Sign in with the email link: the message arrives in Mailpit. In development,
  Turnstile is skipped when no secret key is set.
- `HOST` defaults to `127.0.0.1`. If you change `PORT`, also set `NEXTAUTH_URL` to
  the same origin, or API writes fail the same-origin check.
- Remote databases need `ALLOW_REMOTE_MIGRATE=1`.
- `dev.sh` is an older helper that uses ports 6000/5432; prefer `start.sh`.

### Seed data

```bash
# First administrator (password: 12+ characters, at most 72 UTF-8 bytes)
ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='a-long-unique-password' npm run db:seed

# Demo content: 50 users (user1@gmail.com … user50@gmail.com) and 10 published
# stories with tags, claps, comments, bookmarks and follows.
npm run db:seed:demo
```

The demo seeder is safe to re-run and refuses to run with `NODE_ENV=production`.
Demo users still go through account setup (name and second factor) on first
sign-in.

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

Email templates, event coverage, unsubscribe and Mailpit checks: [EMAILS.md](EMAILS.md).

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
| `RESEND_API_KEY` | prod email | Sign-in emails in production |
| `EMAIL_SERVER`, `EMAIL_FROM` | dev email | Mailpit SMTP in development |
| `R2_*` | for uploads | Cloudflare R2 bucket, keys and public URL |
| `CLAMAV_HOST`, `CLAMAV_PORT` | optional | Upload virus scanning (fails closed when set) |
| `OPENAI_API_KEY`, `OPENAI_MODEL` | for AI editor | Responses API key and model |
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
