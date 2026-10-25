# API reference

Every HTTP endpoint under `app/api/`. All bodies are JSON unless noted. For how
the pieces fit together, see [ARCHITECTURE.md](ARCHITECTURE.md).

## Contents

- [Conventions](#conventions)
- [Health](#health)
- [Articles](#articles)
- [Comments, reactions and ratings](#comments-reactions-and-ratings)
- [Media and video](#media-and-video)
- [AI editor](#ai-editor)
- [Library](#library)
- [Following writers and topics](#following-writers-and-topics)
- [Reader sign-in](#reader-sign-in)
- [Digest subscriptions](#digest-subscriptions)
- [Account](#account)
- [Security settings (MFA)](#security-settings-mfa)
- [Admin](#admin)
- [Errors](#errors)

---

## Conventions

### Authentication

| Caller | Credential | Notes |
| --- | --- | --- |
| Reader or writer | Auth.js database session cookie: `authjs.session-token`, or `__Secure-authjs.session-token` when `NEXTAUTH_URL` is HTTPS | A session that still owes a second factor, or whose account has no display name or no second factor, is treated as signed out except where noted |
| Anonymous reader | `reader_session` cookie (signed, 30 days), set on article pages | Used only by comments and feedback |
| Admin | `admin_session` cookie (HS256 JWT, 8 hours, `SameSite=Strict`) | Checked against the database on every request |

Below, **session** means a fully set-up reader session, **setup session** means
signed in and MFA-verified but possibly without a name or second factor yet, and
**admin** means a valid admin session.

### Rules applied by `proxy.ts` to every API request

- **Same-origin writes.** POST, PUT, PATCH and DELETE need an `Origin` header
  equal to the origin of `NEXTAUTH_URL`, and `Sec-Fetch-Site` must not be
  `cross-site`. Otherwise `403 { "error": "Forbidden" }`. Requests without
  `Origin` are rejected.
- **Rate limits** per client IP per minute: 10 for credential endpoints (marked
  🔒 below), 60 for other writes, 300 for reads. Over the limit:
  `429 { "error": "Too many requests" }` with `Retry-After` in seconds.
- **Body size.** Write bodies over 1 MiB return `413`; bodies that take more than
  10 seconds to arrive return `408`; unreadable bodies return `400`.
- **Caching.** Every API response has `Cache-Control: private, no-store`.
- `GET /api/health` is exempt from all of the above.

Per-route limits (for example uploads per day) are listed with each route. In
production the limiter needs Redis; if Redis is unavailable, limited requests are
denied.

### Pagination

- Public feed: cursor-based. Pass the previous response's `nextCursor` as
  `cursor`. `null` means the end.
- Admin lists: page-based, `page` from 1 to 1000, 20 per page.
- Export: follow each section's `next` URL until it is `null`.

---

## Health

### `GET /api/health`

`200 { "status": "ok" }`. Liveness only: it does not touch the database or Redis.

---

## Articles

### `GET /api/articles`

Published stories, newest first, 20 per page. No authentication.

| Query | Description |
| --- | --- |
| `tag` | Tag slug filter |
| `cursor` | Article id from the previous `nextCursor` |

```json
{
  "articles": [
    {
      "id": "cm…",
      "slug": "my-story-0b7c…",
      "title": "My story",
      "subtitle": "Optional",
      "coverImage": "https://…" ,
      "readTime": 5,
      "memberOnly": false,
      "publishedAt": "2026-10-25T12:00:00.000Z",
      "author": { "username": "writer-…", "name": "Maya", "avatarUrl": null },
      "tags": [{ "tag": { "name": "typescript", "slug": "typescript" } }],
      "_count": { "claps": 4, "comments": 2 }
    }
  ],
  "nextCursor": "cm…"
}
```

### `POST /api/articles`

Create a draft. **Session.**

```json
{
  "title": "My story",
  "subtitle": "Optional, up to 500 characters",
  "coverImage": "https://media.example.com/stories/…/….webp",
  "content": { "type": "doc", "content": [] },
  "contentText": "Plain text fallback",
  "memberOnly": false,
  "theme": "classic",
  "tagSlugs": ["typescript", "next js"]
}
```

| Field | Rules |
| --- | --- |
| `title` | 1–250 characters, required |
| `subtitle` | up to 500 characters |
| `coverImage` | HTTPS, no credentials or port; host must be the R2 public URL (`/stories/` path), `lh3.googleusercontent.com`, `avatars.githubusercontent.com` or `*.public.blob.vercel-storage.com`; or `null` |
| `content` | Object. If it is a Tiptap `doc`, it must pass the story document allow-list (nodes, marks, 5,000 nodes, depth 20, 100,000 text characters, images only from R2, safe video thumbnails) |
| `contentText` | up to 100,000 characters. Ignored when `content` is a valid document: the server derives the text itself |
| `memberOnly` | boolean, default `false` |
| `theme` | `classic`, `modern`, `editorial`, `elegant`, `bold` or `technical`; default `classic` |
| `tagSlugs` | up to 5; each lowercased and turned into kebab-case; duplicates dropped; missing tags are created |

`readTime` is words / 200, rounded up, at least 1. The slug is the slugified
title plus a random UUID.

`201 { "id", "slug", "author": { "username" } }`. Errors: `401`, `400` (Zod
`flatten()` output in `error`).

### `PATCH /api/articles/{id}`

Update your own article. **Session**, author only. All fields optional:
`title`, `subtitle` (nullable), `content`, `contentText`, `memberOnly`, `theme`,
`coverImage` (nullable), with the same rules as create. Publication state, author
and slug cannot be changed here.

`200 { "id", "slug", "updatedAt" }`. Errors: `401`, `403`, `404`, `400`.

### `DELETE /api/articles/{id}`

**Session**, author only. Deletes the article and everything attached to it.
`204`. Errors: `401`, `403`, `404`.

### `POST /api/articles/{id}/publish`

**Session**, author only. Body optional: `{ "published": true }` (default) or
`{ "published": false }`. Idempotent. Publishing keeps an existing `publishedAt`
or sets it to now; unpublishing clears it.

`200 { "id", "published", "publishedAt" }`. Errors: `401`, `403`, `404`, `400`.

### `POST /api/articles/{id}/status`

**Session**, author only. Moves a story between the Stories tabs.

```json
{ "action": "schedule", "scheduledAt": "2026-11-01T09:00:00.000Z" }
```

- `action`: `draft`, `publish`, `unlist` (published but hidden from feeds and
  discovery; reachable by link), `submit` (unpublished, queued for editorial
  review) or `schedule`.
- `scheduledAt`: required for `schedule`; must be in the future. Due stories are
  published when the Stories, Following or Stats pages load.
- Every action except `draft` needs a title and story text.

`200 { "ok": true }`. Errors: `401`, `404`, `400` (bad action, past date, empty
story).

---

## Comments, reactions and ratings

These accept members and guests. The **voter** is the signed-in user, or the
anonymous reader from the `reader_session` cookie. With neither:
`400 { "error": "Reload the page and try again." }`.

### `POST /api/articles/{id}/comments`

```json
{
  "body": "Great read",
  "guestName": "Maya",
  "turnstileToken": "…",
  "parentId": "optional top-level comment id"
}
```

- `body`: 1–2,000 characters after trimming.
- Guests must send `guestName` (2–50 characters: letters, spaces, `.`, `'`, `-`,
  starting with a letter) and a valid `turnstileToken`. Members' values for these
  are ignored.
- `parentId` must be a live top-level comment on the same story (one reply level).
- The story must be published.
- Limit: 10 comments per voter per hour.

`201` with the comment:

```json
{
  "id": "cm…",
  "body": "Great read",
  "createdAt": "2026-10-25T12:00:00.000Z",
  "name": "Maya",
  "username": null,
  "avatarUrl": null,
  "guest": true,
  "parentId": null,
  "canDelete": false
}
```

Errors: `400` (validation, missing name, failed verification), `404` (story or
parent not found), `429`.

### `DELETE /api/comments/{id}`

**Session.** The commenter only; story authors cannot remove readers' comments. Soft delete: replies stay.
`204`. Errors: `401`, `403`, `404`.

### `PUT /api/articles/{id}/feedback`

```json
{ "reaction": "LIKE", "rating": 4 }
```

- `reaction`: `"LIKE"`, `"DISLIKE"` or `null` (clear).
- `rating`: integer 1–5 or `null` (clear).
- Omitted fields are unchanged. At least one field is required.
- The story must be published. Limit: 60 votes per voter per 10 minutes.

`200`:

```json
{
  "likes": 12,
  "dislikes": 1,
  "ratingAverage": 4.3,
  "ratingCount": 9,
  "mine": { "reaction": "LIKE", "rating": 4 }
}
```

Errors: `400`, `404`, `429`.

---

## Media and video

### `POST /api/media`

Upload an image. **Verified reader or admin session.**

```json
{ "type": "image/webp", "data": "<base64>", "purpose": "inline" }
```

| Step | Failure |
| --- | --- |
| R2 configured | `503` "Image storage is not configured yet." |
| 50 uploads per user per day | `429` |
| `type` is `image/jpeg`, `image/png` or `image/webp`; `data` is base64 | `400` |
| Decoded size ≤ 600 KB and the file signature matches `type` | `400` |
| ClamAV scan, when `CLAMAV_HOST` is set | `422` infected; `503` scanner unavailable |
| Decodable image, ≤ 40 megapixels | `400` |
| R2 upload (20-second timeout) | `502` |

The server re-encodes to WebP, fitting inside 1,600 px (`inline`, default) or
2,400 px (`cover`) or 512 px (`avatar`) on the long edge, and removes metadata.

`201 { "url": "<R2_PUBLIC_URL>/stories/{userId}/{uuid}.webp" }`.

The editor shrinks large photos in the browser before calling this endpoint, so
writers can pick files up to 25 MB. Profile photos use `purpose: "avatar"`;
apply the returned URL using `PATCH /api/me` or `PATCH /api/admin/profile`.
`avatarUrl` must point to a generated WebP in the current user's R2 prefix.
Send `avatarUrl: null` to remove the photo, or omit it to retain the current one.
Uploads require the configured R2 bucket and credentials in all environments.

### `GET /api/videos?url=…` / `POST /api/videos`

Resolve a video link to a preview. GET is public so readers can load thumbnails
for existing links; POST requires a reader session for the editor.

```json
{ "url": "https://youtu.be/dQw4w9WgXcQ" }
```

Accepts HTTPS YouTube (`watch?v=`, `youtu.be/`, `shorts/`, `embed/`, 11-character
ids), Vimeo (`vimeo.com/{numeric id}`, `player.vimeo.com/video/{id}`), and direct
MP4/WebM/OGV file URLs. The server calls only the allow-listed provider
oEmbed endpoint (8-second timeout, redirects rejected, cached for one hour).
Vimeo unlisted hashes are retained. Direct files are never fetched server-side.
They return a native-video URL
without a thumbnail. Provider HTML is discarded.

`200 { "url": "<normalised URL>", "title": "…", "thumbnail": "https://i.ytimg.com/…" }`.
Errors: `401`, `400` (unsupported URL), `422` (private, unavailable or unsafe
thumbnail), `502` (provider unreachable).

Existing standalone YouTube/Vimeo links in rich-text paragraphs and legacy
plain text render as click-to-play cards without rewriting stored stories.
Pasting a supported link into the reader editor inserts a video block. Prose
links and code stay as written. YouTube uses the privacy-enhanced player with
an origin referrer so playback is not rejected with error 153. Unsupported or
provider-restricted embeds retain an external viewing link.

Article banners use `coverImage` on reader and admin article create/update
requests. The reader editor shows banner controls above the story title; admin
forms also support upload, replacement and removal. Saving an unchanged admin
content field preserves the existing rich document.

---

## AI editor

### `GET /api/ai/editor`

**Session.** Without `id`: `200 { "conversations": [{ "id", "title", "updatedAt" }] }`
(latest 50). With `?id=`: `200 { "messages": [{ "id", "role", "content",
"attachments": [{ "name", "type" }], "createdAt" }] }` (up to 100). Attachment
contents are never returned. Errors: `401`, `404`.

### `DELETE /api/ai/editor?id={conversationId}`

**Session**, owner only. Deletes the conversation and its messages.
`200 { "ok": true }`. Errors: `401`, `400`.

### `POST /api/ai/editor`

**Session** with premium access: a subscription that is `ACTIVE` or `TRIALING`
and whose `currentPeriodEnd` is in the future. The premium check is skipped
only when `NODE_ENV=development`.

```json
{ "conversationId": "optional", "text": "Message", "attachments": [{ "name": "notes.md", "type": "text/markdown", "data": "<base64>" }] }
```

- `text`: 1–12,000 characters after trimming.
- `attachments`: up to 3 files, 500 KB in total. Types: `text/plain`,
  `text/markdown`, `text/csv`, `application/json`, `application/pdf`,
  `image/png`, `image/jpeg`.
- Without `conversationId` a new conversation is created. A conversation holds
  at most 100 messages; the last 12 are sent as context.
- Limits: 30 requests per user per day, and one request in flight per user
  (15 seconds). Attempts count even when the provider fails.

`200 { "conversation": { "id", "title", "updatedAt" }, "messages": [userMessage, assistantMessage] }`.

| Status | Meaning |
| --- | --- |
| `401` | Not signed in |
| `403` | No active premium membership |
| `404` | Conversation not found |
| `503` | `OPENAI_API_KEY` not set |
| `400` | Bad length, file type or size; conversation full |
| `409` | The conversation changed in another tab |
| `429` | Daily or in-flight limit reached (`Retry-After` set) |
| `502` | Provider error (including a rejected API key), timeout (60 s) or empty output |

The request uses `store: false` and at most 3,000 output tokens.

---

## Library

### `GET /api/me/library?articleId={id}`

**Session.** `200 { "lists": [{ "id", "name", "items": [{ "articleId" }] }], "bookmarked": boolean }`.
`items` contains the article only when it is in that list.

### `POST /api/me/library`

**Session.** Limit: 120 changes per user per 10 minutes. One action per request:

| `action` | Fields | Effect |
| --- | --- | --- |
| `createList` | `name` (1–100), `description`? (≤ 500), `isPublic`? | Creates a list (max 100 per user). Returns `{ "list" }`. |
| `deleteList` | `listId` | Deletes your list. |
| `bookmark` | `articleId`, `saved` | Saves or removes a story from your reading list. |
| `listItem` | `articleId`, `listId`, `saved` | Adds or removes a story from your list. Unlisted stories can only go in private lists. |
| `saveList` | `listId`, `saved` | Saves or removes another reader's public list. |
| `highlight` | `articleId`, `quote` (1–3,000), `note`? (≤ 2,000) | Saves a highlight. The quote must appear in text you can read (the excerpt for locked member stories). |
| `deleteHighlight` | `highlightId` | Deletes your highlight. |
| `clearHistory` | — | Hides reading history before now. |

`200 { "ok": true }`. Errors: `401`, `400`, `404` (story or list not found), `429`.

---

## Following writers and topics

### `PUT` / `DELETE /api/users/{id}/follow`

**Session.** Follows or unfollows a writer. Limit: 120 changes per user per 10
minutes. `200 { "following": boolean }`. Errors: `401`, `400` (yourself), `404`,
`429`.

### `PUT` / `DELETE /api/topics/{id}/follow`

**Session.** Follows or unfollows a topic (tag). Same limit.
`200 { "following": boolean }`. Errors: `401`, `404`, `429`.

---

## Reader sign-in

Auth.js handles `/api/auth/*` (session, CSRF, callbacks, sign-out) through
`app/api/auth/[...nextauth]`. Direct `POST /api/auth/signin/resend` is blocked
with `403`; use the magic-link route.

### 🔒 `POST /api/auth/magic-link`

Send a one-time sign-in link.

```json
{ "intent": "login", "email": "maya@example.com", "turnstileToken": "…" }
```

```json
{ "intent": "signup", "email": "maya@example.com", "name": "Maya", "turnstileToken": "…" }
```

| Status | Body | When |
| --- | --- | --- |
| `200` | `{ "ok": true }` | Link sent |
| `400` | `{ "error": … }` | Invalid input or Turnstile failed |
| `404` | `{ "error", "code": "no_account" }` | `login` for an email with no account |
| `409` | `{ "error", "code": "account_exists" }` | `signup` for an email that has an account |
| `429` | | More than 3 links per email per 15 minutes |
| `500` | | The email could not be sent |

Email matching is case-insensitive. The link opens `/verify`, where the person
presses **Continue** to spend the token, then lands on `/mfa`. For sign-up, the
display name travels in the link so it works on another device.

This route reveals whether an email has an account. Turnstile and the
credential rate limits bound how fast that can be probed.

### 🔒 `POST /api/auth/oauth-turnstile`

Run before starting Google or GitHub sign-in.

`{ "turnstileToken": "…" }` → `200 { "ok": true }` and a 5-minute
`oauth_turnstile` cookie. The OAuth callback rejects sign-ins without it.
Errors: `400`.

### 🔒 `POST /api/auth/passkey/{action}`

Passwordless sign-in with a discoverable passkey.

| Action | Body | Response |
| --- | --- | --- |
| `options` | none | `{ "options": <WebAuthn request options> }` |
| `verify` | `{ "response": <WebAuthn assertion> }` | `{ "ok": true }` and a new session cookie, already MFA-verified; `401` if the passkey is not recognised |

### 🔒 `POST /api/auth/mfa/{action}`

Second step for a session that owes MFA. Requires a session with `mfaPending`;
otherwise `401`.

| Action | Body | Response |
| --- | --- | --- |
| `options` | none | `{ "methods": { "totp": bool, "passkey": bool }, "options": <WebAuthn options or null> }` |
| `verify` | `{ "proof": <proof> }` | `{ "ok": true }`; `401` if not accepted |

A **proof** is one of:

```json
{ "type": "code", "code": "123456" }
{ "type": "code", "code": "abcde-fghjk" }
{ "type": "passkey", "response": <WebAuthn assertion> }
```

Six digits are checked as an authenticator code; `xxxxx-xxxxx` as a recovery
code. Each account gets 10 attempts per 15 minutes.

---

## Digest subscriptions

### `POST /api/newsletter`

Subscribe an email address to the story digest. **Public.** Limits: 10 requests
per hour per IP, 3 confirmation emails per hour per address (further requests
still return `202` but send nothing).

`{ "email": "reader@example.com", "frequency": "DAILY" | "WEEKLY" | "MONTHLY", "turnstileToken": "…" }`

`202 { "message": "Check your inbox to confirm your subscription." }`, whether or
not the address is already subscribed. The confirmation link (7 days) applies
the requested frequency. Errors: `400` (invalid input or failed Turnstile),
`429`, `502` (email could not be sent).

### `GET` / `POST /newsletter/confirm?token=…` and `/newsletter/unsubscribe?token=…`

Email links, not JSON APIs. `GET` shows a page with a button and changes
nothing; `POST` confirms or unsubscribes. Unsubscribe `POST` also serves
mailbox one-click unsubscribe (RFC 8058) and deletes the subscriber.

---

## Account

### `PATCH /api/me`

Set the display name, bio and optional uploaded profile photo. **Setup session** (used during account setup and
on `/settings`).

`{ "name": "Maya", "bio": "Optional, up to 500 characters" }`. `name` is 1–100
characters after trimming. `avatarUrl` is optional; omit it to keep the current
photo, or pass null to remove it. A new URL must belong to your upload prefix.

`200 { "saved": true }`. Errors: `401`, `400`.

### `PATCH /api/me/notifications`

Save email preferences. **Session.**
`{ "emailTheme": "light" | "dark" | "sand", "activityEmails": true, "digest": "OFF" | "DAILY" | "WEEKLY" | "MONTHLY" }`.
`digest` is optional; omit it to keep the current digest choice. A frequency
subscribes the account email immediately (it is already verified) and replaces
any visitor signup for that address; `OFF` removes it.

`200 { "saved": true }`. Errors: `401`, `400`.

### `DELETE /api/me`

Erase your account. **Session.** Admin accounts are refused (`400`); another
admin must delete them.

Order: cancel a live Stripe subscription, delete your uploaded images from R2,
then delete verification tokens, digest signups for the same address, reading
records and the user (everything else cascades). Other people's replies to your comments remain.

`204`. Errors: `401`, `404`, `400`. A storage or billing failure returns `500`
and nothing is deleted from the database; retry.

### `GET /api/me/export`

Download your data. **Session.** Limit: 10 requests per minute. Responses carry
`Content-Disposition: attachment; filename="nystara-export.json"`.

Without `section`:

```json
{
  "exportedAt": "2026-10-25T12:00:00.000Z",
  "user": {
    "id": "…", "email": "…", "emailVerified": null, "name": "…", "username": "…",
    "bio": null, "avatarUrl": null, "image": null, "createdAt": "…",
    "stripeCustomerId": null,
    "accounts": [{ "provider": "github", "providerAccountId": "…" }],
    "subscription": null,
    "mfaEnabled": true, "totpEnabledAt": "…",
    "digest": { "frequency": "WEEKLY", "confirmedAt": "…", "lastSentAt": null, "createdAt": "…" },
    "passkeys": [{ "name": "MacBook", "createdAt": "…", "lastUsedAt": "…", "deviceType": "multiDevice", "backedUp": true }]
  },
  "sections": ["/api/me/export?section=articles", "…"]
}
```

With `section` = `articles`, `comments`, `claps`, `bookmarks`, `following`,
`followers`, `views`, `feedback`, `readingLists`, `readingListItems`,
`savedLists`, `highlights`, `topicFollows`, `aiConversations` or `aiMessages`,
and optional `cursor` (≤ 128 characters):

```json
{ "section": "articles", "records": [ … up to 20 … ], "next": "/api/me/export?section=articles&cursor=…" }
```

Articles include the stored document and plain text. Credentials, password
hashes, TOTP secrets and recovery codes are never exported. Errors: `401`, `400`
(unknown section or long cursor), `429`.

---

## Security settings (MFA)

Readers use `/api/me/security` with a **setup session**. Admins use
`/api/admin/security` with an **admin** session. Both share one implementation.

### `GET {base}`

```json
{
  "totpEnabled": true,
  "passkeys": [{ "id": "…", "name": "iPhone", "createdAt": "…", "lastUsedAt": "…", "backedUp": true }],
  "recoveryRemaining": 9,
  "mfaEnabled": true
}
```

### 🔒 `POST {base}/{action}`

| Action | Body | Proof needed | Result |
| --- | --- | --- | --- |
| `totp-setup` | none | no | `{ secret, uri, qr }` (`qr` is a PNG data URL) for the authenticator app; `409` if already on |
| `totp-enable` | `{ "code": "123456", "proof"? }` | when another factor exists | `{ ok, recoveryCodes? }` |
| `totp-disable` | `{ "proof" }` | yes | `{ ok }` |
| `passkey-options` | none | no | `{ options }` (registration) |
| `passkey-register` | `{ "name", "response", "proof"? }` | when another factor exists | `{ ok, recoveryCodes? }` |
| `passkey-delete` | `{ "id", "proof" }` | yes | `{ ok }`; `404` if not yours |
| `recovery-regenerate` | `{ "proof" }` | yes | `{ ok, recoveryCodes }`; `409` with no factor |
| `proof-options` | none | no | `{ options, methods }` to build a passkey proof |

- `recoveryCodes` (ten codes) is returned only when the first factor is added,
  and on regeneration. They are shown once and stored hashed.
- Missing or rejected proof: `403 { "error", "proofRequired": true }`.
- Unknown action: `404`.
- For readers, adding a factor marks the current session verified.
- Removing a reader's last factor puts the account back into required setup on
  its next request.

---

## Admin

All routes except login need an **admin** session; otherwise `401`.

### 🔒 `POST /api/admin/login`

```json
{ "email": "admin@example.com", "password": "…", "turnstileToken": "…" }
```

| Response | When |
| --- | --- |
| `200 { "ok": true }` + `admin_session` cookie | Correct password, no MFA |
| `200 { "mfaRequired": true, "methods": { "totp", "passkey" } }` + 5-minute `admin_mfa_pending` cookie | Correct password, MFA on |
| `400` | Invalid input or Turnstile failed |
| `401 { "error": "Invalid credentials" }` | Wrong email or password, or not an admin |

### 🔒 `POST /api/admin/login/{action}`

| Action | Body | Notes |
| --- | --- | --- |
| `mfa-options` | none | Needs the pending cookie. Returns `{ options }` for a passkey proof |
| `mfa` | `{ "proof" }` | Needs the pending cookie. Starts the admin session if the proof is valid and the password has not changed since step one |
| `passkey-options` | none | Passkey-only admin sign-in |
| `passkey` | `{ "response" }` | Starts the session if the passkey belongs to an admin |

Failures return `401`.

### `POST /api/admin/logout`

Clears the admin cookie. `200 { "ok": true }`.

### `GET /api/admin/me`

`200 { "id", "email", "name", "username", "avatarUrl", "bio" }`.

### `PATCH /api/admin/profile`

`{ "name"?, "bio"?, "avatarUrl"?, "currentPassword"?, "newPassword"? }`. A new password needs
the current password, must be 12+ characters and at most 72 UTF-8 bytes, revokes
every admin session for this account and clears the cookie.

`200 { "id", "email", "name", "bio", "avatarUrl" }`. Errors: `400`.

### `POST /api/admin/theme`

`{ "theme": "light" | "dark" | "sand" | "system" }` → sets the `theme` cookie.

### `GET /api/admin/users`

| Query | Description |
| --- | --- |
| `page` | 1–1000, default 1 |
| `q` | Name or username contains (case-insensitive), or an exact full email address (emails are encrypted at rest); up to 200 characters |

`200 { "users": [{ "id", "email", "name", "username", "role", "avatarUrl", "createdAt", "_count": { "articles" } }], "total", "page", "pages" }`.

### `GET /api/admin/users/{id}`

User detail with `bio` and `_count` of articles, followers and following.

### `PATCH /api/admin/users/{id}`

`{ "name"?, "bio"?, "role"?: "USER" | "ADMIN" }`. Changing a role revokes that
user's admin sessions. You cannot remove your own admin role (`400`).

### `DELETE /api/admin/users/{id}`

Runs the same erasure as `DELETE /api/me`. You cannot delete yourself (`400`).
`200 { "ok": true }`.

### `GET /api/admin/articles`

| Query | Description |
| --- | --- |
| `page` | 1–1000 |
| `q` | Title search |
| `status` | `published`, `draft` or `submitted` |

`200 { "articles": [{ "id", "slug", "title", "published", "memberOnly", "readTime", "createdAt", "publishedAt", "author", "_count": { "claps", "comments", "views" } }], "total", "page", "pages" }`.

### `POST /api/admin/articles`

`{ "title", "subtitle"?, "contentText", "memberOnly"?, "published"?, "tagSlugs"? }`.
The article belongs to the admin, and its content is stored as plain text.
`201 { "id", "slug" }`.

### `GET /api/admin/articles/{id}`

Article detail including `contentText`, tags, author and counts.

### `PATCH /api/admin/articles/{id}`

`{ "title"?, "subtitle"?, "contentText"?, "memberOnly"?, "published"?, "tagSlugs"? }`.
Setting `contentText` replaces the rich document with plain text. `tagSlugs`
replaces all tags. `200 { "id", "slug", "title", "published" }`.

### `DELETE /api/admin/articles/{id}`

`200 { "ok": true }`.

---

## Errors

Errors are JSON: `{ "error": "Human-readable message" }`. Validation errors on
article and admin routes return Zod's `flatten()` object in `error` instead.
Some routes add a `code` (`no_account`, `account_exists`) or `proofRequired`.

| Status | Meaning |
| --- | --- |
| `400` | Invalid input, failed CAPTCHA, or no reader identity |
| `401` | Not signed in, or credentials not accepted |
| `403` | Cross-origin write, not the owner, no premium, or proof required |
| `404` | Not found, or unknown action |
| `408` | Request body too slow |
| `409` | Conflicting state (account exists, factor already on) |
| `413` | Body over 1 MiB |
| `422` | Upload blocked by the scanner, or video cannot be embedded |
| `429` | Rate limited; see `Retry-After` |
| `500` | Unexpected failure (for example, email could not be sent) |
| `502` | An upstream service (R2, OpenAI, oEmbed) failed |
| `503` | A required service is not configured or unavailable |

## Not available yet

There are no endpoints for claps, bookmarks, follows, search, notifications,
Stripe checkout, customer portal or webhooks.
