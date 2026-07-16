#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="${JRC_ENV_FILE:-/etc/jrcedu-api.env}"
BACKUP_ROOT="${JRC_DATABASE_BACKUP_DIR:-/opt/jrcedu-backups/database}"
RETENTION_DAYS="${JRC_DATABASE_BACKUP_RETENTION_DAYS:-30}"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "missing environment file: ${ENV_FILE}" >&2
  exit 1
fi

set -a
source "${ENV_FILE}"
set +a

: "${JRC_DB_NAME:?JRC_DB_NAME is required}"
: "${JRC_DB_USER:?JRC_DB_USER is required}"
: "${JRC_DB_PASSWORD:?JRC_DB_PASSWORD is required}"

mkdir -p "${BACKUP_ROOT}"
timestamp="$(date +%Y%m%d-%H%M%S)"
archive="${BACKUP_ROOT}/jrcedu-${timestamp}.dump"

args=(--format=custom --file "${archive}" --username "${JRC_DB_USER}" --dbname "${JRC_DB_NAME}")
if [[ -n "${JRC_DB_HOST:-}" ]]; then args+=(--host "${JRC_DB_HOST}"); fi
if [[ -n "${JRC_DB_PORT:-}" ]]; then args+=(--port "${JRC_DB_PORT}"); fi

export PGPASSWORD="${JRC_DB_PASSWORD}"
if [[ "${JRC_DB_SSL:-}" == "true" ]]; then export PGSSLMODE=require; fi
pg_dump "${args[@]}"
pg_restore --list "${archive}" >/dev/null
unset PGPASSWORD

sha256sum "${archive}" > "${archive}.sha256"
find "${BACKUP_ROOT}" -type f -name "jrcedu-*.dump" -mtime +"${RETENTION_DAYS}" -delete
find "${BACKUP_ROOT}" -type f -name "jrcedu-*.dump.sha256" -mtime +"${RETENTION_DAYS}" -delete

echo "created ${archive}"
