#!/usr/bin/env bash
set -euo pipefail

# Ports
# Next.js : 3000
# PostgreSQL: 5432
# Redis    : 6379

echo "Starting dev infrastructure (postgres:5432, redis:6379)..."
docker compose -f docker-compose.dev.yml up -d

echo "Waiting for postgres to be ready..."
until docker compose -f docker-compose.dev.yml exec -T db pg_isready -U techscribe -q; do
  sleep 1
done

echo "Waiting for redis to be ready..."
until docker compose -f docker-compose.dev.yml exec -T redis redis-cli ping | grep -q PONG; do
  sleep 1
done

echo "Running database migrations..."
export DATABASE_URL="postgresql://techscribe:techscribe@localhost:5432/techscribe"
npx prisma migrate deploy

echo "Starting Next.js on port 3000..."
npm run dev
