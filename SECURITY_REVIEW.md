# Security and correctness review — 25 October 2026

Scope: the application committed at `29736a4`, including all API handlers, server actions, private/public page queries, authentication, database relations, request validation, external calls, rendering, container deployment, dependencies and startup scripts. The review uses the [OWASP Web Top 10:2025](https://top10.owasp.org/2025/0x00_2025-Introduction/) and [OWASP API Top 10:2023](https://devguide.owasp.org/en/07-training-education/07-api-top-ten/) as coverage guides. Findings below are code-confirmed; hardening is identified separately. This is a source review with local regression testing, not an external penetration test or a GDPR certification.

## Remediated findings

| Severity | Finding and trigger | Fix and evidence |
| --- | --- | --- |
| Critical | Lockfile contained known Auth.js and Next.js advisories, including proxy-bypass, authentication and resource-exhaustion issues. Initial `npm audit` reported 31 vulnerable packages. | Compatible updates, Next.js 16.4.3, matching ESLint configuration; removed unused vulnerable `@vercel/og`. Final registry audit reports zero advisories. |
| High | Admin article/user server pages relied exclusively on proxy authorization before querying private data. A proxy bypass could expose those queries. | `app/admin/articles/page.tsx`, `app/admin/articles/[id]/page.tsx`, `app/admin/users/page.tsx` authorize through the verified database-backed admin session before querying. Existing API ownership checks retained and tested. |
| High | API write-origin checks trusted forwarded host and ignored URL scheme; writes without Origin were accepted. | `lib/request.ts:isSameOriginWrite` compares against configured `NEXTAUTH_URL`, rejects absent/null/cross-site origins and scheme/port mismatches. Tests exercise DELETE/PATCH authorization and CSRF. |
| High | Declared Content-Length was the only body limit. Chunked JSON bypassed it; parsing could allocate unbounded memory. Deep article JSON and unbounded offsets/lists added resource risk. | Streaming byte counter and deadline before API handlers, bounded content depth/node count, bounded pagination, paged stories/stats/export, database pool and statement limits. Public page requests are also rate limited. |
| High | Process-local rate limits multiplied across replicas; saturating the key map cleared all active penalties. IP header trust was implicit. | Atomic expiring Redis counters, HMAC-only Redis keys, production fail-closed behavior, bounded dev fallback that rejects new keys at capacity. Proxy IP trust requires explicit verified ingress configuration. Recipient-level magic-link limits reduce mail abuse. |
| High | Production could use documented always-pass Turnstile secrets; the email provider's callback did not independently enforce the protected entry point. | Production rejects dummy secrets and missing keys. Email verification-request callbacks permit only the internal protected sign-in path. Direct provider POST is also blocked. Provider verification has a five-second timeout. |
| High | Changing an admin password left stolen JWTs valid for up to eight hours; demotion/re-promotion could revive old tokens. bcrypt silently truncates passwords after 72 bytes. | `sessionVersion` is signed and checked against the database; password/role changes and reseeding increment it. Password changes clear the cookie and send the UI back to login. Creation/change reject passwords over 72 UTF-8 bytes. |
| High | Concurrent paywall requests could all count below the quota under default transaction isolation. An ACTIVE status alone accepted expired subscriptions. | Transaction-scoped PostgreSQL advisory lock serializes each visitor's checks; duplicate article views reuse the existing grant. Subscription period must be current. Concurrent integration test grants exactly five of ten unique articles. |
| High | Account erasure could fail when another author replied to the deleted user's comment; the parent FK restricted deletion. | Migration changes the nullable parent reference to `ON DELETE SET NULL` and indexes parent/author FKs. Integration test erases one author and preserves another author's reply. |
| Medium | New public usernames exposed the email local part. Anonymous reader IDs fingerprinted IP/browser indefinitely. Export omitted reading records and article JSON, and loaded every record in one response. | Random public usernames and signed random 30-day reader cookies; no fingerprint-derived reader IDs. Credential-free owner-scoped export sections with 20-record cursor pages include article JSON and views. Daily maintenance command deletes expired reading/auth records. Notices describe implemented processing. |
| Medium | Saved bookmarks continued returning metadata for articles after unpublishing. Following feeds loaded all followed IDs before querying articles. Slug generation loaded every matching slug and raced under parallel creation. | Library filters published articles; following uses a bounded relational query. New slugs use a random UUID suffix without a scan. Duplicate tag slugs are deduplicated before relation creation. |
| Medium | Launcher sourced dotenv files as shell programs, ignored requested dev ports, and needlessly required Docker for remote databases. Production Compose used a fixed database password; migration configuration was missing from the image. | `start.sh` uses the Next dotenv parser, random secrets with private file creation, explicit host/port arguments, local-only infrastructure, remote migration opt-in, production CAPTCHA checks, and no database resets/seeding. Compose requires a configurable password; Prisma config is packaged. Launcher regression test verifies dotenv command text cannot execute and `.env.local`/PORT behavior. |

## Correctness and accessibility

Production Auth.js now trusts only requests normalized to the explicitly configured canonical origin, without requiring a platform-specific trust-host flag. The story editor's Publish button created a draft and navigated to its unpublished URL, yielding a 404. It now saves then publishes, retains the saved draft for retries and reports failures. Publication requests set the requested state idempotently instead of toggling on retries. Editable title/body fields have textbox roles and accessible names; long unbroken article titles/text wrap on mobile. A browser regression publishes script-like title/body text under the production nonce CSP and checks it remains text with no injected image or script execution.

## Additional hardening

- Production script CSP uses a fresh nonce rather than `unsafe-inline`; HTML remains dynamically rendered with private/no-store behavior. Framework scripts carry the response nonce. Existing article text is rendered through React escaping; no raw-HTML sink or confirmed stored-XSS exploit was found.
- Cover-image writes accept only the configured image hosts, HTTPS and no embedded credentials. This limits new third-party tracking URLs. Existing external images and deployment egress policy still require operator review.
- Generic security events cover administrator login outcomes, password/role changes, exports and erasure without including credentials, IPs, email addresses or article text. Query-argument error logging is disabled; runtime errors use Prisma's minimal format. Collection, retention and alerts remain deployment responsibilities.
- A CI workflow runs lint, type checking, regression tests, registry audit, migrations, production build and PostgreSQL/Redis integration tests with read-only repository permissions.

## OWASP coverage

| Web 2025 category | Review result |
| --- | --- |
| A01 Broken Access Control | Owner/admin authorization, CSRF, private cache behavior and draft metadata reviewed; fixes and negative-access tests above. |
| A02 Security Misconfiguration | CSP, cookies, trusted proxy boundary, CAPTCHA, Compose secrets and launch behavior hardened. Edge/TLS/live settings remain unverified. |
| A03 Software Supply Chain Failures | Lockfile patched and CI audit added; container image and CI-action provenance are operator responsibilities. |
| A04 Cryptographic Failures | Admin JWT audience/algorithm/claims and revocation checked; strong-secret setup and bcrypt byte limits enforced. Hosted database TLS and secret rotation unverified. |
| A05 Injection | No raw HTML rendering or unparameterized SQL sink found. New advisory-lock SQL binds its argument. CSP, URL and content constraints hardened. |
| A06 Insecure Design | Shared quotas, abuse controls, privacy minimization and erasure behavior addressed. Anonymous cookie reset still bypasses the intentionally soft reading quota. |
| A07 Authentication Failures | CAPTCHA defaults, email-provider entry, admin password lifecycle, role checks and dependency advisories addressed. Live OAuth/email not exercised. |
| A08 Software or Data Integrity Failures | Explicit API fields, mass-assignment negative test, JWT audiences, concurrent quotas, tag deduplication and collision-resistant slugs reviewed. |
| A09 Security Logging and Alerting Failures | Minimal security events added; hosted alert delivery and operational response unverified. |
| A10 Mishandling of Exceptional Conditions | Malformed/oversized JSON, database limits, bounded external-call duration and production limiter outages reviewed. Third-party billing failure recovery remains operationally dependent. |

| API 2023 category | Review result |
| --- | --- |
| API1 Object Level Authorization | Cross-user draft writes rejected; export scope derives from authenticated user; admin reads separately authorize. |
| API2 Broken Authentication | Token claims/revocation, password bytes, CAPTCHA, Auth.js patching and direct email-provider entry addressed. |
| API3 Object Property Authorization | Zod allowlists and explicit response projections retained; mass-assignment regression rejects ownership/publication changes through ordinary PATCH. |
| API4 Resource Consumption | Stream limits/deadline, shared limits, pagination, connection/statement caps and bounded document validation. |
| API5 Function Level Authorization | Admin API and private page checks verified; ordinary sessions cannot use admin APIs. |
| API6 Sensitive Business Flows | Per-recipient email limits, credential buckets, CAPTCHA, serialized reading quota and export account limits. |
| API7 SSRF | No user-selected server-fetch destination found. Turnstile destination is fixed; image optimizer has configured hosts. Egress, DNS and provider behavior unverified. |
| API8 Security Misconfiguration | Origin/cookie/CSP/no-store behavior, secrets, deployment packaging and proxy trust reviewed. |
| API9 Inventory Management | Reviewed every current `app/api/**/route.ts`; protected export/erasure contract documented in `API.md`. No upload/checkout/webhook implementation exists to test. |
| API10 Unsafe API Consumption | Turnstile response checked and time bounded; provider SDKs patched. OAuth, Resend and Stripe live flows were not called. |

## Validation and rollout

Local validation: 13 unit/launcher tests and 16 production integration/browser/migration tests passed. Lint, TypeScript, production build, shell syntax/help and final registry audit passed; the audit reports zero vulnerabilities. The final Docker image builds successfully; runtime migration tooling runs as UID 1001. Container startup and hosted CI status are recorded in the PR. Integration tests use disposable PostgreSQL 16 and Redis 7 with synthetic users, not the developer's configured databases. Migration `5_security_review` adds a session version, changes a nullable FK's delete action and adds indexes; existing admin JWTs intentionally require sign-in again. Export consumers must follow every section and `next` link. New article URLs have a UUID suffix; existing URLs do not change.

Run `npm run db:cleanup` daily in a maintenance environment with the TypeScript runner available. Reader-view retention affects historical view counts. Configure provider/log/backup erasure and retention separately; cancellation before local deletion does not erase a billing provider's legally retained records. Configure valid controller/contact details, processor agreements, lawful bases and cookie decisions before launch.

An application rate limiter does not absorb volumetric DDoS attacks. Require edge connection/request/time limits, private authenticated data stores and appropriate WAF/CDN protection. Keep `/api/health` as cheap liveness; monitor dependencies separately. Redis must have bounded memory with `noeviction`, since eviction would reset penalties. Without verified proxy trust, clients intentionally share aggregate buckets; Redis failure denies protected requests.

No deployment, real email, OAuth login, billing-provider operation or production security posture is claimed by this review. CI status must be checked on the pushed commit.
