#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/jrcedu}"
API_BASE="${JRC_LOCAL_API_BASE:-http://127.0.0.1:3000}"
ENV_FILE="${JRC_ENV_FILE:-/etc/jrcedu-api.env}"
TEACHER_BATCH_DIR="${APP_DIR}/data/historical-paike-batches"
ACTIVATION_STORE_DIR="${APP_DIR}/data/historical-paike-activation-stores"

if [[ -f "${ENV_FILE}" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
  set +a
fi

if [[ -z "${JRC_API_TOKEN:-}" ]]; then
  echo "缺少 JRC_API_TOKEN：请检查 ${ENV_FILE}"
  exit 2
fi

if [[ ! -d "${TEACHER_BATCH_DIR}" ]]; then
  echo "找不到老师排课分包目录：${TEACHER_BATCH_DIR}"
  exit 3
fi

echo "开始导入历史排课老师分包..."
for file in "${TEACHER_BATCH_DIR}"/*.json; do
  name="$(basename "${file}" .json)"
  code="$(
    curl -sS --http1.1 \
      --retry 5 --retry-delay 2 --retry-all-errors \
      --connect-timeout 10 --max-time 180 \
      -X POST "${API_BASE}/paike/formal-import" \
      -H "Authorization: Bearer ${JRC_API_TOKEN}" \
      -H "Content-Type: application/json; charset=utf-8" \
      -H "Expect:" \
      --data-binary @"${file}" \
      -o "/tmp/jrc-paike-import-${name}.json" \
      -w "%{http_code}"
  )"
  if [[ "${code}" != "200" ]]; then
    echo "导入失败：${name} HTTP ${code}"
    head -c 1000 "/tmp/jrc-paike-import-${name}.json" || true
    exit 4
  fi
  echo "已导入：${name}"
done

if [[ -d "${ACTIVATION_STORE_DIR}" ]]; then
  echo "开始写入历史盘活报告分包..."
  for file in "${ACTIVATION_STORE_DIR}"/*.json; do
    name="$(basename "${file}" .json)"
    code="$(
      curl -sS --http1.1 \
        --retry 5 --retry-delay 2 --retry-all-errors \
        --connect-timeout 10 --max-time 180 \
        -X PUT "${API_BASE}/module-data" \
        -H "Authorization: Bearer ${JRC_API_TOKEN}" \
        -H "Content-Type: application/json; charset=utf-8" \
        -H "Expect:" \
        --data-binary @"${file}" \
        -o "/tmp/jrc-paike-activation-${name}.json" \
        -w "%{http_code}"
    )"
    if [[ "${code}" != "200" ]]; then
      echo "报告写入失败：${name} HTTP ${code}"
      head -c 1000 "/tmp/jrc-paike-activation-${name}.json" || true
      exit 5
    fi
    echo "已写入报告：${name}"
  done
fi

echo "历史排课数据本地导入完成。"
