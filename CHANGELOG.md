# Changelog

All notable changes to Nystara will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Article hero header, share bar (Facebook, LinkedIn, X, Instagram, Discord, copy link) and a go-to-top button
- Comments from members and named guests (Turnstile-verified), with one level of replies and author moderation
- Like/dislike and 1–5 star ratings for members and anonymous readers
- "What's trending" (48-hour reads, likes and comments) and "Most viewed today" sidebar on article pages
- Open Graph and Twitter card metadata for article links
- Word-style editor ribbon (Home, Insert, Design) with a styles gallery and six document themes saved per story
- Image uploads are virus-scanned with ClamAV when `CLAMAV_HOST` is set, decoded, stripped of metadata, resized and stored in R2 as WebP
- Passkeys (WebAuthn) for passwordless sign-in and as a second factor, for readers and admins
- Authenticator-app (TOTP) two-step verification with single-use recovery codes
- `/me/security` and `/admin/security` settings pages, and a `/mfa` sign-in challenge
- Nystara design system across the admin console
- Comprehensive documentation (API.md, CONTRIBUTING.md, SECURITY.md)
- Environment variable validation utility
- Admin panel with user and article management
- Cloudflare Turnstile bot protection on auth flows
- OAuth pre-verification for Google and GitHub
- Server-side paywall enforcement with 5 free articles per 30 days
- Article CRUD with Zod validation
- Member-only article support

### Changed
- Every article read is now recorded for trending; the members-only paywall quota counts only members-only reads, as before
- Renamed the project from TechScribe to Nystara (package, docs, Docker, JWT audiences, email sender)
- Upgraded nodemailer to 10.2.1 (fixes GHSA-c7w3-x93f-qmm8 and 16 related advisories); `npm audit` reports 0 vulnerabilities
- Updated documentation with cross-references
- Improved type safety across API routes

### Security
- HttpOnly, Secure cookies for sessions
- Separate admin JWT authentication
- bcrypt password hashing for admin accounts
- Server-side paywall (content never sent to unauthorized clients)

## [0.1.0] - 2026-05-07

### Added
- Initial release
- Next.js 16 with App Router
- PostgreSQL database with Prisma ORM
- NextAuth v5 authentication (Google, GitHub, Magic Link)
- Article publishing with rich text editor
- User profiles with username routing
- Tag-based article filtering
- Article claps and bookmarks
- Threaded comments
- User following system
- Stripe subscription model
- Admin panel for user and content management
- Health check endpoint
- Docker and Docker Compose support
- Railway deployment configuration

### Technical
- TypeScript strict mode (no `any` types)
- Tailwind CSS 4 for styling
- Prisma 7 with PostgreSQL adapter
- Zod validation on all API routes
- Cursor-based pagination
- Full-text search with tsvector (PostgreSQL)
- Server-side rendering for SEO
- ISR caching with 60s TTL

### Infrastructure
- Docker multi-stage build
- Railway deployment via Dockerfile
- Automatic database migrations on startup
- Environment variable management
- Health check endpoint for monitoring

---

## Version History

- **0.1.0** (2026-05-07): Initial release with core features
