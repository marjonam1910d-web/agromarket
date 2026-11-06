#!/usr/bin/env bash
# Tiklash: ./scripts/restore.sh backups/db-YYYYMMDD-HHMMSS.dump [backups/uploads-....tar.gz]
set -euo pipefail
cd "$(dirname "$0")/.."
[ -f "${1:-}" ] || { echo "Foydalanish: $0 <db.dump> [uploads.tar.gz]"; exit 1; }
source .env
read -r -p "⚠️  Joriy baza ustidan yoziladi. Davom etasizmi? (yes/no) " ok
[ "$ok" = "yes" ] || exit 1
docker compose stop backend
docker compose exec -T db pg_restore -U "${POSTGRES_USER:-agromarket}" -d "${POSTGRES_DB:-agromarket}" --clean --if-exists < "$1"
if [ -n "${2:-}" ]; then
  docker compose run --rm -T -v "$(pwd)/$(dirname "$2"):/backup" --entrypoint sh backend -c "tar xzf /backup/$(basename "$2") -C /app"
fi
docker compose start backend
echo "✅ Tiklandi"
