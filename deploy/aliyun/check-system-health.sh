#!/usr/bin/env bash
set -u -o pipefail

ENV_FILE="${JRC_ENV_FILE:-/etc/jrcedu-api.env}"
STATE_DIR="${JRC_HEALTH_STATE_DIR:-/opt/jrcedu-runtime}"
STATE_FILE="${STATE_DIR}/health.json"
mkdir -p "${STATE_DIR}"

if [[ -f "${ENV_FILE}" ]]; then
  set -a
  source "${ENV_FILE}"
  set +a
fi

service_status="$(systemctl is-active jrcedu-api 2>/dev/null || true)"
api_status="000"
ai_status="000"

if [[ -n "${JRC_API_TOKEN:-}" ]]; then
  api_status="$(curl -sS --max-time 15 -o /dev/null -w '%{http_code}' -H "Authorization: Bearer ${JRC_API_TOKEN}" http://127.0.0.1:3000/health 2>/dev/null || true)"
fi

if [[ -n "${JRC_DEEPSEEK_API_KEY:-}" ]]; then
  ai_status="$(curl -sS --max-time 30 -o /dev/null -w '%{http_code}' https://api.deepseek.com/chat/completions \
    -H "Authorization: Bearer ${JRC_DEEPSEEK_API_KEY}" \
    -H 'Content-Type: application/json' \
    --data '{"model":"deepseek-chat","messages":[{"role":"user","content":"health check"}],"max_tokens":1}' 2>/dev/null || true)"
fi

overall="ok"
if [[ "${service_status}" != "active" || "${api_status}" != "200" || "${ai_status}" != "200" ]]; then overall="warn"; fi

printf '{"checkedAt":"%s","overall":"%s","service":"%s","apiHttp":%s,"deepseekHttp":%s}\n' \
  "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "${overall}" "${service_status:-unknown}" "${api_status:-0}" "${ai_status:-0}" > "${STATE_FILE}"

chmod 640 "${STATE_FILE}"
cat "${STATE_FILE}"
