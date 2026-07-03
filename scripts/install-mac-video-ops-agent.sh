#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
LABEL="com.jrcedu.video-ops-agent"
PLIST="$HOME/Library/LaunchAgents/${LABEL}.plist"
CONFIG="${VIDEO_OPS_AGENT_CONFIG:-$HOME/Documents/JRC-Video-Ops-Agent/config.json}"
LOG_DIR="$HOME/Documents/JRC-Video-Ops-Agent/logs"
NODE_BIN="${NODE_BIN:-$(command -v node)}"
API_TOKEN="${JRC_API_TOKEN:-}"

mkdir -p "$(dirname "$CONFIG")" "$LOG_DIR" "$HOME/Library/LaunchAgents"

if [ ! -f "$CONFIG" ]; then
  "$NODE_BIN" "$REPO_DIR/scripts/video-ops-agent.mjs" init --config "$CONFIG"
fi

cat > "$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LABEL}</string>

  <key>ProgramArguments</key>
  <array>
    <string>${NODE_BIN}</string>
    <string>${REPO_DIR}/scripts/video-ops-agent.mjs</string>
    <string>run</string>
    <string>--config</string>
    <string>${CONFIG}</string>
  </array>

  <key>WorkingDirectory</key>
  <string>${REPO_DIR}</string>

  <key>EnvironmentVariables</key>
  <dict>
    <key>VIDEO_OPS_AGENT_CONFIG</key>
    <string>${CONFIG}</string>
    <key>JRC_API_TOKEN</key>
    <string>${API_TOKEN}</string>
  </dict>

  <key>StartCalendarInterval</key>
  <array>
    <dict>
      <key>Hour</key>
      <integer>9</integer>
      <key>Minute</key>
      <integer>20</integer>
    </dict>
    <dict>
      <key>Hour</key>
      <integer>21</integer>
      <key>Minute</key>
      <integer>20</integer>
    </dict>
  </array>

  <key>StandardOutPath</key>
  <string>${LOG_DIR}/video-ops-agent.out.log</string>
  <key>StandardErrorPath</key>
  <string>${LOG_DIR}/video-ops-agent.err.log</string>
</dict>
</plist>
PLIST

launchctl unload "$PLIST" >/dev/null 2>&1 || true
launchctl load "$PLIST"

echo "已安装短视频系统 Mac mini 采集器：$PLIST"
echo "配置文件：$CONFIG"
echo "日志目录：$LOG_DIR"
echo ""
echo "第一次使用请先执行："
echo "  cd \"$REPO_DIR\""
echo "  node scripts/video-ops-agent.mjs login --config \"$CONFIG\""
echo ""
echo "手动测试采集："
echo "  node scripts/video-ops-agent.mjs run --config \"$CONFIG\""
echo ""
if [ -z "$API_TOKEN" ]; then
  echo "注意：当前没有读取到 JRC_API_TOKEN，定时任务会先保存本地 JSON，不会自动推送云端。"
  echo "如需自动推送，请用下面形式重新安装："
  echo "  JRC_API_TOKEN=\"你的token\" bash scripts/install-mac-video-ops-agent.sh"
fi
