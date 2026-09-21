#!/bin/sh
set -e

echo "kusi-app entrypoint starting (NODE_ENV=${NODE_ENV:-unset}, PORT=${PORT:-3000})"

if [ -z "$DATABASE_URL" ]; then
  echo "DATABASE_URL is required" >&2
  exit 1
fi

echo "Running database migrations..."
./node_modules/.bin/prisma migrate deploy

if [ "$RUN_SEED" = "true" ]; then
  echo "Seeding database..."
  ./node_modules/.bin/tsx prisma/seed.ts
fi

echo "Starting Next.js..."
exec node server.js
