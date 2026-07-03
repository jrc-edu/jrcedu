#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import process from "node:process";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { chromium } from "playwright";

const DEFAULT_STORE_KEY = "jrc-video-ops-monitor-v1";
const DEFAULT_MODULE_KEY = "videoOps";
const DEFAULT_DATA_DIR = path.join(os.homedir(), "Documents", "JRC-Video-Ops-Agent");
const DEFAULT_PROFILE_DIR = path.join(os.homedir(), "Library", "Application Support", "JRC Video Ops Agent", "ChromeProfile");
const DEFAULT_CONFIG_PATH = path.join(DEFAULT_DATA_DIR, "config.json");
const DEFAULT_CHROME_PATH = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const LOGIN_HINTS = ["扫码登录", "微信扫码", "登录", "验证码", "安全验证", "请验证", "重新登录"];

function nowIso() {
  return new Date().toISOString();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function hashText(value) {
  const text = normalizeText(value);
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) >>> 0;
  }
  return hash.toString(16);
}

function parseNumber(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const raw = String(value ?? "").replace(/,/g, "").trim();
  if (!raw) return 0;
  const match = raw.match(/-?\d+(?:\.\d+)?/);
  if (!match) return 0;
  const base = Number(match[0]);
  if (!Number.isFinite(base)) return 0;
  if (raw.includes("亿")) return Math.round(base * 100000000);
  if (raw.includes("万")) return Math.round(base * 10000);
  if (raw.includes("%")) return base / 100;
  return base;
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value.startsWith("--")) {
      args._.push(value);
      continue;
    }
    const key = value.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      args[key] = true;
    } else {
      args[key] = next;
      index += 1;
    }
  }
  return args;
}

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function readJson(filePath, fallback = null) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

async function writeJson(filePath, payload) {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function defaultConfig() {
  return {
    apiBaseUrl: "https://你的域名/api",
    apiTokenEnv: "JRC_API_TOKEN",
    storeKey: DEFAULT_STORE_KEY,
    moduleKey: DEFAULT_MODULE_KEY,
    operator: {
      name: "Mac mini 短视频机器人",
      username: "video_ops_agent"
    },
    dataDir: DEFAULT_DATA_DIR,
    profileDir: DEFAULT_PROFILE_DIR,
    chromePath: DEFAULT_CHROME_PATH,
    headless: false,
    limits: {
      maxVideosPerAccount: 30,
      navigationTimeoutMs: 60000,
      minDelayMs: 900,
      maxDelayMs: 2200
    },
    accounts: [
      {
        platform: "抖音",
        accountType: "自有账号",
        name: "程志豪个人号",
        owner: "程志豪",
        weeklyTarget: 7,
        dashboardUrl: "https://creator.douyin.com/creator-micro/home",
        videoListUrl: "https://creator.douyin.com/creator-micro/content/manage",
        defaultTopic: "数学教育",
        enabled: true,
        selectors: {
          accountAudit: {},
          videoList: {
            card: "",
            title: "",
            url: ""
          },
          videoDetail: {}
        }
      },
      {
        platform: "视频号",
        accountType: "自有账号",
        name: "程志豪视频号",
        owner: "程志豪",
        weeklyTarget: 5,
        dashboardUrl: "https://channels.weixin.qq.com/platform",
        videoListUrl: "https://channels.weixin.qq.com/platform/post/list",
        defaultTopic: "数学教育",
        enabled: true,
        selectors: {
          accountAudit: {},
          videoList: {
            card: "",
            title: "",
            url: ""
          },
          videoDetail: {}
        }
      }
    ]
  };
}

async function loadConfig(configPath) {
  const exists = await pathExists(configPath);
  if (!exists) {
    const config = defaultConfig();
    await writeJson(configPath, config);
    return config;
  }
  const userConfig = await readJson(configPath, {});
  return {
    ...defaultConfig(),
    ...userConfig,
    limits: { ...defaultConfig().limits, ...(userConfig.limits || {}) },
    operator: { ...defaultConfig().operator, ...(userConfig.operator || {}) },
    accounts: Array.isArray(userConfig.accounts) ? userConfig.accounts : defaultConfig().accounts
  };
}

async function openContext(config) {
  await ensureDir(config.profileDir || DEFAULT_PROFILE_DIR);
  const launchOptions = {
    headless: Boolean(config.headless),
    viewport: { width: 1440, height: 980 },
    locale: "zh-CN",
    timezoneId: "Asia/Shanghai",
    args: [
      "--no-first-run",
      "--no-default-browser-check"
    ]
  };
  const chromePath = process.env.VIDEO_OPS_CHROME_PATH || config.chromePath || DEFAULT_CHROME_PATH;
  if (chromePath && await pathExists(chromePath)) launchOptions.executablePath = chromePath;
  return chromium.launchPersistentContext(config.profileDir || DEFAULT_PROFILE_DIR, launchOptions);
}

async function gotoSafe(page, url, config) {
  if (!url) return false;
  const timeout = Number(config.limits?.navigationTimeoutMs || 60000);
  await page.goto(url, { waitUntil: "domcontentloaded", timeout });
  await page.waitForLoadState("networkidle", { timeout: Math.min(timeout, 20000) }).catch(() => {});
  await randomDelay(config);
  return true;
}

async function randomDelay(config) {
  const min = Number(config.limits?.minDelayMs || 900);
  const max = Number(config.limits?.maxDelayMs || 2200);
  const ms = min + Math.floor(Math.random() * Math.max(1, max - min));
  await sleep(ms);
}

async function pageText(page) {
  return normalizeText(await page.locator("body").innerText({ timeout: 8000 }).catch(() => ""));
}

function hasLoginBarrier(text) {
  const clean = normalizeText(text);
  return LOGIN_HINTS.some((hint) => clean.includes(hint));
}

async function saveEvidence(page, config, prefix) {
  const dir = path.join(config.dataDir || DEFAULT_DATA_DIR, "evidence");
  await ensureDir(dir);
  const safePrefix = prefix.replace(/[^\w\u4e00-\u9fa5-]+/g, "_").slice(0, 80);
  const filePath = path.join(dir, `${safePrefix}-${Date.now()}.png`);
  await page.screenshot({ path: filePath, fullPage: true }).catch(() => {});
  return filePath;
}

async function readSelector(page, selector) {
  if (!selector) return "";
  try {
    return normalizeText(await page.locator(selector).first().innerText({ timeout: 3500 }));
  } catch {
    try {
      return normalizeText(await page.locator(selector).first().getAttribute("content", { timeout: 1500 }));
    } catch {
      return "";
    }
  }
}

async function readSelectorNumber(page, selector) {
  return parseNumber(await readSelector(page, selector));
}

function valueAfterLabels(text, labels) {
  const escaped = labels.map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const forward = new RegExp(`(?:${escaped})\\s*[:：]?\\s*([+-]?\\d[\\d,.]*(?:\\.\\d+)?\\s*(?:万|亿|%)?)`, "i");
  const forwardMatch = text.match(forward);
  if (forwardMatch) return parseNumber(forwardMatch[1]);
  const backward = new RegExp(`([+-]?\\d[\\d,.]*(?:\\.\\d+)?\\s*(?:万|亿|%)?)\\s*(?:${escaped})`, "i");
  const backwardMatch = text.match(backward);
  if (backwardMatch) return parseNumber(backwardMatch[1]);
  return 0;
}

function extractLines(text, patterns, limit = 8) {
  const lines = String(text || "")
    .split(/(?<=[。！？!?])|\n|\r/)
    .map(normalizeText)
    .filter((line) => line.length >= 6 && line.length <= 180);
  return lines
    .filter((line) => patterns.some((pattern) => pattern.test(line)))
    .filter((line, index, arr) => arr.indexOf(line) === index)
    .slice(0, limit);
}

function extractTitleFromText(text, fallback = "") {
  const lines = String(text || "")
    .split(/\n|\r| {2,}/)
    .map(normalizeText)
    .filter((line) => line.length >= 5 && line.length <= 80)
    .filter((line) => !/登录|首页|消息|设置|数据|管理|创作者|发布|扫码/.test(line));
  return lines[0] || fallback;
}

function extractPublishedAt(text) {
  const match = String(text || "").match(/20\d{2}[-/.年]\d{1,2}[-/.月]\d{1,2}(?:日)?(?:\s+\d{1,2}:\d{2})?/);
  return match ? match[0].replace(/年|月/g, "-").replace(/日/g, "") : "";
}

function extractTopic(text, fallback = "") {
  const tagMatch = String(text || "").match(/#([\u4e00-\u9fa5A-Za-z0-9_-]{2,16})/);
  if (tagMatch) return tagMatch[1];
  const candidates = ["初中数学", "小学数学", "科学", "暑假课程", "刷题班", "学习方法", "家长沟通", "提分", "出门测"];
  return candidates.find((item) => text.includes(item)) || fallback || "";
}

async function extractAccountAudit(page, account, config) {
  const selectors = account.selectors?.accountAudit || {};
  const text = await pageText(page);
  const trafficSources = {
    recommend: valueAfterLabels(text, ["推荐流量", "推荐", "推荐页"]),
    search: valueAfterLabels(text, ["搜索流量", "搜索"]),
    follower: valueAfterLabels(text, ["关注流量", "关注", "粉丝流量"]),
    profile: valueAfterLabels(text, ["主页流量", "主页访问来源", "主页"]),
    other: valueAfterLabels(text, ["其他流量", "其他"])
  };
  const advice = extractLines(text, [/建议|诊断|优化|流失|留存|完播|点击|推荐|搜索|转化/], 6).join("；");
  const audit = {
    platform: account.platform,
    accountType: account.accountType || "自有账号",
    accountName: account.name,
    owner: account.owner || "",
    capturedAt: nowIso(),
    followers: selectors.followers ? await readSelectorNumber(page, selectors.followers) : valueAfterLabels(text, ["粉丝数", "粉丝", "关注者"]),
    totalVideos: selectors.totalVideos ? await readSelectorNumber(page, selectors.totalVideos) : valueAfterLabels(text, ["作品数", "视频数", "内容数"]),
    totalViews: selectors.totalViews ? await readSelectorNumber(page, selectors.totalViews) : valueAfterLabels(text, ["总播放", "累计播放", "播放总量"]),
    recentViews: selectors.recentViews ? await readSelectorNumber(page, selectors.recentViews) : valueAfterLabels(text, ["近7天播放", "近期播放", "本周播放", "播放量"]),
    profileVisits: selectors.profileVisits ? await readSelectorNumber(page, selectors.profileVisits) : valueAfterLabels(text, ["主页访问", "主页访客", "主页浏览"]),
    messages: selectors.messages ? await readSelectorNumber(page, selectors.messages) : valueAfterLabels(text, ["私信", "咨询", "消息"]),
    leads: selectors.leads ? await readSelectorNumber(page, selectors.leads) : valueAfterLabels(text, ["线索", "有效咨询", "留资"]),
    followerGrowth: selectors.followerGrowth ? await readSelectorNumber(page, selectors.followerGrowth) : valueAfterLabels(text, ["涨粉", "新增粉丝", "净增粉丝"]),
    trafficSources,
    searchKeywords: extractLines(text, [/搜索词|关键词|初一|初二|初三|数学|科学|暑假|提分/], 10),
    audienceSummary: extractLines(text, [/粉丝画像|年龄|城市|地区|家长|学生|性别|人群/], 5).join("；"),
    contentTags: [account.defaultTopic, extractTopic(text)].filter(Boolean),
    platformAdvice: advice,
    positioning: account.positioning || account.defaultTopic || "",
    source: "playwright-agent"
  };
  audit.id = `audit-${hashText([audit.platform, audit.accountName, audit.capturedAt].join("|"))}`;
  return audit;
}

async function collectVideoCards(page, account, config) {
  const maxVideos = Number(config.limits?.maxVideosPerAccount || 30);
  const listSelectors = account.selectors?.videoList || {};
  if (listSelectors.card) {
    const cards = await page.locator(listSelectors.card).evaluateAll((nodes, selectors) => nodes.slice(0, 80).map((node) => {
      const pick = (selector) => selector ? node.querySelector(selector)?.textContent?.trim() || "" : "";
      const linkNode = selectors.url ? node.querySelector(selectors.url) : node.querySelector("a[href]");
      return {
        title: pick(selectors.title) || node.textContent?.trim()?.split(/\n/)[0] || "",
        url: linkNode?.href || "",
        text: node.textContent || ""
      };
    }), listSelectors).catch(() => []);
    return cards.filter((card) => card.title || card.url).slice(0, maxVideos);
  }

  const anchors = await page.locator("a[href]").evaluateAll((nodes) => nodes.map((node) => ({
    title: (node.textContent || "").trim(),
    url: node.href || "",
    text: (node.closest("li,article,div")?.textContent || node.textContent || "").trim()
  }))).catch(() => []);
  const seen = new Set();
  return anchors
    .map((item) => ({
      ...item,
      title: normalizeText(item.title).slice(0, 100),
      text: normalizeText(item.text)
    }))
    .filter((item) => item.url && item.title.length >= 4)
    .filter((item) => !/登录|首页|消息|设置|创作|发布|帮助|反馈/.test(item.title))
    .filter((item) => {
      const key = item.url.split("#")[0];
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, maxVideos);
}

async function extractVideoSnapshot(page, account, card, config) {
  const text = await pageText(page);
  const selectors = account.selectors?.videoDetail || {};
  const title = await readSelector(page, selectors.title) || card.title || extractTitleFromText(text, account.defaultTopic || "");
  const platformAdvice = [
    await readSelector(page, selectors.platformAdvice),
    extractLines(text, [/建议|诊断|优化|流失|留存|完播|点击|推荐|搜索|转化/], 5).join("；")
  ].filter(Boolean).join("；");
  const snapshot = {
    platform: account.platform,
    accountType: account.accountType || "自有账号",
    accountName: account.name,
    owner: account.owner || "",
    videoId: card.videoId || `video-${hashText([account.platform, account.name, card.url || title].join("|"))}`,
    title,
    url: card.url || page.url(),
    topic: extractTopic(text, account.defaultTopic || ""),
    publishedAt: await readSelector(page, selectors.publishedAt) || extractPublishedAt(text),
    capturedAt: nowIso(),
    views: selectors.views ? await readSelectorNumber(page, selectors.views) : valueAfterLabels(text, ["播放量", "播放", "观看", "浏览"]),
    likes: selectors.likes ? await readSelectorNumber(page, selectors.likes) : valueAfterLabels(text, ["点赞量", "点赞"]),
    comments: selectors.comments ? await readSelectorNumber(page, selectors.comments) : valueAfterLabels(text, ["评论量", "评论"]),
    favorites: selectors.favorites ? await readSelectorNumber(page, selectors.favorites) : valueAfterLabels(text, ["收藏量", "收藏"]),
    shares: selectors.shares ? await readSelectorNumber(page, selectors.shares) : valueAfterLabels(text, ["转发", "分享"]),
    impressions: selectors.impressions ? await readSelectorNumber(page, selectors.impressions) : valueAfterLabels(text, ["曝光", "展现", "推荐曝光"]),
    clickThroughRate: selectors.clickThroughRate ? await readSelectorNumber(page, selectors.clickThroughRate) : valueAfterLabels(text, ["点击率", "封面点击率"]),
    completeRate: selectors.completeRate ? await readSelectorNumber(page, selectors.completeRate) : valueAfterLabels(text, ["完播率", "播放完成率"]),
    threeSecondRetention: selectors.threeSecondRetention ? await readSelectorNumber(page, selectors.threeSecondRetention) : valueAfterLabels(text, ["3秒留存", "三秒留存"]),
    fiveSecondRetention: selectors.fiveSecondRetention ? await readSelectorNumber(page, selectors.fiveSecondRetention) : valueAfterLabels(text, ["5秒留存", "五秒留存"]),
    avgWatchSeconds: selectors.avgWatchSeconds ? await readSelectorNumber(page, selectors.avgWatchSeconds) : valueAfterLabels(text, ["平均播放时长", "平均观看时长"]),
    videoDurationSeconds: selectors.videoDurationSeconds ? await readSelectorNumber(page, selectors.videoDurationSeconds) : valueAfterLabels(text, ["视频时长", "时长"]),
    profileVisits: selectors.profileVisits ? await readSelectorNumber(page, selectors.profileVisits) : valueAfterLabels(text, ["主页访问", "主页浏览"]),
    messages: selectors.messages ? await readSelectorNumber(page, selectors.messages) : valueAfterLabels(text, ["私信", "咨询"]),
    leads: selectors.leads ? await readSelectorNumber(page, selectors.leads) : valueAfterLabels(text, ["线索", "有效咨询", "留资"]),
    followersGained: selectors.followersGained ? await readSelectorNumber(page, selectors.followersGained) : valueAfterLabels(text, ["涨粉", "新增粉丝"]),
    platformAdvice,
    notes: "",
    source: "playwright-agent"
  };
  snapshot.id = `snapshot-${hashText([snapshot.platform, snapshot.accountName, snapshot.videoId, snapshot.capturedAt].join("|"))}`;
  return snapshot;
}

function extractSnapshotFromCard(account, card) {
  const text = card.text || card.title || "";
  const snapshot = {
    platform: account.platform,
    accountType: account.accountType || "自有账号",
    accountName: account.name,
    owner: account.owner || "",
    videoId: `video-${hashText([account.platform, account.name, card.url || card.title].join("|"))}`,
    title: card.title || extractTitleFromText(text, account.defaultTopic || ""),
    url: card.url || "",
    topic: extractTopic(text, account.defaultTopic || ""),
    publishedAt: extractPublishedAt(text),
    capturedAt: nowIso(),
    views: valueAfterLabels(text, ["播放量", "播放", "观看", "浏览"]),
    likes: valueAfterLabels(text, ["点赞量", "点赞"]),
    comments: valueAfterLabels(text, ["评论量", "评论"]),
    favorites: valueAfterLabels(text, ["收藏量", "收藏"]),
    shares: valueAfterLabels(text, ["转发", "分享"]),
    platformAdvice: "",
    source: "playwright-agent-list"
  };
  snapshot.id = `snapshot-${hashText([snapshot.platform, snapshot.accountName, snapshot.videoId, snapshot.capturedAt].join("|"))}`;
  return snapshot;
}

async function collectAccount(context, account, config) {
  const page = await context.newPage();
  const warnings = [];
  const accountAudits = [];
  const snapshots = [];

  try {
    if (account.dashboardUrl) {
      await gotoSafe(page, account.dashboardUrl, config);
      const text = await pageText(page);
      if (hasLoginBarrier(text)) {
        const screenshot = await saveEvidence(page, config, `${account.name}-login-required`);
        warnings.push(`${account.platform}｜${account.name} 可能需要重新登录或验证，截图：${screenshot}`);
      }
      accountAudits.push(await extractAccountAudit(page, account, config));
    }

    if (account.videoListUrl) {
      await gotoSafe(page, account.videoListUrl, config);
      const text = await pageText(page);
      if (hasLoginBarrier(text)) {
        const screenshot = await saveEvidence(page, config, `${account.name}-video-list-login-required`);
        warnings.push(`${account.platform}｜${account.name} 视频列表可能需要登录验证，截图：${screenshot}`);
      }
      const cards = await collectVideoCards(page, account, config);
      for (const card of cards) {
        if (!card.url) {
          snapshots.push(extractSnapshotFromCard(account, card));
          continue;
        }
        const detailPage = await context.newPage();
        try {
          await gotoSafe(detailPage, card.url, config);
          snapshots.push(await extractVideoSnapshot(detailPage, account, card, config));
        } catch (error) {
          warnings.push(`${account.platform}｜${account.name} 视频详情采集失败：${card.title || card.url}｜${error.message}`);
          snapshots.push(extractSnapshotFromCard(account, card));
        } finally {
          await detailPage.close().catch(() => {});
        }
      }
    }
  } finally {
    await page.close().catch(() => {});
  }

  return { accountAudits, snapshots, warnings };
}

function normalizeAccountsForPayload(config) {
  return (config.accounts || [])
    .filter((account) => account.enabled !== false)
    .map((account) => ({
      platform: account.platform,
      accountType: account.accountType || "自有账号",
      name: account.name,
      owner: account.owner || "",
      weeklyTarget: account.weeklyTarget || 0,
      url: account.dashboardUrl || account.url || "",
      note: account.note || "Mac mini Playwright 自动巡检"
    }))
    .filter((account) => account.platform && account.name);
}

async function collect(configPath) {
  const config = await loadConfig(configPath);
  await ensureDir(config.dataDir || DEFAULT_DATA_DIR);
  const context = await openContext(config);
  const payload = {
    accounts: normalizeAccountsForPayload(config),
    accountAudits: [],
    snapshots: [],
    warnings: [],
    collectedAt: nowIso(),
    source: "mac-mini-playwright-agent"
  };

  try {
    for (const account of config.accounts || []) {
      if (account.enabled === false) continue;
      console.log(`采集 ${account.platform}｜${account.name}`);
      const result = await collectAccount(context, account, config);
      payload.accountAudits.push(...result.accountAudits);
      payload.snapshots.push(...result.snapshots);
      payload.warnings.push(...result.warnings);
    }
  } finally {
    await context.close().catch(() => {});
  }

  const outputFile = path.join(config.dataDir || DEFAULT_DATA_DIR, "latest-video-ops-payload.json");
  const datedFile = path.join(config.dataDir || DEFAULT_DATA_DIR, "history", `video-ops-${new Date().toISOString().slice(0, 10)}-${Date.now()}.json`);
  await writeJson(outputFile, payload);
  await writeJson(datedFile, payload);
  console.log(`采集完成：账号体检 ${payload.accountAudits.length} 条，视频快照 ${payload.snapshots.length} 条`);
  console.log(`本地文件：${outputFile}`);
  if (payload.warnings.length) {
    console.warn("需要人工查看：");
    payload.warnings.forEach((warning) => console.warn(`- ${warning}`));
  }
  return { config, payload, outputFile };
}

async function readRemoteState(config, token) {
  if (!config.apiBaseUrl || !token) return null;
  const response = await fetch(`${String(config.apiBaseUrl).replace(/\/+$/, "")}/module-data?storeKey=${encodeURIComponent(config.storeKey || DEFAULT_STORE_KEY)}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!response.ok) return null;
  const result = await response.json();
  return result?.payload || result?.data?.payload || null;
}

function mergeByKey(rows, keyFn) {
  const map = new Map();
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const key = keyFn(row);
    if (!key) return;
    map.set(key, { ...(map.get(key) || {}), ...row });
  });
  return [...map.values()];
}

function mergePayloads(existing, incoming) {
  const oldState = existing && typeof existing === "object" ? existing : {};
  const newState = incoming && typeof incoming === "object" ? incoming : {};
  return {
    accounts: mergeByKey([...(oldState.accounts || []), ...(newState.accounts || [])], (row) => [row.platform, row.name || row.accountName, row.accountType || "自有账号"].join("|")),
    accountAudits: mergeByKey([...(oldState.accountAudits || []), ...(newState.accountAudits || [])], (row) => row.id || [row.platform, row.accountName || row.name, row.capturedAt].join("|")),
    snapshots: mergeByKey([...(oldState.snapshots || []), ...(oldState.videos || []), ...(newState.snapshots || [])], (row) => row.id || [row.platform, row.accountName, row.videoId || row.url || row.title, row.capturedAt].join("|")),
    updatedAt: nowIso(),
    source: "mac-mini-playwright-agent"
  };
}

async function pushPayload(configPath, filePath = "") {
  const config = await loadConfig(configPath);
  const token = process.env[config.apiTokenEnv || "JRC_API_TOKEN"] || process.env.JRC_API_TOKEN || config.apiToken || "";
  if (!config.apiBaseUrl || !/^https?:\/\//.test(config.apiBaseUrl)) {
    throw new Error("config.apiBaseUrl 未配置，无法推送。");
  }
  if (!token) {
    throw new Error(`未设置 API Token。请设置环境变量 ${config.apiTokenEnv || "JRC_API_TOKEN"}。`);
  }
  const payloadFile = filePath || path.join(config.dataDir || DEFAULT_DATA_DIR, "latest-video-ops-payload.json");
  const incoming = await readJson(payloadFile, null);
  if (!incoming) throw new Error(`未找到可推送数据：${payloadFile}`);
  const existing = await readRemoteState(config, token);
  const merged = mergePayloads(existing, incoming);
  const response = await fetch(`${String(config.apiBaseUrl).replace(/\/+$/, "")}/module-data`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      storeKey: config.storeKey || DEFAULT_STORE_KEY,
      moduleKey: config.moduleKey || DEFAULT_MODULE_KEY,
      payload: merged,
      replaceMode: "replace",
      operatorName: config.operator?.name || "Mac mini 短视频机器人",
      operatorUsername: config.operator?.username || "video_ops_agent"
    })
  });
  const resultText = await response.text();
  if (!response.ok) throw new Error(`推送失败 ${response.status}: ${resultText}`);
  console.log(`推送成功：${resultText}`);
  return resultText;
}

async function login(configPath) {
  const config = await loadConfig(configPath);
  await ensureDir(config.dataDir || DEFAULT_DATA_DIR);
  const rl = readline.createInterface({ input, output });
  const context = await openContext(config);
  try {
    for (const account of config.accounts || []) {
      if (account.enabled === false || !account.dashboardUrl) continue;
      const page = await context.newPage();
      console.log(`打开 ${account.platform}｜${account.name}`);
      await gotoSafe(page, account.dashboardUrl, config);
      await rl.question("请在打开的 Chrome 中完成扫码/验证，确认已经看到后台数据后按 Enter 继续...");
      await saveEvidence(page, config, `${account.name}-login-ok`);
      await page.close().catch(() => {});
    }
  } finally {
    rl.close();
    await context.close().catch(() => {});
  }
  console.log(`登录状态已保存在独立 Chrome 档案：${config.profileDir || DEFAULT_PROFILE_DIR}`);
}

async function initConfig(configPath) {
  if (await pathExists(configPath)) {
    console.log(`配置已存在：${configPath}`);
    return;
  }
  await writeJson(configPath, defaultConfig());
  console.log(`已创建配置：${configPath}`);
}

function usage() {
  console.log(`
短视频系统 Mac mini 采集器

用法：
  node scripts/video-ops-agent.mjs init [--config 路径]
  node scripts/video-ops-agent.mjs login [--config 路径]
  node scripts/video-ops-agent.mjs collect [--config 路径]
  node scripts/video-ops-agent.mjs push [--config 路径] [--file JSON路径]
  node scripts/video-ops-agent.mjs run [--config 路径]

说明：
  init     创建配置文件
  login    打开独立 Chrome 档案，人工扫码登录抖音/视频号后台
  collect  自动打开后台并采集账号体检、视频数据、平台建议
  push     推送 latest-video-ops-payload.json 到网站短视频系统
  run      collect + push；如果没有 API Token，会保留本地 JSON，不会丢数据
`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const command = args._[0] || "help";
  const configPath = path.resolve(String(args.config || process.env.VIDEO_OPS_AGENT_CONFIG || DEFAULT_CONFIG_PATH));
  if (command === "help" || command === "--help") return usage();
  if (command === "init") return await initConfig(configPath);
  if (command === "login") return await login(configPath);
  if (command === "collect") return await collect(configPath);
  if (command === "push") return await pushPayload(configPath, args.file ? path.resolve(String(args.file)) : "");
  if (command === "run") {
    await collect(configPath);
    try {
      await pushPayload(configPath);
    } catch (error) {
      console.warn(`推送未完成：${error.message}`);
      console.warn("数据已保存到本地 latest-video-ops-payload.json，可以稍后重试 push 或复制到网页收件箱。");
    }
    return;
  }
  usage();
  throw new Error(`未知命令：${command}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
