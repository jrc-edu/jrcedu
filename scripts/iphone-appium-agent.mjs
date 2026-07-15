#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import process from "node:process";
import { spawn } from "node:child_process";
import { remote } from "webdriverio";

const DATA_DIR = path.join(os.homedir(), "Documents", "JRC-iPhone-Agent");
const SNAPSHOT_DIR = path.join(DATA_DIR, "snapshots");
const DOUYIN_SEARCH_DIR = path.join(DATA_DIR, "douyin-searches");
const DOUYIN_MATH_RESEARCH_DIR = path.join(DATA_DIR, "douyin-math-research");
const DOUYIN_VIDEO_DEEP_DIVE_DIR = path.join(DATA_DIR, "douyin-video-deep-dives");
const LATEST_JSON_PATH = path.join(DATA_DIR, "latest-appium-snapshot.json");
const LATEST_SOURCE_PATH = path.join(DATA_DIR, "latest-page-source.xml");
const LATEST_SCREENSHOT_PATH = path.join(DATA_DIR, "latest-appium-screenshot.png");
const INSTALLED_APPS_RAW_PATH = path.join(DATA_DIR, "latest-installed-apps.raw.json");
const INSTALLED_APPS_PATH = path.join(DATA_DIR, "latest-installed-apps.json");
const LATEST_DOUYIN_SEARCH_JSON_PATH = path.join(DATA_DIR, "latest-douyin-search.json");
const LATEST_DOUYIN_SEARCH_MD_PATH = path.join(DATA_DIR, "latest-douyin-search.md");
const LATEST_DOUYIN_MATH_RESEARCH_JSON_PATH = path.join(DATA_DIR, "latest-douyin-math-research.json");
const LATEST_DOUYIN_MATH_RESEARCH_MD_PATH = path.join(DATA_DIR, "latest-douyin-math-research.md");
const LATEST_DOUYIN_VIDEO_DEEP_DIVE_JSON_PATH = path.join(DATA_DIR, "latest-douyin-video-deep-dive.json");
const LATEST_DOUYIN_VIDEO_DEEP_DIVE_MD_PATH = path.join(DATA_DIR, "latest-douyin-video-deep-dive.md");
const LATEST_DOUYIN_LINK_COPY_JSON_PATH = path.join(DATA_DIR, "latest-douyin-link-copy.json");
const LATEST_DOUYIN_LINK_COPY_MD_PATH = path.join(DATA_DIR, "latest-douyin-link-copy.md");
const SCRIPT_DIR = path.dirname(path.resolve(process.cwd(), process.argv[1] || "scripts/iphone-appium-agent.mjs"));
const OCR_SCRIPT_PATH = path.join(SCRIPT_DIR, "ocr-image.swift");

const UDID = process.env.JRC_IPHONE_UDID || "00008120-000A5D1C2E5BC01E";
const DEVICE_NAME = process.env.JRC_IPHONE_NAME || "程志豪的iPhone";
const PLATFORM_VERSION = process.env.JRC_IPHONE_PLATFORM_VERSION || "26.5";
const WDA_LAUNCH_TIMEOUT = Number(process.env.JRC_WDA_LAUNCH_TIMEOUT || 300000);
const WEBDRIVER_TIMEOUT = Number(process.env.JRC_WEBDRIVER_TIMEOUT || WDA_LAUNCH_TIMEOUT + 60000);
const SHOW_XCODE_LOG = process.env.JRC_SHOW_XCODE_LOG === "1";
const USE_NEW_WDA = process.env.JRC_USE_NEW_WDA === "1";
const SHOULD_START_APPIUM = process.env.JRC_START_APPIUM !== "0";

const APP_ALIASES = {
  wechat: {
    label: "微信",
    bundleId: "com.tencent.xin",
    note: "只采集当前可见界面，不自动发送消息、不自动加好友。"
  },
  douyin: {
    label: "抖音",
    bundleId: "com.ss.iphone.ugc.Aweme",
    note: "可用于短视频手工检索后的画面采集。"
  }
};

const MATH_RESEARCH_KEYWORD_GROUPS = [
  {
    group: "高赞文案",
    purpose: "找适合数学老师账号复用的家长痛点、学习焦虑、提分承诺、老师人设表达。",
    keywords: [
      "数学老师 文案",
      "数学提分 文案",
      "小学数学 家长 文案",
      "初中数学 学习方法 家长"
    ]
  },
  {
    group: "高赞讲题",
    purpose: "找高赞好题、讲题结构、题目类型、封面标题和可深挖的板书答案候选。",
    keywords: [
      "数学老师 讲题",
      "小学数学 解题技巧",
      "初中数学 压轴题 讲解",
      "小升初数学 讲题",
      "数学辅助线 解题"
    ]
  }
];

function nowIso() {
  return new Date().toISOString();
}

function timestampForFile(value = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${value.getFullYear()}${pad(value.getMonth() + 1)}${pad(value.getDate())}-${pad(value.getHours())}${pad(value.getMinutes())}${pad(value.getSeconds())}`;
}

function sanitizeFileName(value) {
  return String(value || "current")
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "current";
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function run(command, args = [], options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
      ...options
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      resolve({
        ok: false,
        code: -1,
        stdout,
        stderr: `${stderr}${error.message}`
      });
    });
    child.on("close", (code) => {
      resolve({
        ok: code === 0,
        code,
        stdout: stdout.trim(),
        stderr: stderr.trim()
      });
    });
  });
}

async function fetchWithTimeout(url, timeoutMs = 1500) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

async function findAppiumServer() {
  const candidates = [
    { path: "/wd/hub", statusUrl: "http://127.0.0.1:4723/wd/hub/status" },
    { path: "/", statusUrl: "http://127.0.0.1:4723/status" }
  ];
  for (const candidate of candidates) {
    if (await fetchWithTimeout(candidate.statusUrl)) {
      return { running: true, path: candidate.path, startedByScript: false };
    }
  }
  return { running: false, path: "/wd/hub", startedByScript: false };
}

async function ensureAppiumServer() {
  const existing = await findAppiumServer();
  if (existing.running) {
    return existing;
  }
  if (!SHOULD_START_APPIUM) {
    throw new Error("Appium 服务没有启动。请先运行：appium --base-path /wd/hub");
  }

  const child = spawn("appium", ["--base-path", "/wd/hub"], {
    shell: false,
    stdio: ["ignore", "pipe", "pipe"]
  });
  let appiumLog = "";
  const appendLog = (chunk) => {
    const text = chunk.toString();
    appiumLog = `${appiumLog}${text}`.slice(-8000);
    if (process.env.JRC_APPIUM_LOG === "1") {
      process.stdout.write(text);
    }
  };
  child.stdout.on("data", appendLog);
  child.stderr.on("data", appendLog);

  for (let i = 0; i < 60; i += 1) {
    const current = await findAppiumServer();
    if (current.running) {
      return { ...current, startedByScript: true, child };
    }
    if (child.exitCode !== null) {
      throw new Error(`Appium 启动失败：\n${appiumLog || `exit ${child.exitCode}`}`);
    }
    await sleep(500);
  }

  child.kill("SIGTERM");
  throw new Error(`Appium 启动超时。最近日志：\n${appiumLog}`);
}

async function checkTunnelRunning() {
  const result = await run("ps", ["aux"]);
  const text = `${result.stdout}\n${result.stderr}`;
  return /tunnel-creation|RemoteXPC/i.test(text);
}

function resolveApp(input) {
  if (!input || input === "current") {
    return null;
  }
  const alias = APP_ALIASES[input];
  if (alias) {
    return alias;
  }
  if (/^[a-zA-Z0-9.-]+$/.test(input)) {
    return {
      label: input,
      bundleId: input,
      note: "自定义 bundleId。"
    };
  }
  throw new Error(`不认识这个 App：${input}。可用：wechat、douyin，或传入完整 bundleId。`);
}

function decodeXmlEntity(value) {
  return String(value || "")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function decodeHtmlEntity(value) {
  return decodeXmlEntity(value)
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)));
}

function stripHtml(value) {
  return decodeHtmlEntity(String(value || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim());
}

function escapeIosPredicateString(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function xpathLiteral(value) {
  const text = String(value);
  if (!text.includes("'")) {
    return `'${text}'`;
  }
  if (!text.includes("\"")) {
    return `"${text}"`;
  }
  return `concat(${text.split("'").map((part) => `'${part}'`).join(", \"'\", ")})`;
}

function parseAttributes(tag) {
  const attrs = {};
  for (const match of tag.matchAll(/\s([A-Za-z_:][\w:.-]*)="([^"]*)"/g)) {
    attrs[match[1]] = decodeXmlEntity(match[2]);
  }
  return attrs;
}

function compactText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractElements(source) {
  const items = [];
  const seen = new Set();

  for (const match of source.matchAll(/<XCUIElementType[^>]*>/g)) {
    const attrs = parseAttributes(match[0]);
    if (attrs.visible === "false") {
      continue;
    }
    const text = compactText(attrs.label || attrs.name || attrs.value || "");
    if (!text || text === "(null)") {
      continue;
    }
    const key = `${attrs.type}|${text}|${attrs.x}|${attrs.y}|${attrs.width}|${attrs.height}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    items.push({
      type: attrs.type || "",
      text,
      enabled: attrs.enabled !== "false",
      selected: attrs.selected === "true",
      rect: {
        x: Number(attrs.x || 0),
        y: Number(attrs.y || 0),
        width: Number(attrs.width || 0),
        height: Number(attrs.height || 0)
      }
    });
  }

  return items.sort((a, b) => (a.rect.y - b.rect.y) || (a.rect.x - b.rect.x));
}

function elementTextMatches(item, keyword) {
  const text = compactText(item?.text || "");
  if (!text || !keyword) {
    return false;
  }
  return text === keyword || text.includes(keyword);
}

function isNoisyVisibleText(text) {
  const value = compactText(text);
  if (!value) {
    return true;
  }
  if (/^\d{1,2}:\d{2}$/.test(value)) {
    return true;
  }
  if (/^(首页|商城|消息|我|朋友|推荐|关注|精选|搜索|取消|返回|更多|分享|评论|点赞|转发|收藏)$/.test(value)) {
    return true;
  }
  if (/^aweme\.search\.result\.card\.video$/.test(value)) {
    return true;
  }
  if (/^(电池电量|蜂窝网络|无线局域网|Page control|水平滚动条|Home screen icons)/.test(value)) {
    return true;
  }
  if (/^[\d.,万wWkK]+$/.test(value)) {
    return true;
  }
  return value.length <= 1;
}

function summarizeSearchTexts(pages) {
  const all = [];
  const seen = new Set();
  for (const page of pages) {
    for (const item of page.elements || []) {
      const text = compactText(item.text);
      if (isNoisyVisibleText(text) || seen.has(text)) {
        continue;
      }
      seen.add(text);
      all.push(text);
    }
  }

  const educationPattern = /数学|小升初|初中|小学|中考|奥数|培优|家长|孩子|学习|成绩|提分|老师|课堂|升学|压轴|几何|代数|函数|方程|考试|满分|错题|讲题|解题|思维/;
  const accountPattern = /老师|教育|数学|学校|学堂|课堂|讲题|培优|升学|账号|主页|粉丝/;
  const metricPattern = /赞|评论|收藏|转发|粉丝|获赞|播放|点赞/;
  const highLikeCandidates = extractVideoCards(pages, educationPattern);

  return {
    uniqueTextCount: all.length,
    topTexts: all.slice(0, 120),
    possibleVideoTitles: all
      .filter((text) => text.length >= 6 && text.length <= 90 && educationPattern.test(text))
      .filter((text) => !isSearchTabText(text))
      .slice(0, 60),
    possibleAccounts: all
      .filter((text) => text.length >= 2 && text.length <= 40 && accountPattern.test(text))
      .filter((text) => !isSearchTabText(text))
      .slice(0, 40),
    possibleMetrics: all
      .filter((text) => text.length <= 40 && metricPattern.test(text) && /[0-9]/.test(text))
      .slice(0, 60),
    possibleHighLikeVideos: highLikeCandidates
      .sort((a, b) => b.hotScore - a.hotScore)
      .slice(0, 40)
  };
}

function rectCenter(rect) {
  return {
    x: Number(rect?.x || 0) + Number(rect?.width || 0) / 2,
    y: Number(rect?.y || 0) + Number(rect?.height || 0) / 2
  };
}

function pointInRect(point, rect, padding = 0) {
  return point.x >= Number(rect.x || 0) - padding
    && point.x <= Number(rect.x || 0) + Number(rect.width || 0) + padding
    && point.y >= Number(rect.y || 0) - padding
    && point.y <= Number(rect.y || 0) + Number(rect.height || 0) + padding;
}

function extractVideoCards(pages, educationPattern) {
  const cards = [];
  const seen = new Set();
  for (const page of pages) {
    const elements = page.elements || [];
    const cardContainers = elements.filter((item) => compactText(item.text) === "aweme.search.result.card.video");
    for (const card of cardContainers) {
      const inside = elements.filter((item) => {
        if (item === card) {
          return false;
        }
        return pointInRect(rectCenter(item.rect), card.rect, 4);
      });
      const titleCandidates = inside
        .map((item) => compactText(item.text))
        .filter((text) => text.length >= 6 && text.length <= 120)
        .filter((text) => educationPattern.test(text))
        .filter((text) => !/未选中|已选中|垂直滚动条|相关搜索|点赞|获赞/.test(text));
      if (!titleCandidates.length) {
        continue;
      }
      const title = [...new Set(titleCandidates)].sort((a, b) => b.length - a.length)[0];
      const metricTexts = [...new Set(inside
        .map((item) => compactText(item.text))
        .filter((text) => /赞|点赞|获赞|评论|收藏|转发|播放/.test(text))
        .filter((text) => /[0-9]/.test(text)))];
      const accountTexts = [...new Set(inside
        .map((item) => compactText(item.text))
        .filter((text) => text && text !== title)
        .filter((text) => !/赞|点赞|获赞|评论|收藏|转发|播放|未点赞|aweme/.test(text))
        .filter((text) => !isCardMetaText(text))
        .filter((text) => text.length >= 2 && text.length <= 30))];
      const key = `${title}|${metricTexts.join(",")}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      cards.push({
        text: title,
        pageIndex: page.pageIndex,
        accountTexts: accountTexts.slice(0, 3),
        metricTexts: metricTexts.slice(0, 6),
        hotScore: metricTexts.reduce((score, item) => score + parseMetricScore(item), 0)
      });
    }
  }
  return cards;
}

function isCardMetaText(text) {
  const value = compactText(text);
  if (!value) {
    return true;
  }
  if (/^(抖音|返回。按钮|水平滚动条|垂直滚动条)/.test(value)) {
    return true;
  }
  if (isSearchTabText(value)) {
    return true;
  }
  if (/按钮$/.test(value) || /未选中|已选中/.test(value)) {
    return true;
  }
  if (/^\d{1,2}:\d{2}(?::\d{2})?$/.test(value)) {
    return true;
  }
  if (/^\d+(?:\.\d+)?万?$/.test(value)) {
    return true;
  }
  return false;
}

function isSearchTabText(text) {
  const value = compactText(text).replace(/。?(未选中|已选中|按钮)$/g, "");
  return /^(综合|视频|用户|图文|直播|商品|音乐|筛选|全部|小学|初中|高中|美女|女老师|厉老师|徒手画圆|跳舞|头像)$/.test(value);
}

function parseMetricScore(text) {
  const value = compactText(text);
  let score = 0;
  for (const match of value.matchAll(/([0-9]+(?:\.[0-9]+)?)(万|w|W)?/g)) {
    const n = Number(match[1]);
    if (!Number.isFinite(n)) {
      continue;
    }
    score += n * (match[2] ? 10000 : 1);
  }
  if (/赞|点赞|获赞/.test(value)) {
    score *= 1.8;
  }
  if (/收藏|转发/.test(value)) {
    score *= 1.5;
  }
  if (/粉丝|播放/.test(value)) {
    score *= 1.2;
  }
  return score;
}

function normalizeMatchText(text) {
  return compactText(text)
    .replace(/#[^#\s]+/g, "")
    .replace(/@[^@\s]+/g, "")
    .replace(/[，。！？、,.!?:：；;“”"'‘’（）()\[\]【】《》<>#\s]+/g, "")
    .toLowerCase();
}

function titleLooksLikeMatch(candidate, target) {
  const c = normalizeMatchText(candidate);
  const t = normalizeMatchText(target);
  if (!c || !t) {
    return false;
  }
  if (c === t || c.includes(t) || t.includes(c)) {
    return true;
  }
  const cHead = c.slice(0, Math.min(18, c.length));
  const tHead = t.slice(0, Math.min(18, t.length));
  return cHead.length >= 8 && tHead.length >= 8 && (c.includes(tHead) || t.includes(cHead));
}

async function relaunchApp(driver, app) {
  try {
    await driver.terminateApp(app.bundleId);
    await sleep(1200);
  } catch {
    // Some Appium builds do not expose terminateApp reliably on real devices.
  }
  try {
    await driver.activateApp(app.bundleId);
  } catch {
    await launchApp(driver, app);
  }
  await sleep(Number(process.env.JRC_IOS_APP_SETTLE_MS || 3000));
}

async function ocrImage(imagePath) {
  if (process.env.JRC_VIDEO_DEEP_OCR === "0") {
    return { ok: false, text: "", error: "OCR disabled by JRC_VIDEO_DEEP_OCR=0" };
  }
  try {
    await fs.access(OCR_SCRIPT_PATH);
  } catch {
    return { ok: false, text: "", error: `OCR script missing: ${OCR_SCRIPT_PATH}` };
  }
  const result = await run("swift", [OCR_SCRIPT_PATH, imagePath]);
  if (!result.ok) {
    return { ok: false, text: "", error: result.stderr || result.stdout || `swift exit ${result.code}` };
  }
  let payload = null;
  try {
    payload = JSON.parse(result.stdout || "{}");
  } catch {
    return { ok: true, text: result.stdout || "", cleanText: "", observations: [], image: null, error: "" };
  }
  const observations = Array.isArray(payload.observations) ? payload.observations : [];
  const rawText = observations.map((item) => item.text).filter(Boolean).join("\n");
  const cleanObservations = filterVideoOcrObservations(payload.image, observations);
  return {
    ok: true,
    text: rawText,
    cleanText: cleanObservations.map((item) => item.text).filter(Boolean).join("\n"),
    observations,
    cleanObservations,
    image: payload.image || null,
    error: ""
  };
}

function isDouyinUiOrDanmuText(text) {
  const value = compactText(text);
  if (!value) {
    return true;
  }
  if (/^(搜索|返回|全屏观看|期待你的评论|听抖音|抖音精选内容|合集|进度条|开头|片尾|弹|区|d：|Q)$/.test(value)) {
    return true;
  }
  if (/^(点赞|评论|收藏|分享|未点赞|关注|粉丝|私信)$/.test(value)) {
    return true;
  }
  if (/^\d+(\.\d+)?万?$/.test(value)) {
    return true;
  }
  if (/^\d{1,2}:\d{2}$/.test(value)) {
    return true;
  }
  if (/第\d+集|#|@|亮亮巧解数学|抖音|小助手/.test(value)) {
    return true;
  }
  if (/王者|多推|我以为|弹幕|哈哈|牛逼|打王者|辅助教学|发枪/.test(value)) {
    return true;
  }
  if (value.length <= 1 && !/[A-Za-z0-9]/.test(value)) {
    return true;
  }
  return false;
}

function filterVideoOcrObservations(image, observations) {
  const width = Number(image?.width || 0);
  const height = Number(image?.height || 0);
  if (!width || !height) {
    return observations.filter((item) => !isDouyinUiOrDanmuText(item.text));
  }

  return observations
    .filter((item) => {
      const box = item.pixelBox || {};
      const x = Number(box.x || 0);
      const y = Number(box.y || 0);
      const w = Number(box.width || 0);
      const h = Number(box.height || 0);
      const centerX = x + w / 2;
      const centerY = y + h / 2;

      // Keep the main teaching canvas: avoid top status/search bar, right action rail,
      // bottom account/comment area, and most full-screen danmu lanes.
      if (centerY < height * 0.15 || centerY > height * 0.78) {
        return false;
      }
      if (centerX < width * 0.08 || centerX > width * 0.78) {
        return false;
      }
      if (centerY < height * 0.45 && compactText(item.text).length > 8 && !/[A-Za-z0-9①②③④⑤⑥⑦⑧⑨＋+\-＝=∠△]/.test(item.text)) {
        return false;
      }
      return !isDouyinUiOrDanmuText(item.text);
    })
    .sort((a, b) => {
      const ay = Number(a.pixelBox?.y || 0);
      const by = Number(b.pixelBox?.y || 0);
      const ax = Number(a.pixelBox?.x || 0);
      const bx = Number(b.pixelBox?.x || 0);
      return (ay - by) || (ax - bx);
    });
}

function findVideoCardInElements(elements, targetTitle) {
  const cardContainers = elements.filter((item) => compactText(item.text) === "aweme.search.result.card.video");
  for (const card of cardContainers) {
    const inside = elements.filter((item) => item !== card && pointInRect(rectCenter(item.rect), card.rect, 4));
    const titleCandidates = inside
      .map((item) => ({
        text: compactText(item.text),
        rect: item.rect,
        type: item.type
      }))
      .filter((item) => item.text.length >= 6)
      .filter((item) => !/赞|点赞|获赞|评论|收藏|转发|播放|未点赞|aweme|未选中|已选中|水平滚动条|垂直滚动条/.test(item.text));
    const matchedTitle = titleCandidates.find((item) => titleLooksLikeMatch(item.text, targetTitle));
    if (!matchedTitle) {
      continue;
    }
    const metricTexts = [...new Set(inside
      .map((item) => compactText(item.text))
      .filter((text) => /赞|点赞|获赞|评论|收藏|转发|播放/.test(text))
      .filter((text) => /[0-9]/.test(text)))];
    const accountTexts = [...new Set(inside
      .map((item) => compactText(item.text))
      .filter((text) => text && text !== matchedTitle.text)
      .filter((text) => !/赞|点赞|获赞|评论|收藏|转发|播放|未点赞|aweme/.test(text))
      .filter((text) => !isCardMetaText(text))
      .filter((text) => text.length >= 2 && text.length <= 30))];
    return {
      card,
      matchedTitle: matchedTitle.text,
      matchedTitleRect: matchedTitle.rect,
      accountTexts: accountTexts.slice(0, 3),
      metricTexts: metricTexts.slice(0, 6)
    };
  }
  return null;
}

async function searchAndOpenTargetVideo(driver, target, options = {}) {
  const app = APP_ALIASES.douyin;
  const maxScanPages = Math.max(1, Math.min(12, Number(options.maxScanPages || process.env.JRC_DOUYIN_DEEP_SCAN_PAGES || 5)));
  await relaunchApp(driver, app);

  const searchEntry = await enterDouyinSearch(driver);
  if (!searchEntry.ok) {
    return {
      ok: false,
      pageIndex: 0,
      match: null,
      scannedPages: [],
      reason: "无法进入抖音搜索框，可能被登录/验证弹层挡住。"
    };
  }

  await enterSearchKeyword(driver, target.keyword || target.text);
  await submitSearch(driver);
  await applyDouyinHotVideoFilter(driver);

  const scannedPages = [];
  for (let pageIndex = 1; pageIndex <= maxScanPages; pageIndex += 1) {
    const source = await driver.getPageSource();
    const elements = extractElements(source);
    const match = findVideoCardInElements(elements, target.text);
    scannedPages.push({
      pageIndex,
      textCount: elements.length,
      found: Boolean(match),
      firstTexts: elements.slice(0, 40).map((item) => item.text)
    });
    if (match) {
      const tapRect = match.matchedTitleRect || match.card.rect;
      const point = rectCenter(tapRect);
      await tapAt(driver, point.x, point.y);
      await sleep(Number(process.env.JRC_DOUYIN_VIDEO_OPEN_SETTLE_MS || 2500));
      return {
        ok: true,
        pageIndex,
        match,
        scannedPages
      };
    }
    if (pageIndex < maxScanPages) {
      await driver.execute("mobile: swipe", { direction: "up" });
      await sleep(Number(process.env.JRC_IOS_SEARCH_PAGE_SETTLE_MS || 1800));
    }
  }
  return {
    ok: false,
    pageIndex: 0,
    match: null,
    scannedPages
  };
}

async function saveDeepDiveFrame(driver, itemDir, target, frame, elapsedState) {
  const waitMs = Math.max(0, frame.atMs - elapsedState.elapsedMs);
  if (waitMs) {
    await sleep(waitMs);
    elapsedState.elapsedMs += waitMs;
  }
  const base = `${String(frame.index).padStart(2, "0")}-${frame.label}`;
  const screenshotPath = path.join(itemDir, `${base}.png`);
  const jsonPath = path.join(itemDir, `${base}.json`);

  // Video pages are highly dynamic; getPageSource can time out or invalidate the Appium tree.
  // For deep dives we only need stable visual frames, so capture the screenshot directly.
  const screenshot = await driver.takeScreenshot();
  await fs.writeFile(screenshotPath, Buffer.from(screenshot, "base64"));

  const ocr = await ocrImage(screenshotPath);
  await fs.writeFile(jsonPath, `${JSON.stringify({
    collectedAt: nowIso(),
    action: `douyin-video-deep-dive:${frame.label}`,
    target: {
      text: target.text,
      keyword: target.keyword,
      materialType: target.materialType || "",
      accountTexts: target.accountTexts || [],
      metricTexts: target.metricTexts || []
    },
    frame: {
      label: frame.label,
      labelName: frame.labelName,
      atMs: frame.atMs
    },
    files: {
      screenshotPath,
      jsonPath
    },
    ocr
  }, null, 2)}\n`, "utf8");

  return {
    label: frame.label,
    labelName: frame.labelName,
    atMs: frame.atMs,
    files: {
      screenshotPath,
      jsonPath
    },
    visibleTexts: [],
    ocr
  };
}

async function createDriver(serverPath) {
  return remote({
    protocol: "http",
    hostname: "127.0.0.1",
    port: 4723,
    path: serverPath,
    logLevel: "warn",
    connectionRetryTimeout: WEBDRIVER_TIMEOUT,
    connectionRetryCount: 0,
    capabilities: {
      platformName: "iOS",
      "appium:automationName": "XCUITest",
      "appium:udid": UDID,
      "appium:deviceName": DEVICE_NAME,
      "appium:platformVersion": PLATFORM_VERSION,
      "appium:noReset": true,
      "appium:newCommandTimeout": 180,
      "appium:showXcodeLog": SHOW_XCODE_LOG,
      "appium:usePrebuiltWDA": false,
      "appium:useNewWDA": USE_NEW_WDA,
      "appium:wdaLaunchTimeout": WDA_LAUNCH_TIMEOUT,
      "appium:wdaStartupRetries": 2,
      "appium:wdaStartupRetryInterval": 10000,
      "appium:updatedWDABundleId": process.env.JRC_WDA_BUNDLE_ID || "com.jrcedu.WebDriverAgentRunner"
    }
  });
}

async function launchApp(driver, app) {
  if (!app) {
    return;
  }
  try {
    await driver.execute("mobile: launchApp", { bundleId: app.bundleId });
  } catch {
    await driver.activateApp(app.bundleId);
  }
  await sleep(Number(process.env.JRC_IOS_APP_SETTLE_MS || 3000));
}

async function tapAt(driver, x, y) {
  await driver.performActions([
    {
      type: "pointer",
      id: "finger1",
      parameters: { pointerType: "touch" },
      actions: [
        { type: "pointerMove", duration: 0, x: Math.round(x), y: Math.round(y) },
        { type: "pointerDown", button: 0 },
        { type: "pause", duration: 120 },
        { type: "pointerUp", button: 0 }
      ]
    }
  ]);
  await driver.releaseActions();
}

async function clickFirstMatchingText(driver, texts) {
  const source = await driver.getPageSource();
  const elements = extractElements(source);
  for (const text of texts) {
    const found = elements.find((item) => elementTextMatches(item, text));
    if (!found) {
      continue;
    }
    const x = found.rect.x + found.rect.width / 2;
    const y = found.rect.y + found.rect.height / 2;
    await tapAt(driver, x, y);
    return { ok: true, text: found.text, rect: found.rect };
  }
  return { ok: false, elements };
}

function hasDouyinLoginPrompt(elements) {
  const text = elements.map((item) => compactText(item.text)).join(" ");
  return /登录发现更多精彩|请输入手机号|手机号验证|密码登录|验证并登录|用户协议|隐私政策/.test(text);
}

async function dismissDouyinBlockingPrompts(driver) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const source = await driver.getPageSource();
    const elements = extractElements(source);
    if (!hasDouyinLoginPrompt(elements)) {
      return { dismissed: attempt > 0, reason: "no-login-prompt" };
    }

    const close = await clickFirstMatchingText(driver, ["关闭", "跳过", "取消", "以后再说", "暂不登录"]);
    if (close.ok) {
      await sleep(1500);
      continue;
    }

    try {
      await driver.hideKeyboard();
      await sleep(800);
    } catch {
      // Keyboard may already be hidden, or the driver may not expose hideKeyboard.
    }

    const retryClose = await clickFirstMatchingText(driver, ["关闭", "跳过", "取消", "以后再说", "暂不登录"]);
    if (retryClose.ok) {
      await sleep(1500);
      continue;
    }
    return { dismissed: attempt > 0, reason: "login-prompt-not-dismissible" };
  }
  return { dismissed: true, reason: "max-attempts" };
}

async function enterDouyinSearch(driver) {
  await dismissDouyinBlockingPrompts(driver);

  if (await findInputElement(driver)) {
    return { ok: true, method: "existing-input" };
  }

  let searchEntry = await clickFirstMatchingText(driver, ["搜索"]);
  if (searchEntry.ok) {
    await sleep(1500);
    await dismissDouyinBlockingPrompts(driver);
    if (await findInputElement(driver)) {
      return { ok: true, method: `tap:${searchEntry.text}` };
    }
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const back = await clickFirstMatchingText(driver, ["返回"]);
    if (!back.ok) {
      break;
    }
    await sleep(1200);
    await dismissDouyinBlockingPrompts(driver);
    if (await findInputElement(driver)) {
      return { ok: true, method: "back-to-input" };
    }
    searchEntry = await clickFirstMatchingText(driver, ["搜索"]);
    if (searchEntry.ok) {
      await sleep(1500);
      await dismissDouyinBlockingPrompts(driver);
      if (await findInputElement(driver)) {
        return { ok: true, method: `back-and-tap:${searchEntry.text}` };
      }
    }
  }

  const rect = await driver.getWindowRect();
  const tapPoints = [
    { x: rect.width - 42, y: Math.max(56, rect.height * 0.07) },
    { x: rect.width * 0.5, y: Math.max(62, rect.height * 0.08) },
    { x: rect.width * 0.42, y: Math.min(84, rect.height * 0.09) }
  ];
  for (const point of tapPoints) {
    await tapAt(driver, point.x, point.y);
    await sleep(1200);
    await dismissDouyinBlockingPrompts(driver);
    if (await findInputElement(driver)) {
      return { ok: true, method: "coordinate-tap" };
    }
  }

  return { ok: false, method: "not-found" };
}

async function findInputElement(driver) {
  const selectors = [
    "-ios class chain:**/XCUIElementTypeSearchField",
    "-ios class chain:**/XCUIElementTypeTextField",
    "-ios class chain:**/XCUIElementTypeTextView",
    "-ios predicate string:type == 'XCUIElementTypeSearchField' OR type == 'XCUIElementTypeTextField' OR type == 'XCUIElementTypeTextView'"
  ];
  for (const selector of selectors) {
    const element = await driver.$(selector);
    if (await element.isExisting()) {
      return element;
    }
  }
  return null;
}

async function enterSearchKeyword(driver, keyword) {
  let input = await findInputElement(driver);
  if (!input) {
    const rect = await driver.getWindowRect();
    await tapAt(driver, rect.width * 0.42, Math.min(84, rect.height * 0.09));
    await sleep(800);
    input = await findInputElement(driver);
  }
  if (!input) {
    throw new Error("没有找到搜索输入框。可能抖音页面结构变化，或当前不在搜索页。");
  }

  await input.click();
  await sleep(300);
  try {
    await input.clearValue();
  } catch {
    await driver.keys(["\uE009", "a"]);
    await sleep(200);
  }
  try {
    await input.setValue(keyword);
  } catch {
    await driver.keys(keyword);
  }
  await sleep(800);
}

async function submitSearch(driver) {
  const clicked = await clickFirstMatchingText(driver, ["搜索"]);
  if (clicked.ok) {
    await sleep(Number(process.env.JRC_IOS_SEARCH_SETTLE_MS || 3500));
    return { ok: true, method: `tap:${clicked.text}` };
  }
  try {
    await driver.keys("\uE007");
    await sleep(Number(process.env.JRC_IOS_SEARCH_SETTLE_MS || 3500));
    return { ok: true, method: "keyboard-enter" };
  } catch {
    return { ok: false, method: "none" };
  }
}

async function applyDouyinHotVideoFilter(driver) {
  const attempts = [];
  const videoTab = await clickFirstMatchingText(driver, ["视频"]);
  attempts.push({
    target: "视频",
    ok: videoTab.ok,
    matched: videoTab.text || ""
  });
  if (videoTab.ok) {
    await sleep(1600);
  }

  for (const target of ["最多点赞", "最热", "热门", "综合排序"]) {
    const result = await clickFirstMatchingText(driver, [target]);
    attempts.push({
      target,
      ok: result.ok,
      matched: result.text || ""
    });
    if (result.ok) {
      await sleep(1800);
      break;
    }
  }
  return attempts;
}

async function captureSnapshot(driver, app, action) {
  await fs.mkdir(SNAPSHOT_DIR, { recursive: true });
  const orientation = await driver.getOrientation();
  const source = await driver.getPageSource();
  const screenshot = await driver.takeScreenshot();
  const elements = extractElements(source);

  const stamp = timestampForFile();
  const baseName = `${stamp}-${sanitizeFileName(app?.label || "current")}`;
  const sourcePath = path.join(SNAPSHOT_DIR, `${baseName}.xml`);
  const screenshotPath = path.join(SNAPSHOT_DIR, `${baseName}.png`);
  const jsonPath = path.join(SNAPSHOT_DIR, `${baseName}.json`);

  await fs.writeFile(sourcePath, source, "utf8");
  await fs.writeFile(screenshotPath, Buffer.from(screenshot, "base64"));
  await fs.copyFile(sourcePath, LATEST_SOURCE_PATH);
  await fs.copyFile(screenshotPath, LATEST_SCREENSHOT_PATH);

  const snapshot = {
    collectedAt: nowIso(),
    action,
    device: {
      udid: UDID,
      name: DEVICE_NAME,
      platformVersion: PLATFORM_VERSION,
      orientation
    },
    app: app
      ? {
          label: app.label,
          bundleId: app.bundleId,
          note: app.note
        }
      : {
          label: "当前手机画面",
          bundleId: "",
          note: "没有主动打开 App，只采集当前屏幕。"
        },
    files: {
      jsonPath,
      sourcePath,
      screenshotPath,
      latestJsonPath: LATEST_JSON_PATH,
      latestSourcePath: LATEST_SOURCE_PATH,
      latestScreenshotPath: LATEST_SCREENSHOT_PATH
    },
    summary: {
      elementCount: elements.length,
      textCount: elements.filter((item) => item.text).length,
      topVisibleTexts: elements.slice(0, 80).map((item) => item.text)
    },
    elements: elements.slice(0, 300),
    safety: {
      mode: "collect_only",
      canSendMessage: false,
      canAddFriend: false,
      note: "当前版本只采集信息和页面结构，不自动发送消息、不自动加好友。"
    }
  };

  await fs.writeFile(jsonPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  await fs.writeFile(LATEST_JSON_PATH, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  return snapshot;
}

async function withDriver(task) {
  const tunnelRunning = await checkTunnelRunning();
  if (!tunnelRunning) {
    console.log("提醒：没有检测到 RemoteXPC tunnel。如果连接失败，请先运行：sudo appium driver run xcuitest tunnel-creation");
  }

  const server = await ensureAppiumServer();
  const driver = await createDriver(server.path);
  try {
    return await task(driver, { tunnelRunning, server });
  } finally {
    try {
      await driver.deleteSession();
    } finally {
      if (server.startedByScript && server.child) {
        server.child.kill("SIGTERM");
      }
    }
  }
}

async function check() {
  const server = await findAppiumServer();
  const tunnelRunning = await checkTunnelRunning();
  await fs.mkdir(DATA_DIR, { recursive: true });
  const status = {
    checkedAt: nowIso(),
    dataDir: DATA_DIR,
    device: {
      udid: UDID,
      name: DEVICE_NAME,
      platformVersion: PLATFORM_VERSION
    },
    appium: {
      running: server.running,
      path: server.path,
      autoStartEnabled: SHOULD_START_APPIUM
    },
    remoteXpcTunnelRunning: tunnelRunning,
    scripts: {
      collectCurrent: "npm run iphone:collect",
      collectWechat: "npm run iphone:collect:wechat",
      openWechat: "npm run iphone:open -- wechat"
    }
  };
  const statusPath = path.join(DATA_DIR, "latest-appium-agent-status.json");
  await fs.writeFile(statusPath, `${JSON.stringify(status, null, 2)}\n`, "utf8");
  console.log("iPhone Appium 采集器检查完成");
  console.log(`Appium：${server.running ? `已启动 ${server.path}` : "未启动，采集时会尝试自动启动"}`);
  console.log(`RemoteXPC tunnel：${tunnelRunning ? "已启动" : "未检测到"}`);
  console.log(`状态文件：${statusPath}`);
}

async function collect(appInput) {
  const app = resolveApp(appInput);
  const snapshot = await withDriver(async (driver) => {
    await launchApp(driver, app);
    return captureSnapshot(driver, app, "collect");
  });
  console.log("采集完成");
  console.log(`App：${snapshot.app.label}${snapshot.app.bundleId ? `（${snapshot.app.bundleId}）` : ""}`);
  console.log(`可见文本：${snapshot.summary.textCount} 条`);
  console.log(`截图：${snapshot.files.latestScreenshotPath}`);
  console.log(`结构：${snapshot.files.latestSourcePath}`);
  console.log(`JSON：${snapshot.files.latestJsonPath}`);
}

async function openApp(appInput) {
  const app = resolveApp(appInput);
  if (!app) {
    throw new Error("请指定要打开的 App，例如：npm run iphone:open -- wechat");
  }
  await withDriver(async (driver) => {
    await launchApp(driver, app);
  });
  console.log(`已打开：${app.label}（${app.bundleId}）`);
}

async function tapText(text) {
  const target = compactText(text);
  if (!target) {
    throw new Error("请指定要点击的文字，例如：npm run iphone:tap -- 搜索");
  }
  const snapshot = await withDriver(async (driver) => {
    const escaped = escapeIosPredicateString(target);
    let element = await driver.$(`-ios predicate string:name == '${escaped}' OR label == '${escaped}' OR value == '${escaped}'`);
    if (!(await element.isExisting())) {
      const literal = xpathLiteral(target);
      element = await driver.$(`//*[contains(@name, ${literal}) or contains(@label, ${literal}) or contains(@value, ${literal})]`);
    }
    if (!(await element.isExisting())) {
      throw new Error(`当前画面没有找到可点击文字：${target}`);
    }
    await element.click();
    await sleep(Number(process.env.JRC_IOS_ACTION_SETTLE_MS || 1200));
    return captureSnapshot(driver, null, `tap:${target}`);
  });
  console.log(`已点击：${target}`);
  console.log(`点击后截图：${snapshot.files.latestScreenshotPath}`);
  console.log(`点击后 JSON：${snapshot.files.latestJsonPath}`);
}

async function typeText(text) {
  const value = String(text || "");
  if (!value) {
    throw new Error("请指定要输入的文字，例如：npm run iphone:type -- 竞品数学老师");
  }
  const snapshot = await withDriver(async (driver) => {
    await driver.keys(value);
    await sleep(Number(process.env.JRC_IOS_ACTION_SETTLE_MS || 1200));
    return captureSnapshot(driver, null, "type");
  });
  console.log("已输入文字");
  console.log(`输入后截图：${snapshot.files.latestScreenshotPath}`);
  console.log(`输入后 JSON：${snapshot.files.latestJsonPath}`);
}

async function swipe(directionInput) {
  const direction = compactText(directionInput || "up").toLowerCase();
  if (!["up", "down", "left", "right"].includes(direction)) {
    throw new Error("滑动方向只能是 up、down、left、right。");
  }
  const snapshot = await withDriver(async (driver) => {
    await driver.execute("mobile: swipe", { direction });
    await sleep(Number(process.env.JRC_IOS_ACTION_SETTLE_MS || 1200));
    return captureSnapshot(driver, null, `swipe:${direction}`);
  });
  console.log(`已滑动：${direction}`);
  console.log(`滑动后截图：${snapshot.files.latestScreenshotPath}`);
}

async function pressHome() {
  const snapshot = await withDriver(async (driver) => {
    await driver.execute("mobile: pressButton", { name: "home" });
    await sleep(Number(process.env.JRC_IOS_ACTION_SETTLE_MS || 1200));
    return captureSnapshot(driver, null, "home");
  });
  console.log("已回到桌面");
  console.log(`桌面截图：${snapshot.files.latestScreenshotPath}`);
}

function renderDouyinSearchMarkdown(report) {
  const lines = [];
  lines.push(`# 抖音关键词采集报告`);
  lines.push("");
  lines.push(`- 关键词：${report.keyword}`);
  lines.push(`- 采集时间：${report.collectedAt}`);
  lines.push(`- 采集页数：${report.pages.length}`);
  lines.push(`- 热门筛选：${report.hotFilterAttempts.some((item) => item.ok) ? "已尝试切到视频/热门结果" : "未识别到热门筛选，保留普通搜索结果"}`);
  lines.push(`- 安全模式：只采集可见页面，不自动关注、不评论、不私信`);
  lines.push("");
  lines.push("## 高赞候选视频");
  const highLikeVideos = report.summary.possibleHighLikeVideos.slice(0, 30);
  if (highLikeVideos.length) {
    for (const item of highLikeVideos) {
      const metrics = item.metricTexts.length ? `｜附近数据：${item.metricTexts.join("、")}` : "";
      const accounts = item.accountTexts?.length ? `｜账号：${item.accountTexts.join("、")}` : "";
      lines.push(`- 第 ${item.pageIndex} 屏｜${item.text}${accounts}${metrics}`);
    }
  } else {
    lines.push("- 暂未从可见文本里识别到高赞候选，建议查看截图确认抖音是否展示了点赞/播放字段。");
  }
  lines.push("");
  lines.push("## 可能的视频标题/内容线索");
  const titles = report.summary.possibleVideoTitles.slice(0, 30);
  if (titles.length) {
    for (const text of titles) {
      lines.push(`- ${text}`);
    }
  } else {
    lines.push("- 暂未从可见文本里识别到明显标题，建议查看截图确认页面是否进入搜索结果。");
  }
  lines.push("");
  lines.push("## 可能的账号/同行线索");
  const accounts = report.summary.possibleAccounts.slice(0, 20);
  if (accounts.length) {
    for (const text of accounts) {
      lines.push(`- ${text}`);
    }
  } else {
    lines.push("- 暂未识别到明显账号名。");
  }
  lines.push("");
  lines.push("## 可能的数据字段");
  const metrics = report.summary.possibleMetrics.slice(0, 30);
  if (metrics.length) {
    for (const text of metrics) {
      lines.push(`- ${text}`);
    }
  } else {
    lines.push("- 暂未识别到明显点赞/粉丝/播放数据。");
  }
  lines.push("");
  lines.push("## 每屏截图");
  for (const page of report.pages) {
    lines.push(`- 第 ${page.pageIndex} 屏：${page.files.screenshotPath}`);
  }
  lines.push("");
  lines.push("## 原始文本");
  for (const text of report.summary.topTexts.slice(0, 80)) {
    lines.push(`- ${text}`);
  }
  lines.push("");
  return `${lines.join("\n")}\n`;
}

async function collectDouyinSearchWithDriver(driver, keyword, options = {}) {
  const maxPages = Math.max(1, Math.min(20, Number(options.maxPages || process.env.JRC_DOUYIN_SEARCH_PAGES || 6)));
  const app = APP_ALIASES.douyin;
  const runId = `${timestampForFile()}-${options.group ? `${sanitizeFileName(options.group)}-` : ""}${sanitizeFileName(keyword)}`;
  const runDir = path.join(DOUYIN_SEARCH_DIR, runId);

  await fs.mkdir(runDir, { recursive: true });
  console.log(`${options.group ? `【${options.group}】` : ""}打开抖音：${app.bundleId}`);
  await launchApp(driver, app);

  console.log("进入搜索入口");
  const searchEntry = await enterDouyinSearch(driver);
  if (!searchEntry.ok) {
    throw new Error("无法进入抖音搜索框，可能被登录/验证弹层挡住。");
  }

  console.log(`输入关键词：${keyword}`);
  await enterSearchKeyword(driver, keyword);
  const submit = await submitSearch(driver);
  if (!submit.ok) {
    console.log("没有找到确定搜索按钮，已保留输入后的页面继续采集。");
  }
  console.log("尝试切换到视频/热门结果");
  const hotFilterAttempts = await applyDouyinHotVideoFilter(driver);

  const pages = [];
  for (let pageIndex = 1; pageIndex <= maxPages; pageIndex += 1) {
    console.log(`采集搜索结果第 ${pageIndex}/${maxPages} 屏`);
    const snapshot = await captureSnapshot(driver, app, `douyin-search:${keyword}:page-${pageIndex}`);
    const localBase = `${String(pageIndex).padStart(2, "0")}-${sanitizeFileName(keyword)}`;
    const localJsonPath = path.join(runDir, `${localBase}.json`);
    const localSourcePath = path.join(runDir, `${localBase}.xml`);
    const localScreenshotPath = path.join(runDir, `${localBase}.png`);
    await fs.copyFile(snapshot.files.jsonPath, localJsonPath);
    await fs.copyFile(snapshot.files.sourcePath, localSourcePath);
    await fs.copyFile(snapshot.files.screenshotPath, localScreenshotPath);
    pages.push({
      pageIndex,
      collectedAt: snapshot.collectedAt,
      textCount: snapshot.summary.textCount,
      topVisibleTexts: snapshot.summary.topVisibleTexts,
      files: {
        jsonPath: localJsonPath,
        sourcePath: localSourcePath,
        screenshotPath: localScreenshotPath
      },
      elements: snapshot.elements
    });

    if (pageIndex < maxPages) {
      await driver.execute("mobile: swipe", { direction: "up" });
      await sleep(Number(process.env.JRC_IOS_SEARCH_PAGE_SETTLE_MS || 1800));
    }
  }

  return {
    collectedAt: nowIso(),
    keyword,
    group: options.group || "",
    purpose: options.purpose || "",
    platform: "抖音",
    app,
    runId,
    runDir,
    maxPages,
    submit,
    hotFilterAttempts,
    pages,
    summary: summarizeSearchTexts(pages),
    safety: {
      mode: "search_collect_only",
      canFollow: false,
      canComment: false,
      canSendMessage: false,
      note: "只采集搜索结果可见信息，不自动关注、评论、私信或下载视频。"
    }
  };
}

async function writeDouyinSearchReport(report, options = {}) {
  const reportJsonPath = path.join(report.runDir, "report.json");
  const reportMdPath = path.join(report.runDir, "report.md");
  await fs.writeFile(reportJsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await fs.writeFile(reportMdPath, renderDouyinSearchMarkdown(report), "utf8");
  if (options.latest !== false) {
    await fs.copyFile(reportJsonPath, LATEST_DOUYIN_SEARCH_JSON_PATH);
    await fs.copyFile(reportMdPath, LATEST_DOUYIN_SEARCH_MD_PATH);
  }
  return { reportJsonPath, reportMdPath };
}

async function douyinKeywordSearch(keywordInput) {
  const keyword = compactText(keywordInput || process.env.JRC_DOUYIN_KEYWORD || "数学老师");
  if (!keyword) {
    throw new Error("请提供关键词，例如：npm run iphone:douyin-search -- 数学老师");
  }
  const maxPages = Math.max(1, Math.min(20, Number(process.env.JRC_DOUYIN_SEARCH_PAGES || 6)));
  const report = await withDriver((driver) => collectDouyinSearchWithDriver(driver, keyword, { maxPages }));
  const { reportJsonPath, reportMdPath } = await writeDouyinSearchReport(report);

  console.log("抖音关键词采集完成");
  console.log(`关键词：${keyword}`);
  console.log(`采集屏数：${report.pages.length}`);
  console.log(`可用文本：${report.summary.uniqueTextCount} 条`);
  console.log(`报告：${reportMdPath}`);
  console.log(`最新报告：${LATEST_DOUYIN_SEARCH_MD_PATH}`);
  console.log(`JSON：${reportJsonPath}`);
}

function cardKey(card) {
  return `${compactText(card.text)}|${compactText(card.accountTexts?.[0] || "")}|${compactText(card.metricTexts?.[0] || "")}`;
}

function normalizeCardsForResearch(reports) {
  const seen = new Set();
  const cards = [];
  for (const report of reports) {
    for (const card of report.summary.possibleHighLikeVideos || []) {
      const key = cardKey(card);
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      const page = report.pages.find((item) => item.pageIndex === card.pageIndex);
      cards.push({
        ...card,
        keyword: report.keyword,
        group: report.group || "",
        purpose: report.purpose || "",
        screenshotPath: page?.files?.screenshotPath || "",
        sourceReportDir: report.runDir
      });
    }
  }
  return cards.sort((a, b) => Number(b.hotScore || 0) - Number(a.hotScore || 0));
}

function isProblemVideoCard(card) {
  const text = compactText(card.text);
  return /题|讲|解|方程|几何|辅助线|压轴|面积|应用题|行程|函数|证明|思路|技巧|模型|竞赛|复习|押题|小升初|中考|六年级|五年级|二元一次|板书|公式/.test(text);
}

function isCopywritingCard(card) {
  const text = compactText(card.text);
  if (isProblemVideoCard(card) && !/家长|孩子|老师|提分|学习|成绩|少打一份工|学霸|方法/.test(text)) {
    return false;
  }
  return /家长|孩子|老师|学生|成绩|提分|学习|方法|收藏|焦虑|学霸|少打一份工|现在不学|能多拿一分|课堂|文案|小学数学|初中数学/.test(text);
}

function uniqueCleanLines(values, limit = 30) {
  const seen = new Set();
  const lines = [];
  for (const value of values || []) {
    const parts = String(value || "")
      .split(/\n|\/|。|；|;/)
      .map((item) => compactText(item))
      .filter(Boolean);
    for (const part of parts) {
      const text = part
        .replace(/\s+/g, " ")
        .replace(/^[,，.。:：;；、]+|[,，.。:：;；、]+$/g, "");
      const key = normalizeMatchText(text);
      if (!key || seen.has(key) || isDouyinUiOrDanmuText(text)) {
        continue;
      }
      seen.add(key);
      lines.push(text);
      if (lines.length >= limit) {
        return lines;
      }
    }
  }
  return lines;
}

function isMathBoardLine(text) {
  const value = compactText(text);
  if (!value || isDouyinUiOrDanmuText(value)) {
    return false;
  }
  return /题|已知|求|证明|解|设|作|连接|辅助线|中点|角平分线|垂直|平行|相似|全等|函数|方程|面积|半径|直径|圆|模型|步骤|答案|所以|因为|可得|∠|△|⊥|∥|=|x|y|①|②|③|④/.test(value);
}

function isCopywritingLine(text) {
  const value = compactText(text);
  if (!value || isDouyinUiOrDanmuText(value)) {
    return false;
  }
  if (isMathBoardLine(value) && !/家长|孩子|老师|成绩|提分|学习|方法|焦虑|课堂|收藏|关注/.test(value)) {
    return false;
  }
  return /家长|孩子|老师|学生|成绩|提分|学习|方法|焦虑|课堂|收藏|关注|评论|别再|一定要|为什么|不是|真正|建议|记住|数学/.test(value);
}

function rewriteCopyForJrc(sourceLines, target) {
  const topic = compactText(target?.text || sourceLines[0] || "数学学习");
  const source = uniqueCleanLines(sourceLines, 12).join("；");
  const gradeHint = /小升初/.test(topic)
    ? "小升初"
    : /初中|中考|压轴/.test(topic)
      ? "初中/中考"
      : /小学/.test(topic)
        ? "小学"
        : "小学到初中";
  const painPoint = /粗心|错题|不会|基础|成绩|提分|焦虑/.test(source + topic)
    ? "孩子不是简单多刷题就能变好，关键是看他错在哪里、方法有没有建立起来。"
    : "家长真正关心的不是一道题本身，而是孩子能不能把同一类题迁移到考试里。";
  return [
    `选题方向：围绕“${topic.replace(/#[^#\s]+/g, "").slice(0, 38)}”做我们自己的宁波数学培优表达。`,
    `开头改写：${gradeHint}家长先看一个判断标准：${painPoint}`,
    "主体改写：不要照搬原文情绪词，改成“现象 -> 原因 -> 我们怎么训练 -> 家长怎么判断”的四段结构。",
    "结尾改写：把关注理由落到可执行动作，例如让家长看孩子是否会复盘、会归纳模型、会讲清楚思路。"
  ];
}

function buildDeepDiveMaterialDigest(item) {
  const target = item.target || {};
  const frameTexts = (item.frames || []).flatMap((frame) => [
    frame.ocr?.cleanText || "",
    frame.ocr?.text || ""
  ]);
  const lines = uniqueCleanLines([target.text || "", ...frameTexts], 80);
  const materialType = target.materialType || (isProblemVideoCard(target) ? "problem" : "copywriting");
  if (materialType === "problem") {
    const boardLines = lines.filter(isMathBoardLine).slice(0, 20);
    const questionLines = boardLines.filter((line) => /题|已知|求|证明|如图|选择|填空|函数|方程|几何|压轴|中考|小升初/.test(line)).slice(0, 6);
    const stepLines = boardLines.filter((line) => /解|设|作|连接|辅助线|因为|所以|可得|∴|①|②|③|④|=/.test(line)).slice(0, 10);
    const answerLines = boardLines.filter((line) => /答案|故|所以|可得|=|选|结论|得出/.test(line)).slice(0, 6);
    return {
      materialType,
      title: "讲题板书素材",
      purpose: "只保留题目、关键步骤、完整板书和答案截图，不采集完整讲课过程。",
      questionLines,
      stepLines,
      answerLines,
      boardLines,
      rewriteLines: []
    };
  }

  const copyLines = lines.filter(isCopywritingLine).slice(0, 20);
  return {
    materialType,
    title: "口播文案素材",
    purpose: "提取公开标题/字幕/文案线索，并改写成我们自己的可拍表达，避免原样照搬。",
    sourceCopyLines: copyLines,
    rewriteLines: rewriteCopyForJrc(copyLines.length ? copyLines : lines, target)
  };
}

function buildDeepDiveTargets(research) {
  const totalLimit = Math.max(1, Math.min(20, Number(process.env.JRC_DOUYIN_DEEP_LIMIT || 6)));
  const problemLimit = Math.max(0, Math.min(totalLimit, Number(process.env.JRC_DOUYIN_DEEP_PROBLEM_LIMIT || Math.ceil(totalLimit * 0.6))));
  const copyLimit = Math.max(0, Math.min(totalLimit, Number(process.env.JRC_DOUYIN_DEEP_COPY_LIMIT || (totalLimit - problemLimit))));
  const seen = new Set();
  const decorate = (card, materialType) => ({ ...card, materialType });
  const takeUnique = (cards, materialType, limit) => {
    const selected = [];
    for (const card of cards || []) {
      if (!card?.text || !card?.keyword) {
        continue;
      }
      const key = cardKey(card);
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      selected.push(decorate(card, materialType));
      if (selected.length >= limit) {
        break;
      }
    }
    return selected;
  };
  const problemTargets = takeUnique(research.problemCards || [], "problem", problemLimit);
  const copyTargets = takeUnique(research.copywritingCards || [], "copywriting", copyLimit);
  return problemTargets.concat(copyTargets).slice(0, totalLimit);
}

function getDeepDiveFramePlan(materialType) {
  if (materialType === "copywriting") {
    return [
      { index: 1, label: "copy-opening", labelName: "口播开头/封面文案", atMs: Number(process.env.JRC_DOUYIN_COPY_OPENING_MS || 1500) },
      { index: 2, label: "copy-subtitle", labelName: "口播字幕/核心观点", atMs: Number(process.env.JRC_DOUYIN_COPY_SUBTITLE_MS || 5500) },
      { index: 3, label: "copy-ending", labelName: "口播结尾/关注理由", atMs: Number(process.env.JRC_DOUYIN_COPY_ENDING_MS || 10500) }
    ].sort((a, b) => a.atMs - b.atMs);
  }
  return [
    { index: 1, label: "problem-cover", labelName: "题目/封面", atMs: Number(process.env.JRC_DOUYIN_DEEP_OPENING_MS || 1800) },
    { index: 2, label: "problem-steps", labelName: "关键步骤/完整板书", atMs: Number(process.env.JRC_DOUYIN_DEEP_STEPS_MS || 9000) },
    { index: 3, label: "problem-answer", labelName: "最终答案/完整板书", atMs: Number(process.env.JRC_DOUYIN_DEEP_ENDING_MS || 16000) }
  ].sort((a, b) => a.atMs - b.atMs);
}

function renderDouyinMathResearchMarkdown(research) {
  const lines = [];
  lines.push("# 抖音数学内容研究报告");
  lines.push("");
  lines.push(`- 生成时间：${research.createdAt}`);
  lines.push(`- 采集关键词：${research.reports.map((item) => item.keyword).join("、")}`);
  lines.push(`- 采集说明：当前报告来自搜索结果页，可稳定提取标题/封面文案/账号/点赞/截图；讲题类下一步只抓题目、步骤、完整板书和答案关键帧，不录完整讲课过程。`);
  lines.push("");

  lines.push("## 一、高赞文案池");
  if (research.copywritingCards.length) {
    for (const card of research.copywritingCards.slice(0, 30)) {
      const account = card.accountTexts?.[0] ? `｜账号：${card.accountTexts[0]}` : "";
      const metric = card.metricTexts?.[0] ? `｜数据：${card.metricTexts[0]}` : "";
      lines.push(`- ${card.text}${account}${metric}｜来源关键词：${card.keyword}`);
    }
  } else {
    lines.push("- 暂未提取到稳定的高赞文案候选。");
  }
  lines.push("");

  lines.push("## 二、高赞讲题视频池");
  if (research.problemCards.length) {
    for (const card of research.problemCards.slice(0, 30)) {
      const account = card.accountTexts?.[0] ? `｜账号：${card.accountTexts[0]}` : "";
      const metric = card.metricTexts?.[0] ? `｜数据：${card.metricTexts[0]}` : "";
      lines.push(`- ${card.text}${account}${metric}｜来源关键词：${card.keyword}`);
      lines.push(`  - 当前已拿到：标题/封面文案、账号、点赞、截图`);
      lines.push(`  - 下一步深挖：打开原视频，只截图题目页、关键步骤页、完整板书/答案页`);
      if (card.screenshotPath) {
        lines.push(`  - 搜索页截图：${card.screenshotPath}`);
      }
    }
  } else {
    lines.push("- 暂未提取到稳定的讲题候选。");
  }
  lines.push("");

  lines.push("## 三、最值得优先深挖的前 10 条");
  const priority = research.problemCards.concat(research.copywritingCards).slice(0, 10);
  if (priority.length) {
    for (const [index, card] of priority.entries()) {
      const account = card.accountTexts?.[0] ? `｜账号：${card.accountTexts[0]}` : "";
      const metric = card.metricTexts?.[0] ? `｜数据：${card.metricTexts[0]}` : "";
      lines.push(`${index + 1}. ${card.text}${account}${metric}`);
    }
  } else {
    lines.push("- 暂无。");
  }
  lines.push("");

  lines.push("## 四、下一步动作");
  lines.push("- 对“高赞讲题视频池”逐条点开，只采集题目、关键步骤、完整板书和答案截图。");
  lines.push("- 对“高赞文案池”提炼开头 3 秒钩子、家长痛点、评论引导、关注理由，并改写成我们自己的表达。");
  lines.push("- 再把可复拍内容导入短视频系统，形成今日拍摄任务。");
  lines.push("");
  return `${lines.join("\n")}\n`;
}

async function douyinMathResearch() {
  const pagesPerKeyword = Math.max(1, Math.min(10, Number(process.env.JRC_DOUYIN_RESEARCH_PAGES || 3)));
  const maxKeywords = Math.max(1, Number(process.env.JRC_DOUYIN_RESEARCH_MAX_KEYWORDS || 9));
  const runId = `math-research-${timestampForFile()}`;
  const runDir = path.join(DOUYIN_MATH_RESEARCH_DIR, runId);
  await fs.mkdir(runDir, { recursive: true });

  const keywordJobs = MATH_RESEARCH_KEYWORD_GROUPS.flatMap((group) => group.keywords.map((keyword) => ({
    keyword,
    group: group.group,
    purpose: group.purpose
  }))).slice(0, maxKeywords);

  const reports = await withDriver(async (driver) => {
    const collected = [];
    for (const [index, job] of keywordJobs.entries()) {
      console.log(`\n数学内容研究 ${index + 1}/${keywordJobs.length}：${job.group}｜${job.keyword}`);
      const report = await collectDouyinSearchWithDriver(driver, job.keyword, {
        maxPages: pagesPerKeyword,
        group: job.group,
        purpose: job.purpose
      });
      await writeDouyinSearchReport(report, { latest: false });
      collected.push(report);
    }
    return collected;
  });

  const allCards = normalizeCardsForResearch(reports);
  const problemCards = allCards.filter(isProblemVideoCard);
  const copywritingCards = allCards.filter(isCopywritingCard);
  const research = {
    createdAt: nowIso(),
    runId,
    runDir,
    pagesPerKeyword,
    keywordJobs,
    reports: reports.map((report) => ({
      keyword: report.keyword,
      group: report.group,
      runDir: report.runDir,
      highLikeCount: report.summary.possibleHighLikeVideos.length,
      uniqueTextCount: report.summary.uniqueTextCount
    })),
    allCards,
    copywritingCards,
    problemCards,
    limitation: "搜索结果页无法稳定拿到完整板书和答案；讲题类只需逐条打开视频做关键帧截图识别，不采集完整讲课过程。"
  };

  const reportJsonPath = path.join(runDir, "math-research.json");
  const reportMdPath = path.join(runDir, "math-research.md");
  await fs.writeFile(reportJsonPath, `${JSON.stringify(research, null, 2)}\n`, "utf8");
  await fs.writeFile(reportMdPath, renderDouyinMathResearchMarkdown(research), "utf8");
  await fs.copyFile(reportJsonPath, LATEST_DOUYIN_MATH_RESEARCH_JSON_PATH);
  await fs.copyFile(reportMdPath, LATEST_DOUYIN_MATH_RESEARCH_MD_PATH);

  console.log("\n抖音数学内容研究完成");
  console.log(`关键词数：${keywordJobs.length}`);
  console.log(`每个关键词采集屏数：${pagesPerKeyword}`);
  console.log(`高赞文案候选：${copywritingCards.length} 条`);
  console.log(`讲题视频候选：${problemCards.length} 条`);
  console.log(`报告：${reportMdPath}`);
  console.log(`最新报告：${LATEST_DOUYIN_MATH_RESEARCH_MD_PATH}`);
}

function compactOcrPreview(text, limit = 500) {
  return compactText(text)
    .replace(/\s*[\r\n]+\s*/g, " / ")
    .slice(0, limit);
}

function normalizedFrameLabelName(frame, materialType) {
  const label = compactText(frame?.label || "");
  const labelName = compactText(frame?.labelName || "");
  if (materialType === "copywriting") {
    if (/opening|开头/.test(label + labelName)) {
      return "口播开头/封面文案";
    }
    if (/ending|结尾/.test(label + labelName)) {
      return "口播结尾/关注理由";
    }
    return "口播字幕/核心观点";
  }
  if (/opening|开头/.test(label + labelName)) {
    return "题目/封面";
  }
  if (/ending|结尾|答案/.test(label + labelName)) {
    return "最终答案/完整板书";
  }
  return "关键步骤/完整板书";
}

function cleanFrameOcrPreview(frame, materialType) {
  const cleanText = frame?.ocr?.cleanText || "";
  const rawText = frame?.ocr?.text || "";
  const lines = uniqueCleanLines([cleanText || rawText], 30);
  const filtered = materialType === "copywriting"
    ? lines.filter(isCopywritingLine)
    : lines.filter(isMathBoardLine);
  return compactOcrPreview((filtered.length ? filtered : lines).slice(0, 12).join("\n"), 500);
}

function renderVideoDeepDiveMarkdown(report) {
  const lines = [];
  lines.push("# 抖音高赞素材深挖报告");
  lines.push("");
  lines.push(`- 生成时间：${report.createdAt}`);
  lines.push(`- 深挖数量：${report.items.length}`);
  lines.push(`- 来源：${report.sourceResearchPath}`);
  lines.push(`- 说明：讲题类只截图题目、关键步骤、完整板书/答案页，不采集完整讲课过程；口播类提取公开文案/字幕线索后改写成我们自己的表达。`);
  lines.push("");

  for (const item of report.items) {
    const target = item.target;
    const digest = item.materialDigest || buildDeepDiveMaterialDigest(item);
    const account = target.accountTexts?.[0] ? `｜账号：${target.accountTexts[0]}` : "";
    const metric = target.metricTexts?.[0] ? `｜数据：${target.metricTexts[0]}` : "";
    lines.push(`## ${item.index}. ${target.text}${account}${metric}`);
    lines.push(`- 素材类型：${digest.title}`);
    lines.push(`- 处理原则：${digest.purpose}`);
    lines.push(`- 来源关键词：${target.keyword || ""}`);
    lines.push(`- 定位状态：${item.openResult.ok ? `已打开，位于搜索第 ${item.openResult.pageIndex} 屏` : "未找到对应视频卡片"}`);
    if (item.openResult.match?.matchedTitle) {
      lines.push(`- 实际匹配标题：${item.openResult.match.matchedTitle}`);
    }
    if (item.error) {
      lines.push(`- 错误：${item.error}`);
    }

    if (digest.materialType === "problem") {
      lines.push("");
      lines.push("### 可复拍题目素材");
      if (digest.questionLines?.length) {
        lines.push("- 题目/选题线索：");
        for (const line of digest.questionLines) {
          lines.push(`  - ${line}`);
        }
      }
      if (digest.stepLines?.length) {
        lines.push("- 关键步骤线索：");
        for (const line of digest.stepLines) {
          lines.push(`  - ${line}`);
        }
      }
      if (digest.answerLines?.length) {
        lines.push("- 答案/结论线索：");
        for (const line of digest.answerLines) {
          lines.push(`  - ${line}`);
        }
      }
      if (!digest.questionLines?.length && !digest.stepLines?.length && !digest.answerLines?.length) {
        lines.push("- 暂未从 OCR 中稳定识别到完整题目和板书，请直接查看下方关键截图。");
      }
    } else {
      lines.push("");
      lines.push("### 口播文案整理");
      if (digest.sourceCopyLines?.length) {
        lines.push("- 原始文案线索（只作参考，不建议原样使用）：");
        for (const line of digest.sourceCopyLines.slice(0, 10)) {
          lines.push(`  - ${line}`);
        }
      } else {
        lines.push("- 原始文案线索：未稳定识别到完整字幕，先以标题和封面文案做改写。");
      }
      if (digest.rewriteLines?.length) {
        lines.push("- 洗干净后的复拍表达：");
        for (const line of digest.rewriteLines) {
          lines.push(`  - ${line}`);
        }
      }
    }

    if (item.frames?.length) {
      lines.push("");
      lines.push("- 关键帧：");
      for (const frame of item.frames) {
        lines.push(`  - ${normalizedFrameLabelName(frame, digest.materialType)}：${frame.files.screenshotPath}`);
        const cleanOcrPreview = frame.ocr?.ok ? cleanFrameOcrPreview(frame, digest.materialType) : "";
        const ocrPreview = frame.ocr?.ok ? compactOcrPreview(frame.ocr.text) : "";
        if (cleanOcrPreview) {
          lines.push(`    - 整理OCR：${cleanOcrPreview}`);
        }
        if (process.env.JRC_DOUYIN_SHOW_RAW_OCR === "1" && ocrPreview) {
          lines.push(`    - 原始OCR：${ocrPreview}`);
        } else if (frame.ocr?.error) {
          lines.push(`    - OCR 未成功：${compactText(frame.ocr.error).slice(0, 160)}`);
        }
        const usefulVisible = (frame.visibleTexts || [])
          .filter((text) => !isNoisyVisibleText(text))
          .slice(0, 8);
        if (usefulVisible.length) {
          lines.push(`    - 页面可见文字：${usefulVisible.join(" / ")}`);
        }
      }
    }
    lines.push("");
  }

  lines.push("## 下一步整理方式");
  lines.push("- 讲题类：只看题目、步骤、答案和完整板书截图，用自己的讲法重新讲。");
  lines.push("- 口播类：只借鉴结构、痛点和表达节奏，正文必须改写成匠人程自己的说法。");
  lines.push("- 把可复拍内容导入短视频系统，形成“可拍题目库”和“高赞文案库”。");
  lines.push("");
  return `${lines.join("\n")}\n`;
}

async function douyinVideoDeepDive() {
  const research = JSON.parse(await fs.readFile(LATEST_DOUYIN_MATH_RESEARCH_JSON_PATH, "utf8"));
  const targets = buildDeepDiveTargets(research);
  if (!targets.length) {
    throw new Error("没有找到可深挖的素材候选。请先运行：npm run iphone:douyin-math-research");
  }

  const runId = `video-deep-dive-${timestampForFile()}`;
  const runDir = path.join(DOUYIN_VIDEO_DEEP_DIVE_DIR, runId);
  await fs.mkdir(runDir, { recursive: true });

  const items = await withDriver(async (driver) => {
    const collected = [];
    for (const [targetIndex, target] of targets.entries()) {
      const index = targetIndex + 1;
      const materialType = target.materialType || (isProblemVideoCard(target) ? "problem" : "copywriting");
      const framePlan = getDeepDiveFramePlan(materialType);
      const itemDir = path.join(runDir, `${String(index).padStart(2, "0")}-${sanitizeFileName(target.text)}`);
      await fs.mkdir(itemDir, { recursive: true });
      console.log(`\n视频深挖 ${index}/${targets.length}`);
      console.log(`目标：${target.text}`);
      console.log(`素材类型：${materialType === "problem" ? "讲题板书" : "口播文案"}`);
      const item = {
        index,
        target: { ...target, materialType },
        materialType,
        framePlan,
        itemDir,
        openResult: { ok: false, pageIndex: 0, scannedPages: [] },
        frames: [],
        materialDigest: null,
        error: ""
      };
      try {
        const openResult = await searchAndOpenTargetVideo(driver, target);
        item.openResult = {
          ok: openResult.ok,
          pageIndex: openResult.pageIndex,
          scannedPages: openResult.scannedPages,
          match: openResult.match
            ? {
                matchedTitle: openResult.match.matchedTitle,
                accountTexts: openResult.match.accountTexts,
                metricTexts: openResult.match.metricTexts
              }
            : null
        };
        if (!openResult.ok) {
          item.error = "搜索结果中没有定位到对应标题。";
          collected.push(item);
          continue;
        }
        const elapsedState = { elapsedMs: 0 };
        for (const frame of framePlan) {
          console.log(`截取：${frame.labelName}`);
          item.frames.push(await saveDeepDiveFrame(driver, itemDir, target, frame, elapsedState));
        }
        item.materialDigest = buildDeepDiveMaterialDigest(item);
      } catch (error) {
        item.error = error?.message || String(error);
      }
      collected.push(item);
    }
    return collected;
  });

  const report = {
    createdAt: nowIso(),
    runId,
    runDir,
    sourceResearchPath: LATEST_DOUYIN_MATH_RESEARCH_JSON_PATH,
    frameStrategy: {
      problem: "题目/封面、关键步骤/完整板书、最终答案/完整板书",
      copywriting: "口播开头/封面文案、核心字幕/观点、结尾/关注理由"
    },
    items,
    safety: {
      mode: "open_video_collect_frames_only",
      canLike: false,
      canFollow: false,
      canComment: false,
      canSendMessage: false,
      note: "只打开公开视频并截图识别，不点赞、不关注、不评论、不私信。"
    }
  };
  const jsonPath = path.join(runDir, "video-deep-dive.json");
  const mdPath = path.join(runDir, "video-deep-dive.md");
  await fs.writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await fs.writeFile(mdPath, renderVideoDeepDiveMarkdown(report), "utf8");
  await fs.copyFile(jsonPath, LATEST_DOUYIN_VIDEO_DEEP_DIVE_JSON_PATH);
  await fs.copyFile(mdPath, LATEST_DOUYIN_VIDEO_DEEP_DIVE_MD_PATH);

  console.log("\n抖音素材深挖完成");
  console.log(`深挖数量：${items.length}`);
  console.log(`成功打开：${items.filter((item) => item.openResult.ok).length} 条`);
  console.log(`讲题板书：${items.filter((item) => item.materialType === "problem").length} 条`);
  console.log(`口播文案：${items.filter((item) => item.materialType === "copywriting").length} 条`);
  console.log(`报告：${mdPath}`);
  console.log(`最新报告：${LATEST_DOUYIN_VIDEO_DEEP_DIVE_MD_PATH}`);
}

async function douyinVideoReportRefresh() {
  const report = JSON.parse(await fs.readFile(LATEST_DOUYIN_VIDEO_DEEP_DIVE_JSON_PATH, "utf8"));
  const items = (report.items || []).map((item, index) => {
    const target = item.target || {};
    const materialType = item.materialType || target.materialType || (isProblemVideoCard(target) ? "problem" : "copywriting");
    const normalized = {
      ...item,
      index: item.index || index + 1,
      target: { ...target, materialType },
      materialType
    };
    return {
      ...normalized,
      materialDigest: buildDeepDiveMaterialDigest(normalized)
    };
  });
  const refreshed = {
    ...report,
    refreshedAt: nowIso(),
    frameStrategy: report.frameStrategy || {
      problem: "题目/封面、关键步骤/完整板书、最终答案/完整板书",
      copywriting: "口播开头/封面文案、核心字幕/观点、结尾/关注理由"
    },
    items
  };
  await fs.writeFile(LATEST_DOUYIN_VIDEO_DEEP_DIVE_JSON_PATH, `${JSON.stringify(refreshed, null, 2)}\n`, "utf8");
  await fs.writeFile(LATEST_DOUYIN_VIDEO_DEEP_DIVE_MD_PATH, renderVideoDeepDiveMarkdown(refreshed), "utf8");
  if (refreshed.runDir) {
    await fs.writeFile(path.join(refreshed.runDir, "video-deep-dive.md"), renderVideoDeepDiveMarkdown(refreshed), "utf8");
  }
  console.log("抖音素材深挖报告已按新规则刷新");
  console.log(`深挖数量：${items.length}`);
  console.log(`讲题板书：${items.filter((item) => item.materialType === "problem").length} 条`);
  console.log(`口播文案：${items.filter((item) => item.materialType === "copywriting").length} 条`);
  console.log(`最新报告：${LATEST_DOUYIN_VIDEO_DEEP_DIVE_MD_PATH}`);
}

function extractFirstUrl(input) {
  const match = String(input || "").match(/https?:\/\/[^\s，。)）]+/i);
  return match ? match[0].replace(/[),，。；;]+$/g, "") : "";
}

function parseHtmlAttributes(tag) {
  const attrs = {};
  for (const match of String(tag || "").matchAll(/\s([A-Za-z_:][\w:.-]*)\s*=\s*(["'])(.*?)\2/g)) {
    attrs[match[1].toLowerCase()] = decodeHtmlEntity(match[3]);
  }
  return attrs;
}

function extractHtmlMeta(html) {
  const meta = {};
  for (const match of String(html || "").matchAll(/<meta\b[^>]*>/gi)) {
    const attrs = parseHtmlAttributes(match[0]);
    const key = compactText(attrs.property || attrs.name || attrs.itemprop || "").toLowerCase();
    const content = compactText(attrs.content || "");
    if (key && content && !meta[key]) {
      meta[key] = content;
    }
  }
  const titleMatch = String(html || "").match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch) {
    meta.title = stripHtml(titleMatch[1]);
  }
  return meta;
}

function decodeJsonTextFragment(value) {
  const raw = String(value || "");
  try {
    return JSON.parse(`"${raw.replace(/"/g, '\\"')}"`);
  } catch {
    return raw
      .replace(/\\u([0-9a-f]{4})/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
      .replace(/\\n/g, " ")
      .replace(/\\"/g, "\"");
  }
}

function extractPublicCopyCandidates(html, meta) {
  const candidates = [
    meta["og:title"],
    meta["og:description"],
    meta.description,
    meta.title,
    meta.keywords
  ];
  const patterns = [
    /"desc"\s*:\s*"([^"]{4,800})"/g,
    /"description"\s*:\s*"([^"]{4,800})"/g,
    /"title"\s*:\s*"([^"]{4,800})"/g,
    /"shareTitle"\s*:\s*"([^"]{4,800})"/g
  ];
  for (const pattern of patterns) {
    for (const match of String(html || "").matchAll(pattern)) {
      candidates.push(decodeJsonTextFragment(match[1]));
    }
  }
  return uniqueCleanLines(candidates.map((item) => stripHtml(item)), 30)
    .filter((line) => line.length >= 4)
    .filter((line) => !/验证码|登录|安全验证|浏览器|redirect|window\./i.test(line));
}

function extractHashtagsFromText(lines) {
  const tags = [];
  const seen = new Set();
  for (const line of lines || []) {
    for (const match of String(line).matchAll(/#[\u4e00-\u9fa5A-Za-z0-9_]+/g)) {
      const tag = match[0];
      if (seen.has(tag)) {
        continue;
      }
      seen.add(tag);
      tags.push(tag);
    }
  }
  return tags;
}

function renderDouyinLinkCopyMarkdown(report) {
  const lines = [];
  lines.push("# 抖音链接文案解析");
  lines.push("");
  lines.push(`- 生成时间：${report.createdAt}`);
  lines.push(`- 原始链接：${report.inputUrl}`);
  lines.push(`- 最终链接：${report.finalUrl || ""}`);
  lines.push(`- 解析状态：${report.ok ? "成功" : "未成功"}`);
  if (report.error) {
    lines.push(`- 失败原因：${report.error}`);
  }
  lines.push("");

  lines.push("## 公开页面文案线索");
  if (report.copyLines.length) {
    for (const line of report.copyLines) {
      lines.push(`- ${line}`);
    }
  } else {
    lines.push("- 没有从公开页面稳定提取到标题/描述。可以改用手机截图 OCR 深挖。");
  }
  lines.push("");

  if (report.hashtags.length) {
    lines.push("## 话题标签");
    for (const tag of report.hashtags) {
      lines.push(`- ${tag}`);
    }
    lines.push("");
  }

  lines.push("## 洗干净后的复拍表达");
  for (const line of report.rewriteLines) {
    lines.push(`- ${line}`);
  }
  lines.push("");

  lines.push("## 使用原则");
  lines.push("- 不原样照搬对方文案，只保留选题角度、情绪触发点和表达结构。");
  lines.push("- 讲题类最终以我们自己的板书、自己的讲法、自己的学生案例重新拍。");
  lines.push("");
  return `${lines.join("\n")}\n`;
}

async function douyinLinkCopy(input) {
  const inputUrl = extractFirstUrl(input);
  if (!inputUrl) {
    throw new Error("请提供抖音分享链接，例如：npm run iphone:douyin-link-copy -- https://v.douyin.com/xxxx/");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(process.env.JRC_DOUYIN_LINK_TIMEOUT_MS || 15000));
  let response;
  let html = "";
  try {
    response = await fetch(inputUrl, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.6",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
      }
    });
    html = await response.text();
  } finally {
    clearTimeout(timeout);
  }

  const meta = extractHtmlMeta(html);
  const copyLines = extractPublicCopyCandidates(html, meta);
  const hashtags = extractHashtagsFromText(copyLines);
  const report = {
    createdAt: nowIso(),
    inputUrl,
    finalUrl: response?.url || "",
    status: response?.status || 0,
    ok: Boolean(response?.ok && copyLines.length),
    error: response?.ok
      ? (copyLines.length ? "" : "公开页面没有暴露稳定文案，可能需要登录、验证或只能通过手机端 OCR。")
      : `HTTP ${response?.status || 0}`,
    meta,
    copyLines,
    hashtags,
    rewriteLines: rewriteCopyForJrc(copyLines, { text: copyLines[0] || "数学短视频文案" })
  };

  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(LATEST_DOUYIN_LINK_COPY_JSON_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await fs.writeFile(LATEST_DOUYIN_LINK_COPY_MD_PATH, renderDouyinLinkCopyMarkdown(report), "utf8");
  console.log("抖音链接文案解析完成");
  console.log(`状态：${report.ok ? "成功" : "未完整成功"}`);
  console.log(`文案线索：${copyLines.length} 条`);
  console.log(`报告：${LATEST_DOUYIN_LINK_COPY_MD_PATH}`);
  console.log(`JSON：${LATEST_DOUYIN_LINK_COPY_JSON_PATH}`);
}

async function listApps() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const result = await run("xcrun", [
    "devicectl",
    "device",
    "info",
    "apps",
    "--device",
    UDID,
    "--include-all-apps",
    "--json-output",
    INSTALLED_APPS_RAW_PATH
  ]);

  if (!result.ok) {
    throw new Error(`读取 iPhone App 列表失败：\n${result.stderr || result.stdout}`);
  }

  const raw = JSON.parse(await fs.readFile(INSTALLED_APPS_RAW_PATH, "utf8"));
  const apps = (raw.result?.apps || [])
    .map((app) => ({
      name: app.name || "",
      bundleId: app.bundleIdentifier || "",
      version: app.version || "",
      bundleVersion: app.bundleVersion || "",
      removable: Boolean(app.removable),
      defaultApp: Boolean(app.defaultApp)
    }))
    .filter((app) => app.name && app.bundleId)
    .sort((a, b) => a.name.localeCompare(b.name, "zh-Hans-CN"));

  const important = apps.filter((app) => /微信|WeChat|抖音|Douyin|视频|小红书|rednote|快手|Kuaishou|飞书|Feishu/i.test(`${app.name} ${app.bundleId}`));
  const payload = {
    collectedAt: nowIso(),
    device: {
      udid: UDID,
      name: DEVICE_NAME,
      platformVersion: PLATFORM_VERSION
    },
    count: apps.length,
    important,
    apps
  };

  await fs.writeFile(INSTALLED_APPS_PATH, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log("iPhone 已安装 App 清单已保存");
  console.log(`总数：${apps.length}`);
  console.log(`简化清单：${INSTALLED_APPS_PATH}`);
  console.log(`原始清单：${INSTALLED_APPS_RAW_PATH}`);
  console.log("常用 App：");
  for (const app of important.slice(0, 20)) {
    console.log(`- ${app.name}: ${app.bundleId}`);
  }
}

function printHelp() {
  console.log(`用法：
  npm run iphone:appium-check
  npm run iphone:apps
  npm run iphone:collect
  npm run iphone:collect:wechat
  npm run iphone:collect -- douyin
  npm run iphone:douyin-search -- 数学老师
  npm run iphone:douyin-math-research
  npm run iphone:douyin-video-deep-dive
  npm run iphone:douyin-video-report-refresh
  npm run iphone:douyin-link-copy -- 抖音分享链接
  npm run iphone:open -- wechat
  npm run iphone:open -- douyin
  npm run iphone:tap -- 搜索
  npm run iphone:type -- 竞品数学老师
  npm run iphone:swipe -- up
  npm run iphone:home
  JRC_IOS_BUNDLE_ID=com.example.app npm run iphone:collect -- custom

说明：
  - collect 不传 App 时，只采集手机当前画面。
  - douyin-search 会打开抖音搜索关键词，默认采集 6 屏，并尽量偏向视频/热门/高赞结果，只采集不互动。
  - douyin-math-research 会批量采集数学高赞文案和讲题视频候选，默认每个关键词 3 屏。
  - douyin-video-deep-dive 会同时深挖讲题板书素材和口播文案素材；讲题类只截图题目、关键步骤、完整板书/答案页。
  - douyin-video-report-refresh 会用已有截图/OCR 重新生成新版素材报告，不重新控制手机。
  - douyin-link-copy 会解析抖音分享链接公开页面里的标题/描述/话题，并生成不照搬原文的复拍表达。
  - wechat 只打开微信并采集当前界面，不会自动发消息、不加好友。
  - 如果连接失败，确认手机解锁、UI Automation 开启、RemoteXPC tunnel 终端保持运行。`);
}

async function main() {
  const action = process.argv[2] || "collect";
  const input = process.env.JRC_IOS_BUNDLE_ID || process.argv[3];
  const restText = process.argv.slice(3).join(" ");

  if (action === "check") {
    await check();
    return;
  }
  if (action === "apps" || action === "list-apps") {
    await listApps();
    return;
  }
  if (action === "collect" || action === "snapshot" || action === "source") {
    await collect(input);
    return;
  }
  if (action === "douyin-search") {
    await douyinKeywordSearch(restText);
    return;
  }
  if (action === "douyin-math-research") {
    await douyinMathResearch();
    return;
  }
  if (action === "douyin-video-deep-dive") {
    await douyinVideoDeepDive();
    return;
  }
  if (action === "douyin-video-report-refresh") {
    await douyinVideoReportRefresh();
    return;
  }
  if (action === "douyin-link-copy") {
    await douyinLinkCopy(restText);
    return;
  }
  if (action === "open") {
    await openApp(input);
    return;
  }
  if (action === "tap") {
    await tapText(restText);
    return;
  }
  if (action === "type") {
    await typeText(restText);
    return;
  }
  if (action === "swipe") {
    await swipe(input);
    return;
  }
  if (action === "home") {
    await pressHome();
    return;
  }
  if (action === "help" || action === "--help" || action === "-h") {
    printHelp();
    return;
  }

  printHelp();
  process.exitCode = 1;
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exitCode = 1;
});
