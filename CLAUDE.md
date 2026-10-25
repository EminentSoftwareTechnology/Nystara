# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:

- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:

- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:

- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:

- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:

```text
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

---

## Project context: Nystara

Long-form blogging platform. One Next.js 16 app (App Router, React 19,
TypeScript strict), PostgreSQL 16 via Prisma 7, Redis for rate limits. Read
[ARCHITECTURE.md](ARCHITECTURE.md) before changing auth, the paywall, uploads or
the request pipeline, and [AGENTS.md](AGENTS.md) for Next.js 16 differences.

### Commands

- Run locally: `./start.sh` (app on port 6100, PostgreSQL 5442, Redis 6389,
  Mailpit 8035).
- Verify a change: `npm run lint && npm run typecheck && npm test`.
- Integration tests need disposable `TEST_DATABASE_URL` and `TEST_REDIS_URL`.
- Schema change: edit `prisma/schema.prisma`, then `npm run db:migrate -- --name <change>`.

### Rules specific to this codebase

- Request interception is `proxy.ts` (not `middleware.ts`). It enforces
  same-origin writes, rate limits, the 1 MiB body limit and the CSP nonce for
  everything under it; don't duplicate those checks in handlers.
- Use `auth()` for signed-in access. It returns null until the account has a
  display name and a second factor, and the session has passed MFA. Only the
  `/mfa` flow uses `authForAccountSetup()` or `authIncludingPendingMfa()`.
- Admin routes use `getVerifiedAdminSession()` (JWT plus database version check),
  never the reader session.
- Validate request bodies with Zod and read them with `readJson()` from
  `lib/request.ts`.
- Story content must pass `articleContent` (`lib/article-schema.ts`). Render it
  only through `StoryContent`; never use `dangerouslySetInnerHTML`.
- New personal data must cascade on user delete and appear in `GET /api/me/export`.
- When you add or change an endpoint or control, update `API.md` and
  `SECURITY.md` in the same change.
