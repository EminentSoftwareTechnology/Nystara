# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

### How to Report

Email security concerns to: **[your-email]** (replace with actual security contact)

Include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

### Response Timeline

- **24 hours**: Initial acknowledgment
- **7 days**: Detailed response with assessment
- **30 days**: Fix deployed (for confirmed vulnerabilities)

### What to Expect

- We will acknowledge receipt of your report
- We will confirm the vulnerability and determine severity
- We will work on a fix and coordinate disclosure timeline
- We will credit you in the security advisory (unless you prefer to remain anonymous)

---

## Security Measures

### Authentication

- **NextAuth v5**: Industry-standard authentication library
- **OAuth 2.0**: Google and GitHub providers
- **Magic Links**: Passwordless email authentication via Resend
- **Admin Sessions**: Separate JWT-based authentication with 8-hour expiry
- **CAPTCHA**: Cloudflare Turnstile on all auth flows

**Security Controls:**
- HttpOnly cookies (prevents XSS token theft)
- Secure flag in production (HTTPS only)
- SameSite=Lax (CSRF protection)
- Short-lived admin sessions (8 hours)
- OAuth requires Turnstile pre-verification

### Password Security

**Admin Accounts:**
- bcrypt hashing (cost factor: 10)
- Passwords never logged or exposed in API responses
- No password reset flow (admin-only, manual reset via DB)

**User Accounts:**
- No passwords stored (OAuth + magic link only)
- Reduces attack surface significantly

### Database Security

**Connection:**
- TLS/SSL enforced (Railway auto-configures)
- Connection string in environment variables only
- No database credentials in code

**Access Control:**
- Application-level authorization checks
- Prisma ORM (parameterized queries, no SQL injection)
- Row-level security via middleware (paywall checks)

**Sensitive Data:**
- No credit cards stored (Stripe handles payments)
- Email addresses are the most sensitive data
- User deletion cascades all related data

### API Security

**Authentication:**
- Session cookies for users
- JWT for admin panel
- No API keys yet (same-origin only)

**Authorization:**
- Endpoint-level: Session required for `/me`, `/new-story`
- Resource-level: Users can only edit their own articles
- Admin routes: Separate session + role check + DB verification

**Input Validation:**
- Zod schemas on all API routes
- Type-safe request/response handling
- Normalized tag slugs to prevent injection

**Rate Limiting:**
- ⚠️ **Not implemented yet** (planned)
- Recommendation: Upstash Rate Limit with Redis

### Paywall Security

**Critical:** Full article content is never sent to unauthorized clients.

- Server-side check in Page component
- Excerpt generation (300 words max)
- No CSS blur tricks (content doesn't reach client)
- Visitor tracking via cookie + IP+UA hash
- Quota enforcement in database transaction (prevents race conditions)

**Known Limitation:**
- Soft paywall (incognito/cookie clearing bypasses)
- By design: conversion nudge, not DRM
- For true security, consider JWT-based access tokens

### CAPTCHA (Cloudflare Turnstile)

**Protected Flows:**
- Magic link requests
- Admin login
- OAuth pre-verification

**Implementation:**
- Server-side verification only
- Test keys in development (auto-pass)
- Production keys required for deployment

**Bypass in Dev:**
- Turnstile verification skipped if `TURNSTILE_SECRET_KEY` not set and `NODE_ENV !== "production"`

### Cross-Site Scripting (XSS)

**Protections:**
- React auto-escapes all content
- `dangerouslySetInnerHTML` not used
- Article content stored as JSON (Tiptap format)
- Rendering via controlled components

**Note:** User-generated content (article bodies) should be sanitized before rendering. Consider DOMPurify or similar if raw HTML is ever allowed.

### Cross-Site Request Forgery (CSRF)

**Protections:**
- SameSite=Lax cookies
- Origin checking in NextAuth
- No state-changing GET requests
- Admin routes require separate session

### SQL Injection

**Protections:**
- Prisma ORM (parameterized queries)
- No raw SQL in application code
- Full-text search uses `@@` operator with bound parameters

### Content Security Policy (CSP)

**Current Status:** Not implemented

**Recommendation:**
```
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'unsafe-inline' challenges.cloudflare.com;
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https:;
  connect-src 'self' https://challenges.cloudflare.com;
  frame-src challenges.cloudflare.com;
```

### Secrets Management

**Environment Variables:**
- Never committed to Git
- `.env` in `.gitignore`
- Railway injects secrets securely
- Local dev uses `.env.example` template

**Secrets Rotation:**
- `NEXTAUTH_SECRET`: Rotate every 90 days
- `ADMIN_JWT_SECRET`: Rotate every 90 days
- OAuth secrets: Managed by providers
- Stripe webhook secret: Auto-rotated by Stripe on regeneration

### Image Upload Security

**Current Implementation:**
- Vercel Blob (CDN-backed object storage)
- Direct upload from client with signed URLs (recommended)
- File type validation (images only)
- Size limits enforced

**Risks:**
- User can upload any image (within size limits)
- No virus scanning (rely on Vercel's infrastructure)
- No content moderation (manual review required)

### Dependency Security

**Automated Scanning:**
- GitHub Dependabot enabled
- `npm audit` in CI (recommended)

**Current Status:**
- All dependencies are up-to-date
- No known vulnerabilities

**Policy:**
- Critical vulnerabilities: Fix within 24 hours
- High vulnerabilities: Fix within 7 days
- Medium/Low: Fix in next release cycle

### Logging and Monitoring

**Current Status:**
- Basic Prisma error logging
- No structured logging yet

**Recommendations:**
- Add structured logging (Pino, Winston)
- Log auth attempts (success and failures)
- Log admin actions
- Set up error tracking (Sentry, Rollbar)
- Monitor for suspicious patterns (multiple failed logins, etc.)

**Never Log:**
- Passwords (plain or hashed)
- Session tokens
- OAuth secrets
- Credit card data
- Full email content (only metadata)

### HTTPS/TLS

**Production:**
- Railway provides automatic HTTPS
- TLS 1.2+ enforced
- HSTS enabled

**Development:**
- HTTP only (localhost)
- Never expose dev environment publicly

### Admin Panel Security

**Access Control:**
- Separate JWT session (not NextAuth)
- 8-hour expiry
- Cookie-based (HttpOnly, Secure in prod)
- Role check: `role === "ADMIN"`
- DB verification on each request (prevents stale tokens)

**Additional Measures:**
- Turnstile on login
- No "remember me" option
- No password reset (manual DB update)
- Consider IP allowlisting for production

### Third-Party Services

| Service | Purpose | Data Shared | Security |
|---------|---------|-------------|----------|
| Railway | Hosting + Postgres | All app data | SOC 2 compliant |
| Vercel Blob | Image storage | Uploaded images | ISO 27001 |
| Resend | Email delivery | Email addresses | GDPR compliant |
| Stripe | Payments | Email, subscription data | PCI DSS Level 1 |
| Google OAuth | Authentication | Email, name, avatar | Google's security |
| GitHub OAuth | Authentication | Email, name, avatar | GitHub's security |
| Cloudflare | Turnstile CAPTCHA | IP, browser fingerprint | Cloudflare's security |

### Incident Response Plan

1. **Detection**: Monitor logs, error tracking, user reports
2. **Assessment**: Determine scope and severity
3. **Containment**: Revoke compromised tokens, block IPs, disable affected features
4. **Eradication**: Deploy fixes, rotate secrets
5. **Recovery**: Restore service, verify security
6. **Post-Mortem**: Document incident, improve security measures

### Known Limitations

1. **Soft Paywall**: Not cryptographically secure, bypassable by design
2. **No Rate Limiting**: API endpoints are not rate-limited (planned)
3. **No CAPTCHA on Reads**: Only on auth and write operations
4. **No 2FA**: Admin panel doesn't have two-factor authentication (planned)
5. **No Email Verification**: OAuth provides verified emails, magic links verify email ownership
6. **No Content Moderation**: User-generated content is not automatically moderated

### Compliance

**GDPR Considerations:**
- User data deletion: Implemented (cascading deletes)
- Data export: Not implemented (planned)
- Privacy policy: Basic template exists
- Cookie consent: Not implemented (required for EU users)

**Accessibility:**
- WCAG 2.1 AA compliance: Partial (needs audit)

---

## Security Checklist for Deployment

Before deploying to production:

- [ ] All secrets in Railway environment variables
- [ ] `.env` never committed to Git
- [ ] `NEXTAUTH_SECRET` is strong (32+ random bytes)
- [ ] `ADMIN_JWT_SECRET` is strong (32+ random bytes)
- [ ] `ADMIN_PASSWORD` is strong and changed from default
- [ ] OAuth apps configured with production URLs only
- [ ] Turnstile using production keys (not test keys)
- [ ] Database backups enabled (Railway auto-backup)
- [ ] HTTPS enforced (Railway auto-configures)
- [ ] Domain verified and SSL certificate valid
- [ ] Error tracking configured (Sentry, etc.)
- [ ] Monitoring and alerting configured
- [ ] Security headers verified (next.config.ts)
- [ ] CORS properly configured (same-origin for now)
- [ ] Admin email changed from default
- [ ] Stripe webhook endpoint configured with proper secret

---

## Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [NextAuth Security](https://next-auth.js.org/security)
- [Prisma Security](https://www.prisma.io/docs/concepts/components/prisma-client/deployment#security)
- [Stripe Security](https://stripe.com/docs/security)

---

## Contact

For security concerns: **[your-security-email]**

For general issues: [GitHub Issues](https://github.com/your-repo/techscribe/issues)
