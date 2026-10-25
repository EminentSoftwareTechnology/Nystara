#!/usr/bin/env bash
# Usage: ./start.sh [dev|prod|docker]
# dev: local infrastructure and hot reload; prod: local build; docker: full Compose stack.
set -euo pipefail
MODE="${1:-dev}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"
log() { printf '==> %s\n' "$*"; }
die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }
require() { command -v "$1" >/dev/null 2>&1 || die "$1 is required."; }
compose() {
  if docker compose version >/dev/null 2>&1; then docker compose "$@";
  elif command -v docker-compose >/dev/null 2>&1; then docker-compose "$@";
  else die "Docker Compose is required."; fi
}
case "$MODE" in
  -h|--help|help) head -n 3 "$0" | tail -n 2 | sed 's/^# //'; exit 0 ;;
  dev|prod|docker) ;;
  *) die "Unknown mode. Use dev, prod, or docker." ;;
esac
require node
require npm
node -e 'const [a,b]=process.versions.node.split(".").map(Number);process.exit(a>22 || (a===22 && b>=12) ? 0:1)' || die "Node 22.12+ is required."
if [ "$MODE" != dev ]; then export NODE_ENV=production; fi
if [ ! -f .env.local ] && [ ! -f .env ]; then
  log "Creating .env.local with fresh secrets"
  (umask 077; node --input-type=module <<'JS'
import { readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
const password = randomBytes(24).toString('hex');
let content = readFileSync('.env.example', 'utf8');
const values = {
  DATABASE_URL: 'postgresql://techscribe:techscribe@127.0.0.1:5432/techscribe',
  REDIS_URL: 'redis://127.0.0.1:6379',
  NEXTAUTH_SECRET: randomBytes(32).toString('hex'),
  ADMIN_JWT_SECRET: randomBytes(32).toString('hex'),
  POSTGRES_PASSWORD: password,
};
for (const [key, value] of Object.entries(values)) content = content.replace(new RegExp(`^${key}=.*$`, 'm'), `${key}=${value}`);
writeFileSync('.env.local', content, { mode: 0o600, flag: 'wx' });
JS
  )
fi
if [ ! -d node_modules ] || [ package-lock.json -nt node_modules/.package-lock.json ]; then
  log "Installing dependencies"
  npm ci
fi
# Parse dotenv as data using the same loader as Next.js; never source shell code.
if [ "${2:-}" != --env-loaded ]; then exec node scripts/start.mjs "$MODE"; fi
node --input-type=module <<'JS'
for (const key of ['NEXTAUTH_SECRET', 'ADMIN_JWT_SECRET']) {
  const value = process.env[key];
  if (!value || value.length < 32 || value.startsWith('generate-')) throw new Error(`${key} must contain at least 32 random characters`);
}
if (!process.env.DATABASE_URL || !process.env.NEXTAUTH_URL) throw new Error('DATABASE_URL and NEXTAUTH_URL are required');
if (process.env.NODE_ENV === 'production') {
  const key = process.env.TURNSTILE_SECRET_KEY;
  if (!key || /^[123]x0{10,}/.test(key)) throw new Error('A real production Turnstile secret is required');
  const site = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  if (!site || /^[123]x0{10,}/.test(site)) throw new Error("A real production Turnstile site key is required");
  if (!process.env.REDIS_URL) throw new Error('REDIS_URL is required in production');
}
JS
if [ "$MODE" = docker ]; then
  require docker
  docker info >/dev/null 2>&1 || die "Docker daemon is not running."
  compose -f docker-compose.yml up --build
  exit $?
fi
DB_LOCAL="$(node -e 'const u=new URL(process.env.DATABASE_URL);console.log(["localhost","127.0.0.1","[::1]"].includes(u.hostname)?"1":"0")')"
if [ "$DB_LOCAL" = 1 ]; then
  require docker
  docker info >/dev/null 2>&1 || die "Docker daemon is not running."
  log "Starting local Postgres and Redis"
  compose -f docker-compose.dev.yml up -d --wait --wait-timeout 60
elif [ "${ALLOW_REMOTE_MIGRATE:-0}" != 1 ]; then
  die "Remote database migrations require ALLOW_REMOTE_MIGRATE=1."
fi
log "Generating Prisma client and applying migrations"
npm run db:generate
npm run db:migrate:deploy
if [ "$MODE" = prod ]; then
  npm run build
  exec npm run start -- --hostname "${HOST:-127.0.0.1}" --port "${PORT:-3000}"
fi
exec npm run dev -- --hostname "${HOST:-127.0.0.1}" --port "${PORT:-3000}"
