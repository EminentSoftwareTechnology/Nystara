# Nystara email templates

17 events share a responsive, 720px table layout with the orbital PNG mark,
Nystara name, editorial hero, primary action, plain-text alternative, and links
to stories, contact, privacy, terms and email preferences. Light, dark and sand
use the app’s existing design tokens. Fonts fall back to Georgia and Arial.

## Connected events

| Event | Trigger | Delivery |
| --- | --- | --- |
| Sign-in | Auth.js verification request, via `/api/auth/magic-link` | Essential |
| Welcome | Auth.js user creation | Activity |
| Profile updated | Explicit reader/admin profile save | Essential |
| Authenticator enabled / disabled | Successful security setting change | Essential |
| Passkey added / removed | Successful security setting change | Essential |
| Recovery codes regenerated | Successful recovery-code replacement | Essential |
| Password changed | Successful admin password change | Essential |
| Role changed | Admin changes the account role | Essential |
| Account deleted | Erasure completes, including subscription cancellation | Essential |
| Story published / unpublished | Reader/admin changes publication state; admin creates published story | Activity |
| Story deleted | Reader/admin deletes story | Activity |
| Comment received | New comment on a published story | Activity |
| Reply received | Reply to a registered reader’s comment | Activity |
| Comment removed | Story author removes another reader’s comment | Activity |

Reply recipients and story authors are deduplicated; people are not emailed
about their own comments. Publication and role no-ops do not generate emails.
Autosaves, page reads, feedback votes and paginated export GETs do not send
emails. Follow mutations, billing checkout/webhooks and newsletter sending are
not implemented in this app, so this change does not invent those workflows.
No passwords, recovery codes, TOTP secrets, export data or comment bodies are
included in messages. Story messages use generic text rather than draft content.

## Preferences and unsubscribe

Apply `prisma/migrations/8_email_preferences` before deploying the app, then
regenerate the Prisma client. Existing accounts default to light emails and
activity delivery enabled. `/settings/notifications` lets authenticated readers
save their email theme and disable or re-enable activity emails. The preference
is independent of the device’s theme; new sign-in recipients fall back to their
explicit browser theme, then light.

Activity messages include a signed unsubscribe link and `List-Unsubscribe` /
`List-Unsubscribe-Post` headers. GET displays confirmation without mutating data.
POST accepts the purpose-bound, one-year token without requiring a login or
Origin header (mailbox one-click); it only disables that account’s activity flag.
Invalid/expired tokens cannot write. Repeated requests are safe. Essential
sign-in, security and account messages remain enabled. Rotating NEXTAUTH_SECRET
invalidates old unsubscribe links; account settings remain available.

Delivery uses Mailpit SMTP in development (`EMAIL_SERVER`, default port 1035),
and Resend in production (`RESEND_API_KEY`). `EMAIL_FROM` overrides the sender;
use a verified sender in production. Set `NEXTAUTH_URL` to the canonical app
origin so images and links resolve correctly. PNG logos are served from
`public/brand/email/`; generate replacements from the corresponding brand SVGs.

Sign-in delivery failures fail the sign-in request. Other notifications are
best-effort after successful mutations and log only the event name on failure;
there is no durable retry queue in this change. Production delivery, provider
sender verification and actual Outlook/Gmail rendering require separate checks.
Clients may simplify rounded corners or override colors in forced dark mode.

## Preview and verify

Start the app and the existing dev Mailpit service, then:

```sh
npm run email:preview
npm run email:preview -- --send
```

The runner writes all 51 HTML/text variants and `index.html` to
`/private/tmp/nystara-email-previews` (override `EMAIL_PREVIEW_DIR`). Set
`NEXTAUTH_URL` to the local app’s actual origin. Sending refuses production and
non-loopback SMTP hosts, and uses only synthetic `@nystara.test` recipients.
Preview sign-in/unsubscribe tokens are deliberately synthetic; use the live
integration test for functional links. Open Mailpit at the port configured in
`docker-compose.dev.yml` (8035).

```sh
npm test
npm run lint
npm run typecheck
npm run build
# Start the app against the same disposable *_test database before this check.
TEST_EMAIL_APP_URL=http://localhost:6101 \
TEST_DATABASE_URL=postgresql://nystara:nystara@127.0.0.1:5442/nystara_email_test \
node --import tsx --test tests/email.integration.ts
```

The live test requires a development server with Mailpit SMTP and no production
Turnstile keys; it creates and cleans up synthetic users. It verifies sign-in
links, theme persistence, captured multipart mail, one-click headers, scanner-safe
GET, signed POST, activity suppression, essential delivery and footer/logo URLs.
It skips unless `TEST_EMAIL_APP_URL` is set. Never point it at a real database or
email provider.
