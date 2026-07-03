# 短视频系统 Mac mini 自动采集器

目标：Mac mini 定时打开抖音创作者中心、视频号助手等后台，采集账号总览、视频详情、平台建议，推送到网站里的“短视频系统”。

## 第一次配置

```bash
cd /opt/jrcedu
npm install
npm run video:init
```

生成配置：

```text
~/Documents/JRC-Video-Ops-Agent/config.json
```

需要在配置里确认：

- `apiBaseUrl`：网站 API 地址，当前为 `https://jrcwork.cn/api`
- `accounts`：要巡检的抖音、视频号账号
- `dashboardUrl`：创作者中心首页
- `videoListUrl`：作品/视频列表页

## 登录

```bash
npm run video:login
```

系统会打开一个独立 Chrome 档案。你本人扫码登录抖音、视频号后台。登录成功后回到终端按 Enter。

登录状态保存在：

```text
~/Library/Application Support/JRC Video Ops Agent/ChromeProfile
```

不要把你的日常 Chrome 主档案交给机器人使用。

## 手动采集测试

```bash
npm run video:collect
```

采集结果会保存到：

```text
~/Documents/JRC-Video-Ops-Agent/latest-video-ops-payload.json
```

如果暂时没有配置 API Token，可以复制这个 JSON 到网页“短视频系统”的“机器人数据收件箱”里导入。

## 推送到网站

服务器 API 如果设置了 `JRC_API_TOKEN`，本机也要设置同一个 token：

```bash
export JRC_API_TOKEN="你的token"
npm run video:push
```

也可以一次性采集并推送：

```bash
export JRC_API_TOKEN="你的token"
npm run video:run
```

## 每天自动执行

在 Mac mini 上执行：

```bash
bash scripts/install-mac-video-ops-agent.sh
```

默认每天 `09:20` 和 `21:20` 执行一次。

## 重要边界

- 只采集你们自己有权限看到的后台数据。
- 遇到验证码、微信确认、登录失效时，机器人暂停并提醒人工处理。
- 不做验证码绕过、不做风控规避、不切换伪装身份。
- 同行账号只采公开数据，不能采集同行后台私密数据。
