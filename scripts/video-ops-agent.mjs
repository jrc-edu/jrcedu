#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import process from "node:process";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const SCRIPT_FILE = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(SCRIPT_FILE), "..");
const DEFAULT_STORE_KEY = "jrc-video-ops-monitor-v1";
const DEFAULT_MODULE_KEY = "videoOps";
const DEFAULT_DATA_DIR = path.join(os.homedir(), "Documents", "JRC-Video-Ops-Agent");
const DEFAULT_PROFILE_DIR = path.join(os.homedir(), "Library", "Application Support", "JRC Video Ops Agent", "ChromeProfile");
const DEFAULT_CONFIG_PATH = path.join(DEFAULT_DATA_DIR, "config.json");
const DEFAULT_CHROME_PATH = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const DEFAULT_BENCHMARK_ACCOUNTS_PATH = path.join(REPO_ROOT, "data", "video_benchmark_accounts.json");
const LOGIN_HINTS = ["扫码登录", "微信扫码", "登录", "验证码", "安全验证", "请验证", "重新登录"];
const INVALID_VIDEO_TITLE_RE = /^(内容管理|视频\s*\(\d+\)|了解详情|关于腾讯|微信视频号运营规范|首页|帮助|通知|消息|设置|活动管理|数据中心|创作中心|互动管理|变现中心|发布|反馈|登录|扫码登录|下载抖音精选|用户服务协议|平均播放时长|平均观看时长|人均观看时长|封面点击率|播放点击率|点击率|播放量|点赞量|评论量|收藏量|分享量|转发量|完播率|播放完成率|3秒留存|三秒留存|5秒留存|五秒留存|\d{1,2}:\d{2})$/i;
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
  views: ["播放量", "播放次数", "播放", "观看量", "观看次数", "观看", "浏览量", "浏览", "阅读量", "阅读"],
  likes: ["点赞量", "点赞数", "点赞", "喜欢"],
  comments: ["评论量", "评论数", "评论"],
  favorites: ["收藏量", "收藏数", "收藏"],
  shares: ["转发量", "分享量", "转发", "分享"],
  impressions: ["曝光量", "展现量", "推荐曝光", "曝光次数", "曝光", "展现"],
  clickThroughRate: ["点击率", "封面点击率", "播放点击率", "封面进入率", "播放进入率"],
  completeRate: ["完播率", "播放完成率", "完成率", "完整播放率"],
  threeSecondRetention: ["3秒留存", "三秒留存", "3 秒留存"],
  fiveSecondRetention: ["5秒留存", "五秒留存", "5 秒留存"],
  avgWatchSeconds: ["平均播放时长", "平均观看时长", "人均观看时长", "平均观看", "平均播放"],
  videoDurationSeconds: ["视频时长", "作品时长", "时长"],
  profileVisits: ["主页访问人数", "主页访问量", "主页访问", "主页访客", "主页浏览", "主页点击"],
  messages: ["私信咨询", "私信人数", "私信用户", "私信", "咨询", "消息"],
  leads: ["有效线索", "线索量", "线索", "有效咨询", "留资数", "留资", "表单提交", "表单", "客资"]
};
const DEEP_ACCOUNT_LINK_LABELS = [
  "数据中心",
  "数据概览",
  "账号诊断",
  "作品数据",
  "内容数据",
  "粉丝画像",
  "观众画像",
  "粉丝数据",
  "流量分析",
  "搜索分析",
  "互动数据",
  "经营数据",
  "转化数据",
  "线索管理"
];
const DEEP_VIDEO_CONTROL_LABELS = [
  "数据",
  "作品数据",
  "视频数据",
  "数据分析",
  "流量分析",
  "观众分析",
  "粉丝画像",
  "互动数据",
  "转化数据",
  "诊断",
  "建议",
  "详情"
];
const UNSAFE_CONTROL_RE = /发布|删除|编辑|修改|保存|确定|确认|取消|关闭|投放|推广|充值|授权|退出|登录|扫码|上传|下载|复制链接|分享/i;
const METRIC_KEY_PATTERNS = {
  views: [/play[_-]?count/i, /view[_-]?count/i, /watch[_-]?count/i, /read[_-]?count/i, /播放|观看|浏览|阅读/],
  likes: [/like[_-]?count/i, /digg[_-]?count/i, /点赞|喜欢/],
  comments: [/comment[_-]?count/i, /评论/],
  favorites: [/collect[_-]?count/i, /favorite[_-]?count/i, /收藏/],
  shares: [/share[_-]?count/i, /forward[_-]?count/i, /转发|分享/],
  impressions: [/show[_-]?count/i, /impression/i, /exposure/i, /曝光|展现/],
  clickThroughRate: [/click.*rate/i, /\bctr\b/i, /点击率|封面进入率|播放进入率/],
  completeRate: [/complete.*rate/i, /finish.*rate/i, /完播率|完成率/],
  threeSecondRetention: [/3.*retention/i, /retention.*3/i, /3秒留存|三秒留存/],
  fiveSecondRetention: [/5.*retention/i, /retention.*5/i, /5秒留存|五秒留存/],
  avgWatchSeconds: [/avg.*watch/i, /average.*watch/i, /平均.*观看|平均.*播放/],
  videoDurationSeconds: [/duration/i, /视频时长|作品时长|时长/],
  profileVisits: [/profile.*visit/i, /home.*visit/i, /主页访问|主页浏览|主页访客/],
  messages: [/message/i, /private.*message/i, /私信|咨询|消息/],
  leads: [/lead/i, /clue/i, /form/i, /线索|留资|表单|客资/],
  followersGained: [/new.*fan/i, /new.*follower/i, /follower.*gain/i, /涨粉|新增粉丝/]
};
const SENSITIVE_KEY_RE = /token|cookie|session|secret|password|authorization|credential|ticket|csrf|sign/i;

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

function textHasAny(value, patterns = []) {
  const text = String(value || "");
  return patterns.some((pattern) => pattern.test(text));
}

function inferVideoTags(row = {}) {
  const text = normalizeText([
    row.title,
    row.topic,
    row.platformAdvice,
    ...(row.searchKeywords || []),
    ...(row.trafficSourceLines || [])
  ].join(" "));
  const rules = [
    ["宁波本地", /宁波|鄞州|本地|同城|附近|效实|鄞中|蛟川|蓝青|宋诏桥/],
    ["小升初", /小升初|六年级|分班考|小初衔接/],
    ["中考", /中考|初三|九年级|压轴|重点高中/],
    ["初一", /初一|七年级|有理数|整式/],
    ["初二", /初二|八年级|分式|二次根式|全等|相似/],
    ["初三", /初三|九年级|中考|二次函数|圆/],
    ["小学奥数", /小学|奥数|举一反三|高斯|算式谜|数字谜/],
    ["几何", /几何|三角形|四边形|圆|全等|相似|辅助线|折叠|K字/],
    ["计算", /计算|巧算|分数|根号|有理数|绝对值|代数/],
    ["选拔真题", /选拔|真题|强基|自招|大讲堂|竞赛/],
    ["暑假规划", /暑假|暑期|预习|衔接|弯道/],
    ["学习方法", /方法|习惯|粗心|不开窍|听不懂|跟不上|提分|补弱/],
    ["家长焦虑", /家长|焦虑|掉队|分化|后悔|来不及|怎么办/],
    ["招生转化", /咨询|报名|试听|课程|班课|刷题班|培优/]
  ];
  const tags = rules.filter(([, pattern]) => pattern.test(text)).map(([label]) => label);
  if (Number(row.views || 0) >= 5000) tags.push("品牌曝光");
  if (Number(row.followersGained || 0) > 0) tags.push("涨粉");
  if (Number(row.leads || 0) + Number(row.messages || 0) > 0) tags.push("咨询线索");
  if (Number(row.favorites || 0) + Number(row.shares || 0) > 0) tags.push("收藏转发");
  return tags.filter((tag, index, arr) => arr.indexOf(tag) === index).slice(0, 10);
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
      maxDelayMs: 2200,
      manualConfirm: false,
      strictCollection: true,
      autoOpenDetails: false,
      deepOwnDetails: false
    },
    benchmarks: {
      enabled: true,
      source: DEFAULT_BENCHMARK_ACCOUNTS_PATH,
      publicCollection: {
        enabled: false,
        accountsPerRun: 8,
        videosPerAccount: 8,
        rotateDaily: true,
        searchUrlTemplate: "https://www.douyin.com/search/{keyword}?type=video"
      },
      note: "标杆账号库只作为对照名单。默认不自动采集公开视频，避免公开搜索结果混入无效信息。"
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

function accountConfigKey(row = {}) {
  return [
    normalizeText(row.platform),
    normalizeText(row.name || row.accountName || row.nickname),
    normalizeText(row.accountType || "自有账号")
  ].join("|");
}

function resolveBenchmarkPath(source) {
  const raw = normalizeText(source);
  if (!raw) return DEFAULT_BENCHMARK_ACCOUNTS_PATH;
  return path.isAbsolute(raw) ? raw : path.resolve(REPO_ROOT, raw);
}

async function loadBenchmarkAccounts(benchmarks = {}) {
  if (benchmarks.enabled === false) return [];
  const filePath = resolveBenchmarkPath(benchmarks.source || DEFAULT_BENCHMARK_ACCOUNTS_PATH);
  const rows = await readJson(filePath, []);
  return (Array.isArray(rows) ? rows : [])
    .filter((row) => row && row.enabled !== false)
    .map((row) => ({
      ...row,
      platform: row.platform || "抖音",
      accountType: row.accountType || "同行账号",
      owner: row.owner || "公开标杆",
      defaultTopic: row.defaultTopic || "数学教育",
      collectionEnabled: row.collectionEnabled === true,
      note: row.note || "公开标杆账号库；抖音账号已收录，视频号待平台内确认后补充。"
    }))
    .filter((row) => row.name);
}

function mergeBenchmarkConfig(defaults = {}, incoming = {}) {
  return {
    ...defaults,
    ...incoming,
    publicCollection: {
      ...(defaults.publicCollection || {}),
      ...(incoming.publicCollection || {})
    }
  };
}

function mergeAccountConfigs(primaryAccounts = [], benchmarkAccounts = []) {
  const map = new Map();
  [...benchmarkAccounts, ...primaryAccounts].forEach((account) => {
    const key = accountConfigKey(account);
    if (!key.replace(/\|/g, "")) return;
    map.set(key, { ...(map.get(key) || {}), ...account });
  });
  return [...map.values()];
}

async function loadConfig(configPath) {
  const defaults = defaultConfig();
  const exists = await pathExists(configPath);
  if (!exists) {
    const config = defaults;
    await writeJson(configPath, config);
    const benchmarkAccounts = await loadBenchmarkAccounts(config.benchmarks);
    return { ...config, accounts: mergeAccountConfigs(config.accounts, benchmarkAccounts) };
  }
  const userConfig = await readJson(configPath, {});
  const config = {
    ...defaults,
    ...userConfig,
    limits: { ...defaults.limits, ...(userConfig.limits || {}) },
    operator: { ...defaults.operator, ...(userConfig.operator || {}) },
    benchmarks: mergeBenchmarkConfig(defaults.benchmarks, userConfig.benchmarks || {}),
    accounts: Array.isArray(userConfig.accounts) ? userConfig.accounts : defaults.accounts
  };
  const benchmarkAccounts = await loadBenchmarkAccounts(config.benchmarks);
  return { ...config, accounts: mergeAccountConfigs(config.accounts, benchmarkAccounts) };
}

function applyRuntimeOptions(config, options = {}) {
  const next = {
    ...config,
    limits: { ...(config.limits || {}) },
    benchmarks: mergeBenchmarkConfig(defaultConfig().benchmarks, config.benchmarks || {})
  };
  const maxVideos = parseNumber(options.maxVideos || options["max-videos"] || process.env.VIDEO_OPS_MAX_VIDEOS);
  if (maxVideos > 0) next.limits.maxVideosPerAccount = Math.max(1, Math.min(500, Math.round(maxVideos)));
  const scanMode = normalizeText(options.scanMode || options["scan-mode"] || process.env.VIDEO_OPS_SCAN_MODE);
  if (scanMode) next.scanMode = scanMode;
  const benchmarkAccounts = parseNumber(options.benchmarkAccounts || options["benchmark-accounts"] || process.env.VIDEO_OPS_BENCHMARK_ACCOUNTS);
  if (benchmarkAccounts > 0) {
    next.benchmarks.publicCollection.accountsPerRun = Math.max(1, Math.min(47, Math.round(benchmarkAccounts)));
  }
  const benchmarkVideos = parseNumber(options.benchmarkVideos || options["benchmark-videos"] || process.env.VIDEO_OPS_BENCHMARK_VIDEOS);
  if (benchmarkVideos > 0) {
    next.benchmarks.publicCollection.videosPerAccount = Math.max(1, Math.min(50, Math.round(benchmarkVideos)));
  }
  next.benchmarks.publicCollection.enabled = false;
  if (options.benchmarkTop || options["benchmark-top"] || process.env.VIDEO_OPS_BENCHMARK_TOP === "1") {
    next.benchmarks.publicCollection.rotateDaily = false;
  }
  if (options.withBenchmarks || options["with-benchmarks"] || process.env.VIDEO_OPS_WITH_BENCHMARKS === "1") {
    next.benchmarks.publicCollection.enabled = true;
  }
  if (options.noBenchmarks || options["no-benchmarks"] || process.env.VIDEO_OPS_NO_BENCHMARKS === "1") {
    next.benchmarks.publicCollection.enabled = false;
  }
  next.limits.manualConfirm = false;
  if (options.manual || options["manual-confirm"] || process.env.VIDEO_OPS_MANUAL_CONFIRM === "1") {
    next.limits.manualConfirm = true;
  }
  if (options.openDetails || options["open-details"] || process.env.VIDEO_OPS_OPEN_DETAILS === "1") {
    next.limits.autoOpenDetails = true;
  }
  if (options.deepOwn || options["deep-own"] || options.ownDetails || options["own-details"] || process.env.VIDEO_OPS_DEEP_OWN === "1") {
    next.limits.deepOwnDetails = true;
  }
  if (options.fresh || options.rebuild || options["replace-data"] || process.env.VIDEO_OPS_FRESH === "1") {
    next.rebuildMode = true;
  }
  return next;
}

function collectionPlan(config) {
  const maxVideos = Number(config.limits?.maxVideosPerAccount || 30);
  const mode = normalizeText(config.scanMode) || (maxVideos <= 50 ? "日常轻量巡检" : maxVideos <= 150 ? "每周阶段复盘" : "月度全量校验");
  const publicCollection = config.benchmarks?.publicCollection || {};
  const benchmarkEnabled = publicCollection.enabled !== false;
  const benchmarkAccounts = benchmarkEnabled ? Number(publicCollection.accountsPerRun || 8) : 0;
  const benchmarkVideos = benchmarkEnabled ? Number(publicCollection.videosPerAccount || 8) : 0;
  const cadence = maxVideos <= 50 ? "daily" : maxVideos <= 150 ? "weekly" : "monthly";
  return {
    mode,
    cadence,
    targetPerAccount: maxVideos,
    benchmarkAccountsPerRun: benchmarkAccounts,
    benchmarkVideosPerAccount: benchmarkVideos,
    deepOwnDetails: Boolean(config.limits?.deepOwnDetails),
    sampleMethod: benchmarkEnabled
      ? `自有账号自动读取后台并用可信度规则过滤；标杆账号仅在明确开启时采公开视频，本轮计划 ${benchmarkAccounts} 个标杆账号、每个最多 ${benchmarkVideos} 条。`
      : "自动读取自有账号后台；默认只采自有账号，不再自动采标杆公开搜索结果。页面不对、权限没进、字段不可信时自动跳过。",
    purpose: cadence === "daily"
      ? "适合每天看新发视频、最近 7 天变化和少量二次起量老视频。"
      : cadence === "weekly"
        ? "适合每周复盘最近 30 天内容，判断题材、留存、互动和转化的大方向。"
        : "适合首次建档或月度全量校验，用更大历史样本建立账号基准。",
    conclusionBoundary: maxVideos < 20
      ? "样本偏少，只能做方向提示，不能下账号级重结论。"
      : cadence === "daily"
        ? "可以判断当天和近 7 天变化，不用于重算长期账号定位。"
        : cadence === "weekly"
          ? "可以做近期阶段复盘，但长期基准仍以月度全量校验为准。"
          : "可以做较完整账号体检，但仍受平台后台可见数据限制。",
    fullScan: maxVideos >= 150,
    operatorControl: "今晚首次建档用 video:own-deep；以后每天用 video:daily，每周用 video:weekly，每月用 video:monthly。需要人工确认时才显式加 --manual。"
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

function splitSignalLines(text, limit = 24) {
  const metricWordRe = /播放|观看|浏览|阅读|点赞|评论|收藏|转发|分享|曝光|展现|完播|留存|点击率|平均|时长|主页|私信|咨询|线索|留资|表单|涨粉|粉丝|搜索|流量|诊断|建议|优化|转化/i;
  return String(text || "")
    .split(/\n|\r|(?<=[。！？!?；;])/)
    .map(normalizeText)
    .filter((line) => line.length >= 3 && line.length <= 180)
    .filter((line) => metricWordRe.test(line))
    .filter((line, index, arr) => arr.indexOf(line) === index)
    .slice(0, limit);
}

function flattenMetricSignals(value, prefix = "", rows = []) {
  if (rows.length >= 80 || value == null) return rows;
  if (typeof value === "number" || typeof value === "string" || typeof value === "boolean") {
    const key = normalizeText(prefix);
    const raw = normalizeText(value);
    if (key && raw && !SENSITIVE_KEY_RE.test(key)) {
      const useful = Object.values(METRIC_KEY_PATTERNS).flat().some((pattern) => pattern.test(key)) ||
        /播放|观看|浏览|点赞|评论|收藏|转发|分享|曝光|展现|完播|留存|点击率|主页|私信|咨询|线索|留资|粉丝|搜索|流量|诊断|建议|优化|转化/i.test(`${key} ${raw}`);
      if (useful) rows.push(`${key}：${raw}`.slice(0, 180));
    }
    return rows;
  }
  if (Array.isArray(value)) {
    value.slice(0, 30).forEach((item, index) => flattenMetricSignals(item, `${prefix}[${index}]`, rows));
    return rows;
  }
  if (typeof value === "object") {
    Object.entries(value).slice(0, 80).forEach(([key, item]) => {
      if (SENSITIVE_KEY_RE.test(key)) return;
      flattenMetricSignals(item, prefix ? `${prefix}.${key}` : key, rows);
    });
  }
  return rows;
}

function metricValueFromSignals(signals, key) {
  const patterns = METRIC_KEY_PATTERNS[key] || [];
  const rows = Array.isArray(signals) ? signals : [];
  let best = 0;
  rows.forEach((line) => {
    const [name = "", value = ""] = String(line).split(/[:：=]/);
    if (!patterns.some((pattern) => pattern.test(name))) return;
    const parsed = key === "avgWatchSeconds" || key === "videoDurationSeconds"
      ? parseDurationValue(value) || parseNumber(value)
      : parseNumber(value);
    if (Number(parsed) > Number(best)) best = parsed;
  });
  return best;
}

function extractMetricsFromSignals(signals) {
  return Object.fromEntries(Object.keys(METRIC_KEY_PATTERNS).map((key) => [key, metricValueFromSignals(signals, key)]));
}

function mergeMetricObjects(primary = {}, fallback = {}) {
  const merged = { ...primary };
  Object.keys(METRIC_KEY_PATTERNS).forEach((key) => {
    if (!Number(merged[key]) && Number(fallback[key])) merged[key] = fallback[key];
  });
  return merged;
}

function metricCompleteness(row = {}) {
  const groups = {
    core: ["views", "likes", "comments", "favorites", "shares"],
    reach: ["impressions", "clickThroughRate"],
    retention: ["completeRate", "threeSecondRetention", "fiveSecondRetention", "avgWatchSeconds", "videoDurationSeconds"],
    conversion: ["profileVisits", "messages", "leads", "followersGained"],
    traffic: ["trafficSourceLines", "searchKeywords"]
  };
  const result = {};
  Object.entries(groups).forEach(([group, keys]) => {
    result[group] = keys.filter((key) => Array.isArray(row[key]) ? row[key].length > 0 : Number(row[key]) > 0);
  });
  const totalFields = Object.values(groups).flat().length;
  const presentFields = Object.values(result).reduce((sum, keys) => sum + keys.length, 0);
  result.score = Math.round((presentFields / totalFields) * 100);
  result.summary = [
    `核心互动 ${result.core.length}/5`,
    `曝光点击 ${result.reach.length}/2`,
    `留存节奏 ${result.retention.length}/5`,
    `转化咨询 ${result.conversion.length}/4`,
    `流量来源 ${result.traffic.length}/2`
  ].join("，");
  return result;
}

function attachApiCapture(page, label = "") {
  const records = [];
  const handler = async (response) => {
    if (records.length >= 80) return;
    const url = response.url();
    if (!/creator|douyin|aweme|channels|weixin|data|stat|analysis|metric|video|item|post|feed|dashboard/i.test(url)) return;
    const contentType = response.headers()["content-type"] || "";
    if (!/json|javascript|text/i.test(contentType)) return;
    try {
      const json = contentType.includes("json") ? await response.json() : JSON.parse(await response.text());
      const signalLines = flattenMetricSignals(json).slice(0, 30);
      if (!signalLines.length) return;
      records.push({
        label,
        url: url.split("?")[0].slice(0, 180),
        capturedAt: nowIso(),
        signalLines
      });
    } catch {
      // Some endpoints return script/text or blocked bodies. Ignore quietly.
    }
  };
  page.on("response", handler);
  return {
    records,
    signalLines() {
      return records.flatMap((record) => record.signalLines).filter((line, index, arr) => arr.indexOf(line) === index).slice(0, 80);
    },
    sources() {
      return records.map((record) => record.url).filter((url, index, arr) => arr.indexOf(url) === index).slice(0, 12);
    },
    detach() {
      page.off("response", handler);
    }
  };
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

async function askOperator(config, question) {
  if (!config.__readline) return "";
  return normalizeText(await config.__readline.question(question));
}

async function waitForOperatorConfirmation(page, config, label, account, warnings) {
  if (!config.limits?.manualConfirm) return true;
  const screenshot = await saveEvidence(page, config, `${account.name}-${label}-before-confirm`);
  console.log("");
  console.log(`请人工确认：${account.platform}｜${account.name}｜${label}`);
  console.log(`截图已保存：${screenshot}`);
  console.log("如果当前 Chrome 页面已经是正确后台/正确作品列表，并且能看到真实数据，输入 y 后回车。");
  console.log("如果还没进去，请先在 Chrome 里手动登录、点菜单、打开正确页面，再回到终端输入 y。");
  const answer = await askOperator(config, "确认可以采集？输入 y 继续，直接回车跳过这个账号：");
  const confirmed = /^y|yes|好|确认|可以|继续$/i.test(answer);
  if (!confirmed) warnings.push(`${account.platform}｜${account.name}｜${label} 未经人工确认，已跳过，避免采集无效页面。截图：${screenshot}`);
  return confirmed;
}

async function preflightPage(page, config, account, label) {
  const text = await pageText(page);
  const url = page.url();
  const issues = [];
  if (hasLoginBarrier(text)) issues.push("页面出现登录、扫码、验证码或安全验证提示");
  if (!normalizeText(text) || normalizeText(text).length < 40) issues.push("页面文字过少，可能为空白页或未加载完成");
  if (label.includes("作品") && !textHasAny(text, [/作品|内容|视频|播放|点赞|评论|发布时间|数据|管理/])) {
    issues.push("作品列表特征不足，暂不采集，避免把菜单页当作品页");
  }
  if (label.includes("账号") && !textHasAny(text, [/粉丝|作品|播放|数据|概览|创作者|主页|账号|访问|涨粉/])) {
    issues.push("账号概览特征不足，暂不采集账号级数据");
  }
  if (/javascript:|about:blank/i.test(url)) issues.push("当前地址不是可采集的后台页面");
  if (!issues.length) {
    return { ok: true, text, url, issues: [] };
  }
  const screenshot = await saveEvidence(page, config, `${account.name}-${label}-preflight-blocked`);
  return { ok: false, text, url, issues, screenshot };
}

function preflightWarning(account, label, result) {
  return [
    `${account.platform}｜${account.name}｜${label} 跑前体检未通过，已自动跳过，避免采集假数据。`,
    `原因：${result.issues.join("；")}`,
    result.screenshot ? `截图：${result.screenshot}` : ""
  ].filter(Boolean).join(" ");
}

async function clickUsefulControls(page, labels, config, maxClicks = 8) {
  let clicked = 0;
  for (const label of labels) {
    if (clicked >= maxClicks) break;
    const locator = page.locator("button, a, [role='tab'], [role='button']").filter({ hasText: label });
    const count = Math.min(await locator.count().catch(() => 0), 4);
    for (let index = 0; index < count && clicked < maxClicks; index += 1) {
      const item = locator.nth(index);
      const text = normalizeText(await item.innerText({ timeout: 1200 }).catch(() => ""));
      if (!text || UNSAFE_CONTROL_RE.test(text) || text.length > 80) continue;
      try {
        await item.scrollIntoViewIfNeeded({ timeout: 2000 });
        const beforeUrl = page.url();
        const popupPromise = page.waitForEvent("popup", { timeout: 2000 }).catch(() => null);
        await item.click({ timeout: 3000 });
        const popup = await popupPromise;
        if (popup) {
          await popup.waitForLoadState("domcontentloaded", { timeout: 8000 }).catch(() => {});
          await popup.close().catch(() => {});
        } else if (page.url() !== beforeUrl) {
          await page.waitForLoadState("domcontentloaded", { timeout: 8000 }).catch(() => {});
        }
        await randomDelay(config);
        clicked += 1;
      } catch {
        // Data-center controls vary by platform. Failed clicks are simply skipped.
      }
    }
  }
  return clicked;
}

async function collectDeepLinks(page) {
  return await page.locator("a[href]").evaluateAll((nodes, labels) => {
    const safe = /数据|概览|诊断|作品|内容|粉丝|观众|流量|搜索|互动|经营|转化|线索/;
    const unsafe = /发布|删除|编辑|保存|确定|取消|关闭|投放|推广|充值|授权|退出|登录|扫码|上传|下载|帮助|协议/;
    return nodes.map((node) => {
      const text = (node.innerText || node.textContent || "").replace(/\s+/g, " ").trim();
      const href = node.href || "";
      return { text, href };
    })
      .filter((row) => row.href && safe.test(row.text || row.href) && !unsafe.test(row.text || row.href))
      .filter((row) => labels.some((label) => (row.text || "").includes(label)) || safe.test(row.href))
      .slice(0, 20);
  }, DEEP_ACCOUNT_LINK_LABELS).catch(() => []);
}

function samePlatformUrl(baseUrl, href) {
  try {
    const base = new URL(baseUrl);
    const target = new URL(href);
    if (!/^https?:$/.test(target.protocol)) return false;
    if (target.hostname === base.hostname) return true;
    return /douyin\.com|weixin\.qq\.com|channels\.weixin\.qq\.com/i.test(target.hostname);
  } catch {
    return false;
  }
}

async function collectCreatorCenterDeepSignals(page, account, config, apiCapture, onProgress = async () => {}) {
  if (!config.limits?.deepOwnDetails || (account.accountType || "自有账号") === "同行账号") {
    return { text: "", pages: [], signalLines: [] };
  }
  const pages = [];
  const addCurrentPage = async (label) => {
    await clickUsefulControls(page, DEEP_VIDEO_CONTROL_LABELS, config, 5);
    const text = await pageText(page);
    if (text) {
      pages.push({
        label,
        url: page.url().split("?")[0],
        signalLines: splitSignalLines(text, 18)
      });
    }
    return text;
  };

  await onProgress(`深挖${account.platform}创作者中心数据页`, {
    currentAccount: account.name,
    currentPlatform: account.platform,
    increment: false
  });
  const texts = [await addCurrentPage("账号首页/数据概览")];
  const originUrl = page.url();
  const links = await collectDeepLinks(page);
  const seen = new Set([originUrl.split("#")[0]]);
  for (const link of links) {
    if (texts.length >= 7) break;
    if (!samePlatformUrl(originUrl, link.href)) continue;
    const urlKey = link.href.split("#")[0];
    if (seen.has(urlKey)) continue;
    seen.add(urlKey);
    try {
      await onProgress(`打开${account.platform}深层数据：${link.text || "数据页"}`, {
        currentAccount: account.name,
        currentPlatform: account.platform,
        increment: false
      });
      await gotoSafe(page, link.href, config);
      if (hasLoginBarrier(await pageText(page))) continue;
      texts.push(await addCurrentPage(link.text || "创作者中心数据页"));
    } catch {
      // Some platform links are SPA anchors or permission-only pages.
    }
  }
  const signalLines = [
    ...pages.flatMap((item) => item.signalLines),
    ...(apiCapture?.signalLines?.() || [])
  ].filter((line, index, arr) => arr.indexOf(line) === index).slice(0, 80);
  return {
    text: texts.filter(Boolean).join("\n"),
    pages,
    signalLines
  };
}

async function scrollToLoadVideoList(page, config, maxVideos, onProgress = async () => {}) {
  const target = Math.max(1, Number(maxVideos || config.limits?.maxVideosPerAccount || 30));
  const maxScrollCap = target >= 300 ? 110 : target >= 150 ? 80 : 45;
  const maxScrolls = Math.max(5, Math.min(maxScrollCap, Math.ceil(target / 5)));
  let lastHeight = 0;
  let stale = 0;
  for (let index = 0; index < maxScrolls; index += 1) {
    const marker = await page.evaluate(() => ({
      height: document.body?.scrollHeight || 0,
      anchors: document.querySelectorAll("a[href]").length,
      textLength: (document.body?.innerText || "").length
    })).catch(() => ({ height: 0, anchors: 0, textLength: 0 }));
    if (index % 5 === 0) {
      await onProgress(`向下加载作品列表 ${index + 1}/${maxScrolls}`, { increment: false });
    }
    const more = page.locator("button, a, [role='button']").filter({ hasText: /加载更多|查看更多|更多|下一页/ }).first();
    if (await more.count().catch(() => 0)) {
      const text = normalizeText(await more.innerText({ timeout: 1000 }).catch(() => ""));
      if (text && !UNSAFE_CONTROL_RE.test(text)) {
        await more.click({ timeout: 2500 }).catch(() => {});
      }
    }
    await page.mouse.wheel(0, 1800).catch(() => {});
    await page.evaluate(() => window.scrollBy(0, Math.max(600, window.innerHeight * 0.9))).catch(() => {});
    await randomDelay(config);
    if (marker.height <= lastHeight + 12) stale += 1;
    else stale = 0;
    lastHeight = Math.max(lastHeight, marker.height);
    if (stale >= 6 && target <= 80) break;
  }
  await page.evaluate(() => window.scrollTo(0, 0)).catch(() => {});
  await randomDelay(config);
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

function valueNearLabels(text, labels) {
  const escaped = labels.map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const forward = new RegExp(`(?:${escaped})\\s*[:：]?\\s*([+-]?\\d[\\d,.]*(?:\\.\\d+)?\\s*(?:万|亿|%|秒|分钟|分)?|\\d{1,2}:\\d{2})`, "i");
  const forwardMatch = String(text || "").match(forward);
  if (forwardMatch) return forwardMatch[1] || "";
  return "";
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
    .filter((line) => !INVALID_VIDEO_TITLE_RE.test(line))
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

function parseDurationValue(value) {
  const raw = String(value || "");
  const clock = raw.match(/(?:^|\D)(\d{1,2}):(\d{2})(?=\D|$)/);
  if (clock) return Number(clock[1]) * 60 + Number(clock[2]);
  const minuteSecond = raw.match(/(\d+(?:\.\d+)?)\s*分(?:钟)?\s*(\d+(?:\.\d+)?)?\s*秒?/);
  if (minuteSecond) return Number(minuteSecond[1]) * 60 + Number(minuteSecond[2] || 0);
  const second = raw.match(/(\d+(?:\.\d+)?)\s*秒/);
  if (second) return Number(second[1]);
  return 0;
}

function extractDurationSeconds(text) {
  const raw = String(text || "");
  const duration = parseDurationValue(raw);
  if (duration) return duration;
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

function snapshotConfidence(snapshot = {}) {
  const title = normalizeText(snapshot.title);
  const url = normalizeText(snapshot.url);
  let score = 0;
  if (title.length >= 6 && !INVALID_VIDEO_TITLE_RE.test(title)) score += 25;
  if (Number(snapshot.views) > 0) score += 28;
  if (["likes", "comments", "favorites", "shares"].some((key) => Number(snapshot[key]) > 0)) score += 18;
  if (["completeRate", "threeSecondRetention", "fiveSecondRetention", "avgWatchSeconds"].some((key) => Number(snapshot[key]) > 0)) score += 18;
  if (["profileVisits", "messages", "leads"].some((key) => Number(snapshot[key]) > 0)) score += 15;
  if (normalizeText(snapshot.publishedAt)) score += 8;
  if (looksLikeVideoUrl(url)) score += 6;
  if (normalizeText(snapshot.platformAdvice)) score += 6;
  if (!hasSnapshotMetrics(snapshot)) score -= 40;
  if (title && INVALID_VIDEO_TITLE_RE.test(title)) score -= 50;
  if (url && INVALID_VIDEO_URL_RE.test(url)) score -= 40;
  if ((snapshot.accountType || "") === "同行账号" && normalizeText(snapshot.source).includes("public-benchmark") && snapshot.benchmarkMatched !== true) score -= 70;
  return Math.max(0, Math.min(100, score));
}

function isTrustedSnapshot(snapshot = {}) {
  const title = normalizeText(snapshot.title);
  if (!title || INVALID_VIDEO_TITLE_RE.test(title)) return false;
  if (!hasSnapshotMetrics(snapshot)) return false;
  if ((snapshot.accountType || "") === "同行账号" && normalizeText(snapshot.source).includes("public-benchmark") && snapshot.benchmarkMatched !== true) return false;
  return snapshotConfidence(snapshot) >= 55;
}

function auditConfidence(audit = {}) {
  let score = 0;
  if (normalizeText(audit.accountName)) score += 20;
  if (Number(audit.followers) > 0) score += 22;
  if (Number(audit.totalVideos) > 0) score += 16;
  if (Number(audit.totalViews) > 0 || Number(audit.recentViews) > 0) score += 18;
  if (Number(audit.profileVisits) > 0 || Number(audit.messages) > 0 || Number(audit.leads) > 0) score += 14;
  if (Object.values(audit.trafficSources || {}).some((value) => Number(value) > 0)) score += 14;
  if (normalizeText(audit.platformAdvice || audit.audienceSummary)) score += 10;
  return Math.max(0, Math.min(100, score));
}

function isTrustedAudit(audit = {}) {
  return auditConfidence(audit) >= 35;
}

async function extractAccountAudit(page, account, config, deepSignals = {}) {
  const selectors = account.selectors?.accountAudit || {};
  const text = [await pageText(page), deepSignals.text || "", (deepSignals.signalLines || []).join("\n")].filter(Boolean).join("\n");
  const signalMetrics = extractMetricsFromSignals(deepSignals.signalLines || []);
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
    totalViews: selectors.totalViews ? await readSelectorNumber(page, selectors.totalViews) : valueAfterLabels(text, ["总播放", "累计播放", "播放总量"]) || signalMetrics.views,
    recentViews: selectors.recentViews ? await readSelectorNumber(page, selectors.recentViews) : valueAfterLabels(text, ["近7天播放", "近期播放", "本周播放", "播放量"]),
    profileVisits: selectors.profileVisits ? await readSelectorNumber(page, selectors.profileVisits) : valueAfterLabels(text, METRIC_LABELS.profileVisits) || signalMetrics.profileVisits,
    messages: selectors.messages ? await readSelectorNumber(page, selectors.messages) : valueAfterLabels(text, METRIC_LABELS.messages) || signalMetrics.messages,
    leads: selectors.leads ? await readSelectorNumber(page, selectors.leads) : valueAfterLabels(text, METRIC_LABELS.leads) || signalMetrics.leads,
    followerGrowth: selectors.followerGrowth ? await readSelectorNumber(page, selectors.followerGrowth) : valueAfterLabels(text, ["涨粉", "新增粉丝", "净增粉丝"]) || signalMetrics.followersGained,
    trafficSources,
    searchKeywords: extractLines(text, [/搜索词|关键词|初一|初二|初三|数学|科学|暑假|提分/], 10),
    audienceSummary: extractLines(text, [/粉丝画像|年龄|城市|地区|家长|学生|性别|人群/], 5).join("；"),
    contentTags: [account.defaultTopic, extractTopic(text)].filter(Boolean),
    platformAdvice: advice,
    positioning: account.positioning || account.defaultTopic || "",
    officialMetricLines: splitSignalLines(text, 30),
    creatorCenterPages: (deepSignals.pages || []).map((item) => ({ label: item.label, url: item.url })),
    apiSignalLines: (deepSignals.signalLines || []).slice(0, 40),
    deepSources: [...(deepSignals.pages || []).map((item) => item.url), ...(deepSignals.apiSources || [])].filter(Boolean).filter((url, index, arr) => arr.indexOf(url) === index).slice(0, 20),
    source: "playwright-agent"
  };
  audit.dataCompleteness = metricCompleteness(audit);
  audit.id = `audit-${hashText([audit.platform, audit.accountName, audit.capturedAt].join("|"))}`;
  return audit;
}

async function collectVideoCards(page, account, config, onProgress = async () => {}) {
  const maxVideos = Number(account.maxVideosPerRun || config.limits?.maxVideosPerAccount || 30);
  const listSelectors = account.selectors?.videoList || {};
  await scrollToLoadVideoList(page, config, maxVideos, onProgress);
  if (listSelectors.card) {
    const cards = await page.locator(listSelectors.card).evaluateAll((nodes, payload) => nodes.slice(0, payload.limit).map((node) => {
      const selectors = payload.selectors || {};
      const pick = (selector) => selector ? node.querySelector(selector)?.textContent?.trim() || "" : "";
      const linkNode = selectors.url ? node.querySelector(selectors.url) : node.querySelector("a[href]");
      return {
        title: pick(selectors.title) || node.textContent?.trim()?.split(/\n/)[0] || "",
        url: linkNode?.href || "",
        text: node.textContent || "",
        rawText: node.innerText || node.textContent || "",
        priority: 10
      };
    }), { selectors: listSelectors, limit: Math.max(260, Math.min(720, maxVideos * 2)) }).catch(() => []);
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
  const count = Math.min(await locator.count().catch(() => 0), Math.max(520, Math.min(900, maxVideos * 3)));
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

async function extractVideoSnapshot(page, account, card, config, detailSignals = {}) {
  const text = [await pageText(page), (detailSignals.signalLines || []).join("\n")].filter(Boolean).join("\n");
  const selectors = account.selectors?.videoDetail || {};
  const title = await readSelector(page, selectors.title) || card.title || extractTitleFromText(text, account.defaultTopic || "");
  const platformAdvice = [
    await readSelector(page, selectors.platformAdvice),
    extractLines(text, [/建议|诊断|优化|流失|留存|完播|点击|推荐|搜索|转化/], 5).join("；")
  ].filter(Boolean).join("；");
  const textMetrics = {
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
    avgWatchSeconds: selectors.avgWatchSeconds ? await readSelectorNumber(page, selectors.avgWatchSeconds) : valueAfterLabels(text, METRIC_LABELS.avgWatchSeconds) || parseDurationValue(valueNearLabels(text, METRIC_LABELS.avgWatchSeconds)),
    videoDurationSeconds: selectors.videoDurationSeconds ? await readSelectorNumber(page, selectors.videoDurationSeconds) : extractDurationSeconds(text),
    profileVisits: selectors.profileVisits ? await readSelectorNumber(page, selectors.profileVisits) : valueAfterLabels(text, METRIC_LABELS.profileVisits),
    messages: selectors.messages ? await readSelectorNumber(page, selectors.messages) : valueAfterLabels(text, METRIC_LABELS.messages),
    leads: selectors.leads ? await readSelectorNumber(page, selectors.leads) : valueAfterLabels(text, METRIC_LABELS.leads),
    followersGained: selectors.followersGained ? await readSelectorNumber(page, selectors.followersGained) : valueAfterLabels(text, ["涨粉", "新增粉丝"])
  };
  const signalMetrics = extractMetricsFromSignals(detailSignals.signalLines || []);
  const metrics = mergeMetricObjects(textMetrics, signalMetrics);
  const snapshot = {
    platform: account.platform,
    accountType: account.accountType || "自有账号",
    accountName: account.name,
    owner: account.owner || "",
    videoId: card.videoId || `video-${hashText([account.platform, account.name, card.url || title].join("|"))}`,
    title,
    url: card.url || page.url(),
    topic: extractTopic(text, account.defaultTopic || ""),
    contentTags: inferVideoTags({ title, topic: extractTopic(text, account.defaultTopic || ""), platformAdvice, ...metrics }),
    publishedAt: await readSelector(page, selectors.publishedAt) || extractPublishedAt(text),
    capturedAt: nowIso(),
    ...metrics,
    platformAdvice,
    trafficSourceLines: extractLines(text, [/流量来源|推荐|搜索|同城|关注|主页|粉丝|附近|朋友|来源|入口/], 8),
    searchKeywords: extractLines(text, [/搜索词|关键词|搜索|初一|初二|初三|数学|科学|暑假|提分|几何|计算|奥数|培优|小升初|中考/], 8),
    officialMetricLines: splitSignalLines(text, 30),
    apiSignalLines: (detailSignals.signalLines || []).slice(0, 40),
    deepSources: [page.url().split("?")[0], ...(detailSignals.apiSources || [])].filter(Boolean).filter((url, index, arr) => arr.indexOf(url) === index).slice(0, 12),
    notes: account.publicCollectionUnverified ? "标杆公开视频搜索样本，需人工复核是否来自目标账号。" : "",
    source: account.publicCollectionUnverified ? "public-benchmark-search" : "playwright-agent"
  };
  snapshot.dataCompleteness = metricCompleteness(snapshot);
  snapshot.id = `snapshot-${hashText([snapshot.platform, snapshot.accountName, snapshot.videoId, snapshot.capturedAt].join("|"))}`;
  return snapshot;
}

function extractSnapshotFromCard(account, card) {
  const text = card.rawText || card.text || card.title || "";
  const metrics = extractMetricsFromText(text);
  const identityTokens = [account.name, account.douyinId, account.douyinAccount]
    .map(normalizeText)
    .filter((value) => value.length >= 3);
  const benchmarkMatched = !account.publicCollectionUnverified || identityTokens.some((token) => normalizeText(text).includes(token) || normalizeText(card.url).includes(token));
  const snapshot = {
    platform: account.platform,
    accountType: account.accountType || "自有账号",
    accountName: account.name,
    owner: account.owner || "",
    videoId: `video-${hashText([account.platform, account.name, card.url || card.title].join("|"))}`,
    title: card.title || extractTitleFromText(text, account.defaultTopic || ""),
    url: card.url || "",
    topic: extractTopic(text, account.defaultTopic || ""),
    contentTags: inferVideoTags({ title: card.title || extractTitleFromText(text, account.defaultTopic || ""), topic: extractTopic(text, account.defaultTopic || ""), ...metrics }),
    publishedAt: extractPublishedAt(text),
    capturedAt: nowIso(),
    ...metrics,
    platformAdvice: "",
    trafficSourceLines: extractLines(text, [/流量来源|推荐|搜索|同城|关注|主页|粉丝|附近|朋友|来源|入口/], 6),
    searchKeywords: extractLines(text, [/搜索词|关键词|搜索|初一|初二|初三|数学|科学|暑假|提分|几何|计算|奥数|培优|小升初|中考/], 6),
    officialMetricLines: splitSignalLines(text, 18),
    apiSignalLines: [],
    deepSources: [],
    benchmarkMatched,
    notes: account.publicCollectionUnverified
      ? (benchmarkMatched ? "标杆公开视频搜索列表样本，已匹配账号名称或抖音号，仍建议人工抽查。" : "标杆公开视频搜索列表样本，未匹配账号名称或抖音号，默认不入库。")
      : "",
    source: account.publicCollectionUnverified ? "public-benchmark-search-list" : "playwright-agent-list"
  };
  snapshot.dataCompleteness = metricCompleteness(snapshot);
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
  ["officialMetricLines", "apiSignalLines", "deepSources", "trafficSourceLines", "searchKeywords"].forEach((key) => {
    const values = [
      ...(Array.isArray(detail[key]) ? detail[key] : []),
      ...(Array.isArray(base[key]) ? base[key] : [])
    ].filter(Boolean);
    if (values.length) merged[key] = values.filter((value, index, arr) => arr.indexOf(value) === index).slice(0, key === "deepSources" ? 12 : 40);
  });
  merged.contentTags = [
    ...inferVideoTags(merged),
    ...(Array.isArray(detail.contentTags) ? detail.contentTags : []),
    ...(Array.isArray(base.contentTags) ? base.contentTags : [])
  ].map(normalizeText).filter(Boolean).filter((value, index, arr) => arr.indexOf(value) === index).slice(0, 12);
  merged.dataCompleteness = metricCompleteness(merged);
  merged.source = [detail.source, base.source].filter(Boolean).filter((value, index, arr) => arr.indexOf(value) === index).join("+") || "playwright-agent";
  merged.id = `snapshot-${hashText([merged.platform, merged.accountName, merged.videoId || merged.url || merged.title, merged.capturedAt].join("|"))}`;
  return merged;
}

function benchmarkSearchKeyword(account = {}) {
  return normalizeText(
    account.publicSearchKeyword ||
    account.douyinSearchKeyword ||
    account.wechatVideoSearchKeyword ||
    account.name ||
    account.douyinId
  );
}

function buildBenchmarkSearchUrl(account = {}, config = {}) {
  const collection = config.benchmarks?.publicCollection || {};
  const template = normalizeText(collection.searchUrlTemplate) || "https://www.douyin.com/search/{keyword}?type=video";
  const keyword = benchmarkSearchKeyword(account);
  return template
    .replaceAll("{keyword}", encodeURIComponent(keyword))
    .replaceAll("{name}", encodeURIComponent(account.name || ""))
    .replaceAll("{douyinId}", encodeURIComponent(account.douyinId || ""));
}

function rotateRows(rows, offset) {
  if (!rows.length) return [];
  const normalizedOffset = ((offset % rows.length) + rows.length) % rows.length;
  return [...rows.slice(normalizedOffset), ...rows.slice(0, normalizedOffset)];
}

function publicBenchmarkCollectionAccounts(config = {}) {
  const collection = config.benchmarks?.publicCollection || {};
  if (collection.enabled === false) return [];
  const limit = Math.max(1, Math.min(47, Math.round(Number(collection.accountsPerRun || 8))));
  const maxVideos = Math.max(1, Math.min(50, Math.round(Number(collection.videosPerAccount || 8))));
  const rows = (config.accounts || [])
    .filter((account) => account.enabled !== false)
    .filter((account) => (account.accountType || "自有账号") === "同行账号")
    .filter((account) => (account.platform || "抖音") === "抖音")
    .filter((account) => account.douyinId || account.name)
    .sort((left, right) => Number(right.douyinFollowersWan || 0) - Number(left.douyinFollowersWan || 0));
  const dayIndex = Math.floor(Date.now() / (24 * 3600 * 1000));
  const offset = collection.rotateDaily === false ? 0 : (dayIndex * limit) % Math.max(1, rows.length);
  return rotateRows(rows, offset).slice(0, limit).map((account) => ({
    ...account,
    platform: "抖音",
    accountType: "同行账号",
    owner: account.owner || "公开标杆",
    dashboardUrl: "",
    videoListUrl: account.publicProfileUrl || account.publicVideoListUrl || buildBenchmarkSearchUrl(account, config),
    maxVideosPerRun: maxVideos,
    collectionEnabled: true,
    publicCollectionUnverified: true,
    note: [
      account.note || "公开标杆账号库。",
      "本轮通过抖音公开搜索采集公开视频样本；采集结果需人工复核账号归属。"
    ].filter(Boolean).join(" ")
  }));
}

function accountCollectionKey(account = {}) {
  return [
    normalizeText(account.platform),
    normalizeText(account.accountType || "自有账号"),
    normalizeText(account.name),
    normalizeText(account.dashboardUrl || account.videoListUrl || account.url)
  ].join("|");
}

async function clickCardForSnapshot(page, account, card, config) {
  if (!card.cardSelector || !Number.isInteger(card.cardIndex)) return null;
  const locator = page.locator(card.cardSelector).nth(card.cardIndex);
  const beforeUrl = page.url();
  let popup = null;
  let currentPageCapture = null;
  let popupCapture = null;
  try {
    await locator.scrollIntoViewIfNeeded({ timeout: 4000 });
    await randomDelay(config);
    currentPageCapture = attachApiCapture(page, `${account.name}-video-detail-click`);
    const popupPromise = page.waitForEvent("popup", { timeout: 5000 }).catch(() => null);
    await locator.click({ timeout: 6500 });
    popup = await popupPromise;
    const targetPage = popup || page;
    popupCapture = popup ? attachApiCapture(targetPage, `${account.name}-video-detail-popup`) : null;
    await targetPage.waitForLoadState("domcontentloaded", { timeout: 12000 }).catch(() => {});
    await targetPage.waitForLoadState("networkidle", { timeout: 12000 }).catch(() => {});
    await clickUsefulControls(targetPage, DEEP_VIDEO_CONTROL_LABELS, config, 8);
    await randomDelay(config);
    return await extractVideoSnapshot(targetPage, account, card, config, {
      signalLines: [...currentPageCapture.signalLines(), ...(popupCapture?.signalLines() || [])],
      apiSources: [...currentPageCapture.sources(), ...(popupCapture?.sources() || [])]
    });
  } finally {
    currentPageCapture?.detach?.();
    popupCapture?.detach?.();
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

async function collectAccount(context, account, config, onProgress = async () => {}, resumeState = null, onCheckpoint = async () => {}) {
  const page = await context.newPage();
  const pageApiCapture = attachApiCapture(page, `${account.platform}-${account.name}`);
  const warnings = [];
  const accountAudits = [];
  const snapshots = [];

  try {
    if (account.dashboardUrl) {
      await onProgress(`打开${account.platform}账号首页`, { currentAccount: account.name, currentPlatform: account.platform });
      await gotoSafe(page, account.dashboardUrl, config);
      const preflight = await preflightPage(page, config, account, "账号首页/数据概览");
      if (!preflight.ok) {
        warnings.push(preflightWarning(account, "账号首页/数据概览", preflight));
      } else {
        if (!await waitForOperatorConfirmation(page, config, "账号首页/数据概览", account, warnings)) {
          return { accountAudits, snapshots, warnings };
        }
        await onProgress(`读取${account.platform}账号概览`, { currentAccount: account.name, currentPlatform: account.platform });
        const deepSignals = await collectCreatorCenterDeepSignals(page, account, config, pageApiCapture, onProgress);
        deepSignals.apiSources = pageApiCapture.sources();
        const audit = await extractAccountAudit(page, account, config, deepSignals);
        audit.confidence = auditConfidence(audit);
        audit.source = `${audit.source || "playwright-agent"}+auto-trusted`;
        if (isTrustedAudit(audit)) {
          accountAudits.push(audit);
        } else {
          warnings.push(`${account.platform}｜${account.name} 账号概览可信度不足（${audit.confidence}/100），未入库。请确认页面是否显示粉丝、作品、播放、访问等真实账号数据。`);
        }
      }
    }

    if (account.videoListUrl) {
      await onProgress(`进入${account.platform}作品列表`, { currentAccount: account.name, currentPlatform: account.platform });
      await gotoSafe(page, account.videoListUrl, config);
      const preflight = await preflightPage(page, config, account, "作品列表");
      if (!preflight.ok) {
        warnings.push(preflightWarning(account, "作品列表", preflight));
        return { accountAudits, snapshots, warnings };
      }
      if (!await waitForOperatorConfirmation(page, config, "作品列表", account, warnings)) {
        return { accountAudits, snapshots, warnings };
      }
      await onProgress(`识别${account.platform}作品卡片`, { currentAccount: account.name, currentPlatform: account.platform });
      const cards = await collectVideoCards(page, account, config, async (label, extra = {}) => {
        await onProgress(label, {
          currentAccount: account.name,
          currentPlatform: account.platform,
          ...extra
        });
      });
      if (!cards.length) {
        const screenshot = await saveEvidence(page, config, `${account.name}-video-list-no-cards`);
        warnings.push(`${account.platform}｜${account.name} 没有识别到有效视频卡片。可能需要补充 selectors，或后台列表当前没有展示视频数据。截图：${screenshot}`);
      }
      for (let cardIndex = 0; cardIndex < cards.length; cardIndex += 1) {
        const card = cards[cardIndex];
        const cardKey = stableCardKey(account, card);
        if (resumeState?.snapshotKeys?.has(cardKey)) {
          resumeState.skipped += 1;
          if (cardIndex % 20 === 0) {
            await onProgress(`跳过已采作品 ${resumeState.skipped} 条`, {
              currentAccount: account.name,
              currentPlatform: account.platform,
              currentVideo: card.title || card.url || "",
              increment: false
            });
          }
          continue;
        }
        await onProgress(`采集第 ${cardIndex + 1}/${cards.length} 条作品`, {
          currentAccount: account.name,
          currentPlatform: account.platform,
          currentVideo: card.title || card.url || ""
        });
        const listSnapshot = extractSnapshotFromCard(account, card);
        let snapshot = isUsefulSnapshot(listSnapshot) ? listSnapshot : null;
        const shouldOpenDetails = config.limits?.autoOpenDetails || (config.limits?.deepOwnDetails && (account.accountType || "自有账号") !== "同行账号");
        if (shouldOpenDetails && isNavigableHttpUrl(card.url)) {
          const detailPage = await context.newPage();
          const detailCapture = attachApiCapture(detailPage, `${account.name}-video-detail-url`);
          try {
            await gotoSafe(detailPage, card.url, config);
            await clickUsefulControls(detailPage, DEEP_VIDEO_CONTROL_LABELS, config, 8);
            const detailSnapshot = await extractVideoSnapshot(detailPage, account, card, config, {
              signalLines: detailCapture.signalLines(),
              apiSources: detailCapture.sources()
            });
            snapshot = mergeSnapshotData(detailSnapshot, listSnapshot);
          } catch (error) {
            warnings.push(`${account.platform}｜${account.name} 视频详情采集失败，已保留列表数据：${card.title || card.url}｜${error.message}`);
          } finally {
            detailCapture.detach();
            await detailPage.close().catch(() => {});
          }
        } else if (shouldOpenDetails && card.cardSelector && Number.isInteger(card.cardIndex)) {
          try {
            const clickSnapshot = await clickCardForSnapshot(page, account, card, config);
            if (clickSnapshot) snapshot = mergeSnapshotData(clickSnapshot, listSnapshot);
          } catch (error) {
            warnings.push(`${account.platform}｜${account.name} 点击作品卡片详情失败，已保留列表数据：${card.title || card.url}｜${error.message}`);
          }
        }
        if (snapshot) {
          snapshot.confidence = snapshotConfidence(snapshot);
          snapshot.source = `${snapshot.source || "playwright-agent"}+auto-trusted`;
        }
        if (snapshot && isTrustedSnapshot(snapshot)) {
          snapshots.push(snapshot);
          snapshotResumeKeys(snapshot).forEach((key) => resumeState?.snapshotKeys?.add(key));
          await onCheckpoint({ account, snapshot, accountAudits, snapshots, warnings });
        } else {
          warnings.push(`${account.platform}｜${account.name} 已跳过可信度不足的视频候选：${card.title || card.url}｜可信度 ${snapshot?.confidence || 0}/100`);
          await onCheckpoint({ account, accountAudits, snapshots, warnings });
        }
      }
    }
  } finally {
    pageApiCapture.detach();
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
      note: account.note || (account.accountType === "同行账号" ? "公开标杆账号库，待补充公开作品样本。" : "Mac mini Playwright 自动巡检"),
      douyinId: account.douyinId || "",
      douyinFollowersWan: account.douyinFollowersWan || 0,
      douyinLikesWan: account.douyinLikesWan || 0,
      benchmarkKind: account.benchmarkKind || "",
      defaultTopic: account.defaultTopic || "",
      gradeFocus: account.gradeFocus || "",
      source: account.source || "",
      wechatVideoName: account.wechatVideoName || "",
      wechatVideoId: account.wechatVideoId || "",
      wechatVideoStatus: account.wechatVideoStatus || "",
      wechatVideoSearchKeyword: account.wechatVideoSearchKeyword || "",
      collectionEnabled: account.collectionEnabled !== false
    }))
    .filter((account) => account.platform && account.name);
}

function checkpointFile(config) {
  return path.join(config.dataDir || DEFAULT_DATA_DIR, "latest-video-ops-checkpoint.json");
}

function collectRunKey(config, enabledAccounts = []) {
  return hashText(JSON.stringify({
    mode: normalizeText(config.scanMode),
    maxVideos: Number(config.limits?.maxVideosPerAccount || 30),
    deepOwnDetails: Boolean(config.limits?.deepOwnDetails),
    benchmarks: Boolean(config.benchmarks?.publicCollection?.enabled),
    accounts: enabledAccounts.map((account) => [account.platform, account.accountType || "自有账号", account.name, account.videoListUrl || account.dashboardUrl || ""].join("|"))
  }));
}

function stableSnapshotKey(row = {}) {
  return [
    normalizeText(row.platform),
    normalizeText(row.accountName || row.name || row.account),
    normalizeText(row.videoId || row.url || row.title)
  ].join("|");
}

function snapshotResumeKeys(row = {}) {
  const base = {
    platform: row.platform,
    accountName: row.accountName || row.name || row.account
  };
  return [
    { ...base, videoId: row.videoId },
    { ...base, url: row.url },
    { ...base, title: row.title },
    { ...base, videoId: row.videoId || row.url || row.title }
  ]
    .map(stableSnapshotKey)
    .filter((value) => value.replace(/\|/g, ""))
    .filter((value, index, arr) => arr.indexOf(value) === index);
}

function stableCardKey(account = {}, card = {}) {
  return stableSnapshotKey({
    platform: account.platform,
    accountName: account.name,
    videoId: card.videoId,
    url: card.url,
    title: card.title
  });
}

function stableAccountKey(account = {}) {
  return [
    normalizeText(account.platform),
    normalizeText(account.accountType || "自有账号"),
    normalizeText(account.name)
  ].join("|");
}

async function loadCollectorCheckpoint(config, runKey) {
  const checkpoint = await readJson(checkpointFile(config), null);
  if (!checkpoint || checkpoint.runKey !== runKey || checkpoint.finished === true) return null;
  const ageMs = Date.now() - Date.parse(checkpoint.updatedAt || checkpoint.startedAt || "");
  if (!Number.isFinite(ageMs) || ageMs > 18 * 3600 * 1000) return null;
  return checkpoint;
}

async function saveCollectorCheckpoint(config, checkpoint) {
  await writeJson(checkpointFile(config), {
    ...checkpoint,
    updatedAt: nowIso()
  }).catch(() => {});
}

function createResumeState(checkpoint = null) {
  const source = checkpoint && typeof checkpoint === "object" ? checkpoint : {};
  const snapshotKeys = new Set();
  (source.snapshots || []).forEach((row) => {
    snapshotResumeKeys(row).forEach((key) => snapshotKeys.add(key));
  });
  return {
    snapshotKeys,
    completedAccountKeys: new Set(source.completedAccountKeys || []),
    skipped: 0
  };
}

function payloadSnapshotCount(payload = {}) {
  return Array.isArray(payload.snapshots) ? payload.snapshots.length : 0;
}

async function collect(configPath, runtimeOptions = {}) {
  const config = applyRuntimeOptions(await loadConfig(configPath), runtimeOptions);
  await ensureDir(config.dataDir || DEFAULT_DATA_DIR);
  let rl = null;
  if (config.limits?.manualConfirm) {
    rl = readline.createInterface({ input, output });
    config.__readline = rl;
  }
  const authorizedAccounts = (config.accounts || [])
    .filter((account) => account.enabled !== false)
    .filter((account) => account.collectionEnabled !== false)
    .filter((account) => account.dashboardUrl || account.videoListUrl);
  const benchmarkAccounts = publicBenchmarkCollectionAccounts(config);
  const enabledAccounts = mergeByKey([...authorizedAccounts, ...benchmarkAccounts], accountCollectionKey);
  const runKey = collectRunKey(config, enabledAccounts);
  const checkpoint = await loadCollectorCheckpoint(config, runKey);
  const resumeState = createResumeState(checkpoint);
  const runId = `video-run-${Date.now().toString(36)}`;
  const startedAt = nowIso();
  let completedPhases = 0;
  const totalPhases = Math.max(1, enabledAccounts.length * 6 + 4);
  const plan = collectionPlan(config);
  const payload = {
    accounts: normalizeAccountsForPayload(config),
    accountAudits: checkpoint?.accountAudits || [],
    snapshots: checkpoint?.snapshots || [],
    warnings: checkpoint?.warnings || [],
    collectedAt: nowIso(),
    source: "mac-mini-playwright-agent",
    rebuildMode: Boolean(config.rebuildMode),
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
      message: checkpoint
        ? `检测到同一轮未完成采集，正在断点续跑：已恢复 ${payloadSnapshotCount(checkpoint)} 条视频。`
        : `Mac mini 正在准备采集。本轮为${plan.mode}：自动判断可信度，不可信数据不入库，默认不采标杆公开搜索。`
    }
  };
  let context = null;
  let lastStatusSyncAt = 0;

  const saveCheckpoint = async (extra = {}) => {
    await saveCollectorCheckpoint(config, {
      runKey,
      runId,
      startedAt: checkpoint?.startedAt || startedAt,
      finished: false,
      plan,
      completedAccountKeys: [...resumeState.completedAccountKeys],
      accountAudits: payload.accountAudits,
      snapshots: payload.snapshots,
      warnings: payload.warnings,
      collectorStatus: payload.collectorStatus,
      ...extra
    });
  };

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
    await saveCheckpoint();
    await updateStatus("启动独立 Chrome", { progress: 3, force: true, message: checkpoint ? "正在从上次中断处继续采集。" : "正在打开专门用于采集的 Chrome 档案。" });
    context = await openContext(config);
    for (let accountIndex = 0; accountIndex < enabledAccounts.length; accountIndex += 1) {
      const account = enabledAccounts[accountIndex];
      const accountKey = stableAccountKey(account);
      if (resumeState.completedAccountKeys.has(accountKey)) {
        await updateStatus(`跳过已完成账号 ${account.platform}｜${account.name}`, {
          accountsDone: accountIndex + 1,
          currentAccount: account.name,
          currentPlatform: account.platform,
          message: `断点续跑：该账号上次已完成，本轮直接跳过。`
        });
        continue;
      }
      console.log(`采集 ${account.platform}｜${account.name}`);
      await updateStatus(`开始采集 ${account.platform}｜${account.name}`, {
        currentAccount: account.name,
        currentPlatform: account.platform,
        message: `正在处理第 ${accountIndex + 1}/${enabledAccounts.length} 个账号。`
      });
      const result = await collectAccount(context, account, config, async (label, extra = {}) => {
        await updateStatus(label, extra);
        await saveCheckpoint();
      }, resumeState, async (partial = {}) => {
        await saveCheckpoint({
          accountAudits: mergeByKey([...(payload.accountAudits || []), ...(partial.accountAudits || [])], (row) => row.id || [row.platform, row.accountName || row.name, row.capturedAt].join("|")),
          snapshots: mergeByKey([...(payload.snapshots || []), ...(partial.snapshots || [])], stableSnapshotKey),
          warnings: [...(payload.warnings || []), ...(partial.warnings || [])].slice(-80)
        });
      });
      payload.accountAudits.push(...result.accountAudits);
      payload.snapshots.push(...result.snapshots);
      payload.warnings.push(...result.warnings);
      resumeState.completedAccountKeys.add(accountKey);
      await updateStatus(`完成 ${account.platform}｜${account.name}`, {
        accountsDone: accountIndex + 1,
        currentAccount: account.name,
        currentPlatform: account.platform,
        message: `该账号采集完成，累计采到账号体检 ${payload.accountAudits.length} 条、视频快照 ${payload.snapshots.length} 条。`
      });
      await saveCheckpoint();
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
    await saveCheckpoint({ collectorStatus: payload.collectorStatus });
    throw error;
  } finally {
    if (context) await context.close().catch(() => {});
    if (rl) rl.close();
    delete config.__readline;
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
    message: `可信采集结束：账号体检 ${payload.accountAudits.length} 条，可信视频快照 ${payload.snapshots.length} 条。${payload.warnings.length ? "有部分页面未入库，需人工查看异常提示。" : ""}`
  };
  await writeJson(outputFile, payload);
  await writeJson(datedFile, payload);
  await publishCollectorStatus(config, payload.collectorStatus);
  await saveCollectorCheckpoint(config, {
    runKey,
    runId,
    startedAt: checkpoint?.startedAt || startedAt,
    finished: true,
    finishedAt: payload.collectorStatus.finishedAt,
    plan,
    completedAccountKeys: [...resumeState.completedAccountKeys],
    accountAudits: payload.accountAudits,
    snapshots: payload.snapshots,
    warnings: payload.warnings,
    collectorStatus: payload.collectorStatus
  });
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
    snapshots: mergeByKey([...(oldState.snapshots || []), ...(oldState.videos || []), ...(newState.snapshots || [])].filter(isTrustedSnapshot), (row) => row.id || [row.platform, row.accountName, row.videoId || row.url || row.title, row.capturedAt].join("|")),
    collectorStatus: newState.collectorStatus || oldState.collectorStatus || null,
    collectionPlan: newState.collectionPlan || oldState.collectionPlan || null,
    analysisStatus: newState.analysisStatus || oldState.analysisStatus || null,
    aiReport: newState.aiReport || oldState.aiReport || null,
    warnings: [...(oldState.warnings || []), ...(newState.warnings || [])].slice(-40),
    rebuildMode: Boolean(newState.rebuildMode),
    updatedAt: nowIso(),
    source: "mac-mini-playwright-agent"
  };
}

function payloadSummary(payload = {}) {
  const rows = payload && typeof payload === "object" ? payload : {};
  return {
    accounts: Array.isArray(rows.accounts) ? rows.accounts.length : 0,
    accountAudits: Array.isArray(rows.accountAudits) ? rows.accountAudits.length : 0,
    snapshots: Array.isArray(rows.snapshots) ? rows.snapshots.length : 0,
    warnings: Array.isArray(rows.warnings) ? rows.warnings.length : 0,
    updatedAt: rows.updatedAt || rows.collectedAt || ""
  };
}

async function pushPayload(configPath, filePath = "", runtimeOptions = {}) {
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
  const replaceExisting = Boolean(runtimeOptions.fresh || runtimeOptions.rebuild || runtimeOptions["replace-data"] || incoming.rebuildMode);
  const existing = replaceExisting ? null : await readRemoteState(config, token);
  const merged = mergePayloads(existing, incoming);
  const resultText = await writeRemoteState(config, token, merged);
  const expected = payloadSummary(merged);
  console.log(`${replaceExisting ? "重建自动导入成功" : "自动导入成功"}：${resultText}`);
  console.log(`已写入网站：账号 ${expected.accounts} 个，账号体检 ${expected.accountAudits} 条，视频快照 ${expected.snapshots} 条，异常 ${expected.warnings} 条。`);
  const remote = await readRemoteState(config, token);
  const actual = payloadSummary(remote);
  console.log(`云端读回校验：账号 ${actual.accounts} 个，账号体检 ${actual.accountAudits} 条，视频快照 ${actual.snapshots} 条，异常 ${actual.warnings} 条。`);
  if (expected.snapshots > 0 && actual.snapshots <= 0) {
    throw new Error("自动导入后云端读回为 0 条视频快照，请检查 API Token、服务器部署版本或 module-data 接口。");
  }
  const importStatus = {
    status: "success",
    importedAt: nowIso(),
    replaceExisting,
    expected,
    actual,
    message: `已自动导入网站：${actual.snapshots} 条视频快照、${actual.accountAudits} 条账号体检。`
  };
  const statusFile = path.join(config.dataDir || DEFAULT_DATA_DIR, "latest-video-ops-import-status.json");
  await writeJson(statusFile, importStatus).catch(() => {});
  return { resultText, expected, actual, merged, remote };
}

function textList(value, limit = 6) {
  if (!value) return [];
  const rows = Array.isArray(value) ? value : String(value).split(/[、,，\n\r]+/);
  return rows.map((item) => normalizeText(typeof item === "object" ? JSON.stringify(item) : item)).filter(Boolean).slice(0, limit);
}

function rate(numerator, denominator) {
  const bottom = Number(denominator) || 0;
  return bottom > 0 ? (Number(numerator) || 0) / bottom : 0;
}

function compactVideoForReport(row = {}) {
  const views = Number(row.views || row.playCount || 0) || 0;
  const favorites = Number(row.favorites || row.collects || row.collectCount || 0) || 0;
  const shares = Number(row.shares || row.shareCount || 0) || 0;
  const leads = Number(row.leads || row.inquiries || 0) || 0;
  const messages = Number(row.messages || row.privateMessages || 0) || 0;
  const followersGained = Number(row.followersGained || row.newFollowers || 0) || 0;
  return {
    platform: row.platform || "",
    accountType: row.accountType || "",
    accountName: row.accountName || row.account || "",
    title: row.title || row.videoTitle || "",
    topic: row.topic || row.category || "",
    publishedAt: row.publishedAt || row.publishTime || "",
    capturedAt: row.capturedAt || row.captureTime || "",
    views,
    likes: Number(row.likes || row.likeCount || 0) || 0,
    comments: Number(row.comments || row.commentCount || 0) || 0,
    favorites,
    shares,
    impressions: Number(row.impressions || row.exposures || row.showCount || 0) || 0,
    clickThroughRate: Number(row.clickThroughRate || row.ctr || 0) || 0,
    threeSecondRetention: Number(row.threeSecondRetention || row.retention3s || 0) || 0,
    fiveSecondRetention: Number(row.fiveSecondRetention || row.retention5s || 0) || 0,
    completeRate: Number(row.completeRate || row.completionRate || 0) || 0,
    avgWatchSeconds: Number(row.avgWatchSeconds || row.averageWatchSeconds || 0) || 0,
    videoDurationSeconds: Number(row.videoDurationSeconds || row.durationSeconds || row.duration || 0) || 0,
    profileVisits: Number(row.profileVisits || row.homepageVisits || 0) || 0,
    messages,
    leads,
    followersGained,
    saveSharePerView: rate(favorites + shares, views),
    leadPerView: rate(leads + messages, views),
    followerPerView: rate(followersGained, views),
    contentTags: textList(row.contentTags || row.tags, 8),
    platformAdvice: normalizeText(row.platformAdvice || row.advice || ""),
    trafficSourceLines: textList(row.trafficSourceLines, 4),
    searchKeywords: textList(row.searchKeywords || row.keywords, 4),
    dataCompleteness: row.dataCompleteness || null,
    officialMetricLines: textList(row.officialMetricLines, 4),
    apiSignalLines: textList(row.apiSignalLines, 4),
    deepSources: textList(row.deepSources, 3),
    source: row.source || ""
  };
}

function buildVideoOpsAiInputForAgent(payload = {}) {
  const state = payload && typeof payload === "object" ? payload : {};
  const snapshots = Array.isArray(state.snapshots) ? state.snapshots.map(compactVideoForReport) : [];
  const ownRows = snapshots.filter((row) => row.accountType !== "同行账号");
  const byViews = ownRows.slice().sort((a, b) => b.views - a.views).slice(0, 60);
  const byLeads = ownRows.slice().filter((row) => row.leads || row.messages).sort((a, b) => (b.leads + b.messages) - (a.leads + a.messages) || b.leadPerView - a.leadPerView).slice(0, 40);
  const byFans = ownRows.slice().filter((row) => row.followersGained).sort((a, b) => b.followersGained - a.followersGained || b.followerPerView - a.followerPerView).slice(0, 40);
  const bySaveShare = ownRows.slice().sort((a, b) => ((b.favorites || 0) + (b.shares || 0)) - ((a.favorites || 0) + (a.shares || 0))).slice(0, 50);
  const withDeepData = ownRows.filter((row) => row.deepSources?.length || row.officialMetricLines?.length || row.apiSignalLines?.length).slice(0, 80);
  const tagGroups = new Map();
  ownRows.forEach((row) => {
    (row.contentTags || []).forEach((tag) => {
      const current = tagGroups.get(tag) || { tag, count: 0, views: 0, leads: 0, followers: 0, saveShare: 0, examples: [] };
      current.count += 1;
      current.views += row.views || 0;
      current.leads += (row.leads || 0) + (row.messages || 0);
      current.followers += row.followersGained || 0;
      current.saveShare += (row.favorites || 0) + (row.shares || 0);
      if (current.examples.length < 5) current.examples.push(row.title);
      tagGroups.set(tag, current);
    });
  });
  const input = {
    generatedAt: nowIso(),
    instruction: [
      "请按中国大陆一到九年级数学教培短视频运营顾问视角，基于以下真实采集数据输出报告。",
      "高播放视频代表本地品牌影响力和认知扩散价值，不能因为直接咨询低就简单判定为差。",
      "咨询线索高的视频代表招生转化价值；涨粉高的视频代表账号增长价值；收藏转发高的视频代表家长愿意保存或转给孩子看的干货价值。",
      "重点服务宁波本地数学培优、奥数、补弱、小升初、中考、暑假预习复习、家长焦虑、私域承接和合规表达。",
      "没有采到的数据必须明说，不要编造。输出必须有下一轮拍摄清单和复拍方向。"
    ].join("\n"),
    collectionPlan: state.collectionPlan || {},
    collectorStatus: state.collectorStatus || {},
    dataSummary: {
      accounts: Array.isArray(state.accounts) ? state.accounts.length : 0,
      accountAudits: Array.isArray(state.accountAudits) ? state.accountAudits.length : 0,
      ownVideos: ownRows.length,
      allVideos: snapshots.length,
      videosWithRetention: ownRows.filter((row) => row.completeRate || row.threeSecondRetention || row.fiveSecondRetention || row.avgWatchSeconds).length,
      videosWithConversion: ownRows.filter((row) => row.profileVisits || row.messages || row.leads || row.followersGained).length,
      videosWithTraffic: ownRows.filter((row) => row.trafficSourceLines?.length || row.searchKeywords?.length).length,
      videosWithOfficialDeepData: withDeepData.length
    },
    accounts: state.accounts || [],
    latestAccountAudits: state.accountAudits || [],
    topVideosByViews: byViews,
    topVideosByLeads: byLeads,
    topVideosByFans: byFans,
    topVideosBySaveShare: bySaveShare,
    topicTagSummary: [...tagGroups.values()]
      .sort((left, right) => (right.views + right.leads * 5000 + right.followers * 3000 + right.saveShare * 120) - (left.views + left.leads * 5000 + left.followers * 3000 + left.saveShare * 120))
      .slice(0, 30),
    videosWithOfficialDeepData: withDeepData,
    latestOwnVideosSample: ownRows.slice(0, 120),
    warnings: state.warnings || []
  };
  return JSON.stringify(input, null, 2).slice(0, 120000);
}

async function requestAiAssistant(config, token, body) {
  const response = await fetch(`${apiBase(config)}/ai-assistant`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(body)
  });
  const resultText = await response.text();
  let result = null;
  try {
    result = resultText ? JSON.parse(resultText) : null;
  } catch {
    result = { raw: resultText };
  }
  if (!response.ok || !result?.ok) {
    throw new Error(result?.message || result?.error || `AI 报告生成失败 ${response.status}: ${resultText}`);
  }
  return result;
}

function normalizeAiReportFromResult(result = {}) {
  const ai = result?.result || result?.data?.result || {};
  return {
    generatedAt: nowIso(),
    title: ai.title || "DeepSeek 短视频专家报告",
    summary: ai.summary || "",
    polishedText: ai.polishedText || ai.parentMessage || ai.internalNote || "",
    riskLevel: ai.riskLevel || "",
    todoItems: Array.isArray(ai.todoItems) ? ai.todoItems : [],
    structuredData: ai.structuredData || {},
    provider: result.provider || result?.data?.provider || "deepseek",
    model: result.model || result?.data?.model || ""
  };
}

async function generateAndPushAiReport(config, basePayload = {}) {
  const token = apiToken(config);
  const snapshots = Array.isArray(basePayload.snapshots) ? basePayload.snapshots : [];
  const accountAudits = Array.isArray(basePayload.accountAudits) ? basePayload.accountAudits : [];
  if (!config.apiBaseUrl || !token) {
    return { skipped: true, reason: `未设置 ${config.apiTokenEnv || "JRC_API_TOKEN"}，无法自动生成并回写 AI 报告。` };
  }
  if (snapshots.length < 20 && accountAudits.length < 1) {
    return { skipped: true, reason: "视频样本不足，暂不自动生成 AI 专家报告。" };
  }
  console.log("正在自动生成 DeepSeek 短视频专家报告...");
  const result = await requestAiAssistant(config, token, {
    mode: "videoOpsReport",
    modeLabel: "短视频运营专家报告",
    target: "短视频系统",
    text: buildVideoOpsAiInputForAgent(basePayload),
    operatorName: config.operator?.name || "Mac mini 短视频机器人",
    operatorUsername: config.operator?.username || "video_ops_agent",
    operatorRole: "system-agent"
  });
  const aiReport = normalizeAiReportFromResult(result);
  const existing = await readRemoteState(config, token);
  const analysisStatus = {
    status: "success",
    generatedAt: aiReport.generatedAt,
    provider: aiReport.provider,
    model: aiReport.model,
    message: "采集数据已自动导入网站，DeepSeek 专家报告已自动生成。"
  };
  const nextStatus = {
    ...(existing?.collectorStatus || basePayload.collectorStatus || {}),
    status: existing?.collectorStatus?.status || basePayload.collectorStatus?.status || "success",
    updatedAt: nowIso(),
    stepLabel: "自动导入和 AI 分析已完成",
    message: analysisStatus.message,
    progress: 100
  };
  const merged = mergePayloads(existing, { aiReport, analysisStatus, collectorStatus: nextStatus });
  await writeRemoteState(config, token, merged);
  const statusFile = path.join(config.dataDir || DEFAULT_DATA_DIR, "latest-video-ops-ai-report-status.json");
  await writeJson(statusFile, analysisStatus).catch(() => {});
  console.log("AI 专家报告已写入网站短视频系统。");
  return { skipped: false, aiReport, analysisStatus };
}

async function login(configPath) {
  const config = await loadConfig(configPath);
  await ensureDir(config.dataDir || DEFAULT_DATA_DIR);
  const rl = readline.createInterface({ input, output });
  const context = await openContext(config);
  try {
    for (const account of config.accounts || []) {
      if (account.enabled === false || account.collectionEnabled === false || !account.dashboardUrl) continue;
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
  node scripts/video-ops-agent.mjs collect [--config 路径] [--fresh] [--max-videos 数量] [--manual]
  node scripts/video-ops-agent.mjs push [--config 路径] [--file JSON路径] [--fresh]
  node scripts/video-ops-agent.mjs import [--config 路径] [--file JSON路径] [--fresh]
  node scripts/video-ops-agent.mjs run [--config 路径] [--fresh] [--max-videos 数量] [--manual] [--deep-own] [--with-benchmarks]

说明：
  init     创建配置文件
  login    打开独立 Chrome 档案，人工扫码登录抖音/视频号后台
  collect  自动打开后台采自有账号数据，并用可信度规则过滤无效页面；默认不采标杆公开搜索
  push     自动导入 latest-video-ops-payload.json 到网站短视频系统，并读回校验
  import   push 的中文语义别名；已采集完时可以单独运行自动导入
  run      collect + 自动导入 + 自动生成短视频专家报告；建议本轮重建使用 --fresh，清掉旧脏数据，只保留新流程可信数据

采集策略：
  自有账号不是随机采集，而是按创作者中心作品列表优先采最近作品。
  默认不再自动点详情页，不再自动采标杆公开视频，避免把菜单页、验证码页、搜索噪音当成作品数据。
  无用数据由程序自动判断并跳过；只有需要人工盯页面时才加 --manual。
  小剂量试验建议 npm run video:trial：只采自有账号最多 30 条并深度采集，不采同行。
  日常轻量建议 npm run video:daily：只采自有账号最多 40 条，用于新发视频和近 7 天变化。
  每周复盘建议 npm run video:weekly：只采自有账号最多 120 条，用于最近 30 天阶段复盘。
  自有账号深度挖掘建议 npm run video:own-deep：只采自己的账号，最多 500 条，打开详情页，建立历史优势库。
  整夜深挖也可以运行 npm run video:overnight，和 video:own-deep 使用同一套全量策略。
  月度校验建议 npm run video:monthly：重建全量可信数据，不需要每天执行。
  同行自动挖掘暂缓：遇到手机号验证码、滑块/图形验证等风控时不要硬跑。标杆账号先用于人工学习，等自有账号研究透再恢复。
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
  if (command === "push" || command === "import") return await pushPayload(configPath, args.file ? path.resolve(String(args.file)) : "", args);
  if (command === "run") {
    const collected = await collect(configPath, args);
    let pushed = null;
    try {
      pushed = await pushPayload(configPath, "", args);
    } catch (error) {
      console.warn(`自动导入未完成：${error.message}`);
      console.warn(`采集已经完成，数据没有丢。本地文件：${collected?.outputFile || path.join(DEFAULT_DATA_DIR, "latest-video-ops-payload.json")}`);
      console.warn("处理办法：如果是 JRC_API_TOKEN 问题，Mac mini 配好后运行 npm run video:push 会自动补传；之后 npm run video:run / video:own-deep 都会跑完自动写入网站并自动生成报告。");
      return;
    }
    try {
      const reportResult = await generateAndPushAiReport(collected.config, pushed.remote || pushed.merged || collected.payload);
      if (reportResult.skipped) {
        console.warn(`AI 专家报告未自动生成：${reportResult.reason}`);
      }
    } catch (error) {
      console.warn(`AI 专家报告自动生成未完成：${error.message}`);
      await publishCollectorStatus(collected.config, {
        ...(pushed.remote?.collectorStatus || pushed.merged?.collectorStatus || collected.payload.collectorStatus || {}),
        status: "warning",
        progress: 100,
        stepLabel: "数据已导入，AI 自动分析失败",
        message: `数据已经自动导入网站，但 AI 专家报告生成失败：${error.message}`,
        updatedAt: nowIso()
      }).catch(() => {});
      console.warn("数据已导入网站。明天打开页面后，也可以在短视频系统里重新生成专家报告。");
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
