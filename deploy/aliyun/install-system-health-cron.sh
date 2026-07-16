#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/jrcedu}"
SCRIPT_SOURCE="${APP_DIR}/deploy/aliyun/check-system-health.sh"
SCRIPT_TARGET="/usr/local/bin/jrcedu-system-health"
CRON_FILE="/etc/cron.d/jrcedu-system-health"
LOG_FILE="/var/log/jrcedu-system-health.log"

if [[ ! -f "${SCRIPT_SOURCE}" ]]; then
  echo "missing health check script: ${SCRIPT_SOURCE}" >&2
  exit 1
fi

install -m 0750 "${SCRIPT_SOURCE}" "${SCRIPT_TARGET}"
mkdir -p /opt/jrcedu-runtime
chmod 750 /opt/jrcedu-runtime
touch "${LOG_FILE}"
chmod 640 "${LOG_FILE}"

cat > "${CRON_FILE}" <<EOF
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
50 7 * * * root ${SCRIPT_TARGET} >> ${LOG_FILE} 2>&1
EOF

chmod 644 "${CRON_FILE}"
"${SCRIPT_TARGET}"

echo "installed daily system health cron: ${CRON_FILE}"
