# Security policy

Report vulnerabilities privately to the repository maintainers through GitHub private vulnerability reporting when available. Do not put credentials, exploit tokens or private user data in public issues. The operator must publish and monitor a real security contact before launch.

## Implemented controls

- Auth.js database sessions; separate audience-bound admin JWTs with database role and session-version checks. Password/role changes revoke prior admin sessions.
- Resource ownership checks and explicit API input/output fields. Admin pages that read private data also authorize before querying.
- Canonical-origin checks for API writes; no trust in forwarded host headers. Provider callbacks retain Auth.js checks.
- Atomic, expiring Redis rate limits in production. Missing/unavailable Redis denies protected traffic. The lightweight liveness endpoint is exempt.
- A 1 MiB streamed API body limit, body-read deadline, bounded article depth/size, bounded query offsets and paginated exports.
- Per-response nonce CSP, React text escaping, restricted cover-image hosts and other response security headers. Raw HTML is not rendered.
- Turnstile verification with a network timeout; production rejects documented dummy secrets. Direct email-provider sign-in requests cannot bypass the protected flow.
- Random signed 30-day reader identifiers, no email-derived new usernames, credential-free paginated exports and account erasure with database cascades.
- Optional two-step verification for readers and admins: WebAuthn passkeys (user verification required, single-use database challenges, counter checks) and TOTP authenticator apps (AES-256-GCM encrypted secrets bound to the account, one step of drift, no code reuse) with ten hashed single-use recovery codes. A session that owes its second factor is treated as signed out; admins complete MFA after the password step through a five-minute pending token. Adding or removing a factor requires a fresh second-factor proof, and MFA attempts are limited per account and per IP.
- The Auth.js session callback returns an explicit allow-list (id, name, email, image, MFA state); session tokens, password hashes and TOTP secrets never reach `/api/auth/session`.
- Generic security events without email, IP, token, password or article-body payloads. The deployment operator must collect these events and configure alerts.

## Operational requirements

Set canonical `NEXTAUTH_URL` (passkeys are bound to its host), unique random signing secrets, a 32-byte base64 `MFA_ENCRYPTION_KEY` (rotating it voids authenticator-app enrolments), real CAPTCHA keys and `REDIS_URL`. Verify ingress behavior before enabling `TRUST_PROXY_IP=1`; block direct backend access and enforce request-size, connection and time limits at the edge. Use bounded dedicated Redis with `noeviction`, TLS, network restrictions and authentication on hosted data stores. Secrets are supplied only at runtime; `.env` and `.env.local` remain ignored.

Run `npm run db:cleanup` daily from an environment with the TypeScript runner installed. It removes reading records older than 30 days expired sessions, verification tokens and passkey challenges. Configure separate provider, log and backup retention policies, deletion procedures and processor agreements. Cookie purpose/consent and lawful-basis decisions require operator review; code changes alone do not establish GDPR compliance.

See [SECURITY_REVIEW.md](SECURITY_REVIEW.md) for reviewed categories, evidence and remaining operational checks. Dependency scanning does not establish the absence of vulnerabilities.
