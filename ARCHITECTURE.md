# Nystara — Medium-like Technical Publishing Platform

> A freemium article platform for technical writers. Free reading up to a monthly limit, premium for unlimited access, writer monetization, email digest, and social sharing.

## 📚 Related Documentation

- **[README.md](README.md)** — Quick start and deployment guide
- **[API.md](API.md)** — Complete API reference
- **[CONTRIBUTING.md](CONTRIBUTING.md)** — Contribution guidelines
- **[SECURITY.md](SECURITY.md)** — Security policy and best practices

## 📋 Table of Contents

1. [Product Vision](#1-product-vision)
2. [Core Features](#2-core-features-mvp--paid)
3. [High-Level Design](#3-high-level-design-hld)
4. [Tech Stack](#4-tech-stack-chosen)
5. [Low-Level Design](#5-low-level-design-lld)

---

## 1. Product Vision

| Pillar           | Description                                                                                    |
| ---------------- | ---------------------------------------------------------------------------------------------- |
| **Content**      | Long-form technical articles (tutorials, deep-dives, opinions)                                 |
| **Discovery**    | Tags, topics, search, personalised feed                                                        |
| **Monetization** | 5 free articles/month → $7/mo or $60/yr for unlimited                                          |
| **Writers**      | Revenue share based on member read-time (Phase 3, after fraud/tax/Stripe Connect are designed) |
| **Growth**       | Email digest, social share cards, SEO-first SSR                                                |

---

## 2. Core Features (MVP → Paid)

### Phase 1 — Free (MVP)

- [ ] Sign up / sign in (Google OAuth, GitHub OAuth, magic-link email)
- [ ] Article CRUD with rich text editor (Tiptap)
- [ ] Tags and topics
- [ ] Public reader feed (home, topic pages)
- [ ] Claps / reactions (auth required — anonymous claps deferred to avoid schema split)
- [ ] Comments (auth required)
- [ ] Bookmarks / reading list
- [ ] Author profiles
- [ ] SEO — per-article OG tags, sitemap, JSON-LD

### Phase 2 — Freemium Gate

- [ ] Soft paywall: 5 free member-only articles per visitor/month (cookie + DB tracking — easy to bypass, acceptable for conversion nudge only, not revenue protection)
- [ ] Stripe subscription (monthly + annual plans)
- [ ] Member-only article badge
- [ ] Writer read-time tracking (internal only — no revenue promises until Phase 3 is fully designed)

### Phase 3 — Writer Monetization (deferred)

- [ ] Stripe Connect for writer payouts
- [ ] Fraud detection + read-session deduplication + bot filtering
- [ ] Tax / KYC compliance
- [ ] Writer earnings dashboard
- [ ] Revenue share payout logic

### Phase 4 — Growth

- [ ] Weekly email digest (personalised by followed topics)
- [ ] Auto-generated social share card (OG image via `@vercel/og`)
- [ ] Social share via share intents (X, LinkedIn, Reddit, HN, native Web Share API) — no direct posting API
- [ ] Newsletter subscription per writer
- [ ] Publication (multi-writer channel)

---

## 3. High-Level Design (HLD)

```text
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT (Browser)                         │
│   Next.js 16 App Router · React 19 · TypeScript · Tailwind CSS  │
└──────────────────────────────┬──────────────────────────────────┘
                               │  HTTPS
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    VERCEL EDGE / SERVER                          │
│                                                                  │
│  ┌─────────────────┐   ┌──────────────────┐  ┌───────────────┐  │
│  │  Next.js Pages  │   │  API Routes      │  │  Middleware   │  │
│  │  (SSR / SSG)    │   │  /api/**         │  │  (auth check  │  │
│  │  · Home feed    │   │  · Auth          │  │   + paywall)  │  │
│  │  · Article page │   │  · Articles      │  └───────────────┘  │
│  │  · Profile      │   │  · Subscriptions │                     │
│  │  · Editor       │   │  · Payments      │                     │
│  └─────────────────┘   └──────────────────┘                     │
└──────────┬──────────────────────┬───────────────────────────────┘
           │                      │
     ┌─────▼──────┐        ┌──────▼───────────┐
     │  Vercel    │        │   External SaaS  │
     │  Blob      │        │                  │
     │  (images)  │        │  Resend (email)  │
     └────────────┘        │  Stripe (pay)    │
                           │  Google/GitHub   │
                           │  OAuth           │
                           └──────────────────┘
                                    │
                    ┌───────────────▼───────────────┐
                    │   Railway — PostgreSQL 16      │
                    │   (primary data store)         │
                    └───────────────────────────────┘
```

### Data flow — Article read (critical path)

```text
Browser → Vercel CDN (cached HTML, ISR 60s)
       → On cache miss: Next.js SSR → Prisma → PostgreSQL
       → Middleware checks: is article member-only?
            └── No  → render full
            └── Yes → check session + subscription
                          └── Active → render full
                          └── None  → render excerpt only (first ~300 words)
                                       + paywall CTA component
                                       (full body is NEVER sent to unauthorized clients)
```

> **Paywall enforcement:** Member-only content is gated server-side. The full article body is not rendered into the HTML for unauthorized requests — only a plain-text excerpt is returned. CSS/blur tricks are not used for revenue-critical content.

---

## 4. Tech Stack (Chosen)

| Layer       | Choice                                         | Why                                  |
| ----------- | ---------------------------------------------- | ------------------------------------ |
| Framework   | **Next.js 16** (App Router)                    | SSR for SEO + API routes in one repo |
| Language    | **TypeScript** strict mode                     | Type safety, no `any`                |
| Styling     | **Tailwind CSS 4**                             | Utility-first, no CSS files          |
| ORM         | **Prisma 7**                                   | Type-safe queries, great DX          |
| Database    | **PostgreSQL 16** on Railway                   | Reliable, free tier for dev          |
| Auth        | **NextAuth.js v5** (Auth.js)                   | Google, GitHub, email magic-link     |
| Editor      | **Tiptap 2**                                   | Headless rich text (ProseMirror)     |
| Payments    | **Stripe**                                     | Subscriptions + webhooks             |
| Email       | **Resend** + **React Email**                   | Transactional + digest templates     |
| Image store | **Vercel Blob**                                | One-line SDK, CDN included           |
| OG Images   | **@vercel/og**                                 | Dynamic article share cards          |
| Validation  | **Zod**                                        | Schema validation on all API inputs  |
| State       | **Zustand** (editor UI only)                   | No global state needed elsewhere     |
| Hosting     | **Vercel** (frontend + API) + **Railway** (DB) | Zero DevOps                          |

**Not included (keep simple):** Redis, message queues, separate microservices, GraphQL.

---

## 5. Low-Level Design (LLD)

### 5.1 Folder Structure

```text
nystara/
├── app/                        # Next.js App Router
│   ├── (public)/               # Route group — no auth
│   │   ├── page.tsx            # Home feed
│   │   ├── [username]/         # Author profile
│   │   ├── [username]/[slug]/  # Article page
│   │   └── tag/[tag]/          # Topic feed
│   ├── (auth)/                 # Route group — requires session
│   │   ├── new/                # Editor — create article
│   │   ├── [username]/[slug]/edit/ # Editor — edit article
│   │   ├── dashboard/          # Writer stats
│   │   └── settings/           # Profile + subscription
│   ├── api/
│   │   ├── auth/[...nextauth]/ # NextAuth handler
│   │   ├── articles/           # CRUD
│   │   ├── claps/              # Clap endpoint
│   │   ├── comments/           # Comments
│   │   ├── subscriptions/      # Stripe subscription management
│   │   ├── webhooks/stripe/    # Stripe webhook handler
│   │   └── og/                 # Dynamic OG image generation
│   └── layout.tsx
├── components/
│   ├── editor/                 # Tiptap editor components
│   ├── article/                # ArticleCard, ArticleBody, PaywallCTA
│   ├── auth/                   # LoginModal, SignupModal
│   └── ui/                     # Button, Input, Avatar, etc.
├── lib/
│   ├── prisma.ts               # Prisma client singleton
│   ├── auth.ts                 # NextAuth config
│   ├── stripe.ts               # Stripe client
│   ├── resend.ts               # Resend client
│   └── paywall.ts              # Metered access logic
├── emails/                     # React Email templates
│   ├── MagicLink.tsx
│   ├── WeeklyDigest.tsx
│   └── WelcomeEmail.tsx
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
└── middleware.ts               # Edge middleware for auth + paywall
```

---

### 5.2 Database Schema (Prisma)

```prisma
// prisma/schema.prisma

model User {
  id            String    @id @default(cuid())
  email         String    @unique
  name          String?
  username      String    @unique
  bio           String?
  avatarUrl     String?
  createdAt     DateTime  @default(now())

  // Auth
  accounts      Account[]
  sessions      Session[]

  // Content
  articles      Article[]
  comments      Comment[]
  claps         Clap[]
  bookmarks     Bookmark[]

  // Social
  following     Follow[]  @relation("follower")
  followers     Follow[]  @relation("following")

  // Monetization
  subscription  Subscription?
  stripeCustomerId String? @unique
  // earnings added in Phase 3 when Stripe Connect + fraud detection are ready
}

model Article {
  id            String    @id @default(cuid())
  slug          String
  title         String
  subtitle      String?
  coverImage    String?
  content       Json      // Tiptap JSON document
  contentText   String    // Plain text for search / read-time
  readTime      Int       // minutes, computed on save
  published     Boolean   @default(false)
  memberOnly    Boolean   @default(false)
  publishedAt   DateTime?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  authorId      String
  author        User      @relation(fields: [authorId], references: [id])

  tags          ArticleTag[]
  comments      Comment[]
  claps         Clap[]
  bookmarks     Bookmark[]
  views         ArticleView[]

  @@unique([authorId, slug])  // /alice/react-hooks and /bob/react-hooks can coexist
}

model Tag {
  id       String       @id @default(cuid())
  name     String       @unique
  slug     String       @unique
  articles ArticleTag[]
}

model ArticleTag {
  articleId String
  tagId     String
  article   Article @relation(fields: [articleId], references: [id])
  tag       Tag     @relation(fields: [tagId], references: [id])
  @@id([articleId, tagId])
}

model Comment {
  id        String   @id @default(cuid())
  body      String
  createdAt DateTime @default(now())
  deletedAt DateTime?  // soft delete — never hard delete comments
  authorId  String
  articleId String
  author    User    @relation(fields: [authorId], references: [id])
  article   Article @relation(fields: [articleId], references: [id])
  parentId  String?
  parent    Comment? @relation("replies", fields: [parentId], references: [id])
  replies   Comment[] @relation("replies")
}

model Clap {
  userId    String
  articleId String
  count     Int      @default(1) // up to 50 per user
  user      User    @relation(fields: [userId], references: [id])
  article   Article @relation(fields: [articleId], references: [id])
  @@id([userId, articleId])
}

model Bookmark {
  userId    String
  articleId String
  createdAt DateTime @default(now())
  user      User    @relation(fields: [userId], references: [id])
  article   Article @relation(fields: [articleId], references: [id])
  @@id([userId, articleId])
}

model Follow {
  followerId  String
  followingId String
  createdAt   DateTime @default(now())
  follower    User @relation("follower", fields: [followerId], references: [id])
  following   User @relation("following", fields: [followingId], references: [id])
  @@id([followerId, followingId])
}

model ArticleView {
  id        String   @id @default(cuid())
  articleId String
  visitorId String   // anonymous cookie ID or userId
  createdAt DateTime @default(now())
  article   Article @relation(fields: [articleId], references: [id])
  @@index([visitorId, createdAt])
}

model Subscription {
  id                   String    @id @default(cuid())
  userId               String    @unique
  stripeSubscriptionId String    @unique
  stripePriceId        String
  status               SubStatus
  currentPeriodEnd     DateTime
  cancelAtPeriodEnd    Boolean   @default(false)
  user                 User      @relation(fields: [userId], references: [id])
}

enum SubStatus {
  ACTIVE
  PAST_DUE
  CANCELED
  TRIALING
}

// NextAuth required tables
model Account { ... }
model Session { ... }
model VerificationToken { ... }
```

> **Search:** `contentText` carries a GIN-indexed `tsvector` column added via a raw migration alongside the Prisma schema. Add this before first deploy — retrofitting it on a populated table is a larger migration.

```sql
-- migration: add full-text search index
ALTER TABLE "Article" ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (to_tsvector('english', coalesce(title, '') || ' ' || coalesce("contentText", ''))) STORED;
CREATE INDEX article_search_idx ON "Article" USING GIN(search_vector);
```

---

### 5.3 Implemented API Routes

| Method | Route                        | Auth      | Description                 |
| ------ | ---------------------------- | --------- | --------------------------- |
| GET    | `/api/articles?tag=&cursor=` | —         | Paginated feed              |
| POST   | `/api/articles`              | required  | Create draft                |
| PATCH  | `/api/articles/[id]`         | author    | Update article              |
| DELETE | `/api/articles/[id]`         | author    | Delete                      |
| POST   | `/api/articles/[id]/publish` | author    | Publish / unpublish         |
| POST   | `/api/auth/magic-link`       | Turnstile | Request email sign-in       |
| POST   | `/api/auth/oauth-turnstile`  | Turnstile | Pre-authorize OAuth sign-in |
| GET    | `/api/admin/me`              | admin     | Current admin profile       |
| GET    | `/api/admin/users`           | admin     | List users                  |
| GET    | `/api/admin/users/[id]`      | admin     | User detail                 |
| PATCH  | `/api/admin/users/[id]`      | admin     | Update user                 |
| DELETE | `/api/admin/users/[id]`      | admin     | Delete user                 |
| GET    | `/api/admin/articles`        | admin     | List articles               |
| POST   | `/api/admin/articles`        | admin     | Create article              |
| GET    | `/api/admin/articles/[id]`   | admin     | Article detail              |
| PATCH  | `/api/admin/articles/[id]`   | admin     | Update article              |
| DELETE | `/api/admin/articles/[id]`   | admin     | Delete article              |
| GET    | `/api/health`                | —         | Health check                |

Planned routes include claps, comments, Stripe checkout and portal endpoints,
Stripe webhooks, and dynamic OG images.

---

### 5.4 Paywall Logic

```text
lib/paywall.ts

FREE_LIMIT = 5 articles / 30-day rolling window per visitorId

isAllowed(visitorId, articleId):
  1. Article not memberOnly → allow (return full content)
  2. User has ACTIVE subscription → allow (return full content)
  3. Count ArticleView where visitorId = X, createdAt >= 30 days ago
     └── count < FREE_LIMIT → allow + record view (return full content)
     └── count >= FREE_LIMIT → deny (return excerpt only, ~300 words)

Server-side excerpt generation:
  - Slice contentText to first ~300 words
  - Return PaywallCTA component (not a CSS overlay)
  - Full Tiptap JSON is never serialized into the page for denied requests
```

> **Soft paywall caveat:** Cookie/visitorId counting is easily bypassed (incognito, cleared cookies). This is intentional for MVP — it's a conversion nudge, not DRM. Do not market it as hard access control.

---

### 5.5 Auth Setup (NextAuth v5)

```typescript
// lib/auth.ts
providers: [
  Google({ clientId, clientSecret }),
  GitHub({ clientId, clientSecret }),
  Resend({ apiKey, from: "noreply@nystara.com" }), // magic link
];
adapter: PrismaAdapter(prisma);
```

---

### 5.6 Email System (Resend + React Email)

| Email                | Trigger                     | Template            |
| -------------------- | --------------------------- | ------------------- |
| Magic link           | Auth                        | `MagicLink.tsx`     |
| Welcome              | First sign-up               | `WelcomeEmail.tsx`  |
| Weekly digest        | Cron every Monday 08:00 UTC | `WeeklyDigest.tsx`  |
| New follower         | Follow event                | `NewFollower.tsx`   |
| New comment          | Comment on your article     | `NewComment.tsx`    |
| Subscription receipt | Stripe `invoice.paid`       | Stripe-native email |

**Weekly digest cron** (Vercel cron job, `vercel.json`):

```json
{
  "crons": [{ "path": "/api/cron/digest", "schedule": "0 8 * * 1" }]
}
```

The digest endpoint:

1. Query top 10 articles published in last 7 days by clap count
2. For each subscriber, filter by their followed tags
3. Batch-send via `resend.batch.send()`

> **Scale note:** A single cron call will hit Vercel's function timeout as subscriber count grows. At that point, switch to cursor-paginated batches with a checkpoint in the DB. For MVP this is acceptable.

---

### 5.7 Rich Text Editor (Tiptap)

Extensions enabled:

- `StarterKit` (headings, bold, italic, lists, code, blockquote, hr)
- `Image` (upload → Vercel Blob → insert URL)
- `CodeBlockLowlight` (syntax highlighting via lowlight)
- `Link`
- `Placeholder`
- `CharacterCount`
- `Youtube` (embed by pasting URL)

On save: store Tiptap JSON in `Article.content`, extract plaintext for `Article.contentText` and compute `readTime = Math.ceil(wordCount / 200)`.

> **Autosave:** Implement debounced autosave (every 30s) from the start. Editor data loss is one of the fastest ways to lose writers.

---

### 5.8 Social Share (Share Intents — No API Posting)

Share buttons open native share URLs. No OAuth, no API keys, no policy surface.

```typescript
const shareUrls = {
  x: `https://x.com/intent/tweet?url=${url}&text=${title}`,
  linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${url}`,
  reddit: `https://reddit.com/submit?url=${url}&title=${title}`,
  hn: `https://news.ycombinator.com/submitlink?u=${url}&t=${title}`,
};
// Also: navigator.share() for mobile Web Share API
```

> Direct social API posting (posting on behalf of users) is not planned. X API pricing is volatile and the OAuth review/token-refresh maintenance cost is high for the return at MVP scale.

---

### 5.9 Planned Social Share Cards (OG Images)

```typescript
// app/api/og/route.tsx  (@vercel/og)
export function GET(request: Request) {
  const { title, author, coverImage } = parse(request.url)
  return new ImageResponse(
    <OgCard title={title} author={author} coverImage={coverImage} />,
    { width: 1200, height: 630 }
  )
}
```

Per-article meta:

```typescript
// app/(public)/[username]/[slug]/page.tsx
export async function generateMetadata({ params }) {
  return {
    openGraph: {
      images: [`/api/og?title=${title}&author=${username}`],
    },
  };
}
```

---

## 6. Freemium Monetization Model

```text
Free tier
  └── 5 member-only articles / 30 days (soft paywall — bypass-able by design)
  └── Unlimited free (non-paywalled) articles
  └── Can write + publish (free articles)

Premium — $7/mo or $60/yr
  └── Unlimited reading
  └── Publish member-only articles
  └── Read-time tracked internally for future revenue share

Writer earnings (Phase 3 — not before fraud + Stripe Connect + KYC are ready)
  └── Pool = 70% of subscription revenue
  └── Share = writer's member read-time / total member read-time
  └── Paid out monthly via Stripe Connect
```

---

## 7. Deployment Architecture

### Vercel (Frontend + API)

- Framework preset: Next.js
- Environment variables: `DATABASE_URL`, `NEXTAUTH_SECRET`, `STRIPE_SECRET_KEY`, `RESEND_API_KEY`, `BLOB_READ_WRITE_TOKEN`, `GOOGLE_CLIENT_ID/SECRET`, `GITHUB_CLIENT_ID/SECRET`
- Cron jobs: configured in `vercel.json`
- Preview deployments: automatic on every PR

### Railway (PostgreSQL)

- PostgreSQL 16 service
- Connection pooling: PgBouncer (Railway add-on)
- `DATABASE_URL` from Railway → Vercel env

### Cost estimate (early stage, < 10k MAU)

| Service         | Plan                             | Cost       |
| --------------- | -------------------------------- | ---------- |
| Vercel Hobby    | Free (100GB bandwidth)           | $0         |
| Railway         | Hobby (usage-based, $5/mo floor) | ~$5/mo     |
| Resend          | Free (3,000 emails/mo)           | $0         |
| Stripe          | 2.9% + $0.30 per transaction     | per-use    |
| Vercel Blob     | Free (1GB included on Hobby)     | $0         |
| **Total fixed** |                                  | **~$5/mo** |

> Vercel Blob Hobby includes 1 GB, not 5 GB. Railway Hobby is usage-based with a $5/mo floor, not a flat free tier.

---

## 8. Implementation Phases & Milestones

### Sprint 1 (Week 1–2) — Skeleton

- [ ] `npx create-next-app@latest` with TypeScript + Tailwind + App Router
- [ ] Prisma schema + Railway PostgreSQL connected
- [ ] GIN/tsvector migration added alongside initial schema
- [ ] NextAuth (Google + GitHub + magic-link)
- [ ] Basic article CRUD + slug generation (scoped per author)
- [ ] Home feed SSR page

### Sprint 2 (Week 3–4) — Core Reading Experience

- [ ] Article page with SSR + OG meta
- [ ] Tiptap editor with autosave
- [ ] Tags + topic pages
- [ ] Claps (auth required) + Comments with soft delete
- [ ] Author profile page

### Sprint 3 (Week 5–6) — Freemium

- [ ] Stripe subscription checkout + webhook
- [ ] Server-side paywall (excerpt-only for unauthorized, never CSS overlay)
- [ ] Member-only article toggle
- [ ] Subscription settings page

### Sprint 4 (Week 7–8) — Growth

- [ ] Weekly digest email (Resend + React Email, batched)
- [ ] Dynamic OG images
- [ ] Social share buttons (intents only)
- [ ] Search (Postgres FTS via pre-added tsvector column)
- [ ] Sitemap + robots.txt

---

## 9. Key Technical Decisions & Trade-offs

| Decision             | Choice                      | Alternative               | Reason                                                                           |
| -------------------- | --------------------------- | ------------------------- | -------------------------------------------------------------------------------- |
| Full-stack framework | Next.js (monorepo)          | Separate Express/.NET API | Fewer repos, Vercel-native, SSR for SEO; no separate service needed at MVP       |
| DB                   | PostgreSQL                  | PlanetScale/MySQL         | Full-text search, JSON columns, Railway free tier                                |
| Auth                 | NextAuth v5                 | Clerk / Supabase Auth     | No vendor lock-in, free, Prisma adapter                                          |
| Search               | Postgres FTS (tsvector/GIN) | Algolia/Meilisearch       | Zero extra cost for MVP; GIN index added at schema creation, not bolted on later |
| Payments             | Stripe                      | Paddle                    | Industry standard, best webhook DX                                               |
| Email                | Resend                      | SendGrid                  | Better DX, React Email templates, generous free tier                             |
| OG Images            | @vercel/og                  | Puppeteer                 | Edge-native, zero cold start, free                                               |
| Social sharing       | Share intents               | Direct posting APIs       | No OAuth review, no API pricing risk, no token management                        |
| Paywall              | Server-side excerpt         | CSS/blur overlay          | Full content must never reach unauthorized clients                               |

---

## 10. Security Checklist

- [ ] `NEXTAUTH_SECRET` rotated per environment
- [ ] Stripe webhook signature verified (`stripe.webhooks.constructEvent`)
- [ ] Stripe webhook handler is idempotent (deduplicate by `event.id`)
- [ ] All API mutation routes validate session + ownership (author check)
- [ ] Zod validation on every API input (no trusting req.body shapes)
- [ ] Rate limiting on `/api/claps`, `/api/comments`, `/api/auth` (Vercel Edge `@upstash/ratelimit` or simple DB counter)
- [ ] No secrets in client bundles — all Stripe/Resend calls server-side only
- [ ] `Content-Security-Policy` header via `next.config.ts`
- [ ] Image uploads restricted to `image/jpeg,image/png,image/webp`, max 5MB, dimensions validated server-side
- [ ] CSRF: Next.js App Router Server Actions include CSRF protection by default; verify for any custom API routes using POST with cookies
- [ ] Email unsubscribe link included in all digest/notification emails (CAN-SPAM / GDPR compliance)
- [ ] Admin and billing actions logged to an audit table (userId, action, metadata, timestamp)

---

## 11. Future Enhancements (Post-MVP)

- Full-text search upgrade → Meilisearch or Typesense on Railway
- Writer newsletter (per-author subscriber list via Resend Audiences)
- Publications (multi-author channels)
- Mobile app (React Native / Expo sharing types with web)
- Stripe Connect for writer payouts (with fraud detection, KYC, deduplication)
- AI-assisted writing (Claude API for title suggestions, readability score)
- Offline PWA support for premium readers
- Weekly digest batching with DB checkpointing for scale

---

Architecture version: 1.1 — May 2026
