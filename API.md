# API Documentation

Complete API reference for TechScribe endpoints.

## Table of Contents

- [Authentication](#authentication)
- [Public API Routes](#public-api-routes)
- [User API Routes](#user-api-routes)
- [Admin API Routes](#admin-api-routes)
- [Error Responses](#error-responses)

## Authentication

TechScribe uses NextAuth v5 for authentication with the following flows:

- **OAuth**: Google and GitHub (requires Turnstile pre-verification)
- **Magic Link**: Email-based passwordless login (requires Turnstile)
- **Admin**: Separate JWT-based session for admin panel

### Session Cookie

Regular users: `authjs.session-token` (httpOnly, secure in production)
Admin users: `admin_session` (httpOnly, secure in production, 8-hour expiry)

---

## Public API Routes

### Get Articles Feed

**GET** `/api/articles`

Paginated list of published articles.

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|--------|----------|-------------|
| `tag` | string | No | Filter by tag slug |
| `cursor` | string | No | Pagination cursor (article ID) |

**Response:** `200 OK`
```json
{
  "articles": [
    {
      "id": "clx...",
      "slug": "my-article",
      "title": "Article Title",
      "subtitle": "Article subtitle",
      "coverImage": "https://...",
      "readTime": 5,
      "memberOnly": false,
      "publishedAt": "2026-05-01T12:00:00Z",
      "author": {
        "username": "johndoe",
        "name": "John Doe",
        "avatarUrl": "https://..."
      },
      "tags": [
        { "tag": { "name": "TypeScript", "slug": "typescript" } }
      ],
      "_count": {
        "claps": 42,
        "comments": 5
      }
    }
  ],
  "nextCursor": "clx..." | null
}
```

**Notes:**
- Returns 20 articles per page
- Articles are ordered by `publishedAt` descending
- Use `nextCursor` for pagination

---

## User API Routes

All routes require authentication (valid session).

### Create Article

**POST** `/api/articles`

Create a new draft article.

**Headers:**
```
Cookie: authjs.session-token=...
Content-Type: application/json
```

**Request Body:**
```json
{
  "title": "My New Article",
  "subtitle": "Optional subtitle",
  "content": {
    "type": "doc",
    "content": []
  },
  "contentText": "Plain text version for search and excerpt",
  "memberOnly": false,
  "tagSlugs": ["typescript", "nextjs"]
}
```

**Validation:**
- `title`: 1-250 characters, required
- `subtitle`: max 500 characters, optional
- `content`: JSON object (Tiptap document format)
- `contentText`: plain text, required
- `memberOnly`: boolean, default `false`
- `tagSlugs`: array of 0-5 tag slugs, normalized to lowercase kebab-case

**Response:** `201 Created`
```json
{
  "id": "clx...",
  "slug": "my-new-article",
  "author": {
    "username": "johndoe"
  }
}
```

**Errors:**
- `401 Unauthorized`: No valid session
- `400 Bad Request`: Validation failed

---

### Update Article

**PATCH** `/api/articles/[id]`

Update an existing article (author only).

**Headers:**
```
Cookie: authjs.session-token=...
Content-Type: application/json
```

**Request Body:**
```json
{
  "title": "Updated Title",
  "subtitle": null,
  "content": { /* ... */ },
  "contentText": "Updated text",
  "memberOnly": true,
  "coverImage": "https://..." | null
}
```

**Notes:**
- All fields are optional
- Only the article author can update
- `readTime` is automatically recalculated from `contentText`

**Response:** `200 OK`
```json
{
  "id": "clx...",
  "slug": "my-new-article",
  "updatedAt": "2026-05-01T12:30:00Z"
}
```

**Errors:**
- `401 Unauthorized`: No valid session
- `403 Forbidden`: Not the article author
- `404 Not Found`: Article doesn't exist
- `400 Bad Request`: Validation failed

---

### Delete Article

**DELETE** `/api/articles/[id]`

Delete an article (author only).

**Headers:**
```
Cookie: authjs.session-token=...
```

**Response:** `204 No Content`

**Errors:**
- `401 Unauthorized`: No valid session
- `403 Forbidden`: Not the article author
- `404 Not Found`: Article doesn't exist

---

### Publish/Unpublish Article

**POST** `/api/articles/[id]/publish`

Set article publication status. Omit the body to publish, or send `{"published": false}` to unpublish. Repeating the same request is idempotent.

**Headers:**
```
Cookie: authjs.session-token=...
Content-Type: application/json
```

**Request Body:**
```json
{
  "published": true
}
```

**Response:** `200 OK`
```json
{
  "id": "clx...",
  "published": true,
  "publishedAt": "2026-05-01T12:00:00Z"
}
```

**Notes:**
- Sets `publishedAt` to current time when publishing
- Sets `publishedAt` to `null` when unpublishing

**Errors:**
- `401 Unauthorized`: No valid session
- `403 Forbidden`: Not the article author
- `404 Not Found`: Article doesn't exist

---

## Admin API Routes

All admin routes require valid admin session (`admin_session` cookie).

### Admin Login

**POST** `/api/admin/login`

Authenticate as admin.

**Request Body:**
```json
{
  "email": "admin@techscribe.io",
  "password": "your-password",
  "turnstileToken": "turnstile-response-token"
}
```

**Response:** `200 OK`
```json
{
  "ok": true
}
```

**Notes:**
- Sets `admin_session` cookie with 8-hour expiry
- Requires Cloudflare Turnstile verification
- Only users with `role=ADMIN` can login
- Password must be set in database (via seed or direct update)

**Errors:**
- `400 Bad Request`: Invalid input or failed Turnstile
- `401 Unauthorized`: Invalid credentials

---

### Admin Logout

**POST** `/api/admin/logout`

Clear admin session.

**Response:** `200 OK`
```json
{
  "ok": true
}
```

---

### Get Current Admin

**GET** `/api/admin/me`

Get current admin user profile.

**Response:** `200 OK`
```json
{
  "id": "clx...",
  "email": "admin@techscribe.io",
  "name": "Admin User",
  "role": "ADMIN"
}
```

**Errors:**
- `401 Unauthorized`: No valid admin session

---

### List Users

**GET** `/api/admin/users`

Get paginated list of users.

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|--------|----------|-------------|
| `cursor` | string | No | Pagination cursor (user ID) |
| `search` | string | No | Search by name/email/username |

**Response:** `200 OK`
```json
{
  "users": [
    {
      "id": "clx...",
      "email": "user@example.com",
      "name": "John Doe",
      "username": "johndoe",
      "role": "USER",
      "createdAt": "2026-01-01T00:00:00Z"
    }
  ],
  "nextCursor": "clx..." | null
}
```

---

### Update User

**PATCH** `/api/admin/users/[id]`

Update user details (admin only).

**Request Body:**
```json
{
  "name": "New Name",
  "role": "ADMIN"
}
```

**Response:** `200 OK`
```json
{
  "id": "clx...",
  "email": "user@example.com",
  "name": "New Name",
  "role": "ADMIN"
}
```

**Errors:**
- `401 Unauthorized`: No valid admin session
- `404 Not Found`: User doesn't exist

---

### Delete User

**DELETE** `/api/admin/users/[id]`

Delete a user and all related data (cascading).

**Response:** `204 No Content`

**Notes:**
- Deletes all user's articles, comments, claps, bookmarks, follows
- Cascading deletes are handled by Prisma schema

**Errors:**
- `401 Unauthorized`: No valid admin session
- `404 Not Found`: User doesn't exist

---

### List All Articles

**GET** `/api/admin/articles`

Get all articles (published and unpublished).

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|--------|----------|-------------|
| `cursor` | string | No | Pagination cursor |
| `published` | string | No | Filter: "true", "false", or omit for all |

**Response:** `200 OK`
```json
{
  "articles": [
    {
      "id": "clx...",
      "title": "Article Title",
      "slug": "article-title",
      "published": true,
      "memberOnly": false,
      "author": {
        "username": "johndoe",
        "name": "John Doe"
      },
      "createdAt": "2026-05-01T12:00:00Z",
      "publishedAt": "2026-05-01T12:00:00Z"
    }
  ],
  "nextCursor": "clx..." | null
}
```

---

### Delete Article (Admin)

**DELETE** `/api/admin/articles/[id]`

Delete any article (admin privilege).

**Response:** `204 No Content`

**Errors:**
- `401 Unauthorized`: No valid admin session
- `404 Not Found`: Article doesn't exist

---

## Auth API Routes

### Magic Link Request

**POST** `/api/auth/magic-link`

Request a magic link sign-in email.

**Request Body:**
```json
{
  "email": "user@example.com",
  "turnstileToken": "turnstile-response-token"
}
```

**Response:** `200 OK`
```json
{
  "ok": true
}
```

**Notes:**
- Sends email via Resend
- Email contains a time-limited sign-in link
- Requires Turnstile verification

---

### OAuth Turnstile Pre-verification

**POST** `/api/auth/oauth-turnstile`

Verify Turnstile before OAuth flow.

**Request Body:**
```json
{
  "turnstileToken": "turnstile-response-token"
}
```

**Response:** `200 OK`
```json
{
  "ok": true
}
```

**Notes:**
- Sets `oauth_turnstile` cookie (5-minute expiry)
- Required before starting OAuth flow
- Checked in auth callback

---

## Health Check

**GET** `/api/health`

Simple health check endpoint.

**Response:** `200 OK`
```json
{
  "status": "ok"
}
```

**Use Cases:**
- Container orchestration health checks
- Uptime monitoring
- Load balancer health checks

---

## Error Responses

### Standard Error Format

All errors return a JSON response:

```json
{
  "error": "Error message" | { /* Zod validation errors */ }
}
```

### HTTP Status Codes

| Code | Meaning | Common Causes |
|------|---------|---------------|
| 400 | Bad Request | Validation failed, malformed JSON |
| 401 | Unauthorized | Missing or invalid session |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource doesn't exist |
| 500 | Internal Server Error | Unhandled server error |

### Common Error Messages

- `"Unauthorized"`: No valid session cookie
- `"Forbidden"`: Valid session but insufficient permissions
- `"Not found"`: Resource ID doesn't exist
- `"Invalid input"`: Request body validation failed
- `"CAPTCHA verification failed"`: Turnstile token invalid/expired

---

## Rate Limiting

**Current Status:** Not implemented

**Recommendation:** Add rate limiting middleware for:
- Auth endpoints: 5 req/min per IP
- Write operations: 20 req/min per user
- Read operations: 100 req/min per IP

**Suggested Implementation:** Use `@upstash/ratelimit` with Redis for distributed rate limiting.

---

## CORS

**Current Status:** Same-origin only

All API routes are same-origin by default. For external API consumers (future):
- Add CORS middleware
- Require API keys
- Implement proper scoping

---

## Pagination

All paginated endpoints use cursor-based pagination:

1. First request: omit `cursor` parameter
2. Response includes `nextCursor`
3. Next request: pass `nextCursor` as `cursor` parameter
4. When `nextCursor` is `null`, no more results

**Example:**
```
GET /api/articles
GET /api/articles?cursor=clx123
GET /api/articles?cursor=clx456
```

**Benefits:**
- Handles concurrent writes gracefully
- Efficient for large datasets
- No "page drift" issues

---

## Content Types

All requests and responses use `application/json` unless otherwise specified.

For file uploads (future):
- Use `multipart/form-data`
- Consider direct upload to Vercel Blob with signed URLs

---

## Security Headers

All API responses include:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`

(Set by Next.js response configuration and proxy)

---

## Versioning

**Current Version:** v1 (implicit, no version in URL)

**Future Versioning Strategy:**
- Use path prefix: `/api/v2/articles`
- Maintain v1 for 6 months after v2 launch
- Deprecation warnings in headers

---

## SDK / Client Libraries

No official SDK yet. Use standard `fetch` or HTTP clients:

```typescript
// Example: Create article
const response = await fetch('/api/articles', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    title: 'My Article',
    content: { type: 'doc', content: [] },
    contentText: 'My article content',
  }),
  credentials: 'include', // Important for cookies
});

const data = await response.json();
```


## Security review updates (25 October 2026)

Every API write requires an `Origin` matching the scheme, host and port of `NEXTAUTH_URL`. Requests without Origin are rejected. Proxy host headers do not establish trust. Body size is limited to 1 MiB with a read deadline. Production rate limits use shared Redis; clients must honor `429` and `Retry-After`.

`GET /api/me/export` returns the caller’s profile and section links. Retrieve each link and follow its `next` URL until null for a complete export. Supported sections are articles, comments, claps, bookmarks, following, followers and views; each response contains at most 20 records. Exports include stored article JSON/text and exclude credentials. The caller’s session determines ownership, independent of query parameters. API responses use `private, no-store`.

`DELETE /api/me` erases the authenticated non-admin account after billing cancellation. Administrator accounts require another administrator’s deletion request. Cross-author comment replies survive with their parent reference cleared.

Password changes sign the administrator out and revoke all earlier admin JWTs. Passwords are 12+ characters and no more than 72 UTF-8 bytes. Role changes also revoke the target’s existing admin tokens. New articles use a UUID suffix to avoid concurrent slug collisions.
