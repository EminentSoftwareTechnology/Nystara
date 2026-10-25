# Security policy

## Reporting a vulnerability

Report vulnerabilities privately through GitHub private vulnerability reporting
on this repository. Do not put credentials, exploit tokens or personal data in
public issues. Before launch, the operator must publish and monitor a real
security contact address.

## Implemented controls

Each control lists the file that implements it. [ARCHITECTURE.md](ARCHITECTURE.md)
explains the flows in detail.

### Authentication and sessions

- **Reader sessions** are Auth.js database sessions. The session payload is an
  explicit allow-list (id, name, email, image, `mfaPending`, `setupRequired`);
  session tokens, password hashes and TOTP secrets never reach
  `/api/auth/session` (`lib/auth.ts`).
- **Second factor required for readers.** An account without a display name and
  at least one passkey or authenticator app is treated as signed out everywhere
  except account setup (`/mfa`). A session that owes its second factor is also
  treated as signed out until verified.
- **Passkeys** (`lib/mfa/passkeys.ts`): user verification and resident keys
  required, RP ID bound to the `NEXTAUTH_URL` hostname, single-use database
  challenges with a 5-minute expiry, signature counter checks.
- **Authenticator apps** (`lib/mfa/totp.ts`, `lib/mfa/crypto.ts`): AES-256-GCM
  encrypted secrets bound to the user id, ±1 time step, and an atomic
  last-step update so a code cannot be reused, even concurrently.
- **Recovery codes** (`lib/mfa/recovery.ts`): ten codes, SHA-256 hashed,
  single use, shown once.
- **Factor changes need proof**: once an account has a factor, adding or removing
  factors or regenerating codes requires a fresh proof from an existing factor
  (`lib/mfa/index.ts`).
- **MFA attempt limits**: 10 per account per 15 minutes, plus the per-IP
  credential tier (10 per minute).
- **Email sign-in**: links go to a `/verify` confirmation page, so automated link
  fetches do not use up the token. Requests must pass Turnstile and are limited
  to 3 per email per 15 minutes. Direct `POST /api/auth/signin/resend` is
  blocked so the protected route cannot be bypassed.
- **OAuth sign-in** requires a 5-minute signed Turnstile cookie checked in the
  Auth.js `signIn` callback.
- **New usernames** are random (`writer-{uuid}`) and never derived from email.

### Admin console

- Separate HS256 JWT (`admin_session`, 8 hours, `HttpOnly`, `SameSite=Strict`,
  `Secure` in production), audience-bound to `nystara:admin`
  (`lib/admin-session.ts`).
- Every admin request re-checks the database: the user must still be an admin and
  the token's `sessionVersion` must match. Password changes, role changes and
  re-seeding increment it, revoking older tokens (`lib/admin-auth.ts`).
- Login runs bcrypt against a dummy hash for unknown emails to equalise timing,
  and requires Turnstile.
- Optional admin second factor (passkey or authenticator) through a 5-minute
  pending token scoped to `/api/admin/login`; passkey-only admin sign-in is also
  available.
- Passwords are 12+ characters and at most 72 UTF-8 bytes (bcrypt's limit).
- Admins cannot remove their own admin role or delete their own account.

### Request handling (`proxy.ts`)

- **CSRF**: every API write must carry an `Origin` equal to the origin of
  `NEXTAUTH_URL`, and `Sec-Fetch-Site` must not be `cross-site`. Forwarded host
  headers are never trusted.
- **Rate limits**: atomic Redis counters keyed by HMAC-SHA256, so Redis holds no
  raw identifiers. Production denies limited traffic when Redis is missing or
  unreachable. Tiers: 10/min for credential endpoints, 60/min for writes,
  300/min for API reads and for pages. Route-level limits cover uploads, AI,
  comments, votes, export and email links.
- **Client IP** is trusted from `X-Forwarded-For` only with `TRUST_PROXY_IP=1`;
  otherwise clients share one conservative bucket.
- **Body limits**: streamed byte count with a 1 MiB cap and a 10-second deadline.
- **Caching**: every page and API response is `private, no-store`.

### Content and rendering

- **CSP**: a fresh nonce per response, `'strict-dynamic'`, no `unsafe-inline`
  scripts in production, frames limited to Turnstile, YouTube and Vimeo,
  `frame-ancestors 'none'`, `object-src 'none'` (`lib/csp.ts`).
- **Static headers** (`next.config.ts`): HSTS with preload, `X-Frame-Options:
  DENY`, `nosniff`, `strict-origin-when-cross-origin`, a restrictive
  Permissions-Policy and `Cross-Origin-Opener-Policy: same-origin`.
- **Story documents** are validated against an allow-list of nodes and marks,
  with bounded size and depth. Links allow only `https`, `http` and `mailto`
  without credentials. Images must come from this deployment's R2 bucket, video
  thumbnails from YouTube or Vimeo image hosts (`lib/story-document.ts`,
  `lib/article-schema.ts`).
- **Rendering** goes through a fixed React renderer; there is no raw HTML sink.
  Comments and AI output are plain text.
- **Paywall**: members-only content beyond the free quota is never serialised
  into the page; only a 300-word excerpt is sent. The quota check takes a
  per-reader PostgreSQL advisory lock.

### Uploads and outbound requests

- **Images** (`app/api/media/route.ts`): only JPEG, PNG and WebP, at most 600 KB,
  magic bytes must match the declared type; optional ClamAV scan that fails
  closed; decoded by `sharp` with a 40-megapixel limit, re-encoded to WebP so
  metadata and appended payloads are dropped; stored under random keys.
- **Video previews** call fixed oEmbed endpoints only, reject redirects, time
  out after 8 seconds and validate thumbnail hosts. The server never fetches a
  user-chosen URL.
- **AI editor** sends messages and attachments only to the OpenAI Responses API
  with `store: false`, a 60-second timeout and a 3,000-token output cap, after
  checking premium access on every request (skipped only in development).
  Attachments are limited to 3 allow-listed types totalling 500 KB and are
  framed as source material, not instructions. Conversations are owner-scoped,
  stored in the database, deleted on account erasure and included in the export.
  Model output is shown as plain text.
- **Library and follows**: list, highlight, follow and topic changes are
  owner-scoped and limited to 120 per user per 10 minutes. Highlights must quote
  text the reader can access, so locked member text cannot be stored through a
  highlight. Unlisted stories cannot be added to public lists, and public lists
  never show them to other readers.
- **Story status** changes are author-only; unlisted and unpublished stories stay
  out of feeds, topic pages and discovery.
- **Turnstile verification** has a 5-second timeout; production rejects missing
  or documented test keys.

### Privacy

- Anonymous readers get a random signed 30-day `reader_session` cookie. It is not
  derived from IP, browser fingerprint or email.
- Data export is owner-scoped, paginated and excludes credentials.
- Account erasure cancels billing, deletes uploaded images and cascades database
  rows; it stops before deleting anything if storage or billing fails.
- Security audit events (`lib/audit.ts`) contain only the event name, outcome and
  timestamp: no email, IP, token, password or article text.

## Operator requirements

The code cannot do these for you:

- Set a canonical `NEXTAUTH_URL`; passkeys are bound to its hostname.
- Use unique random values for `NEXTAUTH_SECRET`, `ADMIN_JWT_SECRET` and a
  32-byte base64 `MFA_ENCRYPTION_KEY`. Rotating the MFA key disables existing
  authenticator-app enrolments.
- Use real Turnstile keys and provide `REDIS_URL` in production.
- Run Redis with bounded memory and `noeviction` (eviction would reset
  penalties), with authentication, TLS and private networking. Do the same for
  PostgreSQL.
- Verify ingress behaviour before enabling `TRUST_PROXY_IP=1`. Block direct
  access to the app and enforce connection, size and time limits at the edge.
  The app limiter is not DDoS protection.
- Supply secrets only at runtime. `.env` and `.env.local` are git-ignored and must
  stay that way.
- Run `npm run db:cleanup` daily. It removes reader views older than 30 days and
  expired sessions, verification tokens and passkey challenges.
- Collect audit events from stdout and alert on them.
- Remember that uploaded images are public, including those in unpublished
  drafts, and that removing an image from a story does not delete it.
- Decide retention for logs, backups and provider data, sign processor
  agreements, and review cookie purposes and lawful bases. Code changes alone do
  not make a deployment GDPR compliant.

See [SECURITY_REVIEW.md](SECURITY_REVIEW.md) for reviewed categories, evidence
and open items. Dependency scanning does not prove the absence of
vulnerabilities.
