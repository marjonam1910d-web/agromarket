#!/usr/bin/env bash
# PostgreSQL + yuklangan fayllar zaxirasi. Cron: 0 3 * * * /opt/agromarket/scripts/backup.sh
set -euo pipefail
cd "$(dirname "$0")/.."
DIR=${BACKUP_DIR:-./backups}
KEEP_DAYS=${KEEP_DAYS:-14}
TS=$(date +%Y%m%d-%H%M%S)
mkdir -p "$DIR"
source .env
docker compose exec -T db pg_dump -U "${POSTGRES_USER:-agromarket}" -Fc "${POSTGRES_DB:-agromarket}" > "$DIR/db-$TS.dump"
docker compose run --rm -T -v "$(pwd)/$DIR:/backup" --entrypoint sh backend -c "tar czf /backup/uploads-$TS.tar.gz -C /app uploads" || true
find "$DIR" -type f -mtime +"$KEEP_DAYS" -delete
echo "✅ Zaxira: $DIR/db-$TS.dump"
