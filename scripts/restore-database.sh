#!/usr/bin/env bash
# Kigali-Pack V2 — Emergency PostgreSQL restore script
# Gracefully terminates connections, drops transactional schemas, and rebuilds
# from a compressed .bak backup file.
#
# Usage: ./restore-database.sh /path/to/kigalipack_YYYYMMDD_HHMMSS.bak.gz
# Requires: DATABASE_URL or DB_* environment variables

set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <backup-file.bak.gz>" >&2
  echo "Example: $0 ../backups/kigalipack_20250624_120000.bak.gz" >&2
  exit 1
fi

BACKUP_FILE="$1"

if [[ ! -f "${BACKUP_FILE}" ]]; then
  echo "ERROR: Backup file not found: ${BACKUP_FILE}" >&2
  exit 1
fi

parse_database_url() {
  if [[ -n "${DATABASE_URL:-}" ]]; then
    if [[ "${DATABASE_URL}" =~ postgresql://([^:]+):([^@]+)@([^:/]+):?([0-9]*)/([^?]+) ]]; then
      export PGUSER="${BASH_REMATCH[1]}"
      export PGPASSWORD="${BASH_REMATCH[2]}"
      export PGHOST="${BASH_REMATCH[3]}"
      export PGPORT="${BASH_REMATCH[4]:-5432}"
      export PGDATABASE="${BASH_REMATCH[5]}"
      return 0
    fi
    echo "ERROR: DATABASE_URL format not recognized." >&2
    exit 1
  fi

  export PGHOST="${DB_HOST:-localhost}"
  export PGPORT="${DB_PORT:-5432}"
  export PGUSER="${DB_USERNAME:-postgres}"
  export PGPASSWORD="${DB_PASSWORD:-postgres}"
  export PGDATABASE="${DB_NAME:-kigalipack_db}"
}

parse_database_url

echo "============================================================"
echo " Kigali-Pack EMERGENCY DATABASE RESTORE"
echo " Target: ${PGDATABASE}@${PGHOST}:${PGPORT}"
echo " Source: ${BACKUP_FILE}"
echo "============================================================"
echo ""
read -r -p "This will DROP and RECREATE all schemas. Continue? [yes/N] " CONFIRM
if [[ "${CONFIRM}" != "yes" ]]; then
  echo "Restore aborted."
  exit 0
fi

echo "[restore] Step 1/4 — Terminating active connection pools..."
psql \
  --host="${PGHOST}" \
  --port="${PGPORT}" \
  --username="${PGUSER}" \
  --dbname="postgres" \
  --command="SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${PGDATABASE}' AND pid <> pg_backend_pid();" \
  2>/dev/null || true

echo "[restore] Step 2/4 — Dropping existing database..."
dropdb \
  --host="${PGHOST}" \
  --port="${PGPORT}" \
  --username="${PGUSER}" \
  --if-exists \
  "${PGDATABASE}"

echo "[restore] Step 3/4 — Creating fresh database instance..."
createdb \
  --host="${PGHOST}" \
  --port="${PGPORT}" \
  --username="${PGUSER}" \
  "${PGDATABASE}"

echo "[restore] Step 4/4 — Restoring from backup..."
gunzip -c "${BACKUP_FILE}" | pg_restore \
  --host="${PGHOST}" \
  --port="${PGPORT}" \
  --username="${PGUSER}" \
  --dbname="${PGDATABASE}" \
  --no-owner \
  --no-acl \
  --verbose

echo "[restore] Complete — database rebuilt from ${BACKUP_FILE}"
echo "[restore] Run 'npm run migration:run' if schema migrations are ahead of backup."
