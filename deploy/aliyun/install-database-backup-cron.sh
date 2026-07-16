#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/jrcedu}"
SCRIPT_SOURCE="${APP_DIR}/deploy/aliyun/backup-postgres.sh"
SCRIPT_TARGET="/usr/local/bin/jrcedu-backup-postgres"
CRON_FILE="/etc/cron.d/jrcedu-database-backup"
LOG_FILE="/var/log/jrcedu-database-backup.log"

if [[ ! -f "${SCRIPT_SOURCE}" ]]; then
  echo "missing backup script: ${SCRIPT_SOURCE}" >&2
  exit 1
fi

install -m 0750 "${SCRIPT_SOURCE}" "${SCRIPT_TARGET}"
mkdir -p /opt/jrcedu-backups/database
chmod 750 /opt/jrcedu-backups /opt/jrcedu-backups/database
touch "${LOG_FILE}"
chmod 640 "${LOG_FILE}"

cat > "${CRON_FILE}" <<EOF
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
35 3 * * * root ${SCRIPT_TARGET} >> ${LOG_FILE} 2>&1
EOF

chmod 644 "${CRON_FILE}"
"${SCRIPT_TARGET}"

echo "installed daily database backup cron: ${CRON_FILE}"
