#!/usr/bin/env bash
set -euo pipefail

APP_REPO_URL="${APP_REPO_URL:-https://github.com/jrc-edu/jrcedu.git}"
APP_DIR="${APP_DIR:-/opt/jrcedu}"
API_DIR="${APP_DIR}/deploy/aliyun/api"
ENV_FILE="${ENV_FILE:-/etc/jrcedu-api.env}"
NGINX_SITE="/etc/nginx/sites-available/jrcedu"
SERVICE_FILE="/etc/systemd/system/jrcedu-api.service"
JRC_DOMAIN="${JRC_DOMAIN:-jrcwork.cn}"
JRC_WWW_DOMAIN="${JRC_WWW_DOMAIN:-www.jrcwork.cn}"
ENABLE_HTTPS="${ENABLE_HTTPS:-false}"
LETSENCRYPT_EMAIL="${LETSENCRYPT_EMAIL:-}"
CERTBOT_STAGING="${CERTBOT_STAGING:-false}"
CERTBOT_WEBROOT="${CERTBOT_WEBROOT:-/var/www/certbot}"

write_nginx_config() {
  local ssl_enabled="false"
  if [[ -f "/etc/letsencrypt/live/${JRC_DOMAIN}/fullchain.pem" && -f "/etc/letsencrypt/live/${JRC_DOMAIN}/privkey.pem" ]]; then
    ssl_enabled="true"
  fi

  if [[ "${ssl_enabled}" == "true" ]]; then
    cat > "${NGINX_SITE}" <<EOF
server {
  listen 80 default_server;
  listen [::]:80 default_server;
  server_name _ ${JRC_DOMAIN} ${JRC_WWW_DOMAIN};

  location /.well-known/acme-challenge/ {
    root ${CERTBOT_WEBROOT};
  }

  location / {
    return 301 https://\$host\$request_uri;
  }
}

server {
  listen 443 ssl http2;
  listen [::]:443 ssl http2;
  server_name ${JRC_DOMAIN} ${JRC_WWW_DOMAIN};

  root /opt;
  index index.html;

  ssl_certificate /etc/letsencrypt/live/${JRC_DOMAIN}/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/${JRC_DOMAIN}/privkey.pem;

  location = / {
    return 302 /jrcedu/portal/index.html;
  }

  location /api/ {
    proxy_pass http://127.0.0.1:3000/;
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
  }

  location /jrcedu/ {
    try_files \$uri \$uri/ /jrcedu/portal/index.html;
  }
}
EOF
  else
    cat > "${NGINX_SITE}" <<EOF
server {
  listen 80 default_server;
  listen [::]:80 default_server;
  server_name _ ${JRC_DOMAIN} ${JRC_WWW_DOMAIN};

  root /opt;
  index index.html;

  location /.well-known/acme-challenge/ {
    root ${CERTBOT_WEBROOT};
  }

  location = / {
    return 302 /jrcedu/portal/index.html;
  }

  location /api/ {
    proxy_pass http://127.0.0.1:3000/;
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
  }

  location /jrcedu/ {
    try_files \$uri \$uri/ /jrcedu/portal/index.html;
  }
}
EOF
  fi
}

if [[ "${EUID}" -ne 0 ]]; then
  echo "Please run as root, or use: sudo bash deploy/aliyun/install-on-ecs.sh"
  exit 1
fi

echo "==> Installing base packages"
apt-get update
apt-get install -y ca-certificates curl git nginx postgresql postgresql-contrib openssl
if [[ "${ENABLE_HTTPS}" == "true" ]]; then
  apt-get install -y certbot
fi

if ! command -v node >/dev/null 2>&1 || [[ "$(node -v | sed 's/^v//' | cut -d. -f1)" -lt 20 ]]; then
  echo "==> Installing Node.js 20"
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

echo "==> Preparing PostgreSQL"
systemctl enable --now postgresql

if [[ -f "${ENV_FILE}" ]]; then
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
fi

JRC_DB_PASSWORD="${JRC_DB_PASSWORD:-$(openssl rand -base64 32 | tr -d '\n')}"
JRC_API_TOKEN="${JRC_API_TOKEN:-$(openssl rand -hex 24)}"
JRC_INITIAL_EMPLOYEE_PASSWORD="${JRC_INITIAL_EMPLOYEE_PASSWORD:-$(openssl rand -base64 18 | tr -d '=+/\n' | cut -c1-16)}"

cat > "${ENV_FILE}" <<EOF
PORT=3000
JRC_SITE_ID=jrcedu-main
JRC_ALLOWED_ORIGINS=http://8.218.84.228,http://${JRC_DOMAIN},http://${JRC_WWW_DOMAIN},https://${JRC_DOMAIN},https://${JRC_WWW_DOMAIN},https://jrc-edu.github.io,http://localhost:3000,http://127.0.0.1:3000
JRC_API_TOKEN=${JRC_API_TOKEN}
JRC_DB_HOST=127.0.0.1
JRC_DB_PORT=5432
JRC_DB_NAME=jrcedu
JRC_DB_USER=jrcedu_app
JRC_DB_PASSWORD=${JRC_DB_PASSWORD}
JRC_DB_SSL=false
JRC_DB_POOL_MAX=5
JRC_UPLOAD_DIR=/opt/jrcedu-uploads
JRC_UPLOAD_MAX_BYTES=31457280
JRC_JSON_MAX_BYTES=75497472
JRC_DEEPSEEK_API_KEY=${JRC_DEEPSEEK_API_KEY:-}
JRC_DEEPSEEK_API_URL=${JRC_DEEPSEEK_API_URL:-https://api.deepseek.com/chat/completions}
JRC_DEEPSEEK_MODEL=${JRC_DEEPSEEK_MODEL:-deepseek-chat}
EOF
chmod 600 "${ENV_FILE}"
mkdir -p /opt/jrcedu-uploads/curriculum /opt/jrcedu-backups/curriculum
chmod 750 /opt/jrcedu-uploads /opt/jrcedu-uploads/curriculum /opt/jrcedu-backups /opt/jrcedu-backups/curriculum

sudo -u postgres psql <<SQL
do \$\$
begin
  if not exists (select from pg_roles where rolname = 'jrcedu_app') then
    create role jrcedu_app login password '${JRC_DB_PASSWORD}';
  else
    alter role jrcedu_app with login password '${JRC_DB_PASSWORD}';
  end if;
end
\$\$;
select 'create database jrcedu owner jrcedu_app'
where not exists (select from pg_database where datname = 'jrcedu')\gexec
grant all privileges on database jrcedu to jrcedu_app;
SQL

echo "==> Fetching application"
if [[ -d "${APP_DIR}/.git" ]]; then
  git -C "${APP_DIR}" fetch origin
  git -C "${APP_DIR}" reset --hard origin/master
else
  rm -rf "${APP_DIR}"
  git clone "${APP_REPO_URL}" "${APP_DIR}"
fi

echo "==> Loading schema and seed data"
sudo -u postgres psql -d jrcedu -f "${APP_DIR}/database/cloud-schema-v1.sql"
sudo -u postgres psql -v jrc_initial_password="${JRC_INITIAL_EMPLOYEE_PASSWORD}" -d jrcedu -f "${APP_DIR}/deploy/aliyun/seed-employees.sql"
echo "==> New installs use a one-time employee password. Keep it offline and require each employee to change it after first login."
sudo -u postgres psql -d jrcedu <<SQL
grant usage on schema public to jrcedu_app;
grant select, insert, update, delete on all tables in schema public to jrcedu_app;
grant usage, select, update on all sequences in schema public to jrcedu_app;
alter default privileges in schema public grant select, insert, update, delete on tables to jrcedu_app;
alter default privileges in schema public grant usage, select, update on sequences to jrcedu_app;
SQL

echo "==> Installing curriculum file backup"
bash "${APP_DIR}/deploy/aliyun/install-curriculum-backup-cron.sh"

echo "==> Installing database backup"
bash "${APP_DIR}/deploy/aliyun/install-database-backup-cron.sh"

echo "==> Installing daily system health check"
bash "${APP_DIR}/deploy/aliyun/install-system-health-cron.sh"

echo "==> Installing API dependencies"
if [[ -f "${API_DIR}/package-lock.json" ]]; then
  npm --prefix "${API_DIR}" ci --omit=dev
else
  npm --prefix "${API_DIR}" install --omit=dev
fi

echo "==> Creating API systemd service"
cat > "${SERVICE_FILE}" <<EOF
[Unit]
Description=JRC Education Cloud API
After=network.target postgresql.service

[Service]
Type=simple
WorkingDirectory=${API_DIR}
EnvironmentFile=${ENV_FILE}
ExecStart=/usr/bin/node ${API_DIR}/server.mjs
Restart=always
RestartSec=5
User=root

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now jrcedu-api
systemctl restart jrcedu-api

echo "==> Configuring Nginx"
mkdir -p "${CERTBOT_WEBROOT}"
write_nginx_config
rm -f /etc/nginx/sites-enabled/default
ln -sf "${NGINX_SITE}" /etc/nginx/sites-enabled/jrcedu
nginx -t
systemctl enable --now nginx
systemctl reload nginx

if command -v ufw >/dev/null 2>&1; then
  ufw allow 22/tcp || true
  ufw allow 80/tcp || true
  ufw allow 443/tcp || true
fi

if [[ "${ENABLE_HTTPS}" == "true" ]]; then
  if [[ -z "${LETSENCRYPT_EMAIL}" ]]; then
    echo "ENABLE_HTTPS=true requires LETSENCRYPT_EMAIL=your-email@example.com"
    exit 1
  fi

  echo "==> Requesting HTTPS certificate"
  certbot_args=(certonly --webroot -w "${CERTBOT_WEBROOT}" -d "${JRC_DOMAIN}" -d "${JRC_WWW_DOMAIN}" --non-interactive --agree-tos -m "${LETSENCRYPT_EMAIL}" --keep-until-expiring)
  if [[ "${CERTBOT_STAGING}" == "true" ]]; then
    certbot_args+=(--staging)
  fi
  certbot "${certbot_args[@]}"
  write_nginx_config
  nginx -t
  systemctl reload nginx
fi

echo "==> Smoke tests"
curl -fsS -H "Authorization: Bearer ${JRC_API_TOKEN}" http://127.0.0.1:3000/health
echo
curl -fsS -H "Authorization: Bearer ${JRC_API_TOKEN}" http://127.0.0.1/api/health
echo

echo "Deployment complete."
echo "Portal: http://jrcwork.cn/jrcedu/portal/index.html"
echo "Portal HTTPS: https://jrcwork.cn/jrcedu/portal/index.html"
echo "Portal www: http://www.jrcwork.cn/jrcedu/portal/index.html"
echo "Portal IP: http://8.218.84.228/jrcedu/portal/index.html"
echo "API health: http://8.218.84.228/api/health"
