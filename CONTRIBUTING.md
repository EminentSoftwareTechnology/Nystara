# Contributing to Nystara

Thanks for helping. This guide covers local setup, the standards we hold code
to, tests, and how pull requests are reviewed.

## Contents

- [Code of conduct](#code-of-conduct)
- [Local setup](#local-setup)
- [Workflow](#workflow)
- [Coding standards](#coding-standards)
- [Security rules](#security-rules)
- [Tests](#tests)
- [Commits](#commits)
- [Pull requests](#pull-requests)

## Code of conduct

Be respectful, give specific and constructive feedback, and assume good intent.

## Local setup

Requirements: Node 22.12+, Git, and Podman (`podman compose` or
`podman-compose`) or Docker Compose v2.

```bash
git clone https://github.com/EminentSoftwareTechnology/Nystara.git
cd Nystara
./start.sh
```

`start.sh` installs dependencies, creates `.env.local` with random secrets if
you have no env file, starts PostgreSQL (`127.0.0.1:5442`), Redis
(`127.0.0.1:6389`) and Mailpit (<http://localhost:8035>), applies migrations and
runs the app at <http://localhost:6100>. It never resets or seeds your database.

Optional seed data:

```bash
ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='a-long-unique-password' npm run db:seed
npm run db:seed:demo   # 50 users (user1@gmail.com …) and 10 stories
```

Sign in through the email link that arrives in Mailpit. New accounts must add a
display name and a passkey or authenticator app before the app opens. Passkeys
work on `localhost` in current browsers.

To work on uploads or the AI editor, add the `R2_*` or `OPENAI_*` variables to
`.env.local`. Without them those routes return 503, which is expected.

## Workflow

1. Pull the latest `main` and branch from it: `feat/…`, `fix/…`, `docs/…`,
   `refactor/…`, `perf/…` or `chore/…`.
2. Make the change, with tests.
3. Run the checks below.
4. Push and open a pull request against `main`.

## Coding standards

### General

- Solve the problem in front of you. No speculative abstractions, options or
  configuration nobody asked for.
- Keep diffs focused. Don't reformat or refactor unrelated code; mention it in the
  PR instead.
- Comments explain *why*, not what. Skip comments on self-evident code.
- Don't add error handling for paths that cannot happen.

### TypeScript

- Strict mode. **No `any`.** Use `unknown` and narrow it.
- Validate every external input (request bodies, query strings, provider
  responses) with Zod at the boundary.
- Select explicit fields in Prisma queries and responses; never return whole rows.

### Next.js and React

- This is Next.js 16. APIs differ from older versions: request interception lives
  in `proxy.ts` (not `middleware.ts`), and `params` / `searchParams` are promises.
  Check `node_modules/next/dist/docs/` when unsure (see [AGENTS.md](AGENTS.md)).
- Server Components by default; add `"use client"` only for interactivity.
- Pages that need a signed-in user wrap their content in `AppShell` or call
  `auth()` and redirect.
- Use `auth()` for normal access. `authForAccountSetup()` and
  `authIncludingPendingMfa()` exist only for the `/mfa` flow and its APIs.

### Styling

- Tailwind CSS 4 with the design tokens in `app/globals.css` (`bg-page`,
  `text-muted`, `border-border` and similar). Shared helpers are in
  `components/ui.tsx` (`buttonClass`, `INPUT`, `CARD`, `cx`).
- Check light, dark and sand themes, and phone width. Touch layouts use the
  `touch:` variant.

### Files and naming

| Kind | Convention |
| --- | --- |
| Components | `PascalCase.tsx` |
| Library modules | `kebab-case.ts` in `lib/` |
| Route handlers | `app/api/**/route.ts` |
| Tests | `tests/<area>.test.ts(x)`; database/browser tests `tests/<area>.integration.ts` |

### Database

- Change `prisma/schema.prisma`, then `npm run db:migrate -- --name <change>`.
  Commit the new folder in `prisma/migrations/`. Never edit an applied migration.
- Add indexes for new foreign keys and frequent filters.
- User-owned rows must cascade on user delete, so account erasure stays complete.
  If you add a new kind of personal data, add it to `GET /api/me/export`.
- Use a transaction for multi-step writes that must succeed together.

## Security rules

- Never commit `.env`, `.env.local`, secrets, tokens or real user data.
- Every new write route sits behind `proxy.ts` (origin check, rate limit, body
  limit). Add per-user or per-reader limits for anything costly or abusable.
- Check ownership in the handler before reading or writing private data.
- Render user content as text through React. Don't add `dangerouslySetInnerHTML`.
- Don't trust client-supplied identity, prices, roles or premium status.
- New outbound requests need a fixed host, a timeout and validated responses.
- Update [SECURITY.md](SECURITY.md) when you add or change a control, and
  [API.md](API.md) when you add or change an endpoint.

## Tests

Run these before pushing:

```bash
npm run lint
npm run typecheck
npm test
```

Integration tests need disposable databases. They create and drop data, so never
point them at a database you care about:

```bash
TEST_DATABASE_URL=postgresql://… TEST_REDIS_URL=redis://… npm run test:integration
```

| File | Covers |
| --- | --- |
| `tests/security.test.ts` | Origin/CSRF checks, body limits, rate limiter, proxy IP trust, admin tokens, reader identity, bcrypt limits, CSP, content limits, production fail-closed rules |
| `tests/mfa.test.ts` | TOTP encryption and replay protection, recovery codes, WebAuthn payload validation, safe redirects |
| `tests/story.test.tsx` | Story document validation and rendering, R2 and video URL rules, premium access, AI output parsing |
| `tests/engagement.test.ts` | Image pipeline (resize, metadata, corrupt files), ClamAV, guest comment names and delete rights, story theme fallback |
| `tests/reader-ui.test.tsx` | Editor ribbon, share bar and trending rail rendering |
| `tests/r2.test.ts` | Account image erasure across pages and partial failures |
| `tests/nav.test.ts` | Navigation sections, active-link matching, per-account browser drafts |
| `tests/auth-adapter.test.ts` | Stale session deletion |
| `tests/launcher.test.ts` | `start.sh` dotenv handling and port selection |
| `tests/security.integration.ts` | Real PostgreSQL/Redis: authorisation, CSRF, mass assignment, export paging, admin token revocation, paywall concurrency, erasure, retention cleanup, shared Redis limits, migrations, and a browser publish under the production CSP |

CI (`.github/workflows/security.yml`) runs on every pull request: install,
Prisma generate, lint, typecheck, unit tests, `npm audit --audit-level=moderate`,
migrations, production build and integration tests. A pull request must pass CI
before it is merged.

For UI changes, also check by hand: phone and desktop widths, all themes,
keyboard navigation, and no console errors.

## Commits

We use [Conventional Commits](https://www.conventionalcommits.org/):

```text
<type>(<optional scope>): <subject>

<body: what changed and why>
```

Types: `feat`, `fix`, `refactor`, `perf`, `docs`, `test`, `chore`.

- Imperative mood ("add", not "added"), lowercase subject, no full stop.
- Subject under about 70 characters.
- Sign your commits; don't skip hooks with `--no-verify`.
- Stage specific files rather than `git add .`.

## Pull requests

- Title in commit format, for example `feat(editor): add table support`.
- Fill in the [pull request template](.github/pull_request_template.md): what
  changed, why, how you tested, and any migration or environment changes.
- Include screenshots for UI changes.
- Keep the branch up to date with `main` and resolve conflicts on your branch.
- A maintainer reviews and merges. Delete the branch afterwards.

By contributing, you agree that your contributions are licensed under the same
terms as the project.
