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
const INVALID_VIDEO_TITLE_RE = /^(内容管理|视频\s*\(\d+\)|了解详情|关于腾讯|微信视频号运营规范|首页|帮助|通知|消息|设置|活动管理|数据中心|创作中心|互动管理|变现中心|发布|反馈|登录|扫码登录)$/i;
const INVALID_VIDEO_URL_RE = /^(javascript:|mailto:|tel:|#)|developers\.weixin\.qq\.com|tencent\.com\/?$|weixin\.qq\.com\/cgi-bin\/readtemplate/i;
const GENERIC_VIDEO_CARD_SELECTOR = [
  "article",
  "li",
  "tr",
  "[role='listitem']",
  "[class*='video']",
  "[class*='Video']",
  "[class*='post']",
  "[class*='Post']",
  "[class*='work']",
  "[class*='Work']",
  "[class*='card']",
  "[class*='Card']",
  "[class*='item']",
  "[class*='Item']"
].join(",");
const METRIC_LABELS = {
  views: ["播放量", "播放次数", "播放", "观看量", "观看", "浏览量", "浏览", "阅读量", "阅读"],
  likes: ["点赞量", "点赞数", "点赞", "喜欢"],
  comments: ["评论量", "评论数", "评论"],
  favorites: ["收藏量", "收藏数", "收藏"],
  shares: ["转发量", "分享量", "转发", "分享"],
  impressions: ["曝光量", "展现量", "推荐曝光", "曝光", "展现"],
  clickThroughRate: ["点击率", "封面点击率", "播放点击率"],
  completeRate: ["完播率", "播放完成率", "完成率"],
  threeSecondRetention: ["3秒留存", "三秒留存", "3 秒留存"],
  fiveSecondRetention: ["5秒留存", "五秒留存", "5 秒留存"],
  avgWatchSeconds: ["平均播放时长", "平均观看时长", "人均观看时长", "平均观看"],
  videoDurationSeconds: ["视频时长", "作品时长", "时长"],
  profileVisits: ["主页访问", "主页访客", "主页浏览", "主页点击"],
  messages: ["私信", "咨询", "消息"],
  leads: ["线索", "有效咨询", "留资", "表单"]
};

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
  const lower = raw.toLowerCase();
  if (!raw) return 0;
  const match = raw.match(/-?\d+(?:\.\d+)?/);
  if (!match) return 0;
  const base = Number(match[0]);
  if (!Number.isFinite(base)) return 0;
  if (raw.includes("亿")) return Math.max(0, Math.round(base * 100000000));
  if (raw.includes("万")) return Math.max(0, Math.round(base * 10000));
  if (lower.includes("w")) return Math.max(0, Math.round(base * 10000));
  if (lower.includes("k")) return Math.max(0, Math.round(base * 1000));
  if (raw.includes("%")) return Math.max(0, base / 100);
  return Math.max(0, base);
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

function apiBase(config) {
  return String(config.apiBaseUrl || "").replace(/\/+$/, "");
}

function apiToken(config) {
  return process.env[config.apiTokenEnv || "JRC_API_TOKEN"] || process.env.JRC_API_TOKEN || config.apiToken || "";
}

function defaultConfig() {
  return {
    apiBaseUrl: "https://jrcwork.cn/api",
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

function applyRuntimeOptions(config, options = {}) {
  const next = {
    ...config,
    limits: { ...(config.limits || {}) }
  };
  const maxVideos = parseNumber(options.maxVideos || options["max-videos"] || process.env.VIDEO_OPS_MAX_VIDEOS);
  if (maxVideos > 0) next.limits.maxVideosPerAccount = Math.max(1, Math.min(500, Math.round(maxVideos)));
  const scanMode = normalizeText(options.scanMode || options["scan-mode"] || process.env.VIDEO_OPS_SCAN_MODE);
  if (scanMode) next.scanMode = scanMode;
  return next;
}

function collectionPlan(config) {
  const maxVideos = Number(config.limits?.maxVideosPerAccount || 30);
  const mode = normalizeText(config.scanMode) || (maxVideos <= 30 ? "日常巡检" : maxVideos <= 100 ? "深度体检" : "全量基准扫描");
  return {
    mode,
    targetPerAccount: maxVideos,
    sampleMethod: "按平台创作者中心作品列表顺序采集，默认优先最近作品，不随机抽样。",
    purpose: maxVideos <= 30
      ? "适合每天看近期发布表现、找马上要复拍和复盘的视频。"
      : maxVideos <= 100
        ? "适合做账号阶段体检，判断题材、留存、互动和转化的大方向。"
        : "适合首次建档或月度复盘，用更大历史样本建立账号基准。",
    conclusionBoundary: maxVideos < 20
      ? "样本偏少，只能做方向提示，不能下账号级重结论。"
      : maxVideos < 80
        ? "可以判断近期趋势，但对长期账号定位仍需更多历史样本。"
        : "可以做较完整账号体检，但仍受平台后台可见数据限制。",
    fullScan: maxVideos >= 150,
    operatorControl: "可以用 --max-videos 指定本轮每个账号最多采多少条。"
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
    .filter((line) => !/登录|首页|消息|设置|数据|管理|创作者|发布|扫码|播放量|点赞|评论|收藏|转发|分享|曝光|展现|完播|留存/.test(line));
  return lines[0] || fallback;
}

function extractPublishedAt(text) {
  const raw = String(text || "");
  const full = raw.match(/20\d{2}[-/.年]\d{1,2}[-/.月]\d{1,2}(?:日)?(?:\s+\d{1,2}:\d{2})?/);
  if (full) return full[0].replace(/年|月/g, "-").replace(/日/g, "");
  const year = new Date().getFullYear();
  const monthDay = raw.match(/(?:^|\D)(\d{1,2})[-/.月](\d{1,2})(?:日)?(?:\s+(\d{1,2}:\d{2}))?/);
  if (monthDay) return `${year}-${String(monthDay[1]).padStart(2, "0")}-${String(monthDay[2]).padStart(2, "0")}${monthDay[3] ? ` ${monthDay[3]}` : ""}`;
  const today = raw.match(/今天\s*(\d{1,2}:\d{2})?/);
  if (today) return `${new Date().toISOString().slice(0, 10)}${today[1] ? ` ${today[1]}` : ""}`;
  const yesterday = raw.match(/昨天\s*(\d{1,2}:\d{2})?/);
  if (yesterday) {
    const date = new Date(Date.now() - 24 * 3600 * 1000);
    return `${date.toISOString().slice(0, 10)}${yesterday[1] ? ` ${yesterday[1]}` : ""}`;
  }
  return "";
}

function extractDurationSeconds(text) {
  const raw = String(text || "");
  const clock = raw.match(/(?:^|\D)(\d{1,2}):(\d{2})(?=\D|$)/);
  if (clock) return Number(clock[1]) * 60 + Number(clock[2]);
  return valueAfterLabels(raw, METRIC_LABELS.videoDurationSeconds);
}

function extractMetricsFromText(text) {
  const raw = String(text || "");
  return {
    views: valueAfterLabels(raw, METRIC_LABELS.views),
    likes: valueAfterLabels(raw, METRIC_LABELS.likes),
    comments: valueAfterLabels(raw, METRIC_LABELS.comments),
    favorites: valueAfterLabels(raw, METRIC_LABELS.favorites),
    shares: valueAfterLabels(raw, METRIC_LABELS.shares),
    impressions: valueAfterLabels(raw, METRIC_LABELS.impressions),
    clickThroughRate: valueAfterLabels(raw, METRIC_LABELS.clickThroughRate),
    completeRate: valueAfterLabels(raw, METRIC_LABELS.completeRate),
    threeSecondRetention: valueAfterLabels(raw, METRIC_LABELS.threeSecondRetention),
    fiveSecondRetention: valueAfterLabels(raw, METRIC_LABELS.fiveSecondRetention),
    avgWatchSeconds: valueAfterLabels(raw, METRIC_LABELS.avgWatchSeconds),
    videoDurationSeconds: extractDurationSeconds(raw),
    profileVisits: valueAfterLabels(raw, METRIC_LABELS.profileVisits),
    messages: valueAfterLabels(raw, METRIC_LABELS.messages),
    leads: valueAfterLabels(raw, METRIC_LABELS.leads)
  };
}

function extractTopic(text, fallback = "") {
  const tagMatch = String(text || "").match(/#([\u4e00-\u9fa5A-Za-z0-9_-]{2,16})/);
  if (tagMatch) return tagMatch[1];
  const candidates = [
    "初中数学",
    "小学数学",
    "奥数",
    "培优",
    "小升初",
    "中考数学",
    "压轴题",
    "几何模型",
    "计算能力",
    "应用题",
    "暑假课程",
    "刷题班",
    "学习方法",
    "家长沟通",
    "提分",
    "出门测"
  ];
  return candidates.find((item) => text.includes(item)) || fallback || "";
}

function hasVideoMetricText(text) {
  return /\d/.test(String(text || "")) && /播放|观看|浏览|点赞|评论|收藏|转发|分享|曝光|展现|完播|留存|点击率|发布时间|发布于|作品数据|视频数据/.test(String(text || ""));
}

function isNavigableHttpUrl(url) {
  return /^https?:\/\//i.test(String(url || "")) && !INVALID_VIDEO_URL_RE.test(String(url || ""));
}

function looksLikeVideoUrl(url) {
  const raw = String(url || "");
  if (!isNavigableHttpUrl(raw)) return false;
  return /douyin\.com|iesdouyin|channels\.weixin\.qq\.com|creator\.douyin\.com|aweme|video|post|item|content|detail/i.test(raw);
}

function isLikelyVideoCard(card = {}) {
  const title = normalizeText(card.title);
  const url = normalizeText(card.url);
  const text = normalizeText(card.text);
  if (!title && !url) return false;
  if (title && INVALID_VIDEO_TITLE_RE.test(title)) return false;
  if (url && INVALID_VIDEO_URL_RE.test(url)) return false;
  if (hasVideoMetricText(text)) return true;
  if (extractPublishedAt(text) && title.length >= 4) return true;
  if (looksLikeVideoUrl(url) && title.length >= 4) return true;
  return false;
}

function cardQuality(card = {}) {
  const text = normalizeText(card.text);
  let score = 0;
  if (hasVideoMetricText(text)) score += 5;
  if (looksLikeVideoUrl(card.url)) score += 4;
  if (extractPublishedAt(text)) score += 2;
  if (normalizeText(card.title).length >= 6) score += 2;
  if (text.length > 850) score -= 3;
  if (text.length > 1300) score -= 6;
  return score;
}

function normalizeVideoCard(card = {}) {
  const rawText = String(card.rawText || card.text || "");
  const text = normalizeText(rawText);
  const title = normalizeText(card.title) || extractTitleFromText(rawText || text, "");
  return {
    ...card,
    title: title.slice(0, 100),
    text,
    rawText,
    url: normalizeText(card.url)
  };
}

function dedupeCards(cards, maxVideos) {
  const map = new Map();
  cards
    .map(normalizeVideoCard)
    .filter(isLikelyVideoCard)
    .forEach((card) => {
      const key = card.url && !INVALID_VIDEO_URL_RE.test(card.url)
        ? card.url.split("#")[0]
        : `${card.title}|${hashText(card.text.slice(0, 180))}`;
      const existing = map.get(key);
      if (!existing || cardQuality(card) > cardQuality(existing) || (card.text.length < existing.text.length && cardQuality(card) >= cardQuality(existing))) {
        map.set(key, card);
      }
    });
  return [...map.values()]
    .sort((left, right) => (right.priority || 0) - (left.priority || 0) || cardQuality(right) - cardQuality(left))
    .slice(0, maxVideos);
}

function hasSnapshotMetrics(snapshot = {}) {
  return [
    snapshot.views,
    snapshot.likes,
    snapshot.comments,
    snapshot.favorites,
    snapshot.shares,
    snapshot.impressions,
    snapshot.clickThroughRate,
    snapshot.completeRate,
    snapshot.threeSecondRetention,
    snapshot.fiveSecondRetention,
    snapshot.avgWatchSeconds,
    snapshot.profileVisits,
    snapshot.messages,
    snapshot.leads,
    snapshot.followersGained
  ].some((value) => Number(value) > 0);
}

function isUsefulSnapshot(snapshot = {}) {
  const title = normalizeText(snapshot.title);
  const url = normalizeText(snapshot.url);
  if (!title && !url) return false;
  if (title && INVALID_VIDEO_TITLE_RE.test(title)) return false;
  if (url && INVALID_VIDEO_URL_RE.test(url)) return false;
  return hasSnapshotMetrics(snapshot) || looksLikeVideoUrl(url);
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
        text: node.textContent || "",
        rawText: node.innerText || node.textContent || "",
        priority: 10
      };
    }), listSelectors).catch(() => []);
    return dedupeCards(cards, maxVideos);
  }

  const anchors = await page.locator("a[href]").evaluateAll((nodes) => nodes.map((node) => ({
    title: (node.textContent || "").trim(),
    url: node.href || "",
    text: (node.closest("li,article,tr,[role='listitem']")?.textContent || node.closest("div")?.textContent || node.textContent || "").trim(),
    rawText: (node.closest("li,article,tr,[role='listitem']")?.innerText || node.closest("div")?.innerText || node.textContent || "").trim(),
    priority: 4
  }))).catch(() => []);
  const genericCards = [];
  const locator = page.locator(GENERIC_VIDEO_CARD_SELECTOR);
  const count = Math.min(await locator.count().catch(() => 0), 220);
  for (let index = 0; index < count; index += 1) {
    const item = await locator.nth(index).evaluate((node) => {
      const rect = node.getBoundingClientRect();
      const style = window.getComputedStyle(node);
      if (style.display === "none" || style.visibility === "hidden" || rect.width < 80 || rect.height < 28) return null;
      const rawText = node.innerText || node.textContent || "";
      const linkNode = node.querySelector("a[href]");
      const imgNode = node.querySelector("img[alt]");
      return {
        title: imgNode?.alt || rawText.split(/\n|\r/).find((line) => line.trim().length >= 4) || "",
        url: linkNode?.href || "",
        text: rawText,
        rawText,
        width: rect.width,
        height: rect.height
      };
    }).catch(() => null);
    if (!item) continue;
    const normalized = normalizeVideoCard({
      ...item,
      cardSelector: GENERIC_VIDEO_CARD_SELECTOR,
      cardIndex: index,
      priority: 1
    });
    if (normalized.text.length < 8 || normalized.text.length > 1500) continue;
    if (!hasVideoMetricText(normalized.text) && !looksLikeVideoUrl(normalized.url) && !extractPublishedAt(normalized.text)) continue;
    if (/登录|扫码|验证码|帮助中心|官方文档|运营规范/.test(normalized.title)) continue;
    genericCards.push(normalized);
  }
  return dedupeCards([...anchors, ...genericCards], maxVideos);
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
    views: selectors.views ? await readSelectorNumber(page, selectors.views) : valueAfterLabels(text, METRIC_LABELS.views),
    likes: selectors.likes ? await readSelectorNumber(page, selectors.likes) : valueAfterLabels(text, METRIC_LABELS.likes),
    comments: selectors.comments ? await readSelectorNumber(page, selectors.comments) : valueAfterLabels(text, METRIC_LABELS.comments),
    favorites: selectors.favorites ? await readSelectorNumber(page, selectors.favorites) : valueAfterLabels(text, METRIC_LABELS.favorites),
    shares: selectors.shares ? await readSelectorNumber(page, selectors.shares) : valueAfterLabels(text, METRIC_LABELS.shares),
    impressions: selectors.impressions ? await readSelectorNumber(page, selectors.impressions) : valueAfterLabels(text, METRIC_LABELS.impressions),
    clickThroughRate: selectors.clickThroughRate ? await readSelectorNumber(page, selectors.clickThroughRate) : valueAfterLabels(text, METRIC_LABELS.clickThroughRate),
    completeRate: selectors.completeRate ? await readSelectorNumber(page, selectors.completeRate) : valueAfterLabels(text, METRIC_LABELS.completeRate),
    threeSecondRetention: selectors.threeSecondRetention ? await readSelectorNumber(page, selectors.threeSecondRetention) : valueAfterLabels(text, METRIC_LABELS.threeSecondRetention),
    fiveSecondRetention: selectors.fiveSecondRetention ? await readSelectorNumber(page, selectors.fiveSecondRetention) : valueAfterLabels(text, METRIC_LABELS.fiveSecondRetention),
    avgWatchSeconds: selectors.avgWatchSeconds ? await readSelectorNumber(page, selectors.avgWatchSeconds) : valueAfterLabels(text, METRIC_LABELS.avgWatchSeconds),
    videoDurationSeconds: selectors.videoDurationSeconds ? await readSelectorNumber(page, selectors.videoDurationSeconds) : extractDurationSeconds(text),
    profileVisits: selectors.profileVisits ? await readSelectorNumber(page, selectors.profileVisits) : valueAfterLabels(text, METRIC_LABELS.profileVisits),
    messages: selectors.messages ? await readSelectorNumber(page, selectors.messages) : valueAfterLabels(text, METRIC_LABELS.messages),
    leads: selectors.leads ? await readSelectorNumber(page, selectors.leads) : valueAfterLabels(text, METRIC_LABELS.leads),
    followersGained: selectors.followersGained ? await readSelectorNumber(page, selectors.followersGained) : valueAfterLabels(text, ["涨粉", "新增粉丝"]),
    platformAdvice,
    notes: "",
    source: "playwright-agent"
  };
  snapshot.id = `snapshot-${hashText([snapshot.platform, snapshot.accountName, snapshot.videoId, snapshot.capturedAt].join("|"))}`;
  return snapshot;
}

function extractSnapshotFromCard(account, card) {
  const text = card.rawText || card.text || card.title || "";
  const metrics = extractMetricsFromText(text);
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
    ...metrics,
    platformAdvice: "",
    source: "playwright-agent-list"
  };
  snapshot.id = `snapshot-${hashText([snapshot.platform, snapshot.accountName, snapshot.videoId, snapshot.capturedAt].join("|"))}`;
  return snapshot;
}

function mergeSnapshotData(primary, fallback) {
  const base = fallback || {};
  const detail = primary || {};
  const merged = { ...base, ...detail };
  [
    "title",
    "url",
    "topic",
    "publishedAt",
    "platformAdvice",
    "notes",
    "source"
  ].forEach((key) => {
    if (!normalizeText(merged[key]) && normalizeText(base[key])) merged[key] = base[key];
  });
  [
    "views",
    "likes",
    "comments",
    "favorites",
    "shares",
    "impressions",
    "clickThroughRate",
    "completeRate",
    "threeSecondRetention",
    "fiveSecondRetention",
    "avgWatchSeconds",
    "videoDurationSeconds",
    "profileVisits",
    "messages",
    "leads",
    "followersGained"
  ].forEach((key) => {
    if (!Number(merged[key]) && Number(base[key])) merged[key] = base[key];
  });
  merged.source = [detail.source, base.source].filter(Boolean).filter((value, index, arr) => arr.indexOf(value) === index).join("+") || "playwright-agent";
  merged.id = `snapshot-${hashText([merged.platform, merged.accountName, merged.videoId || merged.url || merged.title, merged.capturedAt].join("|"))}`;
  return merged;
}

async function clickCardForSnapshot(page, account, card, config) {
  if (!card.cardSelector || !Number.isInteger(card.cardIndex)) return null;
  const locator = page.locator(card.cardSelector).nth(card.cardIndex);
  const beforeUrl = page.url();
  let popup = null;
  try {
    await locator.scrollIntoViewIfNeeded({ timeout: 4000 });
    await randomDelay(config);
    const popupPromise = page.waitForEvent("popup", { timeout: 5000 }).catch(() => null);
    await locator.click({ timeout: 6500 });
    popup = await popupPromise;
    const targetPage = popup || page;
    await targetPage.waitForLoadState("domcontentloaded", { timeout: 12000 }).catch(() => {});
    await targetPage.waitForLoadState("networkidle", { timeout: 12000 }).catch(() => {});
    await randomDelay(config);
    return await extractVideoSnapshot(targetPage, account, card, config);
  } finally {
    if (popup) {
      await popup.close().catch(() => {});
    } else {
      await page.keyboard.press("Escape").catch(() => {});
      if (page.url() !== beforeUrl) {
        await page.goBack({ waitUntil: "domcontentloaded", timeout: 10000 }).catch(async () => {
          await gotoSafe(page, account.videoListUrl, config).catch(() => {});
        });
      }
    }
  }
}

async function collectAccount(context, account, config, onProgress = async () => {}) {
  const page = await context.newPage();
  const warnings = [];
  const accountAudits = [];
  const snapshots = [];

  try {
    if (account.dashboardUrl) {
      await onProgress(`打开${account.platform}账号首页`, { currentAccount: account.name, currentPlatform: account.platform });
      await gotoSafe(page, account.dashboardUrl, config);
      const text = await pageText(page);
      if (hasLoginBarrier(text)) {
        const screenshot = await saveEvidence(page, config, `${account.name}-login-required`);
        warnings.push(`${account.platform}｜${account.name} 可能需要重新登录或验证，截图：${screenshot}`);
      }
      await onProgress(`读取${account.platform}账号概览`, { currentAccount: account.name, currentPlatform: account.platform });
      accountAudits.push(await extractAccountAudit(page, account, config));
    }

    if (account.videoListUrl) {
      await onProgress(`进入${account.platform}作品列表`, { currentAccount: account.name, currentPlatform: account.platform });
      await gotoSafe(page, account.videoListUrl, config);
      const text = await pageText(page);
      if (hasLoginBarrier(text)) {
        const screenshot = await saveEvidence(page, config, `${account.name}-video-list-login-required`);
        warnings.push(`${account.platform}｜${account.name} 视频列表可能需要登录验证，截图：${screenshot}`);
      }
      await onProgress(`识别${account.platform}作品卡片`, { currentAccount: account.name, currentPlatform: account.platform });
      const cards = await collectVideoCards(page, account, config);
      if (!cards.length) {
        const screenshot = await saveEvidence(page, config, `${account.name}-video-list-no-cards`);
        warnings.push(`${account.platform}｜${account.name} 没有识别到有效视频卡片。可能需要补充 selectors，或后台列表当前没有展示视频数据。截图：${screenshot}`);
      }
      for (let cardIndex = 0; cardIndex < cards.length; cardIndex += 1) {
        const card = cards[cardIndex];
        await onProgress(`采集第 ${cardIndex + 1}/${cards.length} 条作品`, {
          currentAccount: account.name,
          currentPlatform: account.platform,
          currentVideo: card.title || card.url || ""
        });
        const listSnapshot = extractSnapshotFromCard(account, card);
        let snapshot = isUsefulSnapshot(listSnapshot) ? listSnapshot : null;
        if (isNavigableHttpUrl(card.url)) {
          const detailPage = await context.newPage();
          try {
            await gotoSafe(detailPage, card.url, config);
            const detailSnapshot = await extractVideoSnapshot(detailPage, account, card, config);
            snapshot = mergeSnapshotData(detailSnapshot, listSnapshot);
          } catch (error) {
            warnings.push(`${account.platform}｜${account.name} 视频详情采集失败，已保留列表数据：${card.title || card.url}｜${error.message}`);
          } finally {
            await detailPage.close().catch(() => {});
          }
        } else if (card.cardSelector && Number.isInteger(card.cardIndex)) {
          try {
            const clickSnapshot = await clickCardForSnapshot(page, account, card, config);
            if (clickSnapshot) snapshot = mergeSnapshotData(clickSnapshot, listSnapshot);
          } catch (error) {
            warnings.push(`${account.platform}｜${account.name} 点击作品卡片详情失败，已保留列表数据：${card.title || card.url}｜${error.message}`);
          }
        }
        if (snapshot && isUsefulSnapshot(snapshot)) {
          snapshots.push(snapshot);
        } else {
          warnings.push(`${account.platform}｜${account.name} 已跳过无有效数据的视频候选：${card.title || card.url}`);
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

async function collect(configPath, runtimeOptions = {}) {
  const config = applyRuntimeOptions(await loadConfig(configPath), runtimeOptions);
  await ensureDir(config.dataDir || DEFAULT_DATA_DIR);
  const enabledAccounts = (config.accounts || []).filter((account) => account.enabled !== false);
  const runId = `video-run-${Date.now().toString(36)}`;
  const startedAt = nowIso();
  let completedPhases = 0;
  const totalPhases = Math.max(1, enabledAccounts.length * 6 + 4);
  const plan = collectionPlan(config);
  const payload = {
    accounts: normalizeAccountsForPayload(config),
    accountAudits: [],
    snapshots: [],
    warnings: [],
    collectedAt: nowIso(),
    source: "mac-mini-playwright-agent",
    collectionPlan: plan,
    collectorStatus: {
      status: "running",
      runId,
      startedAt,
      updatedAt: startedAt,
      progress: 0,
      stepLabel: "准备启动采集器",
      currentAccount: "",
      currentPlatform: "",
      currentVideo: "",
      totalAccounts: enabledAccounts.length,
      targetPerAccount: plan.targetPerAccount,
      scanMode: plan.mode,
      sampleMethod: plan.sampleMethod,
      accountsDone: 0,
      auditsCount: 0,
      snapshotsCount: 0,
      warningsCount: 0,
      message: `Mac mini 正在准备打开创作者中心。本轮为${plan.mode}，每个账号最多采 ${plan.targetPerAccount} 条作品。`
    }
  };
  let context = null;
  let lastStatusSyncAt = 0;

  const updateStatus = async (stepLabel, extra = {}) => {
    if (extra.increment !== false) completedPhases = Math.min(totalPhases, completedPhases + 1);
    payload.collectorStatus = {
      ...payload.collectorStatus,
      status: extra.status || "running",
      updatedAt: nowIso(),
      stepLabel,
      progress: Number.isFinite(extra.progress) ? extra.progress : Math.min(98, Math.round((completedPhases / totalPhases) * 100)),
      accountsDone: extra.accountsDone ?? payload.collectorStatus.accountsDone,
      auditsCount: payload.accountAudits.length,
      snapshotsCount: payload.snapshots.length,
      warningsCount: payload.warnings.length,
      targetPerAccount: plan.targetPerAccount,
      scanMode: plan.mode,
      sampleMethod: plan.sampleMethod,
      currentAccount: extra.currentAccount ?? payload.collectorStatus.currentAccount,
      currentPlatform: extra.currentPlatform ?? payload.collectorStatus.currentPlatform,
      currentVideo: extra.currentVideo ?? "",
      message: extra.message || stepLabel
    };
    console.log(`进度 ${payload.collectorStatus.progress}%｜${stepLabel}`);
    const shouldPublish = extra.force || payload.collectorStatus.status !== "running" || Date.now() - lastStatusSyncAt >= 2500;
    if (shouldPublish) {
      lastStatusSyncAt = Date.now();
      await publishCollectorStatus(config, payload.collectorStatus);
    } else {
      const statusFile = path.join(config.dataDir || DEFAULT_DATA_DIR, "latest-video-ops-status.json");
      await writeJson(statusFile, payload.collectorStatus).catch(() => {});
    }
  };

  try {
    await updateStatus("启动独立 Chrome", { progress: 3, force: true, message: "正在打开专门用于采集的 Chrome 档案。" });
    context = await openContext(config);
    for (let accountIndex = 0; accountIndex < enabledAccounts.length; accountIndex += 1) {
      const account = enabledAccounts[accountIndex];
      console.log(`采集 ${account.platform}｜${account.name}`);
      await updateStatus(`开始采集 ${account.platform}｜${account.name}`, {
        currentAccount: account.name,
        currentPlatform: account.platform,
        message: `正在处理第 ${accountIndex + 1}/${enabledAccounts.length} 个账号。`
      });
      const result = await collectAccount(context, account, config, async (label, extra = {}) => {
        await updateStatus(label, extra);
      });
      payload.accountAudits.push(...result.accountAudits);
      payload.snapshots.push(...result.snapshots);
      payload.warnings.push(...result.warnings);
      await updateStatus(`完成 ${account.platform}｜${account.name}`, {
        accountsDone: accountIndex + 1,
        currentAccount: account.name,
        currentPlatform: account.platform,
        message: `该账号采集完成，累计采到账号体检 ${payload.accountAudits.length} 条、视频快照 ${payload.snapshots.length} 条。`
      });
    }
    await updateStatus("整理采集结果", { force: true, message: "正在保存本地文件，并准备推送到网站。" });
  } catch (error) {
    payload.collectorStatus = {
      ...payload.collectorStatus,
      status: "failed",
      finishedAt: nowIso(),
      updatedAt: nowIso(),
      stepLabel: "采集失败",
      message: error?.message || String(error),
      warningsCount: payload.warnings.length + 1
    };
    await publishCollectorStatus(config, payload.collectorStatus);
    throw error;
  } finally {
    if (context) await context.close().catch(() => {});
  }

  const outputFile = path.join(config.dataDir || DEFAULT_DATA_DIR, "latest-video-ops-payload.json");
  const datedFile = path.join(config.dataDir || DEFAULT_DATA_DIR, "history", `video-ops-${new Date().toISOString().slice(0, 10)}-${Date.now()}.json`);
  payload.collectorStatus = {
    ...payload.collectorStatus,
    status: payload.warnings.length ? "warning" : "success",
    finishedAt: nowIso(),
    updatedAt: nowIso(),
    progress: 100,
    stepLabel: payload.warnings.length ? "采集完成，有部分内容需要查看" : "采集完成",
    currentAccount: "",
    currentPlatform: "",
    currentVideo: "",
    auditsCount: payload.accountAudits.length,
    snapshotsCount: payload.snapshots.length,
    warningsCount: payload.warnings.length,
    message: `采集结束：账号体检 ${payload.accountAudits.length} 条，视频快照 ${payload.snapshots.length} 条。`
  };
  await writeJson(outputFile, payload);
  await writeJson(datedFile, payload);
  await publishCollectorStatus(config, payload.collectorStatus);
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
  const response = await fetch(`${apiBase(config)}/module-data?storeKey=${encodeURIComponent(config.storeKey || DEFAULT_STORE_KEY)}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!response.ok) return null;
  const result = await response.json();
  return result?.payload || result?.data?.payload || null;
}

async function writeRemoteState(config, token, payload) {
  if (!config.apiBaseUrl || !token) return null;
  const response = await fetch(`${apiBase(config)}/module-data`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      storeKey: config.storeKey || DEFAULT_STORE_KEY,
      moduleKey: config.moduleKey || DEFAULT_MODULE_KEY,
      payload,
      replaceMode: "replace",
      operatorName: config.operator?.name || "Mac mini 短视频机器人",
      operatorUsername: config.operator?.username || "video_ops_agent"
    })
  });
  const resultText = await response.text();
  if (!response.ok) throw new Error(`推送失败 ${response.status}: ${resultText}`);
  return resultText;
}

async function publishCollectorStatus(config, statusPatch) {
  const status = {
    updatedAt: nowIso(),
    ...statusPatch
  };
  const statusFile = path.join(config.dataDir || DEFAULT_DATA_DIR, "latest-video-ops-status.json");
  await writeJson(statusFile, status).catch(() => {});
  const token = apiToken(config);
  if (!token || !config.apiBaseUrl) return status;
  try {
    const existing = await readRemoteState(config, token);
    const merged = mergePayloads(existing, { collectorStatus: status });
    await writeRemoteState(config, token, merged);
  } catch (error) {
    console.warn(`进度同步到网页失败：${error.message}`);
  }
  return status;
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
    snapshots: mergeByKey([...(oldState.snapshots || []), ...(oldState.videos || []), ...(newState.snapshots || [])].filter(isUsefulSnapshot), (row) => row.id || [row.platform, row.accountName, row.videoId || row.url || row.title, row.capturedAt].join("|")),
    collectorStatus: newState.collectorStatus || oldState.collectorStatus || null,
    collectionPlan: newState.collectionPlan || oldState.collectionPlan || null,
    warnings: [...(oldState.warnings || []), ...(newState.warnings || [])].slice(-40),
    updatedAt: nowIso(),
    source: "mac-mini-playwright-agent"
  };
}

async function pushPayload(configPath, filePath = "") {
  const config = await loadConfig(configPath);
  const token = apiToken(config);
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
  const resultText = await writeRemoteState(config, token, merged);
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
  node scripts/video-ops-agent.mjs collect [--config 路径] [--max-videos 数量]
  node scripts/video-ops-agent.mjs push [--config 路径] [--file JSON路径]
  node scripts/video-ops-agent.mjs run [--config 路径] [--max-videos 数量]

说明：
  init     创建配置文件
  login    打开独立 Chrome 档案，人工扫码登录抖音/视频号后台
  collect  自动打开后台并采集账号体检、视频数据、平台建议；默认每个账号采最近 30 条
  push     推送 latest-video-ops-payload.json 到网站短视频系统
  run      collect + push；如果没有 API Token，会保留本地 JSON，不会丢数据

采集策略：
  默认不是随机采集，而是按创作者中心作品列表顺序优先采最近作品。
  日常巡检建议 30 条；阶段体检建议 80-100 条；首次建档可用 150-300 条。
`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const command = args._[0] || "help";
  const configPath = path.resolve(String(args.config || process.env.VIDEO_OPS_AGENT_CONFIG || DEFAULT_CONFIG_PATH));
  if (command === "help" || command === "--help") return usage();
  if (command === "init") return await initConfig(configPath);
  if (command === "login") return await login(configPath);
  if (command === "collect") return await collect(configPath, args);
  if (command === "push") return await pushPayload(configPath, args.file ? path.resolve(String(args.file)) : "");
  if (command === "run") {
    await collect(configPath, args);
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
