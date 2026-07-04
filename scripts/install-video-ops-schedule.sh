#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
LOG_DIR="${HOME}/Library/Logs/JRC-Video-Ops-Agent"
LAUNCH_DIR="${HOME}/Library/LaunchAgents"

mkdir -p "${LOG_DIR}" "${LAUNCH_DIR}"

write_plist() {
  local label="$1"
  local npm_script="$2"
  local hour="$3"
  local minute="$4"
  local weekday="${5:-}"
  local monthday="${6:-}"
  local plist="${LAUNCH_DIR}/${label}.plist"
  local calendar_extra=""

  if [[ -n "${weekday}" ]]; then
    calendar_extra="${calendar_extra}
    <key>Weekday</key>
    <integer>${weekday}</integer>"
  fi
  if [[ -n "${monthday}" ]]; then
    calendar_extra="${calendar_extra}
    <key>Day</key>
    <integer>${monthday}</integer>"
  fi

  cat > "${plist}" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${label}</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/zsh</string>
    <string>-lc</string>
    <string>cd "${PROJECT_DIR}" &amp;&amp; npm run ${npm_script}</string>
  </array>
  <key>StartCalendarInterval</key>
  <dict>
    <key>Hour</key>
    <integer>${hour}</integer>
    <key>Minute</key>
    <integer>${minute}</integer>${calendar_extra}
  </dict>
  <key>StandardOutPath</key>
  <string>${LOG_DIR}/${label}.out.log</string>
  <key>StandardErrorPath</key>
  <string>${LOG_DIR}/${label}.err.log</string>
  <key>RunAtLoad</key>
  <false/>
</dict>
</plist>
PLIST

  launchctl unload "${plist}" >/dev/null 2>&1 || true
  launchctl load "${plist}"
  echo "Installed ${label}: npm run ${npm_script}"
}

write_plist "cn.jrcwork.video-ops.daily-morning" "video:daily" 9 15
write_plist "cn.jrcwork.video-ops.daily-evening" "video:daily" 21 30
write_plist "cn.jrcwork.video-ops.weekly" "video:weekly" 2 10 2
write_plist "cn.jrcwork.video-ops.monthly" "video:monthly" 2 30 "" 1

echo "Video ops schedules installed."
echo "Logs: ${LOG_DIR}"
echo "Important: automatic push needs JRC_API_TOKEN in config or launchd environment."
