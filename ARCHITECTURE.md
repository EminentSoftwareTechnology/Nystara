# Nystara architecture

This document describes the system as it is built today. Each section names the
files that implement it, so you can check the details in code. Planned work is
listed separately at the end.

## Contents

1. [System overview](#1-system-overview)
2. [Request pipeline](#2-request-pipeline)
3. [Authentication](#3-authentication)
4. [Data model](#4-data-model)
5. [Reading and the paywall](#5-reading-and-the-paywall)
6. [Reader engagement](#6-reader-engagement)
7. [Writing: editor, documents and media](#7-writing-editor-documents-and-media)
8. [AI editor](#8-ai-editor)
9. [Admin console](#9-admin-console)
10. [Frontend structure](#10-frontend-structure)
11. [Privacy and data lifecycle](#11-privacy-and-data-lifecycle)
12. [Testing and CI](#12-testing-and-ci)
13. [Not yet implemented](#13-not-yet-implemented)
14. [Key decisions](#14-key-decisions)

---

## 1. System overview

Nystara is a single Next.js 16 application. Pages and API route handlers run in
one Node.js process (standalone output, Docker image). There are no separate
services or queues.

```text
                         Browser (React 19)
                                 │ HTTPS
                                 ▼
┌──────────────────────────────────────────────────────────────────────┐
│ proxy.ts  (runs before every request)                                │
│  · API: same-origin write check, rate limit tier, 1 MiB body limit   │
│  · Pages: per-IP rate limit, admin JWT guard, CSP nonce,             │
│           signed reader cookie on article pages                      │
│  · All responses: Cache-Control: private, no-store                   │
└──────────────┬───────────────────────────────────────┬───────────────┘
               ▼                                       ▼
   Server-rendered pages (App Router)        Route handlers (app/api/**)
               │                                       │
               └──────────────┬────────────────────────┘
                              ▼
               lib/  (auth, mfa, paywall, engagement, media, validation)
                              │
     ┌────────────┬───────────┼────────────┬─────────────┬──────────────┐
     ▼            ▼           ▼            ▼             ▼              ▼
 PostgreSQL     Redis    Cloudflare R2   ClamAV      OpenAI        Turnstile,
 (Prisma 7)   (limits)   (images)       (optional)  Responses API  Resend/SMTP,
                                                                   Google/GitHub,
                                                                   YouTube/Vimeo oEmbed
```

| Concern | Where |
| --- | --- |
| Request pipeline | `proxy.ts`, `lib/request.ts`, `lib/rate-limit.ts`, `lib/csp.ts`, `lib/client-ip.ts` |
| Static security headers | `next.config.ts` (HSTS, frame denial, nosniff, referrer, permissions, COOP) |
| Reader auth | `auth.config.ts`, `lib/auth.ts`, `lib/auth-adapter.ts`, `lib/user-session.ts` |
| Second factors | `lib/mfa/*` |
| Admin auth | `lib/admin-session.ts`, `lib/admin-auth.ts`, `lib/password.ts` |
| Paywall and views | `lib/paywall.ts`, `lib/engagement.ts`, `lib/visitor.ts`, `lib/premium.ts` |
| Story documents | `lib/story-document.ts`, `lib/article-schema.ts`, `lib/story-theme.ts` |
| Media | `app/api/media`, `lib/image-pipeline.ts`, `lib/image-type.ts`, `lib/clamav.ts`, `lib/r2.ts`, `lib/storage-url.ts` |
| Erasure and export | `lib/gdpr.ts`, `app/api/me/*`, `scripts/cleanup.ts` |

---

## 2. Request pipeline

`proxy.ts` matches every path except `_next/static`, `_next/image` and the
favicon.

### API routes (`/api/*`)

1. `GET`/`HEAD /api/health` skips everything (cheap liveness check).
2. **Writes** (any method other than GET, HEAD, OPTIONS):
   - `Origin` must exist and equal the origin of `NEXTAUTH_URL`, and
     `Sec-Fetch-Site` must not be `cross-site`. Otherwise `403`. Forwarded host
     headers are never trusted.
   - `POST /api/auth/signin/resend` is blocked, so email links can only be
     requested through `/api/auth/magic-link` (which enforces Turnstile).
3. **Rate limit** per client IP, one-minute window:

   | Tier | Paths | Limit |
   | --- | --- | --- |
   | credential | `/api/admin/login`, `/api/auth/magic-link`, `/api/auth/oauth-turnstile`, and prefixes `/api/auth/mfa/`, `/api/auth/passkey/`, `/api/admin/login/`, `/api/me/security/`, `/api/admin/security/` | 10 |
   | write | other writes | 60 |
   | read | other reads | 300 |

   Over the limit returns `429` with `Retry-After`.
4. **Body limit** for writes: the body is streamed and counted. Over 1 MiB returns
   `413`, a body that takes longer than 10 seconds returns `408`.
5. The response gets `Cache-Control: private, no-store`.

Route handlers then apply their own per-user or per-reader limits (uploads, AI,
comments, votes, export, email links, MFA attempts).

### Pages

1. Per-IP page limit: 300 requests per minute.
2. `/admin/*` (except `/admin/login`) requires a valid admin JWT whose user is
   still an admin with a matching session version; otherwise redirect to
   `/admin/login`.
3. A fresh nonce builds the Content-Security-Policy (`lib/csp.ts`):
   `script-src 'self' 'nonce-…' 'strict-dynamic'` plus Turnstile, frames limited
   to Turnstile, YouTube and Vimeo, `frame-ancestors 'none'`, `object-src 'none'`.
   Development adds `'unsafe-eval'`; production adds `upgrade-insecure-requests`.
4. On article-shaped paths (`/{a}/{b}`, excluding `/admin` and `/me`), the proxy
   reads or issues the `reader_session` cookie (section 6) and passes the reader
   id to the page in an internal `x-reader-id` header. Any client-supplied
   `x-reader-id` is removed first.

### Rate limiter (`lib/rate-limit.ts`)

- With `REDIS_URL`: one atomic Lua script does `INCR` + `PEXPIRE` and returns the
  count and TTL. Keys are `rate:` + HMAC-SHA256(`NEXTAUTH_SECRET`, key), so
  Redis never stores raw emails, user ids or IPs. Commands time out after 1 s.
- Production without Redis, or with Redis unreachable: **deny** (fail closed).
- Development without Redis: an in-memory map capped at 50,000 keys; at capacity
  it rejects new keys rather than clearing existing penalties.
- Client IP (`lib/client-ip.ts`) is the last `X-Forwarded-For` entry only when
  `TRUST_PROXY_IP=1`. Otherwise every client shares the IP bucket `unknown`.
  Per-user and per-email limits still apply.

---

## 3. Authentication

There are two independent systems: Auth.js for readers and writers, and a
separate JWT for the admin console. Admin accounts are `User` rows with
`role = ADMIN` and a `passwordHash`.

### 3.1 Reader sign-in methods

| Method | Flow |
| --- | --- |
| Google / GitHub | The browser solves Turnstile and posts it to `/api/auth/oauth-turnstile`, which sets a 5-minute signed `oauth_turnstile` cookie. Auth.js's `signIn` callback rejects OAuth sign-ins without a valid cookie. |
| Email link | `/api/auth/magic-link` takes `intent: "login"` (existing accounts only, `404 no_account` otherwise) or `intent: "signup"` (new accounts only, `409 account_exists` otherwise, with a display name). After Turnstile and a 3-per-15-minute per-email limit, Auth.js sends the link through Resend (production) or Nodemailer/Mailpit (development). |
| Passkey | `/api/auth/passkey/options` + `/verify` with a discoverable credential. On success the server creates an Auth.js database session directly, already marked MFA-verified. |

Email links point at `/verify`, not at the Auth.js callback
(`confirmBeforeSignIn` in `auth.config.ts`). The page shows a **Continue**
button that submits the token to `/api/auth/callback/{provider}`. Link scanners
and previews that open the URL do not use up the one-time token.

New users get a random public username `writer-{uuid}` (`events.createUser`), so
the email address never leaks into URLs.

`lib/auth-adapter.ts` wraps the Prisma adapter so deleting an already-deleted
session succeeds. Without it, a stale cookie made sign-in and sign-out fail.

### 3.2 Sessions and account setup

Sessions are Auth.js **database sessions** (30 days). The `session` callback
returns an explicit allow-list: `id`, `name`, `email`, `image`, plus two flags:

- `mfaPending`: the account has a second factor but this session has not
  verified it (`Session.mfaVerifiedAt` is null).
- `setupRequired`: the account has no second factor, or no display name.

`lib/auth.ts` exposes three accessors:

| Function | Returns a session when | Used by |
| --- | --- | --- |
| `auth()` | signed in, MFA verified, setup complete | every normal page and API |
| `authForAccountSetup()` | signed in and MFA verified (setup may be incomplete) | `/mfa` setup step, `PATCH /api/me`, `/api/me/security/*` |
| `authIncludingPendingMfa()` | any session | `/mfa` challenge, `/api/auth/mfa/*` |

So a session that owes a second factor, or an account without a name and second
factor, is treated as signed out everywhere else.

Every email and OAuth sign-in lands on `/mfa`:

```text
/mfa
 ├── mfaPending       → MfaChallenge: passkey, authenticator code or recovery code
 │                      → POST /api/auth/mfa/verify → Session.mfaVerifiedAt = now
 ├── setupRequired    → AccountSetup: 1) display name (if missing)
 │                                     2) add a passkey or authenticator app
 │                                     → recovery codes shown once
 └── otherwise        → redirect to ?next (validated by lib/safe-redirect.ts)
```

Adding the first factor marks the current session verified, so the person is
not asked again straight away. Other sessions are asked on their next request.

### 3.3 Second factors (`lib/mfa/`)

| Factor | Implementation |
| --- | --- |
| Passkeys | `@simplewebauthn/server`. RP ID is the hostname of `NEXTAUTH_URL`, RP name "Nystara". Resident key and user verification required. Challenges are stored in `AuthChallenge`, expire in 5 minutes and are deleted when used. Signature counters are checked. |
| Authenticator app (TOTP) | `otpauth`, SHA-1, 6 digits, 30-second period, ±1 step. Secrets are encrypted with AES-256-GCM using `MFA_ENCRYPTION_KEY` and bound to the user id. `totpLastStep` is updated with a conditional write so a code cannot be used twice, even concurrently. |
| Recovery codes | Ten codes like `abcde-fghjk`, stored as SHA-256 hashes, single use, regenerated as a set. Deleted when the last factor is removed. |

`handleSecurityAction` is shared by `/api/me/security/*` and
`/api/admin/security/*`. Once an account has any factor, every change (add,
remove, regenerate codes) needs a fresh proof from an existing factor, so a
stolen session alone cannot change factors. `verifyFactor` allows 10 attempts
per account per 15 minutes, on top of the per-IP credential tier.

Rotating `MFA_ENCRYPTION_KEY` makes stored TOTP secrets unreadable. Those users
fall back to passkeys or recovery codes.

### 3.4 Admin authentication

- `POST /api/admin/login`: Turnstile, then bcrypt comparison (a dummy hash keeps
  timing equal for unknown emails). Only `role = ADMIN` with a password hash
  succeeds.
- If the admin has MFA on, the response is `{ mfaRequired: true, methods }` and a
  5-minute `admin_mfa_pending` JWT cookie (path `/api/admin/login`) is set. The
  admin completes `/api/admin/login/mfa`.
- Passkey-only admin sign-in: `/api/admin/login/passkey-options` + `/passkey`.
- The session is an HS256 JWT in the `admin_session` cookie (8 hours,
  `HttpOnly`, `SameSite=Strict`, `Secure` in production), audience
  `nystara:admin`, carrying `sub`, `email`, `role` and `version`.
- `getVerifiedAdminSession()` checks the JWT and then the database: the user must
  still be an admin and `sessionVersion` must match. Password changes, role
  changes and re-seeding increment `sessionVersion`, revoking older tokens.
- MFA is **optional** for admins; the admin console has its own security page.
- Admin passwords are 12+ characters and at most 72 UTF-8 bytes (bcrypt's limit).

---

## 4. Data model

Schema: `prisma/schema.prisma`. Migrations `0_init` to `7_article_engagement`.

```text
User ─┬─< Article ─┬─< ArticleTag >── Tag
      │            ├─< Comment (self-relation parent/replies, guest or member)
      │            ├─< Clap
      │            ├─< Bookmark
      │            ├─< ArticleView      (visitorId = user id or anon reader id)
      │            └─< ArticleFeedback  (voterId  = user id or anon reader id)
      ├─< Comment, Clap, Bookmark, ArticleFeedback
      ├─< Follow (follower) / Follow (following)
      ├─── Subscription (0..1)
      ├─< Account, Session            (Auth.js)
      └─< Passkey, RecoveryCode       (MFA)

VerificationToken (Auth.js email links)   AuthChallenge (WebAuthn challenges)
```

| Model | Notes |
| --- | --- |
| `User` | `username` unique (nullable until created); `role` USER/ADMIN; `passwordHash` (admins); `sessionVersion`; `mfaEnabled`, `totpSecret` (encrypted), `totpEnabledAt`, `totpLastStep`; `stripeCustomerId`. |
| `Article` | `content` (Tiptap JSON), `contentText` (plain text for excerpts, read time and search), `readTime` (words / 200, minimum 1), `published`, `publishedAt`, `memberOnly`, `theme` (default `classic`). Unique `(authorId, slug)`. Indexed by `(published, publishedAt)` and `(authorId, published, publishedAt)`. |
| `Comment` | `authorId` nullable: guests have `guestName` instead. `deletedAt` soft delete. `parentId` uses `ON DELETE SET NULL`, so erasing one author keeps other people's replies. |
| `ArticleFeedback` | Primary key `(articleId, voterId)`. `reaction` LIKE/DISLIKE (nullable), `rating` 1–5 (nullable). `userId` set for members so erasure cascades. |
| `ArticleView` | One row per counted read. Indexed by `(visitorId, createdAt)`, `articleId`, `createdAt`. |
| `Subscription` | One per user: Stripe ids, `status` (ACTIVE, PAST_DUE, CANCELED, TRIALING), `currentPeriodEnd`. |
| `Session` | Auth.js row plus `mfaVerifiedAt`. |
| `Passkey` | Credential id, public key, counter, transports, device type, backed-up flag, name, last used. |
| `AuthChallenge` | Single-use WebAuthn challenge with purpose, optional user and expiry. |

All user-owned rows cascade on user delete. Migration `1_search_vector` adds a
generated `tsvector` column over title and `contentText` with a GIN index; no
query uses it yet.

Slugs are `slugify(title)` + `-` + a random UUID (`lib/slug.ts`), so concurrent
creation never collides and no lookup is needed.

---

## 5. Reading and the paywall

### Article page (`app/[username]/[slug]/page.tsx`)

1. Load the published article by author username and slug (cached per request so
   `generateMetadata` and the page share one query).
2. Identify the voter: the signed-in user id, or the anonymous reader id from the
   proxy. No identity means `404` (the proxy always issues one).
3. Decide access:

   ```text
   article.memberOnly = false
       → full story; recordView() (one view per reader per article per UTC day)
   article.memberOnly = true
       ├── subscriber (ACTIVE or TRIALING, currentPeriodEnd in the future)
       │       → full story; recordView()
       └── anyone else (anonymous or signed-in non-member)
               → checkPaywallAccess(voterId, articleId)
                   ├── already read this story in the window → full story
                   ├── < 5 members-only reads in 30 days     → full story + record view
                   └── otherwise → 300-word excerpt + "Become a member" box
   ```

4. Load feedback totals, up to 200 live comments, trending and most-viewed-today
   lists, then render.

The paywall check (`lib/paywall.ts`) runs in a transaction that first takes
`pg_advisory_xact_lock(hashtextextended(visitorId, 0))`. This serialises checks
for the same reader across all replicas, so parallel requests cannot exceed the
quota. Only views of members-only stories count toward the 5.

When the reader is over quota, the page passes `content = null` and a plain-text
excerpt to `StoryContent`. The full document is never serialised into the HTML.
This is a soft paywall: a new browser or cleared cookies get a new anonymous
reader id. It nudges readers toward membership; it is not access control.

### Home and profile

- `/` (`app/(public)/page.tsx`): latest 20 published stories, 20 most-clapped
  stories ("featured"), top 10 tags, with `FeedTabs` switching between lists.
- `/{username}`: profile header, follower/following counts, latest 20 stories.
- `GET /api/articles`: the same published feed as JSON, 20 per page with a cursor,
  optional `tag` filter.

### Metadata

`generateMetadata` sets title, description (subtitle or excerpt), canonical URL,
Open Graph `article` data (published time, author, cover image) and a Twitter
card. Share URLs are built from `NEXTAUTH_URL`.

---

## 6. Reader engagement

### Anonymous reader identity (`lib/visitor.ts`)

The `reader_session` cookie is an HS256 JWT signed with `NEXTAUTH_SECRET`,
audience `nystara:reader`, subject `anon-{uuid}`, valid for 30 days. It is
random: it is not derived from IP, browser or email. Invalid or expired cookies
get a fresh identity. The proxy sets it only on article pages.

`currentVoter()` (API routes) and `pageVoter()` (article page) resolve the voter
as `{ voterId, userId }`: members use their user id, guests use the reader id.

### Comments

- `POST /api/articles/{id}/comments` for published stories only.
- Members post under their account. Guests must give a name (2–50 letters,
  spaces, `.`, `'` or `-`) and pass Turnstile.
- Replies are one level deep: the parent must be a live top-level comment on the
  same story.
- 10 comments per voter per hour. Body 1–2,000 characters, rendered as text.
- `DELETE /api/comments/{id}`: the commenter or the story's author, soft delete.

### Reactions and ratings

`PUT /api/articles/{id}/feedback` upserts one row per voter: like or dislike, and
a 1–5 rating, each independently clearable with `null`. 60 votes per voter per
10 minutes. The response is the new totals (likes, dislikes, rounded average,
count) and the voter's own choices.

### Trending and most viewed (`lib/engagement.ts`)

- **What's trending**: the last 48 hours. Score = views × 1 + likes × 3 +
  comments × 5, taken from the top 50 articles in each signal.
- **Most viewed today**: views since midnight UTC.

Both list published stories with a username, plus the first tag as the topic.

### Sharing

`ShareBar` links to Facebook, LinkedIn and X share URLs. Instagram and Discord
have no web share URL: on touch devices the button opens the system share sheet,
otherwise it copies the link. A separate copy-link button is always available.

---

## 7. Writing: editor, documents and media

### Editor (`app/new-story/StoryEditor.tsx`)

`/new-story` creates a story; `/editor/{id}` loads one the signed-in user owns.

- Tiptap with StarterKit, TextAlign, TextStyle (font family, size, line height),
  Image, Placeholder and a custom `video` node
  (`components/editor/video-extension.tsx`).
- `components/editor/Ribbon.tsx`, a Word-style ribbon:
  - **Home**: undo/redo, font family and size, bold/italic/underline/strike,
    clear formatting, alignment, line spacing, lists, and a styles gallery
    (Normal, Heading 1–3, Quote, Code).
  - **Insert**: image (with alt text), cover upload, video link, link, quote,
    code block, divider.
  - **Design**: the six document themes.
- The page area renders inside `.story-theme[data-story-theme]`, so the editor
  looks like the published story.
- Title (250 characters), subtitle (500), members-only toggle, word count and read
  time.
- **Save draft** creates or updates the article. **Publish** saves, then calls
  `/publish`, then opens the story. A failed publish keeps the saved draft.
- A warning appears when leaving with unsaved changes.

### Local drafts (`lib/local-draft.ts`)

Unsaved work is mirrored to `localStorage` 400 ms after each change, under
`nystara:draft:{owner}:{storyId|new}`. On load:

- An existing story uses the browser copy only if it is newer than the server's
  `updatedAt`.
- `/new-story` restores the single in-progress story. After the first save, the
  copy is linked to that draft until it is published.
- "Start a new story" clears only this browser's copy; the server draft stays in
  Stories.

The local copy does not include the story theme, so a restored draft uses the
saved or default theme.

### Document format (`lib/story-document.ts`, `lib/article-schema.ts`)

Content is validated against an allow-list before saving:

- Nodes: doc, paragraph, heading (levels 1–3), text, bullet/ordered list, list
  item, blockquote, code block, hard break, horizontal rule, image, video.
- Marks: bold, italic, underline, strike, code, link (`https`, `http`, `mailto`,
  no credentials), textStyle (fixed font families, sizes, and line heights 1.5,
  1.8 or 2).
- At most 5,000 nodes, depth 20, 100,000 characters of text.
- Image `src` must be under this deployment's R2 public URL and `stories/` path.
  Video thumbnails must be on `i.ytimg.com` or `i.vimeocdn.com`.
- `contentText` is recomputed on the server from the document when it parses,
  so the excerpt and read time cannot be spoofed.

Published stories render through `components/article/StoryContent.tsx`, a fixed
React renderer: no `dangerouslySetInnerHTML`. Older plain-text stories are
converted with `legacyDocument()`.

### Images

```text
Browser (components/editor/prepare-image.ts)
  · JPEG/PNG/WebP up to 25 MB accepted
  · > 600 KB: downscale to ≤ 2400 px and re-encode WebP until ≤ 600 KB
        │ POST /api/media { type, data: base64, purpose: inline | cover }
        ▼
Server (app/api/media/route.ts)
  1. signed-in user; R2 configured (else 503)
  2. 50 uploads per user per day
  3. base64 ≤ 600 KB; magic bytes must match the declared type
  4. ClamAV INSTREAM scan if CLAMAV_HOST is set
       infected → 422; scanner unreachable → 503 (fails closed)
  5. sharp: limit 40 MP, auto-orient, fit inside 1600 px (inline) or
     2400 px (cover), WebP quality 82. Metadata (EXIF, GPS) is dropped.
  6. PutObject to R2: stories/{userId}/{uuid}.webp,
     Cache-Control: public, max-age=31536000, immutable
        │
        ▼
  201 { url: R2_PUBLIC_URL/stories/... }
```

Uploaded images are public, including images in unpublished drafts. Removing an
image from a story does not delete the object; account erasure deletes the whole
`stories/{userId}/` prefix.

Cover images may also come from Google or GitHub avatar hosts and Vercel Blob
(older URLs). Any cover must be HTTPS without credentials or a port.

### Video

`POST /api/videos` accepts public YouTube (`watch`, `youtu.be`, `shorts`,
`embed`) and Vimeo URLs, normalises them, and calls the provider's fixed oEmbed
endpoint (8-second timeout, redirects rejected). It returns the title and a
validated thumbnail. Readers see the thumbnail and load the player only when
they click it.

---

## 8. AI editor

`/ai-editor` (`app/ai-editor/AiStudio.tsx`) is a separate page from the story
editor.

- The writer pastes or types up to 12,000 characters and picks an action:
  polish, shorten, expand, outline, titles or feedback (`lib/ai-editor.ts`).
- The text is kept in this browser's local storage (`nystara:ai:{owner}`).
- Results can be copied, or appended to the in-progress `/new-story` local draft
  (which then opens).
- Non-members see the page with the controls locked.

`POST /api/ai/editor`:

1. Signed-in user with premium access: a `Subscription` that is ACTIVE or
   TRIALING with `currentPeriodEnd` in the future (`lib/premium.ts`). Checked on
   every request.
2. `OPENAI_API_KEY` and `OPENAI_MODEL` set (else `503`).
3. 30 requests per user per day. Attempts count even if the provider fails.
4. Calls `https://api.openai.com/v1/responses` with `store: false`,
   `max_output_tokens: 2000` and a 45-second timeout. The instructions tell the
   model to treat the passage as text to edit, never as instructions, and return
   plain text.
5. Only `output_text` parts of `message` items are used.

Suggestions are not fact-checked. Because there is no checkout yet, premium
access can only be granted by creating a `Subscription` row directly.

---

## 9. Admin console

Pages are under `app/admin/(console)/`. The proxy guards them all. Server pages
that query the database (dashboard, user list, article list and detail,
security) also verify the admin session themselves first. The client pages (user
detail, article new/edit, profile, settings) load and save through
`/api/admin/*`, which verifies on every request.

| Page | Purpose |
| --- | --- |
| `/admin/dashboard` | User, article and published counts; recent articles and users |
| `/admin/users`, `/admin/users/{id}` | Search by email/name/username; edit name, bio and role; erase |
| `/admin/articles`, `/new`, `/{id}`, `/{id}/edit` | Search by title, filter published/draft; create, edit, publish, delete |
| `/admin/profile` | Name, bio, password change (signs the admin out) |
| `/admin/security` | Passkeys, authenticator app and recovery codes |
| `/admin/settings` | Appearance theme; sign-in security summary |

Admin-created articles store plain text as `{ text }` content. An admin cannot
remove their own admin role or delete their own account. Deleting a user runs the
same erasure as self-service deletion.

---

## 10. Frontend structure

- **Root layout** (`app/layout.tsx`): fonts (Geist, Geist Mono, Newsreader for
  display; Playfair Display and Source Serif 4 for story themes, not preloaded),
  metadata, viewport with `viewport-fit=cover`, and `data-theme` from the `theme`
  cookie.
- **Site themes**: light, dark, sand, or system (no attribute; follows the OS).
  Stored in the `theme` cookie so the server renders the right colours on the
  first paint (`lib/theme.ts`, `components/theme/*`).
- **Story themes**: `[data-story-theme]` blocks in `app/globals.css` set fonts,
  accent colour and spacing, with dark-mode variants.
- **App shell** (`components/layout/AppShell.tsx`): wraps signed-in pages and the
  article and profile pages. Desktop shows `AppSidebar` with Read / Write /
  Account sections (`components/layout/nav.ts`). Touch devices (the `touch`
  variant) show `MobileNav`: Home, Library, Write, Stories and a "More" sheet
  with every destination, padded for the iPhone home indicator.
- **Public layout** (`app/(public)/layout.tsx`): marketing header and footer for
  the home and info pages.
- **Auth layout** (`app/(auth)/layout.tsx`): centred card for login, signup,
  verify, MFA and errors.
- **PWA**: `app/manifest.ts` (standalone display), favicons for light and dark,
  Apple touch icon.
- **Shared UI**: `components/ui.tsx` (`buttonClass`, `INPUT`, `CARD`, `cx`),
  `components/icons.tsx`, `components/brand/Logo.tsx`.

Pages are server components that query Prisma directly. Client components handle
the editor, forms, comments, votes, sharing and security settings.

---

## 11. Privacy and data lifecycle

- **Export**: `GET /api/me/export` returns the profile (including linked
  providers, subscription status and passkey metadata) and links to eight
  sections (articles, comments, claps, bookmarks, following, followers, views,
  feedback), 20 records per page with a `next` link. Credentials, password
  hashes and TOTP secrets are never exported.
- **Erasure** (`lib/gdpr.ts`): cancel a live Stripe subscription first, delete
  the user's R2 image prefix (a failure stops erasure so it can be retried), then
  in one transaction delete verification tokens, reader views and the user.
  Everything else cascades. Admins cannot erase themselves through
  `DELETE /api/me`.
- **Retention**: `npm run db:cleanup` deletes reader views older than 30 days
  plus expired sessions, verification tokens and passkey challenges. It is not
  scheduled automatically; run it daily.
- **Audit events** (`lib/audit.ts`): one JSON line per event to stdout, with event
  name, outcome and timestamp only. Events: admin login, password change, role
  change, erasure, export, passkey login, MFA verify, factor added/removed,
  recovery codes regenerated.

---

## 12. Testing and CI

| Suite | Command | Covers |
| --- | --- | --- |
| Unit and component | `npm test` | Security helpers (origin, body limit, rate limiter, CSP, admin tokens, reader identity), MFA crypto/TOTP/recovery/WebAuthn validation, story documents and rendering, image pipeline and ClamAV, comment rules, editor ribbon, share bar and trending rail, R2 erasure, navigation and local drafts, auth adapter, launcher dotenv handling |
| Integration | `npm run test:integration` | Real PostgreSQL 16 and Redis 7: API authorisation and CSRF, mass assignment, export paging, admin token revocation, paywall concurrency, erasure, retention cleanup, shared Redis limits, migrations, and a Playwright check that script-like content stays inert under the production CSP |

`.github/workflows/security.yml` runs on every pull request and push to `main`:
`npm ci`, Prisma generate, lint, typecheck, unit tests, `npm audit
--audit-level=moderate`, migrations, production build and integration tests,
with read-only repository permissions.

---

## 13. Not yet implemented

| Area | Current state |
| --- | --- |
| Stripe billing | SDK and `Subscription` model only. No checkout, portal or webhook. Erasure cancels subscriptions through the API. |
| Claps, bookmarks, follows | Counted and displayed; no endpoint creates or removes them. The profile Follow button is inert. |
| Notifications | Header bell is a placeholder. No notification storage or email. |
| Tag pages | Links go to `/tag/{slug}`, which does not exist. |
| Search | `search_vector` column and GIN index exist; no API or UI. |
| Emails beyond sign-in | No welcome, digest, follower or comment emails. |
| OG images, sitemap, RSS | Not built. Article metadata uses the cover image. |
| Server autosave | Drafts reach the server only on Save or Publish. |
| Writer payouts | Not designed in code (no Stripe Connect). |

---

## 14. Key decisions

| Decision | Choice | Reason |
| --- | --- | --- |
| Application shape | One Next.js app | SSR and API in one deployable; no service boundaries to maintain yet |
| Reader sessions | Auth.js database sessions | Sessions can be revoked and carry `mfaVerifiedAt` |
| Admin sessions | Separate short JWT + database version check | Isolates admin access from reader sessions; fast revocation |
| Second factor | Required for readers, optional for admins | Every reader account is protected from day one; admins also have password + Turnstile |
| Paywall | Server-side excerpt, advisory lock per reader | Full content never reaches unauthorised clients; quota holds under concurrency |
| Anonymous identity | Random signed cookie | Supports guest votes and quota without fingerprinting |
| Rate limits | Redis, fail closed in production | Limits hold across replicas; an outage denies instead of opening the gates |
| Images | Server re-encode to WebP on R2 | Removes metadata and appended payloads; predictable sizes; cheap egress |
| Document storage | Tiptap JSON + plain text, allow-list validated | Rich formatting without storing or rendering raw HTML |
| AI | Direct `fetch` to the Responses API | No SDK dependency; strict timeout, output cap and `store: false` |
| Search (future) | PostgreSQL full-text | Column already in place; no extra service |
