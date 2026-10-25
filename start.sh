#!/usr/bin/env bash
# Usage: ./start.sh [dev|prod|docker]
#   dev    (default) local Postgres/Redis in Docker + `next dev` with hot reload
#   prod   local Postgres/Redis in Docker + production build via `next start`
#   docker full stack (app + db + redis) via docker-compose.yml
set -euo pipefail

MODE="${1:-dev}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

LOCAL_DB_URL="postgresql://techscribe:techscribe@localhost:5432/techscribe"
DEV_COMPOSE="docker-compose.dev.yml"

log()  { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33mWARN:\033[0m %s\n' "$*" >&2; }
die()  { printf '\033[1;31mERROR:\033[0m %s\n' "$*" >&2; exit 1; }

require() { command -v "$1" >/dev/null 2>&1 || die "$1 is required but not installed."; }

# Supports both the Compose v2 plugin and the standalone docker-compose binary.
compose() {
  if docker compose version >/dev/null 2>&1; then
    docker compose "$@"
  elif command -v docker-compose >/dev/null 2>&1; then
    docker-compose "$@"
  else
    die "Docker Compose not found. Install the compose plugin or docker-compose."
  fi
}

check_prereqs() {
  require node
  require npm
  require docker
  docker info >/dev/null 2>&1 || die "Docker daemon is not running. Start Docker Desktop and retry."
  local major
  major="$(node -p 'process.versions.node.split(".")[0]')"
  [ "$major" -ge 20 ] || die "Node 20+ required (found $(node -v))."
}

ensure_env_file() {
  if [ -f .env.local ] || [ -f .env ]; then
    return
  fi
  require openssl
  log "No .env/.env.local found — creating .env.local from .env.example with fresh secrets"
  sed \
    -e "s|^DATABASE_URL=.*|DATABASE_URL=${LOCAL_DB_URL}|" \
    -e "s|^NEXTAUTH_SECRET=.*|NEXTAUTH_SECRET=$(openssl rand -base64 32)|" \
    -e "s|^ADMIN_JWT_SECRET=.*|ADMIN_JWT_SECRET=$(openssl rand -base64 32)|" \
    .env.example > .env.local
  chmod 600 .env.local
}

load_env() {
  # .env.local overrides .env, matching Next.js precedence.
  set -a
  # shellcheck disable=SC1091
  [ -f .env ] && . ./.env
  # shellcheck disable=SC1091
  [ -f .env.local ] && . ./.env.local
  set +a
  export DATABASE_URL="${DATABASE_URL:-$LOCAL_DB_URL}"
}

check_secrets() {
  [ -n "${NEXTAUTH_SECRET:-}" ] || die "NEXTAUTH_SECRET is not set (generate: openssl rand -base64 32)."
  [ -n "${ADMIN_JWT_SECRET:-}" ] || warn "ADMIN_JWT_SECRET is not set — /admin login will fail."
  if [ "$MODE" != "dev" ] && [ -z "${TURNSTILE_SECRET_KEY:-}" ]; then
    warn "TURNSTILE_SECRET_KEY is not set — CAPTCHA-protected endpoints will error in production mode."
  fi
}

uses_local_db() {
  [[ "$DATABASE_URL" == *"@localhost:"* || "$DATABASE_URL" == *"@127.0.0.1:"* ]]
}

start_infra() {
  if ! uses_local_db; then
    log "DATABASE_URL points to a remote host — skipping local Postgres/Redis"
    return
  fi
  log "Starting Postgres (127.0.0.1:5432) and Redis (127.0.0.1:6379)"
  compose -f "$DEV_COMPOSE" up -d

  log "Waiting for Postgres"
  local i
  for i in $(seq 1 60); do
    compose -f "$DEV_COMPOSE" exec -T db pg_isready -U techscribe -q && break
    [ "$i" -eq 60 ] && die "Postgres did not become ready in 60s."
    sleep 1
  done

  log "Waiting for Redis"
  for i in $(seq 1 30); do
    compose -f "$DEV_COMPOSE" exec -T redis redis-cli ping 2>/dev/null | grep -q PONG && break
    [ "$i" -eq 30 ] && die "Redis did not become ready in 30s."
    sleep 1
  done
}

install_deps() {
  if [ ! -d node_modules ] || [ package-lock.json -nt node_modules/.package-lock.json ]; then
    log "Installing dependencies"
    npm ci
  fi
}

prepare_db() {
  if ! uses_local_db && [ "${ALLOW_REMOTE_MIGRATE:-0}" != "1" ]; then
    die "Refusing to run migrations against remote DATABASE_URL. Set ALLOW_REMOTE_MIGRATE=1 to override."
  fi
  log "Generating Prisma client"
  npx prisma generate >/dev/null
  log "Applying database migrations"
  npx prisma migrate deploy
}

check_port() {
  local port="${PORT:-3000}"
  if lsof -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
    die "Port $port is already in use. Stop that process or set PORT."
  fi
}

case "$MODE" in
  dev)
    check_prereqs
    ensure_env_file
    load_env
    check_secrets
    check_port
    install_deps
    start_infra
    prepare_db
    log "Starting Next.js dev server on http://localhost:${PORT:-3000}"
    exec npm run dev
    ;;
  prod)
    check_prereqs
    ensure_env_file
    load_env
    export NODE_ENV=production
    check_secrets
    check_port
    install_deps
    start_infra
    prepare_db
    log "Building production bundle"
    npm run build
    log "Starting production server on http://localhost:${PORT:-3000}"
    exec npm run start
    ;;
  docker)
    require docker
    docker info >/dev/null 2>&1 || die "Docker daemon is not running."
    ensure_env_file
    load_env
    check_secrets
    log "Building and starting full stack via docker-compose.yml"
    compose up --build
    ;;
  -h|--help|help)
    sed -n '2,5p' "$0" | sed 's/^# \{0,1\}//'
    ;;
  *)
    die "Unknown mode '$MODE'. Use: dev | prod | docker"
    ;;
esac
