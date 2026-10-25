# Changelog

All notable changes to Nystara are recorded here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and
the project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
Pull request numbers refer to the GitHub repository.

## [Unreleased]

### Added

#### Accounts and sign-in

- Separate sign-in and sign-up flows. `POST /api/auth/magic-link` takes an
  `intent` (`login` or `signup`); sign-in only mails existing accounts and
  sign-up only mails new ones, so each page can point to the other. (#12)
- Required account setup at `/mfa`: every reader account needs a display name and
  a passkey or authenticator app before it can use the app. A display name given
  at sign-up travels in the email link. (#12)
- Email links open a `/verify` confirmation page, so mail scanners and link
  previews cannot use up the one-time token. (#13)
- Friendly `/sign-in-error` page for Auth.js errors. (#13)
- Passkeys (WebAuthn) for passwordless sign-in and as a second factor, for
  readers and admins. (#5)
- Authenticator-app (TOTP) two-step verification with ten single-use recovery
  codes. Secrets are AES-256-GCM encrypted with `MFA_ENCRYPTION_KEY`. (#5)
- `/me/security` and `/admin/security` settings; any change to factors needs a
  fresh proof from an existing factor. (#5)
- Admin sign-in second step (`admin_mfa_pending`) and passkey-only admin
  sign-in. (#5)

#### Reading and engagement

- Story digests: daily, weekly or monthly emails with newly published, most-read
  and trending stories. Visitors subscribe from the footer with Turnstile and an
  email confirmation; members pick a frequency in email preferences. Sent by
  `npm run digests`.

- Article page redesign: hero header, share bar (Facebook, LinkedIn, X;
  Instagram and Discord through the share sheet or copy link), go-to-top
  button. (#10)
- Comments from members and named guests (Turnstile-verified), one level of
  replies, soft delete by the commenter or the story's author. (#10)
- Like/dislike and 1–5 star ratings for members and anonymous readers. (#10)
- "What's trending" (48-hour reads, likes and comments) and "Most viewed today"
  sidebar. (#10)
- Open Graph and Twitter card metadata for article links. (#10)
- Signed, random 30-day `reader_session` cookie for anonymous readers. (#1, #10)

#### Writing

- Document editor with structured content, saved drafts, member-only toggle,
  cover images and a wider account workspace. (#8)
- Word-style ribbon (Home, Insert, Design) with a styles gallery and six
  document themes saved per story and applied when published. (#10)
- Image uploads to Cloudflare R2: browser-side shrinking, signature checks,
  optional ClamAV scanning (`CLAMAV_HOST`), metadata stripping, resizing and WebP
  re-encoding. (#8, #10)
- YouTube and Vimeo video previews that load the player on click. (#8)
- Browser copy of unsaved drafts in local storage, restored when newer than the
  server copy, and a "Start a new story" action. (#12)
- AI editor moved to its own page, `/ai-editor`, with passage history in the
  browser and "send to story". Premium only, 30 requests per day. (#8, #12)

#### Interface

- Mobile bottom navigation with a "More" sheet listing every destination, and a
  shared desktop sidebar (Read / Write / Account). (#12)
- Blog-style home feed with tabs, and new Why blog and Features pages. (#4)
- Public site redesign across About, Contact, Privacy, Terms and Cookies. (#12)
- Light, dark, sand and system themes saved in a cookie and rendered on the
  server. (#4)
- Web app manifest, so the app can be installed to a home screen. (#12)
- Nystara design system across the app and admin console. (#4, #5)

#### Tooling

- `./start.sh` launcher: creates `.env.local` with random secrets, starts
  PostgreSQL, Redis and Mailpit with Podman or Docker, applies migrations, frees
  the port and opens the browser. (#1, #2, #3, #6)
- Mailpit captures development sign-in email. (#2, #3)
- `npm run db:seed:demo`: 50 demo users and 10 stories with tags, claps,
  comments, bookmarks and follows. (#9)
- `npm run db:cleanup` retention job. (#1)
- CI workflow: lint, typecheck, unit tests, audit, migrations, build and
  PostgreSQL/Redis/Playwright integration tests. (#1)

### Changed

- Dark theme (app and emails) now uses a warm charcoal palette with off-white
  text and parchment buttons instead of pure black and white.
- Writer stats charts use a colour-blind-checked categorical palette.
- Article pages are wider: a larger story column and a wider trending rail.
  Terms, privacy and cookie pages match the header width.
- Development servers can send through Resend with `EMAIL_PROVIDER=resend`.
- Admin user search matches email only on the exact full address.

- Unique local ports to avoid collisions: app 6100, PostgreSQL 5442, Redis 6389,
  Mailpit 1035/8035. (#7)
- Every article read is now recorded for trending. The members-only quota still
  counts only members-only reads. (#10)
- Renamed the project from TechScribe to Nystara (package, docs, Docker, JWT
  audiences, email sender). (#4, #5)
- New articles get a random UUID suffix in their slug. (#1)
- New users get a random `writer-{uuid}` username instead of one derived from
  their email. (#1)
- Upgraded Next.js to 16.4.3 and patched dependencies; removed `@vercel/og`.
  Upgraded nodemailer to 10.2.1 (GHSA-c7w3-x93f-qmm8 and related advisories). (#1, #5)

### Fixed

- Sign-in no longer fails when the browser's old session row has already been
  deleted. (#11)
- The editor's Publish button saves, then publishes, instead of opening an
  unpublished draft URL. (#1)
- Publishing is idempotent instead of toggling on retries. (#1)
- Account erasure no longer fails when another author replied to the user's
  comment. (#1)

### Security

- Personal data is encrypted at rest (AES-256-GCM): emails, sign-in token
  identifiers, OAuth tokens, guest comment names, highlights and AI chats. Email
  lookups use a keyed hash. Requires `DATA_ENCRYPTION_KEY`; run
  `npm run db:encrypt` once after migrating.
- Story writers can no longer delete readers' comments on their stories.

See [SECURITY_REVIEW.md](SECURITY_REVIEW.md) for the full review (#1).

- Same-origin `Origin` check on every API write against `NEXTAUTH_URL`.
- Redis-backed, HMAC-keyed rate limits that fail closed in production.
- Streamed 1 MiB body limit with a 10-second read deadline.
- Per-response CSP nonce; no `unsafe-inline` scripts.
- Admin JWT revocation through `sessionVersion`; 72-byte bcrypt password limit.
- Advisory lock on the paywall quota so concurrent requests cannot exceed it.
- Production rejects Turnstile test keys; direct email-provider sign-in is
  blocked.
- Auth.js session payload limited to an explicit allow-list. (#5)

## [0.1.0] - 2026-05-07

### Added

- Next.js 16 App Router project with TypeScript strict mode and Tailwind CSS 4.
- PostgreSQL schema through Prisma 7: users, articles, tags, comments, claps,
  bookmarks, follows, article views and subscriptions.
- Full-text `tsvector` column and GIN index on articles (no search UI yet).
- NextAuth v5 with Google, GitHub and email magic links; Turnstile checks on
  sign-in.
- Article create/update/delete/publish API with Zod validation and a cursor
  feed.
- Member-only articles with a server-side soft paywall (5 free reads per 30
  days, excerpt only after that).
- Admin console with a separate JWT session for user and article management.
- Health check endpoint, multi-stage Dockerfile, Docker Compose and Railway
  configuration with migrations on startup.
