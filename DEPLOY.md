# DEPLOY.md

Security review deployment requirements take precedence over older examples below: use the patched lockfile; configure shared `REDIS_URL`, canonical `NEXTAUTH_URL`, separate random admin/auth secrets, and real Turnstile keys. Set the public Turnstile site key as a Docker build argument. Database URLs belong in runtime variables, not build arguments. Verify proxy header behavior before enabling `TRUST_PROXY_IP=1`; require ingress DDoS/connection/body limits, private data stores, and daily `npm run db:cleanup` from a maintenance environment with dev tools installed. Apply migration `5_security_review` before serving the new app; administrators must sign in again. See [SECURITY_REVIEW.md](SECURITY_REVIEW.md).

Deployment guide for Nystara to various platforms.

## Table of Contents

- [Railway (Recommended)](#railway-recommended)
- [Vercel + Railway](#vercel--railway)
- [Docker (Self-Hosted)](#docker-self-hosted)
- [Environment Variables](#environment-variables)
- [Database Migrations](#database-migrations)
- [Post-Deployment Checklist](#post-deployment-checklist)

---

## Railway (Recommended)

Railway provides both app hosting and managed PostgreSQL in one platform.

### Prerequisites

- Railway account ([railway.app](https://railway.app))
- GitHub repository connected

### Step-by-Step

1. **Create a new Railway project**
   ```
   New Project → Deploy from GitHub repo → Select nystara
   ```

2. **Add PostgreSQL database**
   ```
   + New → Database → PostgreSQL
   ```
   Railway automatically injects `DATABASE_URL` into your app.

3. **Configure environment variables**
   
   Go to your app service → Variables → Add all from [Environment Variables](#environment-variables) section below (except `DATABASE_URL`).

4. **Deploy**
   
   Railway detects `Dockerfile` via `railway.toml` and builds automatically.
   
   Every push to `main` triggers a new deployment.

5. **Set up custom domain** (optional)
   ```
   Settings → Domains → Add Custom Domain
   ```
   Update `NEXTAUTH_URL` to your custom domain.

### Railway Configuration

The `railway.toml` file configures:
- Build command: Docker build
- Start command: Handled by Dockerfile entrypoint
- Health check: `/api/health`

### Costs

- **Hobby Plan**: $5/month + usage
- **Database**: Included in usage (~$5-10/month for small apps)
- **Total**: ~$10-15/month for < 10k MAU

---

## Vercel + Railway

Host the Next.js app on Vercel, database on Railway.

### Why This Setup?

- Vercel: Best Next.js hosting, global edge network, automatic previews
- Railway: Managed PostgreSQL, easy backups, reasonable pricing

### Step-by-Step

1. **Set up Railway database**
   ```
   New Project → Database → PostgreSQL
   ```
   Copy the `DATABASE_URL` from Railway.

2. **Deploy to Vercel**
   ```
   New Project → Import Git Repository → nystara
   ```

3. **Add environment variables to Vercel**
   
   Project Settings → Environment Variables → Add all from [Environment Variables](#environment-variables) section.
   
   Use the `DATABASE_URL` from Railway.

4. **Configure build settings**
   - Framework Preset: Next.js
   - Build Command: `npm run build`
   - Output Directory: (leave default)
   
5. **Run database migrations**
   
   In Railway, create a new service for migrations:
   ```bash
   # One-time migration service
   docker run --rm \
     -e DATABASE_URL="$RAILWAY_DATABASE_URL" \
     ghcr.io/your-username/nystara:latest \
     npx prisma migrate deploy
   ```
   
   Or run locally:
   ```bash
   DATABASE_URL="railway-connection-string" npm run db:migrate:deploy
   ```

### Costs

- **Vercel Hobby**: Free (with generous limits)
- **Railway Database**: ~$5-10/month
- **Total**: ~$5-10/month for < 10k MAU

---

## Docker (Self-Hosted)

Deploy anywhere that supports Docker (DigitalOcean, AWS, GCP, Azure, etc.).

### Prerequisites

- Docker host (VPS or container platform)
- PostgreSQL database (managed or self-hosted)

### Build Image

```bash
docker build -t nystara:latest .
```

### Run Container

```bash
docker run -d \
  --name nystara \
  -p 6000:3000 \
  -e DATABASE_URL="postgresql://..." \
  -e NEXTAUTH_URL="https://yourdomain.com" \
  -e NEXTAUTH_SECRET="..." \
  -e GOOGLE_CLIENT_ID="..." \
  -e GOOGLE_CLIENT_SECRET="..." \
  -e GITHUB_CLIENT_ID="..." \
  -e GITHUB_CLIENT_SECRET="..." \
  -e RESEND_API_KEY="..." \
  -e NEXT_PUBLIC_TURNSTILE_SITE_KEY="..." \
  -e TURNSTILE_SECRET_KEY="..." \
  -e ADMIN_JWT_SECRET="..." \
  -e STRIPE_SECRET_KEY="..." \
  -e BLOB_READ_WRITE_TOKEN="..." \
  nystara:latest
```

### Docker Compose (Full Stack)

Use the included `docker-compose.yml`:

```bash
# Start both app and database
docker compose up -d

# View logs
docker compose logs -f

# Stop
docker compose down
```

### Health Check

```bash
curl http://localhost:6000/api/health
# Expected: {"status":"ok"}
```

---

## Environment Variables

### Required

```env
DATABASE_URL=postgresql://user:password@host:5432/dbname
NEXTAUTH_URL=https://yourdomain.com
NEXTAUTH_SECRET=<openssl rand -base64 32>
```

### Authentication (at least one provider required)

```env
# Google OAuth
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

# GitHub OAuth
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...

# Email magic link
RESEND_API_KEY=...
```

### Bot Protection

```env
NEXT_PUBLIC_TURNSTILE_SITE_KEY=...
TURNSTILE_SECRET_KEY=...
```

### Admin Panel

```env
ADMIN_JWT_SECRET=<openssl rand -base64 32>
ADMIN_EMAIL=admin@yourdomain.com
ADMIN_PASSWORD=<strong-password>
```

### Optional (can be added later)

```env
# Payments
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Image uploads
BLOB_READ_WRITE_TOKEN=...
```

### Generate Secrets

```bash
# For NEXTAUTH_SECRET and ADMIN_JWT_SECRET
openssl rand -base64 32

# Output example: 5fP3/Yq8xN...
```

---

## Database Migrations

### Initial Setup

On first deployment, migrations run automatically via `docker-entrypoint.sh`:

```bash
npx prisma migrate deploy
```

This is safe to run multiple times (idempotent).

### Development Migrations

When you change the schema locally:

```bash
npm run db:migrate
# Creates a new migration in prisma/migrations/
```

Commit the migration files:

```bash
git add prisma/migrations/
git commit -m "feat(schema): add new field"
```

### Production Migrations

On Railway/Docker, migrations run automatically on container start.

For Vercel + Railway:
- Run migrations manually after schema changes
- Use Railway's CLI or a migration service

---

## Post-Deployment Checklist

### Immediately After Deploy

- [ ] Verify app is accessible at your domain
- [ ] Test health check: `curl https://yourdomain.com/api/health`
- [ ] Test database connection (visit any page)
- [ ] Verify OAuth redirects work (try signing in)
- [ ] Check admin panel login: `/admin/login`

### Security

- [ ] HTTPS is enabled (Railway/Vercel handle this automatically)
- [ ] Environment variables are set (not using defaults)
- [ ] `ADMIN_PASSWORD` is changed from default
- [ ] OAuth apps are configured with production URLs only
- [ ] Turnstile is using production keys (not test keys)
- [ ] Database backups are enabled

### Functionality

- [ ] Can create account (OAuth or magic link)
- [ ] Can create and publish article
- [ ] Can view published articles
- [ ] Paywall shows after 5 articles (test in incognito)
- [ ] Admin panel is accessible and secure

### Monitoring

- [ ] Set up uptime monitoring (UptimeRobot, Pingdom, etc.)
- [ ] Configure error tracking (Sentry, LogRocket, etc.)
- [ ] Set up log aggregation (if needed)
- [ ] Test health check endpoint from monitoring tool

### DNS & Email

- [ ] Domain is connected and DNS propagated
- [ ] SPF/DKIM records for Resend (email deliverability)
- [ ] Test magic link emails are delivered

### Performance

- [ ] Test page load times (Lighthouse, WebPageTest)
- [ ] Verify images are loading from CDN
- [ ] Check database query performance
- [ ] Enable caching headers (handled by Next.js ISR)

---

## Rollback Strategy

### Railway

Railway keeps previous deployments. To rollback:

1. Go to Deployments tab
2. Click on a previous successful deployment
3. Click "Redeploy"

### Vercel

Vercel keeps all deployments. To rollback:

1. Go to Deployments tab
2. Find the working deployment
3. Click "..." → "Promote to Production"

### Docker

Keep tagged images:

```bash
# Tag each release
docker tag nystara:latest nystara:v0.1.0

# Rollback
docker stop nystara
docker rm nystara
docker run ... nystara:v0.1.0
```

---

## Database Backups

### Railway

- **Automatic**: Daily backups (retained for 7 days on Hobby plan)
- **Manual**: Project → Database → Backups → Create Backup

### Self-Hosted

Use `pg_dump` via cron:

```bash
# Daily backup script
#!/bin/bash
BACKUP_DIR=/backups
DATE=$(date +%Y%m%d_%H%M%S)
pg_dump $DATABASE_URL > $BACKUP_DIR/nystara_$DATE.sql
gzip $BACKUP_DIR/nystara_$DATE.sql

# Keep last 30 days
find $BACKUP_DIR -name "nystara_*.sql.gz" -mtime +30 -delete
```

---

## Troubleshooting

### App won't start

1. Check logs: `docker logs nystara` or Railway logs
2. Verify `DATABASE_URL` is correct
3. Ensure migrations ran successfully
4. Check for missing required environment variables

### Database connection errors

1. Verify `DATABASE_URL` format: `postgresql://user:pass@host:port/db`
2. Check database is running and accessible
3. Verify network/firewall rules allow connections
4. Test connection: `psql $DATABASE_URL`

### OAuth not working

1. Verify OAuth app redirect URIs include your domain
2. Check `NEXTAUTH_URL` matches your actual domain
3. Ensure Turnstile pre-verification is working
4. Check OAuth secrets are correct

### Admin panel won't login

1. Verify admin user exists: `npx prisma studio`
2. Check `role` is set to `ADMIN`
3. Verify `ADMIN_JWT_SECRET` is set
4. Test Turnstile is working
5. Try resetting password via Prisma Studio

---

## Scaling Considerations

### < 10k MAU (Current Setup)

- Railway Hobby plan: ✅ Sufficient
- No caching layer needed
- No CDN needed (Vercel Edge handles this)

### 10k - 100k MAU

- Upgrade Railway plan or move to dedicated Postgres
- Add Redis for rate limiting and session storage
- Consider read replicas for database
- Add error tracking and APM (Sentry, DataDog)

### > 100k MAU

- Separate app and database infrastructure
- Use managed Postgres (AWS RDS, Google Cloud SQL)
- Add CDN for static assets (Cloudflare, Fastly)
- Implement proper rate limiting (Upstash Rate Limit)
- Add message queue for email sending (Bull, BullMQ)
- Consider serverless functions for background jobs

---

## Cost Estimates

### Hobby (Railway)

- Compute: ~$5/month
- Database: ~$5-10/month
- **Total: ~$10-15/month**

### Professional (Vercel + Railway)

- Vercel Pro: $20/month
- Railway database: ~$10/month
- **Total: ~$30/month**

### Self-Hosted (DigitalOcean)

- Droplet (2GB): $18/month
- Managed Postgres (1GB): $15/month
- **Total: ~$33/month**

### Enterprise (AWS/GCP)

- App servers: $50-200/month
- RDS Postgres: $50-150/month
- CDN: $20-50/month
- **Total: ~$120-400/month**

---

## Support

- **Documentation**: See README.md, ARCHITECTURE.md, API.md
- **Issues**: [GitHub Issues](https://github.com/your-repo/nystara/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-repo/nystara/discussions)
