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
  case "${CONTAINER_ENGINE:-}" in
    podman)
      if podman compose version >/dev/null 2>&1; then podman compose "$@";
      elif command -v podman-compose >/dev/null 2>&1; then podman-compose "$@";
      else die "Podman Compose is required (install podman-compose)."; fi
      ;;
    docker)
      if docker compose version >/dev/null 2>&1; then docker compose "$@";
      elif command -v docker-compose >/dev/null 2>&1; then docker-compose "$@";
      else die "Docker Compose is required."; fi
      ;;
    *) die "CONTAINER_ENGINE must be podman or docker." ;;
  esac
}
select_container_engine() {
  if [ -n "${CONTAINER_ENGINE:-}" ]; then
    case "$CONTAINER_ENGINE" in podman|docker) return ;; *) die "CONTAINER_ENGINE must be podman or docker." ;; esac
  fi
  if command -v podman >/dev/null 2>&1 && { podman compose version >/dev/null 2>&1 || command -v podman-compose >/dev/null 2>&1; }; then
    export CONTAINER_ENGINE=podman
  elif command -v docker >/dev/null 2>&1 && { docker compose version >/dev/null 2>&1 || command -v docker-compose >/dev/null 2>&1; }; then
    export CONTAINER_ENGINE=docker
  else
    die "Podman Compose or Docker Compose is required."
  fi
}
require_container_engine() {
  select_container_engine
  if [ "$CONTAINER_ENGINE" = podman ]; then
    require podman
    podman info >/dev/null 2>&1 || die "Podman is not running. On macOS, start its machine with 'podman machine start'."
  else
    require docker
    docker info >/dev/null 2>&1 || die "Docker daemon is not running."
  fi
}
# Only listening sockets are matched, so browser tabs connected to the port are left alone.
free_port() {
  local pids
  pids="$(lsof -nP -t -iTCP:"$1" -sTCP:LISTEN 2>/dev/null || true)"
  [ -z "$pids" ] && return
  log "Port $1 in use; stopping PID(s) $(echo $pids)"
  kill $pids 2>/dev/null || true
  for _ in 1 2 3 4 5; do
    lsof -nP -t -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1 || return
    sleep 1
  done
  kill -9 $pids 2>/dev/null || true
}
# Opens a new tab in the default browser once the app responds.
open_when_ready() {
  local url="$1"
  (
    for _ in $(seq 1 600); do
      if curl -s -o /dev/null "$url"; then
        if command -v open >/dev/null 2>&1; then open "$url"; elif command -v xdg-open >/dev/null 2>&1; then xdg-open "$url"; fi
        exit 0
      fi
      sleep 1
    done
  ) >/dev/null 2>&1 &
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
  DATABASE_URL: 'postgresql://nystara:nystara@127.0.0.1:5442/nystara',
  REDIS_URL: 'redis://127.0.0.1:6389',
  NEXTAUTH_SECRET: randomBytes(32).toString('hex'),
  ADMIN_JWT_SECRET: randomBytes(32).toString('hex'),
  MFA_ENCRYPTION_KEY: randomBytes(32).toString('base64'),
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
  if (Buffer.from(process.env.MFA_ENCRYPTION_KEY ?? '', 'base64').length !== 32) throw new Error('MFA_ENCRYPTION_KEY must be 32 random bytes, base64-encoded');
}
JS
if [ "$MODE" = docker ]; then
  require_container_engine
  open_when_ready "$NEXTAUTH_URL"
  compose -f docker-compose.yml up --build
  exit $?
fi
DB_LOCAL="$(node -e 'const u=new URL(process.env.DATABASE_URL);console.log(["localhost","127.0.0.1","[::1]"].includes(u.hostname)?"1":"0")')"
if [ "$DB_LOCAL" = 1 ]; then
  require_container_engine
  log "Starting local Postgres, Redis, and Mailpit with $CONTAINER_ENGINE"
  compose -f docker-compose.dev.yml up -d --wait --wait-timeout 60
elif [ "${ALLOW_REMOTE_MIGRATE:-0}" != 1 ]; then
  die "Remote database migrations require ALLOW_REMOTE_MIGRATE=1."
elif [ "$MODE" = dev ]; then
  require_container_engine
  log "Starting local Mailpit with $CONTAINER_ENGINE"
  compose -f docker-compose.dev.yml up -d --wait --wait-timeout 60 mailpit
fi
log "Generating Prisma client and applying migrations"
npm run db:generate
npm run db:migrate:deploy
free_port "${PORT:-6100}"
open_when_ready "$NEXTAUTH_URL"
if [ "$MODE" = prod ]; then
  npm run build
  exec npm run start -- --hostname "${HOST:-127.0.0.1}" --port "${PORT:-6100}"
fi
exec npm run dev -- --hostname "${HOST:-127.0.0.1}" --port "${PORT:-6100}"
