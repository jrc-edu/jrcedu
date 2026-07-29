#!/usr/bin/env bash
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVER_HOST="${JRC_DEPLOY_HOST:-8.218.84.228}"
SERVER_USER="${JRC_DEPLOY_USER:-root}"
SERVER_APP_DIR="${JRC_DEPLOY_APP_DIR:-/opt/jrcedu}"
SSH_KEY="${JRC_DEPLOY_SSH_KEY:-$HOME/.ssh/jrcedu_deploy}"
BRANCH="${JRC_DEPLOY_BRANCH:-master}"
CHECK_ONLY=false

if [[ "${1:-}" == "--check" ]]; then
  CHECK_ONLY=true
fi

cd "$APP_DIR"

if [[ ! -f "$SSH_KEY" ]]; then
  echo "部署密钥不存在：$SSH_KEY"
  exit 1
fi

npm run audit:portal
npm run audit:data-links

if [[ "$CHECK_ONLY" == "true" ]]; then
  ssh -i "$SSH_KEY" -o BatchMode=yes -o ConnectTimeout=10 "${SERVER_USER}@${SERVER_HOST}" "
    cd '${SERVER_APP_DIR}'
    printf 'server_commit=' && git rev-parse --short HEAD
    printf 'api=' && systemctl is-active jrcedu-api
    printf 'nginx=' && systemctl is-active nginx
    health_code=\$(curl --silent --output /dev/null --write-out '%{http_code}' http://127.0.0.1:3000/health || true)
    [[ "\$health_code" == "200" || "\$health_code" == "401" ]]
    printf 'health=ok\\n'
  "
  echo "部署通道检查通过。"
  exit 0
fi

if [[ "$(git branch --show-current)" != "$BRANCH" ]]; then
  echo "当前分支不是 ${BRANCH}，为避免误部署已停止。"
  exit 1
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "当前有未提交改动。请先完成提交，再部署。"
  exit 1
fi

npm run build
git push origin "$BRANCH"

ssh -i "$SSH_KEY" -o BatchMode=yes -o ConnectTimeout=15 "${SERVER_USER}@${SERVER_HOST}" "bash -se" <<REMOTE
set -euo pipefail
cd '${SERVER_APP_DIR}'
previous_commit=\$(git rev-parse HEAD)
git fetch origin '${BRANCH}'
git reset --hard 'origin/${BRANCH}'
systemctl restart jrcedu-api
nginx -t
systemctl reload nginx
health_code="000"
for attempt in 1 2 3 4 5; do
  health_code=\$(curl --silent --output /dev/null --write-out '%{http_code}' http://127.0.0.1:3000/health || true)
  if [[ "\$health_code" == "200" || "\$health_code" == "401" ]]; then
    break
  fi
  sleep 1
done
if ! systemctl is-active --quiet jrcedu-api || ! systemctl is-active --quiet nginx || [[ "\$health_code" != "200" && "\$health_code" != "401" ]]; then
  git reset --hard "\$previous_commit"
  systemctl restart jrcedu-api
  nginx -t && systemctl reload nginx
  echo "部署验证失败，已回退到 \$previous_commit" >&2
  exit 1
fi
printf 'deployed_commit=' && git rev-parse --short HEAD
printf 'health=ok\\n'
REMOTE

echo "生产部署完成。"
