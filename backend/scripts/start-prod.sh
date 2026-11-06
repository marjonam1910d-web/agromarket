#!/usr/bin/env sh
# Production ishga tushirish (Render / VPS): migratsiyalar → avtomatik sozlash → server
set -e
cd "$(dirname "$0")/.."
npx prisma migrate deploy
node node_modules/tsx/dist/cli.mjs scripts/bootstrap.ts
exec node dist/server.js
