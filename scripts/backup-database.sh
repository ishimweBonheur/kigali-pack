#!/usr/bin/env bash
# Kigali-Pack V2 — Production PostgreSQL backup script
# Reads connection from DATABASE_URL or individual DB_* environment variables.
# Outputs compressed .bak files to isolated backup storage.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"

# Backup destination — override with BACKUP_DIR env var
BACKUP_DIR="${BACKUP_DIR:-${SCRIPT_DIR}/../backups}"
BACKUP_FILE="${BACKUP_DIR}/kigalipack_${TIMESTAMP}.bak.gz"

mkdir -p "${BACKUP_DIR}"

parse_database_url() {
  if [[ -n "${DATABASE_URL:-}" ]]; then
    # postgresql://user:pass@host:port/dbname
    if [[ "${DATABASE_URL}" =~ postgresql://([^:]+):([^@]+)@([^:/]+):?([0-9]*)/([^?]+) ]]; then
      export PGUSER="${BASH_REMATCH[1]}"
      export PGPASSWORD="${BASH_REMATCH[2]}"
      export PGHOST="${BASH_REMATCH[3]}"
      export PGPORT="${BASH_REMATCH[4]:-5432}"
      export PGDATABASE="${BASH_REMATCH[5]}"
      return 0
    fi
    echo "ERROR: DATABASE_URL format not recognized. Expected postgresql://user:pass@host:port/dbname" >&2
    exit 1
  fi

  export PGHOST="${DB_HOST:-localhost}"
  export PGPORT="${DB_PORT:-5432}"
  export PGUSER="${DB_USERNAME:-postgres}"
  export PGPASSWORD="${DB_PASSWORD:-postgres}"
  export PGDATABASE="${DB_NAME:-kigalipack_db}"
}

parse_database_url

echo "[backup] Starting pg_dump for database: ${PGDATABASE}@${PGHOST}:${PGPORT}"
echo "[backup] Output: ${BACKUP_FILE}"

pg_dump \
  --host="${PGHOST}" \
  --port="${PGPORT}" \
  --username="${PGUSER}" \
  --dbname="${PGDATABASE}" \
  --format=custom \
  --no-owner \
  --no-acl \
  --verbose \
  | gzip -9 > "${BACKUP_FILE}"

BACKUP_SIZE="$(du -h "${BACKUP_FILE}" | cut -f1)"
echo "[backup] Complete — ${BACKUP_SIZE} written to ${BACKUP_FILE}"

# Retention: keep last 14 backups unless RETENTION_COUNT is set
RETENTION_COUNT="${RETENTION_COUNT:-14}"
ls -1t "${BACKUP_DIR}"/kigalipack_*.bak.gz 2>/dev/null | tail -n +$((RETENTION_COUNT + 1)) | xargs -r rm -f

echo "[backup] Retention policy applied (keeping ${RETENTION_COUNT} most recent backups)"
