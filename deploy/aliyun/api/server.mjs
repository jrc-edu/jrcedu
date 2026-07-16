import http from "node:http";
import crypto from "node:crypto";
import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { Pool } from "pg";

const port = Number(process.env.PORT || 3000);
const serverStartedAt = Date.now();
const siteId = process.env.JRC_SITE_ID || "jrcedu-main";
const publicApiToken = process.env.JRC_API_TOKEN || "";
const uploadDir = process.env.JRC_UPLOAD_DIR || "/opt/jrcedu-uploads";
const curriculumBackupDir = process.env.JRC_CURRICULUM_BACKUP_DIR || "/opt/jrcedu-backups/curriculum";
const databaseBackupDir = process.env.JRC_DATABASE_BACKUP_DIR || "/opt/jrcedu-backups/database";
const systemHealthStateFile = process.env.JRC_HEALTH_STATE_FILE || "/opt/jrcedu-runtime/health.json";
const uploadMaxBytes = Number(process.env.JRC_UPLOAD_MAX_BYTES || 30 * 1024 * 1024);
const jsonMaxBytes = Number(process.env.JRC_JSON_MAX_BYTES || 72 * 1024 * 1024);
const paikeStoreKey = "paike-june-system-v1";
const deepseekApiKey = process.env.JRC_DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY || "";
const deepseekApiUrl = process.env.JRC_DEEPSEEK_API_URL || "https://api.deepseek.com/chat/completions";
const deepseekModel = process.env.JRC_DEEPSEEK_MODEL || "deepseek-chat";
const deepseekTimeoutMs = Number(process.env.JRC_DEEPSEEK_TIMEOUT_MS || 45000);
const deepseekMaxAttempts = Math.max(1, Number(process.env.JRC_DEEPSEEK_MAX_ATTEMPTS || 3));
const departedEmployeeUsernames = ["zhangyan", "hejianjun"];
const videoOpsManagerPermissions = ["videoOps.access", "videoOps.edit"];
const moduleOwnerPermissionRules = {
  yanyuhan: ["admissions.access", "admissions.edit", "admissions.import", "admissions.export", "admissions.finance", "studentService.access", "studentService.edit"],
  liudajun: ["finance.access", "finance.edit"],
  zhaoxuan: [
    "curriculum.access",
    "curriculum.edit",
    "curriculum.create",
    "curriculum.update",
    "curriculum.delete",
    "curriculum.import",
    "curriculum.export",
    "curriculum.reset"
  ],
  zhoushan: ["paike.access", "paike.edit", "studentService.access", "studentService.edit"],
  gaofangyan: ["studentService.access", "studentService.edit", ...videoOpsManagerPermissions],
  yeyuanze: ["suggestions.access", "suggestions.edit"],
  chengzhihao: ["knowledge.access", "knowledge.edit", ...videoOpsManagerPermissions, "admin.access"],
  chenyuqing: ["hr.access", "hr.edit", ...videoOpsManagerPermissions, "admin.access"],
  lishu: ["ai.access"],
  zhengjiayi: ["teachingQuality.access", "teachingQuality.edit"]
};
const moduleOwnerPermissionNameRules = {
  "高芳燕": videoOpsManagerPermissions,
  "高方燕": videoOpsManagerPermissions
};
const runtimePermissionCatalog = [
  ["videoOps.access", "videoOps", "access", "短视频运营进入"],
  ["videoOps.edit", "videoOps", "edit", "短视频运营管理"]
];
const superAdminUsernames = ["chengzhihao", "czh", "chenyuqing", "haiyingying"];
const roleDefaultPermissions = {
  管理员: [
    "portal.access",
    "ai.access",
    "paike.access",
    "suggestions.access",
    "teachingQuality.access",
    "teachingQuality.edit",
    "studentService.access",
    "studentService.edit",
    "curriculum.access",
    "curriculum.edit",
    "hr.access",
    "hr.edit",
    "campus.access",
    "campus.edit",
    "videoOps.access",
    "videoOps.edit",
    "admin.access"
  ],
  学管: [
    "portal.access",
    "ai.access",
    "paike.access",
    "knowledge.access",
    "suggestions.access",
    "admissions.access",
    "admissions.edit",
    "admissions.import",
    "admissions.export",
    "teachingQuality.access",
    "teachingQuality.edit",
    "studentService.access",
    "studentService.edit",
    "curriculum.access",
    "campus.access",
    "campus.edit",
    "videoOps.access",
    "videoOps.edit"
  ],
  财务: [
    "portal.access",
    "ai.access",
    "suggestions.access",
    "finance.access",
    "finance.edit",
    "videoOps.access",
    "videoOps.edit"
  ],
  授课老师: [
    "portal.access",
    "ai.access",
    "paike.access",
    "suggestions.access",
    "teachingQuality.access",
    "studentService.access",
    "curriculum.access",
    "curriculum.create",
    "curriculum.update",
    "curriculum.import",
    "curriculum.export",
    "campus.access"
  ],
  试用期老师: [
    "portal.access",
    "ai.access",
    "paike.access",
    "knowledge.access",
    "suggestions.access",
    "teachingQuality.access",
    "studentService.access",
    "curriculum.access",
    "campus.access"
  ],
  试用期学管: [
    "portal.access",
    "ai.access",
    "paike.access",
    "knowledge.access",
    "suggestions.access",
    "admissions.access",
    "teachingQuality.access",
    "studentService.access",
    "curriculum.access",
    "campus.access"
  ]
};
const modulePermissionAliases = {
  ai: "ai",
  aiassistant: "ai",
  admissions: "admissions",
  businesslinksnapshot: "portal",
  campus: "campus",
  curriculum: "curriculum",
  employeedirectory: "hr",
  finance: "finance",
  financepreimport: "finance",
  hr: "hr",
  knowledge: "knowledge",
  paike: "paike",
  paikelegacy: "paike",
  portal: "portal",
  studentservice: "studentService",
  suggestions: "suggestions",
  sitefeedback: "suggestions",
  systemlinks: "portal",
  teachingquality: "teachingQuality",
  usageguides: "portal",
  videoops: "videoOps",
  workflowautopilot: "portal"
};

function resolveModulePermission(storeKey = "", moduleKey = "") {
  const normalizedModule = String(moduleKey || "").replace(/[^a-z]/gi, "").toLowerCase();
  if (modulePermissionAliases[normalizedModule]) return modulePermissionAliases[normalizedModule];
  const key = String(storeKey || "").toLowerCase();
  if (/^(advice-system|jrc-admissions)/.test(key)) return "admissions";
  if (/suggestion|site-feedback|trial-feedback/.test(key)) return "suggestions";
  if (/ai-assistant/.test(key)) return "ai";
  if (/paike|schedule/.test(key)) return "paike";
  if (/finance/.test(key)) return "finance";
  if (/teaching-quality/.test(key)) return "teachingQuality";
  if (/student-service|student-homework|class-attendance/.test(key)) return "studentService";
  if (/curriculum/.test(key)) return "curriculum";
  if (/employee|hr-/.test(key)) return "hr";
  if (/campus/.test(key)) return "campus";
  if (/video/.test(key)) return "videoOps";
  if (/knowledge/.test(key)) return "knowledge";
  if (/business-link|system-link|usage-guide|workflow-autopilot/.test(key)) return "portal";
  if (/audit/.test(key)) return "admin";
  return "";
}

async function canUseModule(authorization, storeKey, moduleKey, operation = "read") {
  if (authorization?.kind === "api-token") return true;
  const username = normalizeUsername(authorization?.payload?.sub);
  if (!username) return false;
  const employee = await employeeWithPermissions(username);
  if (!employee) return false;
  const permissions = new Set(employee.permissions || []);
  if (permissions.has("admin.access")) return true;
  const module = resolveModulePermission(storeKey, moduleKey);
  if (!module) return false;
  if (operation === "read") return permissions.has(`${module}.access`);
  if (["ai", "portal", "studentService", "suggestions"].includes(module)) return permissions.has(`${module}.access`);
  return ["edit", "create", "update", "import", "reset"]
    .some((action) => permissions.has(`${module}.${action}`));
}

async function requireModuleAccess(res, headers, authorization, storeKey, moduleKey, operation = "read") {
  if (await canUseModule(authorization, storeKey, moduleKey, operation)) return true;
  send(res, 403, {
    ok: false,
    error: "forbidden",
    message: "当前账号没有该模块的数据访问权限。"
  }, headers);
  return false;
}

async function requireAdminAccess(res, headers, authorization) {
  if (authorization?.kind === "api-token") return true;
  const username = normalizeUsername(authorization?.payload?.sub);
  const employee = username ? await employeeWithPermissions(username) : null;
  if (employee?.permissions?.includes("admin.access")) return true;
  send(res, 403, { ok: false, error: "forbidden", message: "当前账号没有管理员诊断权限。" }, headers);
  return false;
}
const allowedOrigins = (process.env.JRC_ALLOWED_ORIGINS || "https://jrc-edu.github.io,http://localhost:3000,http://127.0.0.1:3000")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowedCurriculumExtensions = new Set([
  ".pdf",
  ".doc",
  ".docx",
  ".ppt",
  ".pptx",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
  ".heic"
]);
const contentTypeByExtension = new Map([
  [".pdf", "application/pdf"],
  [".doc", "application/msword"],
  [".docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  [".ppt", "application/vnd.ms-powerpoint"],
  [".pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".webp", "image/webp"],
  [".gif", "image/gif"],
  [".heic", "image/heic"]
]);

const pool = new Pool({
  host: process.env.JRC_DB_HOST,
  port: Number(process.env.JRC_DB_PORT || 5432),
  database: process.env.JRC_DB_NAME || "jrcedu",
  user: process.env.JRC_DB_USER,
  password: process.env.JRC_DB_PASSWORD,
  ssl: process.env.JRC_DB_SSL === "true" ? { rejectUnauthorized: false } : false,
  max: Number(process.env.JRC_DB_POOL_MAX || 5)
});

function send(res, statusCode, payload, extraHeaders = {}) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    ...extraHeaders
  });
  res.end(JSON.stringify(payload));
}

function corsHeaders(req) {
  const origin = req.headers.origin || "";
  const allowOrigin = allowedOrigins.includes(origin) || origin.endsWith(".github.io") ? origin : allowedOrigins[0] || "*";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Credentials": "true"
  };
}

function base64UrlEncode(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function base64UrlJson(value) {
  return JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
}

function signToken(payload) {
  if (!publicApiToken) return "";
  const encoded = base64UrlEncode(payload);
  const signature = crypto.createHmac("sha256", publicApiToken).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

function verifySessionToken(token) {
  if (!publicApiToken || !token || !token.includes(".")) return null;
  const [encoded, signature] = token.split(".");
  const expected = crypto.createHmac("sha256", publicApiToken).update(encoded).digest("base64url");
  if (Buffer.byteLength(signature) !== Buffer.byteLength(expected)) return null;
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  const payload = base64UrlJson(encoded);
  if (!payload?.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}

function getAuthorization(req) {
  if (!publicApiToken) return true;
  const header = req.headers.authorization || "";
  if (header === `Bearer ${publicApiToken}`) return { kind: "api-token" };
  if (header.startsWith("Bearer ")) {
    const payload = verifySessionToken(header.slice("Bearer ".length));
    if (payload) return { kind: "session", payload };
  }
  return null;
}

async function readJson(req, maxBytes = jsonMaxBytes) {
  const chunks = [];
  let totalBytes = 0;
  for await (const chunk of req) {
    totalBytes += chunk.length;
    if (totalBytes > maxBytes) {
      const error = new Error("request body too large");
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString("utf8");
  if (!text) return {};
  return JSON.parse(text);
}

function encodeStorageKey(storageKey) {
  return String(storageKey || "")
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
}

function sanitizeOriginalFileName(fileName) {
  return String(fileName || "课程资料")
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160) || "课程资料";
}

function sanitizeStorageSegment(value, fallback = "未分类") {
  return String(value || fallback)
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\.\./g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80) || fallback;
}

function curriculumStorageFolder(metadata = {}) {
  const grade = sanitizeStorageSegment(metadata.grade, "未分年级");
  const track = sanitizeStorageSegment(metadata.track, "未分体系");
  const month = new Date().toISOString().slice(0, 7);
  return `curriculum/${grade}/${track}/${month}`;
}

function curriculumVersionFileName(originalFileName, extension) {
  const basename = path.basename(originalFileName, extension);
  const readableName = sanitizeStorageSegment(basename, "课程资料").slice(0, 96);
  const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 14);
  const randomId = crypto.randomBytes(5).toString("hex");
  return `${timestamp}-${randomId}-${readableName}${extension}`;
}

function resolveUploadPath(storageKey) {
  const normalizedKey = path.posix.normalize(String(storageKey || "").replace(/^\/+/g, ""));
  if (!normalizedKey || normalizedKey.startsWith("../") || normalizedKey.includes("/../")) return null;
  if (!normalizedKey.startsWith("curriculum/")) return null;
  const absolutePath = path.resolve(uploadDir, normalizedKey);
  const rootPath = path.resolve(uploadDir);
  if (!absolutePath.startsWith(`${rootPath}${path.sep}`)) return null;
  return absolutePath;
}

function resolveCurriculumLiveBackupPath(storageKey) {
  const normalizedKey = path.posix.normalize(String(storageKey || "").replace(/^\/+/g, ""));
  if (!normalizedKey || normalizedKey.startsWith("../") || normalizedKey.includes("/../")) return null;
  if (!normalizedKey.startsWith("curriculum/")) return null;
  const liveRoot = path.resolve(curriculumBackupDir, "live");
  const absolutePath = path.resolve(liveRoot, normalizedKey);
  if (!absolutePath.startsWith(`${liveRoot}${path.sep}`)) return null;
  return absolutePath;
}

function decodeDataUrl(dataUrl) {
  const match = String(dataUrl || "").match(/^data:([^;,]+)?(;base64)?,(.*)$/s);
  if (!match) {
    const error = new Error("invalid data url");
    error.statusCode = 400;
    throw error;
  }
  const contentType = match[1] || "application/octet-stream";
  const isBase64 = Boolean(match[2]);
  const data = match[3] || "";
  return {
    contentType,
    buffer: isBase64 ? Buffer.from(data, "base64") : Buffer.from(decodeURIComponent(data), "utf8")
  };
}

function ownerScopedPermissions(username, permissions = [], name = "") {
  const nextPermissions = new Set(permissions);
  (moduleOwnerPermissionRules[String(username || "").trim().toLowerCase()] || []).forEach((permission) => {
    nextPermissions.add(permission);
  });
  (moduleOwnerPermissionNameRules[String(name || "").trim()] || []).forEach((permission) => {
    nextPermissions.add(permission);
  });
  return Array.from(nextPermissions).sort();
}

function toEmployee(row, permissions = []) {
  const resolvedPermissions = ownerScopedPermissions(row.username, permissions, row.name);
  return {
    id: row.id,
    name: row.name,
    username: row.username,
    role: row.role,
    phone: row.phone || "",
    wechat: row.wechat || "",
    subject: row.subject || "",
    scope: row.scope || "",
    hireDate: row.hire_date ? row.hire_date.toISOString().slice(0, 10) : "",
    regularDate: row.regular_date ? row.regular_date.toISOString().slice(0, 10) : "",
    commissionRate: row.commission_rate === null ? "" : `${Number(row.commission_rate)}%`,
    status: row.status,
    permissions: resolvedPermissions
  };
}

function makeId(prefix) {
  return `${prefix}-${crypto.randomBytes(4).toString("hex")}-${Date.now().toString(36)}`;
}

function normalizeUsername(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizePermissionKeys(value) {
  return Array.from(new Set((Array.isArray(value) ? value : [])
    .map((key) => String(key || "").trim())
    .filter(Boolean)));
}

function defaultPermissionsForRole(role) {
  return normalizePermissionKeys(roleDefaultPermissions[String(role || "").trim()] || []);
}

function numberFromPercent(value) {
  const text = String(value ?? "").replace("%", "").trim();
  if (!text) return null;
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

function canManageEmployees(authorization) {
  if (authorization?.kind === "api-token") return true;
  const username = normalizeUsername(authorization?.payload?.sub);
  return superAdminUsernames.includes(username);
}

function parseCsvRecords(text) {
  const rows = [];
  let current = "";
  let row = [];
  let insideQuotes = false;
  const input = String(text || "").replace(/^\uFEFF/, "");

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const next = input[index + 1];
    if (char === "\"") {
      if (insideQuotes && next === "\"") {
        current += "\"";
        index += 1;
      } else {
        insideQuotes = !insideQuotes;
      }
      continue;
    }
    if (char === "," && !insideQuotes) {
      row.push(current);
      current = "";
      continue;
    }
    if ((char === "\n" || char === "\r") && !insideQuotes) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(current);
      current = "";
      if (row.some((cell) => cell.trim() !== "")) rows.push(row);
      row = [];
      continue;
    }
    current += char;
  }

  row.push(current);
  if (row.some((cell) => cell.trim() !== "")) rows.push(row);
  if (!rows.length) return [];
  const headers = rows[0].map((header) => header.trim());
  return rows.slice(1).map((values) => {
    const record = {};
    headers.forEach((header, index) => {
      record[header] = String(values[index] || "").trim();
    });
    return record;
  });
}

function normalizeTimeText(value) {
  const normalized = String(value || "")
    .trim()
    .replaceAll("：", ":")
    .replaceAll("；", ":")
    .replaceAll(";", ":");
  const match = normalized.match(/^(\d{1,2}):(\d{1,2})$/);
  if (!match) return normalized;
  return `${match[1].padStart(2, "0")}:${match[2].padStart(2, "0")}`;
}

function normalizeScheduleStatus(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (["adjusted", "changed", "调课"].includes(normalized)) return "adjusted";
  if (["makeup", "补课"].includes(normalized)) return "makeup";
  if (["leave", "paused", "休息", "停课"].includes(normalized)) return "leave";
  return "scheduled";
}

function normalizeConfirmationStatus(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return ["confirmed", "done", "已确认"].includes(normalized) ? "confirmed" : "pending";
}

function normalizeRegularEntry(item) {
  if (!item || typeof item !== "object") return null;
  const teacherName = String(item.teacherName || item.teacher_name || "").trim();
  const className = String(item.className || item.class_name || "").trim();
  const courseDate = String(item.courseDate || item.course_date || "").trim();
  const startTime = normalizeTimeText(item.startTime || item.start_time || "");
  const endTime = normalizeTimeText(item.endTime || item.end_time || "");
  const classroomName = String(item.classroomName || item.classroom_name || "").trim();
  const notes = String(item.notes || "").trim();
  if (!(teacherName || className || courseDate || startTime || endTime || classroomName || notes)) return null;
  return {
    id: item.id || makeId("june-entry"),
    teacherName,
    className,
    courseDate,
    slotIndex: Number(item.slotIndex || item.slot_index || 0),
    startTime,
    endTime,
    classroomName,
    scheduleStatus: normalizeScheduleStatus(item.scheduleStatus || item.schedule_status || ""),
    confirmationStatus: normalizeConfirmationStatus(item.confirmationStatus || item.confirmation_status || ""),
    notes
  };
}

function compareRegularEntries(left, right) {
  return (
    String(left.courseDate || "").localeCompare(String(right.courseDate || "")) ||
    String(left.startTime || "").localeCompare(String(right.startTime || "")) ||
    Number(left.slotIndex || 0) - Number(right.slotIndex || 0) ||
    String(left.teacherName || "").localeCompare(String(right.teacherName || ""), "zh-CN") ||
    String(left.className || "").localeCompare(String(right.className || ""), "zh-CN")
  );
}

function normalizeRegularState(snapshot = {}) {
  const scheduleEntries = Array.isArray(snapshot.scheduleEntries)
    ? snapshot.scheduleEntries.map(normalizeRegularEntry).filter(Boolean)
    : Array.isArray(snapshot.schedule_entries)
      ? snapshot.schedule_entries.map(normalizeRegularEntry).filter(Boolean)
      : [];
  const teachers = new Map();
  (Array.isArray(snapshot.teachers) ? snapshot.teachers : []).forEach((teacher) => {
    const name = String(teacher?.name || teacher?.teacher_name || teacher?.teacherName || "").trim();
    if (name && !teachers.has(name)) teachers.set(name, { id: teacher.id || makeId("june-teacher"), name, subject: String(teacher.subject || "").trim() });
  });
  const rooms = new Map();
  (Array.isArray(snapshot.rooms) ? snapshot.rooms : []).forEach((room) => {
    const name = String(room?.name || room?.room_name || room?.roomName || "").trim();
    if (name && !rooms.has(name)) rooms.set(name, { id: room.id || makeId("june-room"), name, floor: String(room.floor || room.floor_name || room.floorName || "").trim() });
  });
  scheduleEntries.forEach((entry) => {
    if (entry.teacherName && !teachers.has(entry.teacherName)) {
      teachers.set(entry.teacherName, { id: makeId("june-teacher"), name: entry.teacherName, subject: "" });
    }
    if (entry.classroomName && !rooms.has(entry.classroomName)) {
      rooms.set(entry.classroomName, { id: makeId("june-room"), name: entry.classroomName, floor: "" });
    }
  });
  return {
    teachers: Array.from(teachers.values()).sort((left, right) => left.name.localeCompare(right.name, "zh-CN")),
    rooms: Array.from(rooms.values()).sort((left, right) => left.name.localeCompare(right.name, "zh-CN")),
    scheduleEntries: scheduleEntries.sort(compareRegularEntries)
  };
}

async function readModulePayload(storeKey) {
  const result = await pool.query("select payload from module_data_store where store_key = $1 limit 1", [storeKey]);
  return result.rows[0]?.payload || null;
}

function isPlainObject(value) {
  return Object.prototype.toString.call(value) === "[object Object]";
}

function stableSerialize(value) {
  if (Array.isArray(value)) return value.map(stableSerialize);
  if (!isPlainObject(value)) return value;
  return Object.keys(value).sort().reduce((result, key) => {
    result[key] = stableSerialize(value[key]);
    return result;
  }, {});
}

function compactModuleAuditData(value, storeKey) {
  if (value == null) return null;
  const objectValue = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return {
    compacted: true,
    storeKey,
    payloadType: Array.isArray(value) ? "array" : typeof value,
    topLevelKeys: Object.keys(objectValue).slice(0, 40),
    itemCount: Array.isArray(value) ? value.length : 0,
    scheduleEntryCount: Array.isArray(objectValue.scheduleEntries) ? objectValue.scheduleEntries.length : 0,
    updatedAt: objectValue.updatedAt || "",
    lastImportFileName: objectValue.lastImportFileName || "",
    lastImportCount: objectValue.lastImportCount || 0,
    lastImportRemovedCount: objectValue.lastImportRemovedCount || 0,
    lastImportMode: objectValue.lastImportMode || ""
  };
}

function buildModuleMergeId(prefix, row) {
  const explicitId = [
    row?.rowId,
    row?.id,
    row?.leadId,
    row?.followupId,
    row?.auditId,
    row?.ticketId,
    row?.sessionId,
    row?.recordId,
    row?.entryId,
    row?.versionId,
    row?.fileStorageKey
  ].map((value) => String(value || "").trim()).find(Boolean);
  if (explicitId) return explicitId;

  const stableParts = [
    row?.studentName,
    row?.parentPhone,
    row?.teacher,
    row?.teacherName,
    row?.className,
    row?.courseDate,
    row?.date,
    row?.startTime,
    row?.endTime,
    row?.time,
    row?.student,
    row?.name,
    row?.grade,
    row?.track,
    row?.lesson,
    row?.title,
    row?.fileName,
    row?.uploadedAt,
    row?.createdAt
  ].map((value) => String(value || "").trim()).filter(Boolean);

  const fallbackSeed = stableParts.length
    ? stableParts.join("|")
    : JSON.stringify(stableSerialize(Object.fromEntries(
      Object.entries(row || {}).filter(([key]) => !["updatedAt", "lastUpdatedAt", "lastViewedAt"].includes(key))
    )));
  const hash = crypto.createHash("sha1").update(fallbackSeed || `${prefix}-${Date.now()}`).digest("hex").slice(0, 16);
  return `${prefix}-${hash}`;
}

function paikeTeacherKey(value) {
  return String(value || "").replace(/\s+/g, "").replace(/老师$/g, "").trim();
}

function paikeRowTime(row) {
  const value = String(row?.updatedAt || row?.importedAt || row?.createdAt || row?.date || row?.courseDate || "").trim();
  const parsed = Date.parse(value.replace(/\./g, "/").replace(" ", "T"));
  return Number.isFinite(parsed) ? parsed : 0;
}

function paikeRowKey(row, prefix = "formal") {
  if (!row || typeof row !== "object") return "";
  const explicit = [
    row.id,
    row.rowId,
    row.sourceId,
    row.cell && row.sourceWorkbook && row.sourceSheet ? `${row.sourceWorkbook}|${row.sourceSheet}|${row.cell}` : "",
    row.period && row.teacherName && row.studentName && row.date && row.lessonNo ? `${row.period}|${row.teacherName}|${row.studentName}|${row.date}|${row.lessonNo}` : ""
  ].map((value) => String(value || "").trim()).find(Boolean);
  if (explicit) return explicit;
  return [
    prefix,
    row.period,
    row.date || row.courseDate,
    row.teacherName || row.teacher,
    row.studentName || row.student || row.className,
    row.startTime || row.time || row.hours,
    row.sourceFile || row.sourceWorkbook
  ].map((value) => String(value || "").trim().replace(/\s+/g, "")).filter(Boolean).join("|");
}

function mergePaikeRows(prefix, ...groups) {
  const map = new Map();
  groups.flat().forEach((row) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) return;
    const key = paikeRowKey(row, prefix);
    if (!key) return;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, { ...row });
      return;
    }
    const incomingIsNewer = paikeRowTime(row) >= paikeRowTime(existing);
    map.set(key, incomingIsNewer ? { ...existing, ...row } : { ...row, ...existing });
  });
  return [...map.values()].sort((left, right) => {
    const periodDiff = String(right.period || "").localeCompare(String(left.period || ""));
    if (periodDiff) return periodDiff;
    return String(right.date || right.courseDate || "").localeCompare(String(left.date || left.courseDate || ""));
  });
}

function isPaikeExcelImportedRow(row) {
  if (row?.manualEntry) return false;
  const importText = `${row?.notes || ""} ${row?.source || ""} ${row?.sourceFileName || ""}`;
  return Boolean(row?.importedByExcel || row?.sourceFileName || /导入|Excel|课表/i.test(importText));
}

function paikeComparableText(value) {
  return String(value || "").trim().replace(/\s+/g, "").replace(/老师$/g, "");
}

function paikeComparableDate(row) {
  return String(row?.date || row?.courseDate || "").trim().slice(0, 10);
}

function paikeComparablePeriod(row) {
  return String(row?.period || paikeComparableDate(row).slice(0, 7) || "").trim();
}

function paikeComparableParticipant(row) {
  return paikeComparableText(row?.studentName || row?.student || row?.className);
}

function paikeComparisonKey(row) {
  return [
    paikeComparablePeriod(row),
    paikeComparableDate(row),
    paikeComparableText(row?.teacherName || row?.teacher),
    paikeComparableParticipant(row),
    paikeComparableText(row?.startTime || row?.time),
    paikeComparableText(row?.endTime),
    paikeComparableText(row?.classroomName || row?.roomName),
    paikeComparableText(row?.scheduleStatus || row?.status)
  ].join("|");
}

function paikeComparisonAnchor(row) {
  return [
    paikeComparablePeriod(row),
    paikeComparableDate(row),
    paikeComparableParticipant(row),
    paikeComparableText(row?.lessonNo || row?.slotIndex)
  ].join("|");
}

function paikeComparableSourceKey(row) {
  return [
    paikeComparableDate(row),
    paikeComparableText(row?.teacherName || row?.teacher),
    paikeComparableText(row?.startTime || row?.time),
    paikeComparableText(row?.endTime),
    paikeComparableParticipant(row)
  ].join("|");
}

function paikeSourceKeyFromText(value) {
  const parts = String(value || "").split("|");
  if (parts.length < 5) return "";
  return [
    paikeComparableText(parts[0]),
    paikeComparableText(parts[1]),
    paikeComparableText(parts[2]),
    paikeComparableText(parts[3]),
    paikeComparableText(parts.slice(4).join("|"))
  ].join("|");
}

function paikeSortForComparison(rows) {
  return [...rows].sort((left, right) => (
    String(left?.startTime || left?.time || "").localeCompare(String(right?.startTime || right?.time || "")) ||
    String(left?.endTime || "").localeCompare(String(right?.endTime || "")) ||
    String(left?.classroomName || left?.roomName || "").localeCompare(String(right?.classroomName || right?.roomName || ""))
  ));
}

function buildPaikeImportDiff(previousEntries, incomingEntries, attendancePayload = []) {
  const previous = Array.isArray(previousEntries) ? previousEntries : [];
  const incoming = Array.isArray(incomingEntries) ? incomingEntries : [];
  const incomingByKey = new Map(incoming.map((row) => [paikeComparisonKey(row), row]));
  const previousByKey = new Map(previous.map((row) => [paikeComparisonKey(row), row]));
  const unchanged = previous.filter((row) => incomingByKey.has(paikeComparisonKey(row)));
  const previousOnly = previous.filter((row) => !incomingByKey.has(paikeComparisonKey(row)));
  const incomingOnly = incoming.filter((row) => !previousByKey.has(paikeComparisonKey(row)));
  const previousByAnchor = new Map();
  const incomingByAnchor = new Map();
  previousOnly.forEach((row) => {
    const key = paikeComparisonAnchor(row);
    if (!previousByAnchor.has(key)) previousByAnchor.set(key, []);
    previousByAnchor.get(key).push(row);
  });
  incomingOnly.forEach((row) => {
    const key = paikeComparisonAnchor(row);
    if (!incomingByAnchor.has(key)) incomingByAnchor.set(key, []);
    incomingByAnchor.get(key).push(row);
  });
  const changed = [];
  const cancelled = [];
  const added = [];
  const anchors = new Set([...previousByAnchor.keys(), ...incomingByAnchor.keys()]);
  anchors.forEach((anchor) => {
    const beforeRows = paikeSortForComparison(previousByAnchor.get(anchor) || []);
    const afterRows = paikeSortForComparison(incomingByAnchor.get(anchor) || []);
    const paired = Math.min(beforeRows.length, afterRows.length);
    for (let index = 0; index < paired; index += 1) changed.push({ before: beforeRows[index], after: afterRows[index] });
    cancelled.push(...beforeRows.slice(paired));
    added.push(...afterRows.slice(paired));
  });
  const attendanceKeys = new Set();
  const sessions = Array.isArray(attendancePayload)
    ? attendancePayload
    : Array.isArray(attendancePayload?.records)
      ? attendancePayload.records
      : Array.isArray(attendancePayload?.attendanceRows)
        ? attendancePayload.attendanceRows
        : [];
  sessions.forEach((session) => {
    const sourceKey = paikeSourceKeyFromText(session?.sourceScheduleKey);
    if (sourceKey) attendanceKeys.add(sourceKey);
    attendanceKeys.add(paikeComparableSourceKey({
      date: session?.date || session?.courseDate,
      teacherName: session?.teacher || session?.teacherName,
      startTime: session?.startTime,
      endTime: session?.endTime,
      className: session?.className
    }));
  });
  const impacted = [...cancelled, ...changed.map((item) => item.before)].filter((row) => attendanceKeys.has(paikeComparableSourceKey(row)));
  const sample = (rows) => rows.slice(0, 5).map((row) => ({
    date: paikeComparableDate(row),
    teacher: String(row?.teacherName || row?.teacher || "").trim(),
    className: String(row?.studentName || row?.student || row?.className || "").trim(),
    time: [row?.startTime || row?.time, row?.endTime].filter(Boolean).join("-") || "未写时间",
    room: String(row?.classroomName || row?.roomName || "").trim()
  }));
  return {
    addedCount: added.length,
    cancelledCount: cancelled.length,
    changedCount: changed.length,
    unchangedCount: unchanged.length,
    impactedAttendanceCount: impacted.length,
    samples: {
      added: sample(added),
      cancelled: sample(cancelled),
      changed: changed.slice(0, 5).map((item) => ({ before: sample([item.before])[0], after: sample([item.after])[0] })),
      impactedAttendance: sample(impacted)
    }
  };
}

function paikeCourseIdForRow(row, suffix = "") {
  const seed = `${paikeComparisonAnchor(row)}|${paikeComparisonKey(row)}|${suffix}`;
  return `course-${crypto.createHash("sha1").update(seed).digest("hex").slice(0, 16)}`;
}

function assignPaikeCourseIds(previousEntries, incomingEntries) {
  const previous = Array.isArray(previousEntries) ? previousEntries : [];
  const incoming = (Array.isArray(incomingEntries) ? incomingEntries : []).map((row) => ({ ...row }));
  const previousByExact = new Map();
  previous.forEach((row) => {
    const key = paikeComparisonKey(row);
    previousByExact.set(key, [...(previousByExact.get(key) || []), row]);
  });
  const consumedPrevious = new Set();
  incoming.forEach((row) => {
    const candidates = previousByExact.get(paikeComparisonKey(row)) || [];
    const match = candidates.find((candidate) => !consumedPrevious.has(candidate));
    if (!match) return;
    consumedPrevious.add(match);
    row.courseId = String(row.courseId || match.courseId || paikeCourseIdForRow(match)).trim();
  });
  const previousByAnchor = new Map();
  previous.filter((row) => !consumedPrevious.has(row)).forEach((row) => {
    const key = paikeComparisonAnchor(row);
    previousByAnchor.set(key, [...(previousByAnchor.get(key) || []), row]);
  });
  const usedIds = new Set(previous.map((row) => String(row?.courseId || "").trim()).filter(Boolean));
  incoming.forEach((row, index) => {
    if (row.courseId) {
      usedIds.add(String(row.courseId));
      return;
    }
    const anchor = paikeComparisonAnchor(row);
    const candidates = paikeSortForComparison(previousByAnchor.get(anchor) || []);
    const match = candidates.find((candidate) => !consumedPrevious.has(candidate));
    if (match) {
      consumedPrevious.add(match);
      row.courseId = String(match.courseId || paikeCourseIdForRow(match)).trim();
      usedIds.add(row.courseId);
      return;
    }
    let courseId = paikeCourseIdForRow(row);
    let duplicateIndex = 1;
    while (usedIds.has(courseId)) {
      courseId = paikeCourseIdForRow(row, duplicateIndex);
      duplicateIndex += 1;
    }
    row.courseId = courseId;
    usedIds.add(courseId);
  });
  return incoming;
}

function buildPaikeDirectory(entries) {
  const rows = Array.isArray(entries) ? entries : [];
  const buildGroup = (getKey, getName) => {
    const groups = new Map();
    rows.forEach((row) => {
      const key = getKey(row);
      const name = String(getName(row) || "").trim();
      if (!key || !name) return;
      const current = groups.get(key) || { key, displayName: name, aliases: [] };
      if (!current.aliases.includes(name)) current.aliases.push(name);
      if (name.length < current.displayName.length) current.displayName = name;
      groups.set(key, current);
    });
    return [...groups.values()].map((item) => ({ ...item, aliases: item.aliases.sort((left, right) => left.localeCompare(right, "zh-CN")) }));
  };
  return {
    teachers: buildGroup((row) => paikeTeacherKey(row?.teacherName || row?.teacher), (row) => row?.teacherName || row?.teacher),
    participants: buildGroup(paikeComparableParticipant, (row) => row?.studentName || row?.student || row?.className),
    generatedAt: new Date().toISOString()
  };
}

function buildPaikeDataQualitySummary(entries, directory = {}) {
  const rows = Array.isArray(entries) ? entries : [];
  const missingRoom = rows.filter((row) => !String(row?.classroomName || row?.roomName || "").trim()).length;
  const missingEndTime = rows.filter((row) => !String(row?.endTime || "").trim()).length;
  const missingParticipant = rows.filter((row) => !paikeComparableParticipant(row)).length;
  const duplicateBusinessKeys = new Set();
  const duplicateRows = rows.filter((row) => {
    const key = paikeComparisonKey(row);
    if (duplicateBusinessKeys.has(key)) return true;
    duplicateBusinessKeys.add(key);
    return false;
  }).length;
  const teacherAliasCount = (Array.isArray(directory.teachers) ? directory.teachers : []).filter((item) => item.aliases.length > 1).length;
  const participantAliasCount = (Array.isArray(directory.participants) ? directory.participants : []).filter((item) => item.aliases.length > 1).length;
  return {
    missingRoom,
    missingEndTime,
    missingParticipant,
    duplicateRows,
    teacherAliasCount,
    participantAliasCount,
    autoNormalized: rows.length,
    generatedAt: new Date().toISOString()
  };
}

function paikeMonthClosures(value) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value.monthClosures : {};
  return source && typeof source === "object" && !Array.isArray(source) ? source : {};
}

function normalizePaikeState(value) {
  const objectValue = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return {
    ...objectValue,
    scheduleEntries: Array.isArray(objectValue.scheduleEntries) ? objectValue.scheduleEntries : []
  };
}

function mergeStructuredPayload(previous, incoming, path = "payload") {
  if (previous === undefined) return incoming;

  if (Array.isArray(previous) && Array.isArray(incoming)) {
    const allRows = [...previous, ...incoming];
    const objectRowsOnly = allRows.every((item) => item && typeof item === "object" && !Array.isArray(item));
    if (!objectRowsOnly) return incoming;

    const prefix = String(path.split(".").pop() || "row").replace(/[^\w-]/g, "") || "row";
    const map = new Map();

    previous.forEach((row) => {
      const rowId = buildModuleMergeId(prefix, row);
      map.set(rowId, { ...row, id: row?.id || rowId });
    });

    incoming.forEach((row) => {
      const rowId = buildModuleMergeId(prefix, row);
      const existing = map.get(rowId);
      const mergedRow = existing
        ? mergeStructuredPayload(existing, row, `${path}[]`)
        : row;
      map.set(rowId, {
        ...mergedRow,
        id: mergedRow?.id || row?.id || existing?.id || rowId
      });
    });

    return [...map.values()];
  }

  if (isPlainObject(previous) && isPlainObject(incoming)) {
    const merged = { ...previous };
    Object.entries(incoming).forEach(([key, value]) => {
      merged[key] = mergeStructuredPayload(previous[key], value, `${path}.${key}`);
    });
    return merged;
  }

  return incoming;
}

async function upsertModulePayload(storeKey, moduleKey, payload, operatorName = "-", operatorUsername = "-") {
  const result = await pool.query(`
    insert into module_data_store (
      store_key, module_key, payload, version, updated_by_name, updated_by_username, updated_at
    )
    values ($1, $2, $3::jsonb, 1, $4, $5, now())
    on conflict (store_key) do update set
      module_key = excluded.module_key,
      payload = excluded.payload,
      version = module_data_store.version + 1,
      updated_by_name = excluded.updated_by_name,
      updated_by_username = excluded.updated_by_username,
      updated_at = now()
    returning store_key, module_key, version, updated_at
  `, [storeKey, moduleKey, JSON.stringify(payload), operatorName, operatorUsername]);
  return result.rows[0];
}

async function employeeWithPermissions(username) {
  const employee = await pool.query(`
    select id, name, username, role, phone, wechat, subject, scope, hire_date, regular_date, commission_rate, status
    from employees
    where username = $1 and status = 'active'
    limit 1
  `, [username]);
  if (!employee.rows[0]) return null;
  const permissions = await pool.query(`
    select ep.permission_key
    from employee_permissions ep
    where ep.employee_id = $1
    order by ep.permission_key
  `, [employee.rows[0].id]);
  return toEmployee(employee.rows[0], permissions.rows.map((row) => row.permission_key));
}

async function handleHealth(res, headers) {
  await pool.query("select 1");
  send(res, 200, { ok: true, siteId, db: "connected" }, headers);
}

async function latestDatabaseBackup() {
  try {
    const names = await fs.readdir(databaseBackupDir);
    const candidates = names.filter((name) => name.endsWith(".dump"));
    if (!candidates.length) return null;
    const rows = await Promise.all(candidates.map(async (name) => {
      const stats = await fs.stat(path.join(databaseBackupDir, name));
      return { name, modifiedAt: stats.mtime.toISOString(), bytes: stats.size };
    }));
    return rows.sort((left, right) => String(right.modifiedAt).localeCompare(String(left.modifiedAt)))[0] || null;
  } catch (_) {
    return null;
  }
}

async function latestSystemHealth() {
  try {
    return JSON.parse(await fs.readFile(systemHealthStateFile, "utf8"));
  } catch (_) {
    return null;
  }
}

async function handleSystemDiagnostics(res, headers) {
  const [storeSummary, largestStores, activeEmployees, permissionGaps, lastExport, databaseBackup, healthMonitor] = await Promise.all([
    pool.query(`
      select
        count(*)::int as store_count,
        coalesce(sum(pg_column_size(payload)), 0)::bigint as payload_bytes,
        count(*) filter (where pg_column_size(payload) >= 10485760)::int as large_store_count,
        max(updated_at) as last_store_update_at
      from module_data_store
    `),
    pool.query(`
      select store_key, module_key, pg_column_size(payload)::bigint as payload_bytes, updated_at
      from module_data_store
      order by pg_column_size(payload) desc
      limit 5
    `),
    pool.query("select count(*)::int as count from employees where status = 'active'"),
    pool.query(`
      select count(*)::int as count
      from employees e
      where e.status = 'active'
        and not exists (
          select 1 from employee_permissions ep
          where ep.employee_id = e.id and ep.permission_key = 'portal.access'
        )
    `),
    pool.query("select exported_at from backup_exports order by exported_at desc limit 1"),
    latestDatabaseBackup(),
    latestSystemHealth()
  ]);
  const summary = storeSummary.rows[0] || {};
  send(res, 200, {
    ok: true,
    siteId,
    checkedAt: new Date().toISOString(),
    server: {
      uptimeSeconds: Math.floor((Date.now() - serverStartedAt) / 1000),
      database: "connected"
    },
    ai: {
      configured: Boolean(deepseekApiKey),
      model: deepseekModel,
      timeoutSeconds: Math.round(deepseekTimeoutMs / 1000),
      maxAttempts: deepseekMaxAttempts
    },
    data: {
      storeCount: Number(summary.store_count || 0),
      payloadBytes: Number(summary.payload_bytes || 0),
      largeStoreCount: Number(summary.large_store_count || 0),
      lastStoreUpdatedAt: summary.last_store_update_at?.toISOString?.() || summary.last_store_update_at || null,
      largestStores: largestStores.rows.map((row) => ({
        storeKey: row.store_key,
        moduleKey: row.module_key,
        payloadBytes: Number(row.payload_bytes || 0),
        updatedAt: row.updated_at?.toISOString?.() || row.updated_at || null
      }))
    },
    employees: { activeCount: Number(activeEmployees.rows[0]?.count || 0) },
    permissions: { activeEmployeesWithoutPortalAccess: Number(permissionGaps.rows[0]?.count || 0) },
    backups: {
      database: databaseBackup,
      lastClientExportAt: lastExport.rows[0]?.exported_at?.toISOString?.() || lastExport.rows[0]?.exported_at || null
    },
    healthMonitor
  }, headers);
}

async function applyDepartedEmployeeLocks() {
  if (!departedEmployeeUsernames.length) return;
  let client = null;
  try {
    client = await pool.connect();
    await client.query("begin");
    const result = await client.query(`
      update employees
      set
        status = 'departed',
        metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
          'departedAt', coalesce(metadata->>'departedAt', to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SSOF')),
          'departedReason', '账号离职停用；历史排课、上课、结算记录保留'
        ),
        updated_at = now()
      where username = any($1::text[])
        and status <> 'departed'
      returning id, username
    `, [departedEmployeeUsernames]);
    await client.query(`
      delete from employee_permissions
      where employee_id in (
        select id from employees where username = any($1::text[])
      )
    `, [departedEmployeeUsernames]);
    await client.query("commit");
    if (result.rowCount > 0) {
      console.log(`Locked departed employee accounts: ${result.rows.map((row) => row.username).join(", ")}`);
    }
  } catch (error) {
    if (client) await client.query("rollback").catch(() => {});
    console.error("Failed to lock departed employee accounts", error);
  } finally {
    if (client) client.release();
  }
}

async function applyModuleOwnerPermissionRules() {
  const usernameRows = Object.entries(moduleOwnerPermissionRules).flatMap(([username, permissions]) => {
    return permissions.map((permissionKey) => [username, permissionKey]);
  });
  const nameRows = Object.entries(moduleOwnerPermissionNameRules).flatMap(([name, permissions]) => {
    return permissions.map((permissionKey) => [name, permissionKey]);
  });
  if (!usernameRows.length && !nameRows.length) return;
  let client = null;
  try {
    client = await pool.connect();
    await client.query("begin");
    for (const [permissionKey, moduleKey, actionKey, displayName] of runtimePermissionCatalog) {
      await client.query(`
        insert into permission_catalog (permission_key, module_key, action_key, display_name, description)
        values ($1, $2, $3, $4, '系统权限')
        on conflict (permission_key) do update set
          module_key = excluded.module_key,
          action_key = excluded.action_key,
          display_name = excluded.display_name,
          description = excluded.description
      `, [permissionKey, moduleKey, actionKey, displayName]);
    }
    for (const [username, permissionKey] of usernameRows) {
      await client.query(`
        insert into employee_permissions (employee_id, permission_key, note)
        select employees.id, $2, 'module owner permission'
        from employees
        join permission_catalog on permission_catalog.permission_key = $2
        where employees.username = $1
          and employees.status = 'active'
        on conflict (employee_id, permission_key) do nothing
      `, [username, permissionKey]);
    }
    for (const [name, permissionKey] of nameRows) {
      await client.query(`
        insert into employee_permissions (employee_id, permission_key, note)
        select employees.id, $2, 'module owner permission by name'
        from employees
        join permission_catalog on permission_catalog.permission_key = $2
        where employees.name = $1
          and employees.status = 'active'
        on conflict (employee_id, permission_key) do nothing
      `, [name, permissionKey]);
    }
    await client.query("commit");
  } catch (error) {
    if (client) await client.query("rollback").catch(() => {});
    console.error("Failed to apply module owner permission rules", error);
  } finally {
    if (client) client.release();
  }
}

async function handleEmployees(res, headers) {
  const employees = await pool.query(`
    select id, name, username, role, phone, wechat, subject, scope, hire_date, regular_date, commission_rate, status
    from employees
    where status = 'active'
    order by role, name
  `);
  const permissions = await pool.query(`
    select e.username, ep.permission_key
    from employee_permissions ep
    join employees e on e.id = ep.employee_id
    order by e.username, ep.permission_key
  `);
  const permissionMap = permissions.rows.reduce((map, row) => {
    if (!map.has(row.username)) map.set(row.username, []);
    map.get(row.username).push(row.permission_key);
    return map;
  }, new Map());

  send(res, 200, {
    employees: employees.rows.map((row) => toEmployee(row, permissionMap.get(row.username) || []))
  }, headers);
}

async function handleUpsertEmployee(req, res, headers, authorization) {
  if (!canManageEmployees(authorization)) {
    send(res, 403, { ok: false, error: "forbidden", message: "只有总管理员可以新增或修改员工账号。" }, headers);
    return;
  }
  const body = await readJson(req);
  const username = normalizeUsername(body.username);
  const name = String(body.name || "").trim();
  const role = String(body.role || "授课老师").trim() || "授课老师";
  if (!username || !name) {
    send(res, 400, { ok: false, error: "missing_employee_fields", message: "老师姓名和用户名拼音必须填写。" }, headers);
    return;
  }
  const basePermissions = defaultPermissionsForRole(role);
  const customPermissions = normalizePermissionKeys(body.permissions);
  const permissionSet = new Set([...basePermissions, ...customPermissions]);
  (moduleOwnerPermissionRules[username] || []).forEach((permissionKey) => permissionSet.add(permissionKey));
  (moduleOwnerPermissionNameRules[name] || []).forEach((permissionKey) => permissionSet.add(permissionKey));
  const commissionRate = numberFromPercent(body.commissionRate);
  const resetPassword = body.resetPassword !== false;
  const temporaryPassword = String(body.password || crypto.randomBytes(9).toString("base64url"));
  const client = await pool.connect();
  try {
    await client.query("begin");
    const existing = await client.query(`
      select id, password_hash
      from employees
      where username = $1
      limit 1
    `, [username]);
    const hasExistingPassword = Boolean(existing.rows[0]?.password_hash);
    const result = await client.query(`
      insert into employees (
        name, username, password_hash, role, phone, wechat, subject, scope,
        hire_date, regular_date, commission_rate, status, metadata, updated_at
      )
      values (
        $1, $2, crypt($11, gen_salt('bf')), $3, $4, $5, $6, $7,
        nullif($8, '')::date, nullif($9, '')::date, $10, 'active',
        jsonb_build_object('source', 'portal employee form', 'needsPasswordChange', true),
        now()
      )
      on conflict (username) do update set
        name = excluded.name,
        password_hash = case when $12::boolean or not $13::boolean then crypt($11, gen_salt('bf')) else employees.password_hash end,
        role = excluded.role,
        phone = excluded.phone,
        wechat = excluded.wechat,
        subject = excluded.subject,
        scope = excluded.scope,
        hire_date = excluded.hire_date,
        regular_date = excluded.regular_date,
        commission_rate = excluded.commission_rate,
        status = 'active',
        metadata = (coalesce(employees.metadata, '{}'::jsonb) - 'initialPasswordPolicy') || case
          when $12::boolean or not $13::boolean then excluded.metadata
          else '{}'::jsonb
        end,
        updated_at = now()
      returning id
    `, [
      name,
      username,
      role,
      String(body.phone || "").trim(),
      String(body.wechat || "").trim(),
      String(body.subject || "").trim(),
      String(body.scope || "").trim(),
      String(body.hireDate || "").trim(),
      String(body.regularDate || "").trim(),
      commissionRate,
      temporaryPassword,
      resetPassword,
      hasExistingPassword
    ]);
    const employeeId = result.rows[0].id;
    if (superAdminUsernames.includes(username)) {
      const catalog = await client.query("select permission_key from permission_catalog");
      catalog.rows.forEach((row) => permissionSet.add(row.permission_key));
    }
    const permissions = normalizePermissionKeys(Array.from(permissionSet));
    await client.query("delete from employee_permissions where employee_id = $1", [employeeId]);
    for (const permissionKey of permissions) {
      await client.query(`
        insert into employee_permissions (employee_id, permission_key, note)
        select $1, permission_catalog.permission_key, 'employee form default/custom permission'
        from permission_catalog
        where permission_catalog.permission_key = $2
        on conflict (employee_id, permission_key) do nothing
      `, [employeeId, permissionKey]);
    }
    await client.query(`
      insert into audit_logs (
        module_key, action_key, target_type, target_id, summary,
        operator_name, operator_username, operator_role, created_at
      )
      values ('hr', 'employee.upsert', 'employee', $1, $2, $3, $4, $5, now())
    `, [
      username,
      `新增/更新员工账号：${name}（${role}）`,
      authorization?.payload?.name || "api-token",
      authorization?.payload?.sub || "api-token",
      authorization?.payload?.role || ""
    ]);
    await client.query("commit");
    const employee = await employeeWithPermissions(username);
    send(res, 200, {
      ok: true,
      employee,
      temporaryPassword: resetPassword || !hasExistingPassword ? temporaryPassword : ""
    }, headers);
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function handlePermissions(res, headers) {
  const catalog = await pool.query(`
    select permission_key, module_key, action_key, display_name, description
    from permission_catalog
    order by module_key, action_key, permission_key
  `);
  const roleDefaults = await pool.query(`
    select role, permission_key
    from role_permission_defaults
    order by role, permission_key
  `);
  send(res, 200, {
    permissions: catalog.rows.map((row) => ({
      permissionKey: row.permission_key,
      moduleKey: row.module_key,
      actionKey: row.action_key,
      displayName: row.display_name,
      description: row.description || ""
    })),
    roleDefaults: roleDefaults.rows.map((row) => ({
      role: row.role,
      permissionKey: row.permission_key
    }))
  }, headers);
}

async function handleLogin(req, res, headers) {
  const body = await readJson(req);
  const username = String(body.username || "").trim().toLowerCase();
  const password = String(body.password || "");
  if (!username || !password) {
    send(res, 400, { ok: false, error: "missing username or password" }, headers);
    return;
  }
  const result = await pool.query(`
    select username, metadata
    from employees
    where username = $1
      and status = 'active'
      and password_hash is not null
      and password_hash = crypt($2, password_hash)
    limit 1
  `, [username, password]);
  if (!result.rows[0]) {
    send(res, 401, { ok: false, error: "invalid credentials" }, headers);
    return;
  }
  const employee = await employeeWithPermissions(username);
  const expiresAt = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;
  const token = signToken({
    sub: employee.username,
    name: employee.name,
    role: employee.role,
    exp: expiresAt
  });
  send(res, 200, {
    ok: true,
    siteId,
    employee,
    token,
    expiresAt,
    mustChangePassword: Boolean(result.rows[0].metadata?.needsPasswordChange || result.rows[0].metadata?.initialPasswordPolicy === password)
  }, headers);
}

async function handleChangePassword(req, res, headers, authorization) {
  const username = String(authorization?.payload?.sub || "").trim().toLowerCase();
  if (!username) {
    send(res, 403, { ok: false, error: "session_required", message: "请先用员工账号登录后再修改密码。" }, headers);
    return;
  }

  const body = await readJson(req);
  const currentPassword = String(body.currentPassword || body.oldPassword || "");
  const newPassword = String(body.newPassword || "");
  if (!currentPassword || !newPassword) {
    send(res, 400, { ok: false, error: "missing_password", message: "请填写旧密码和新密码。" }, headers);
    return;
  }
  if (newPassword.length < 8) {
    send(res, 400, { ok: false, error: "weak_password", message: "新密码至少 8 位。" }, headers);
    return;
  }
  if (newPassword === currentPassword) {
    send(res, 400, { ok: false, error: "same_password", message: "新密码不能和旧密码一样。" }, headers);
    return;
  }

  const employee = await pool.query(`
    select id, name, username, role, password_hash
    from employees
    where username = $1
      and status = 'active'
      and password_hash is not null
      and password_hash = crypt($2, password_hash)
    limit 1
  `, [username, currentPassword]);
  const row = employee.rows[0];
  if (!row) {
    send(res, 401, { ok: false, error: "invalid_current_password", message: "旧密码不正确，不能修改。" }, headers);
    return;
  }

  await pool.query(`
    update employees
    set
      password_hash = crypt($2, gen_salt('bf')),
      metadata = (coalesce(metadata, '{}'::jsonb) - 'initialPasswordPolicy') || jsonb_build_object('passwordChangedAt', now(), 'needsPasswordChange', false),
      updated_at = now()
    where id = $1
  `, [row.id, newPassword]);

  await pool.query(`
    insert into audit_logs (
      module_key, action_key, target_type, target_id, summary,
      operator_id, operator_name, operator_username, operator_role, created_at
    )
    values ('portal', 'password.change', 'employee', $1, '员工修改登录密码', $2, $3, $4, $5, now())
  `, [row.username, row.id, row.name, row.username, row.role]);

  const refreshedEmployee = await employeeWithPermissions(username);
  const expiresAt = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;
  const token = signToken({
    sub: refreshedEmployee.username,
    name: refreshedEmployee.name,
    role: refreshedEmployee.role,
    exp: expiresAt
  });
  send(res, 200, { ok: true, siteId, employee: refreshedEmployee, token, expiresAt }, headers);
}

async function handleGetModuleData(url, res, headers, authorization) {
  const storeKey = String(url.searchParams.get("storeKey") || "").trim();
  if (!storeKey) {
    send(res, 400, { ok: false, error: "missing storeKey" }, headers);
    return;
  }
  if (!await requireModuleAccess(res, headers, authorization, storeKey, "", "read")) return;
  const result = await pool.query(`
    select store_key, module_key, payload, version, updated_by_name, updated_by_username, updated_at
    from module_data_store
    where store_key = $1
    limit 1
  `, [storeKey]);
  if (!result.rows[0]) {
    send(res, 200, { ok: true, found: false, storeKey, payload: null }, headers);
    return;
  }
  const row = result.rows[0];
  send(res, 200, {
    ok: true,
    found: true,
    storeKey: row.store_key,
    moduleKey: row.module_key,
    payload: row.payload,
    version: row.version,
    updatedByName: row.updated_by_name || "",
    updatedByUsername: row.updated_by_username || "",
    updatedAt: row.updated_at?.toISOString?.() || row.updated_at
  }, headers);
}

async function handlePutModuleData(req, res, headers, authorization) {
  const body = await readJson(req);
  const storeKey = String(body.storeKey || "").trim();
  const moduleKey = String(body.moduleKey || "unknown").trim() || "unknown";
  if (!storeKey) {
    send(res, 400, { ok: false, error: "missing storeKey" }, headers);
    return;
  }
  if (!await requireModuleAccess(res, headers, authorization, storeKey, moduleKey, "write")) return;
  const payload = body.payload === undefined ? null : body.payload;
  const operatorName = authorization?.payload?.name || body.operatorName || body.operator?.name || "-";
  const operatorUsername = authorization?.payload?.sub || body.operatorUsername || body.operator?.username || "-";
  const replaceMode = body.replaceMode === "replace";
  const existing = await pool.query(`
    select payload, version
    from module_data_store
    where store_key = $1
    limit 1
  `, [storeKey]);
  const previousRow = existing.rows[0] || null;
  const mergedPayload = previousRow && !replaceMode
    ? mergeStructuredPayload(previousRow.payload, payload, storeKey)
    : payload;
  const mergedPayloadJson = JSON.stringify(mergedPayload);
  const result = await pool.query(`
    insert into module_data_store (
      store_key, module_key, payload, version, updated_by_name, updated_by_username, updated_at
    )
    values ($1, $2, $3::jsonb, 1, $4, $5, now())
    on conflict (store_key) do update set
      module_key = excluded.module_key,
      payload = excluded.payload,
      version = module_data_store.version + 1,
      updated_by_name = excluded.updated_by_name,
      updated_by_username = excluded.updated_by_username,
      updated_at = now()
    returning store_key, module_key, version, updated_at
  `, [storeKey, moduleKey, mergedPayloadJson, operatorName, operatorUsername]);
  const nextVersion = result.rows[0].version;
  const compactAudit = storeKey === "paike-june-system-v1" || mergedPayloadJson.length > 500000;
  const beforeAuditData = compactAudit ? compactModuleAuditData(previousRow?.payload ?? null, storeKey) : (previousRow?.payload ?? null);
  const afterAuditData = compactAudit ? compactModuleAuditData(mergedPayload, storeKey) : mergedPayload;
  await pool.query(`
    insert into audit_logs (
      module_key,
      action_key,
      target_type,
      target_id,
      summary,
      before_data,
      after_data,
      operator_name,
      operator_username,
      operator_role
    )
    values ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9, $10)
  `, [
    moduleKey,
    previousRow ? "module-data-update" : "module-data-create",
    "module_store",
    storeKey,
    compactAudit ? `${storeKey} 保存至 v${nextVersion}（大数据仅记录摘要）` : `${storeKey} 保存至 v${nextVersion}`,
    JSON.stringify(beforeAuditData),
    JSON.stringify(afterAuditData),
    operatorName,
    operatorUsername,
    moduleKey
  ]);
  send(res, 200, {
    ok: true,
    storeKey: result.rows[0].store_key,
    moduleKey: result.rows[0].module_key,
    version: result.rows[0].version,
    merged: Boolean(previousRow) && !replaceMode && JSON.stringify(mergedPayload) !== JSON.stringify(payload),
    updatedAt: result.rows[0].updated_at?.toISOString?.() || result.rows[0].updated_at
  }, headers);
}

async function handlePaikeFormalImport(req, res, headers, authorization) {
  if (!await requireModuleAccess(res, headers, authorization, paikeStoreKey, "paike", "write")) return;
  const body = await readJson(req, jsonMaxBytes);
  const entries = Array.isArray(body.entries) ? body.entries.filter((entry) => entry && typeof entry === "object" && !Array.isArray(entry)) : [];
  if (!entries.length) {
    send(res, 400, { ok: false, error: "没有收到可并网的排课课程。" }, headers);
    return;
  }
  const fileName = String(body.fileName || body.fileLabel || "").trim();
  const operatorName = body.operatorName || body.operator?.name || "-";
  const operatorUsername = body.operatorUsername || body.operator?.username || "-";
  const replaceScopes = new Set(entries.map((row) => {
    const period = String(row.period || String(row.date || row.courseDate || "").slice(0, 7) || "").trim();
    const teacher = paikeTeacherKey(row.teacherName || row.teacher);
    return period && teacher ? `${period}|${teacher}` : "";
  }).filter(Boolean));

  const existing = await pool.query(`
    select payload, version
    from module_data_store
    where store_key = $1
    limit 1
  `, [paikeStoreKey]);
  const previousRow = existing.rows[0] || null;
  const previousPayload = normalizePaikeState(previousRow?.payload || {});
  const monthClosures = paikeMonthClosures(previousPayload);
  const lockedPeriods = Array.from(new Set([...replaceScopes]
    .map((scope) => scope.split("|")[0])
    .filter((period) => monthClosures[period]?.status === "locked")));
  if (lockedPeriods.length) {
    send(res, 409, {
      ok: false,
      error: "paike_month_locked",
      message: `月份 ${lockedPeriods.join("、")} 已月结锁定。请先由管理员在排课系统“月结与版本”中恢复为可修改，再上传修正表。`,
      lockedPeriods
    }, headers);
    return;
  }
  const currentEntries = mergePaikeRows("formal", previousPayload.scheduleEntries || []);
  const incomingAnchors = new Set(entries.map(paikeComparisonAnchor));
  const replacedExcelEntries = currentEntries.filter((row) => {
    if (!isPaikeExcelImportedRow(row)) return false;
    const rowTeacher = paikeTeacherKey(row.teacherName || row.teacher);
    const rowPeriod = String(row.period || String(row.date || row.courseDate || "").slice(0, 7) || "").trim();
    return replaceScopes.has(`${rowPeriod}|${rowTeacher}`) || incomingAnchors.has(paikeComparisonAnchor(row));
  });
  let attendancePayload = [];
  try {
    attendancePayload = await readModulePayload("jrc-class-attendance-v1");
  } catch (error) {
    console.warn("排课并网未能读取点名追溯数据，仍继续安全并网", error?.message || error);
  }
  const changeSummary = buildPaikeImportDiff(replacedExcelEntries, entries, attendancePayload);
  const replacedEntrySet = new Set(replacedExcelEntries);
  const preservedEntries = currentEntries.filter((row) => !replacedEntrySet.has(row));
  const importedEntries = assignPaikeCourseIds(replacedExcelEntries, entries).map((entry) => ({
    ...entry,
    canonicalTeacherKey: paikeTeacherKey(entry.teacherName || entry.teacher),
    canonicalParticipantKey: paikeComparableParticipant(entry),
    importedByExcel: entry.importedByExcel !== false,
    importedAt: entry.importedAt || new Date().toISOString()
  }));
  const scheduleDirectory = buildPaikeDirectory([...preservedEntries, ...importedEntries]);
  const dataQualitySummary = buildPaikeDataQualitySummary(importedEntries, scheduleDirectory);
  const mergedEntries = mergePaikeRows("formal", preservedEntries, importedEntries);
  const removedExcelImportCount = Math.max(0, currentEntries.length - preservedEntries.length);
  const nextState = {
    ...previousPayload,
    scheduleEntries: mergedEntries,
    updatedAt: new Date().toISOString(),
    lastImportFileName: fileName,
    lastImportCount: importedEntries.length,
    lastImportRemovedCount: removedExcelImportCount,
    lastImportChangeSummary: { ...changeSummary, generatedAt: new Date().toISOString() },
    lastImportDataQuality: dataQualitySummary,
    scheduleDirectory,
    monthClosures,
    lastImportMode: "server-side-replace-uploaded-teacher-excel-imports"
  };
  const result = await upsertModulePayload(paikeStoreKey, "paike", nextState, operatorName, operatorUsername);
  const teachers = Array.from(new Set(importedEntries.map((row) => row.teacherName || row.teacher).filter(Boolean))).sort((a, b) => a.localeCompare(b, "zh-CN"));
  const periods = Array.from(new Set(importedEntries.map((row) => row.period || String(row.date || row.courseDate || "").slice(0, 7)).filter(Boolean))).sort();
  await pool.query(`
    insert into audit_logs (
      module_key,
      action_key,
      target_type,
      target_id,
      summary,
      before_data,
      after_data,
      operator_name,
      operator_username,
      operator_role
    )
    values ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9, $10)
  `, [
    "paike",
    "paike-formal-import",
    "module_store",
    paikeStoreKey,
    `排课Excel并网：新增 ${changeSummary.addedCount} 条，调整 ${changeSummary.changedCount} 条，取消 ${changeSummary.cancelledCount} 条，覆盖旧Excel ${removedExcelImportCount} 条；已生成 ${importedEntries.length} 条稳定课程编号${changeSummary.impactedAttendanceCount ? `；已点名关联 ${changeSummary.impactedAttendanceCount} 条保留追溯` : ""}`,
    JSON.stringify(compactModuleAuditData(previousPayload, paikeStoreKey)),
    JSON.stringify(compactModuleAuditData(nextState, paikeStoreKey)),
    operatorName,
    operatorUsername,
    "paike"
  ]);
  send(res, 200, {
    ok: true,
    storeKey: paikeStoreKey,
    moduleKey: "paike",
    version: result.version,
    importedCount: importedEntries.length,
    removedExcelImportCount,
    changeSummary,
    dataQualitySummary,
    totalCount: mergedEntries.length,
    teachers,
    periods,
    updatedAt: result.updated_at?.toISOString?.() || result.updated_at
  }, headers);
}

async function handlePaikeMonthClosure(req, res, headers, authorization) {
  if (!await requireModuleAccess(res, headers, authorization, paikeStoreKey, "paike", "write")) return;
  const body = await readJson(req);
  const period = String(body.period || "").trim();
  const action = String(body.action || "lock").trim();
  if (!/^\d{4}-\d{2}$/.test(period) || !["lock", "reopen"].includes(action)) {
    send(res, 400, { ok: false, error: "invalid_month_closure", message: "请提供正确月份和月结操作。" }, headers);
    return;
  }
  const operatorName = body.operatorName || body.operator?.name || "-";
  const operatorUsername = body.operatorUsername || body.operator?.username || "-";
  const existing = await pool.query("select payload from module_data_store where store_key = $1 limit 1", [paikeStoreKey]);
  const previousPayload = normalizePaikeState(existing.rows[0]?.payload || {});
  const currentEntries = mergePaikeRows("formal", previousPayload.scheduleEntries || []);
  const currentClosure = paikeMonthClosures(previousPayload);
  const periodEntries = currentEntries.filter((row) => paikeComparablePeriod(row) === period);
  let attendancePayload = [];
  try {
    attendancePayload = await readModulePayload("jrc-class-attendance-v1");
  } catch (error) {
    console.warn("月结时未能读取点名数据", error?.message || error);
  }
  const attendanceSessions = Array.isArray(attendancePayload) ? attendancePayload : [];
  const attendanceCount = attendanceSessions.filter((session) => String(session?.date || "").slice(0, 7) === period).length;
  const now = new Date().toISOString();
  const monthClosures = {
    ...currentClosure,
    [period]: action === "lock"
      ? {
        ...(currentClosure[period] || {}),
        status: "locked",
        version: Number(currentClosure[period]?.version || 0) + 1,
        lockedAt: now,
        lockedBy: operatorName,
        lockedByUsername: operatorUsername,
        scheduleCount: periodEntries.length,
        attendanceCount
      }
      : {
        ...(currentClosure[period] || {}),
        status: "open",
        reopenedAt: now,
        reopenedBy: operatorName,
        reopenedByUsername: operatorUsername,
        scheduleCount: periodEntries.length,
        attendanceCount
      }
  };
  const nextState = {
    ...previousPayload,
    monthClosures,
    updatedAt: now,
    lastMonthClosure: { period, action, at: now, operatorName, scheduleCount: periodEntries.length, attendanceCount }
  };
  const result = await upsertModulePayload(paikeStoreKey, "paike", nextState, operatorName, operatorUsername);
  await pool.query(`
    insert into audit_logs (
      module_key, action_key, target_type, target_id, summary, before_data, after_data,
      operator_name, operator_username, operator_role
    ) values ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9, $10)
  `, [
    "paike",
    action === "lock" ? "paike-month-lock" : "paike-month-reopen",
    "paike_month",
    period,
    action === "lock"
      ? `排课月结锁定：${period}，课表 ${periodEntries.length} 节，点名 ${attendanceCount} 节。`
      : `排课月结恢复修改：${period}，后续修正会继续留痕。`,
    JSON.stringify(currentClosure[period] || {}),
    JSON.stringify(monthClosures[period]),
    operatorName,
    operatorUsername,
    "paike"
  ]);
  send(res, 200, {
    ok: true,
    period,
    closure: monthClosures[period],
    version: result.version,
    updatedAt: result.updated_at?.toISOString?.() || result.updated_at
  }, headers);
}

async function handlePaikeCourseIdMigration(req, res, headers, authorization) {
  if (!await requireModuleAccess(res, headers, authorization, paikeStoreKey, "paike", "write")) return;
  const body = await readJson(req);
  const operatorName = body.operatorName || body.operator?.name || "-";
  const operatorUsername = body.operatorUsername || body.operator?.username || "-";
  const existing = await pool.query("select payload from module_data_store where store_key = $1 limit 1", [paikeStoreKey]);
  const previousPayload = normalizePaikeState(existing.rows[0]?.payload || {});
  const currentEntries = mergePaikeRows("formal", previousPayload.scheduleEntries || []);
  const missingBefore = currentEntries.filter((row) => !String(row?.courseId || "").trim()).length;
  if (!missingBefore) {
    send(res, 200, { ok: true, updatedCount: 0, totalCount: currentEntries.length, message: "正式课表已具备固定课程编号。" }, headers);
    return;
  }
  const migratedEntries = assignPaikeCourseIds([], currentEntries).map((entry) => ({
    ...entry,
    canonicalTeacherKey: entry.canonicalTeacherKey || paikeTeacherKey(entry.teacherName || entry.teacher),
    canonicalParticipantKey: entry.canonicalParticipantKey || paikeComparableParticipant(entry)
  }));
  const scheduleDirectory = buildPaikeDirectory(migratedEntries);
  const nextState = {
    ...previousPayload,
    scheduleEntries: migratedEntries,
    scheduleDirectory,
    updatedAt: new Date().toISOString(),
    lastCourseIdMigration: { at: new Date().toISOString(), updatedCount: missingBefore, operatorName, operatorUsername }
  };
  const result = await upsertModulePayload(paikeStoreKey, "paike", nextState, operatorName, operatorUsername);
  await pool.query(`
    insert into audit_logs (
      module_key, action_key, target_type, target_id, summary, before_data, after_data,
      operator_name, operator_username, operator_role
    ) values ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9, $10)
  `, [
    "paike",
    "paike-course-id-migration",
    "module_store",
    paikeStoreKey,
    `排课历史数据自动补齐固定课程编号：${missingBefore} 节。`,
    JSON.stringify(compactModuleAuditData(previousPayload, paikeStoreKey)),
    JSON.stringify(compactModuleAuditData(nextState, paikeStoreKey)),
    operatorName,
    operatorUsername,
    "paike"
  ]);
  send(res, 200, {
    ok: true,
    updatedCount: missingBefore,
    totalCount: migratedEntries.length,
    version: result.version,
    updatedAt: result.updated_at?.toISOString?.() || result.updated_at
  }, headers);
}

async function handleImportJuneRegularCsv(req, res, headers, authorization) {
  if (!await requireModuleAccess(res, headers, authorization, paikeStoreKey, "paike", "write")) return;
  const body = await readJson(req);
  const records = parseCsvRecords(body.csv_text || "");
  const entries = records.map(normalizeRegularEntry).filter(Boolean);
  if (!entries.length) {
    send(res, 200, {
      ok: true,
      accepted_count: 0,
      question_count: 0,
      warning_count: 1,
      warnings: ["CSV 没有识别到可导入的排课行。"],
      questions: [],
      snapshot: normalizeRegularState({}),
      saved_at: new Date().toISOString(),
      summer_sync: { demand_count: 0, warning_count: 0, warnings: [], review_items: [] }
    }, headers);
    return;
  }

  const storeKey = "paike-june-system-v1";
  const metaKey = "paike-june-system-meta-v1";
  const existingPayload = await readModulePayload(storeKey);
  const existingSnapshot = existingPayload?.parsedValue || existingPayload || {};
  const snapshot = normalizeRegularState({
    ...existingSnapshot,
    scheduleEntries: entries
  });
  const savedAt = new Date().toISOString();
  const operatorName = authorization?.payload?.name || body.operatorName || "-";
  const operatorUsername = authorization?.payload?.sub || body.operatorUsername || "-";
  const summary = {
    scheduleEntries: snapshot.scheduleEntries.length,
    teachers: snapshot.teachers.length,
    rooms: snapshot.rooms.length
  };
  await upsertModulePayload(storeKey, "paike-legacy", {
    schemaVersion: "paike-legacy-cloud-store-v1",
    storeKey,
    rawValue: JSON.stringify(snapshot),
    parsedValue: snapshot,
    summary: {
      key: storeKey,
      label: "平时课数据",
      mode: "regular",
      summary
    },
    sourceUrl: body.source_url || "",
    savedAt
  }, operatorName, operatorUsername);
  await upsertModulePayload(metaKey, "paike-legacy", {
    schemaVersion: "paike-legacy-cloud-store-v1",
    storeKey: metaKey,
    rawValue: JSON.stringify({
      lastSavedAt: savedAt,
      browserSnapshotOrigin: "cloud_import",
      importLog: `已通过云端 CSV 导入 ${body.file_name || "老师排课 CSV"}，写入 ${entries.length} 行。`,
      importQuestions: []
    }),
    parsedValue: {
      lastSavedAt: savedAt,
      browserSnapshotOrigin: "cloud_import",
      importLog: `已通过云端 CSV 导入 ${body.file_name || "老师排课 CSV"}，写入 ${entries.length} 行。`,
      importQuestions: []
    },
    summary: {
      key: metaKey,
      label: "平时课状态",
      mode: "regular-meta",
      summary: { lastSavedAt: savedAt, importQuestions: 0 }
    },
    sourceUrl: body.source_url || "",
    savedAt
  }, operatorName, operatorUsername);

  send(res, 200, {
    ok: true,
    accepted_count: entries.length,
    question_count: 0,
    warning_count: 0,
    warnings: [],
    questions: [],
    snapshot,
    saved_at: savedAt,
    summer_sync: { demand_count: 0, warning_count: 0, warnings: [], review_items: [] }
  }, headers);
}

async function handleImportJuneRegularXlsx(res, headers) {
  send(res, 501, {
    ok: false,
    error: "xlsx_import_not_ready",
    message: "云端 XLSX 自动拆分解析器还在迁移中。当前请先把老师排课表另存为 CSV 后上传，或在排课明细里直接新增/修改。"
  }, headers);
}

async function handleUploadCurriculumFile(req, res, headers, authorization) {
  if (!await requireModuleAccess(res, headers, authorization, "jrc-curriculum-files", "curriculum", "write")) return;
  const bodyMaxBytes = Math.ceil(uploadMaxBytes * 1.45) + 1024 * 1024;
  const body = await readJson(req, bodyMaxBytes);
  const originalFileName = sanitizeOriginalFileName(body.fileName);
  const extension = path.extname(originalFileName).toLowerCase();
  if (!allowedCurriculumExtensions.has(extension)) {
    send(res, 400, {
      ok: false,
      error: "unsupported_file_type",
      message: "只支持 PDF、Word、PPT 和常见图片文件。"
    }, headers);
    return;
  }

  const decoded = decodeDataUrl(body.dataUrl);
  if (!decoded.buffer.length) {
    send(res, 400, { ok: false, error: "empty_file", message: "文件内容为空。" }, headers);
    return;
  }
  if (decoded.buffer.length > uploadMaxBytes) {
    send(res, 413, {
      ok: false,
      error: "file_too_large",
      message: `单个文件不能超过 ${Math.round(uploadMaxBytes / 1024 / 1024)}MB。`
    }, headers);
    return;
  }

  const metadata = body.metadata && typeof body.metadata === "object" ? body.metadata : {};
  const storedFileName = curriculumVersionFileName(originalFileName, extension);
  const storageKey = `${curriculumStorageFolder(metadata)}/${storedFileName}`;
  const absolutePath = resolveUploadPath(storageKey);
  const backupAbsolutePath = resolveCurriculumLiveBackupPath(storageKey);
  if (!absolutePath) {
    send(res, 500, { ok: false, error: "invalid_storage_key" }, headers);
    return;
  }
  if (!backupAbsolutePath) {
    send(res, 500, { ok: false, error: "invalid_backup_path" }, headers);
    return;
  }

  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, decoded.buffer, { flag: "wx" });

  const contentType = body.contentType || decoded.contentType || contentTypeByExtension.get(extension) || "application/octet-stream";
  const fileUrl = `/api/curriculum-files/${encodeStorageKey(storageKey)}`;
  const uploadedAt = new Date().toISOString();
  const uploadedByName = authorization?.payload?.name || body.operatorName || "-";
  const uploadedByUsername = authorization?.payload?.sub || body.operatorUsername || "-";
  const contentSha256 = crypto.createHash("sha256").update(decoded.buffer).digest("hex");
  const versionId = crypto.createHash("sha256").update(`${storageKey}:${contentSha256}`).digest("hex").slice(0, 16);
  const metadataPayload = {
    versionId,
    storageKey,
    originalFileName,
    fileType: contentType,
    fileSize: decoded.buffer.length,
    contentSha256,
    uploadedAt,
    uploadedByName,
    uploadedByUsername,
    metadata
  };
  await fs.writeFile(`${absolutePath}.metadata.json`, JSON.stringify(metadataPayload, null, 2), { flag: "wx" });

  const backupStorageKey = `live/${storageKey}`;
  const backupCreatedAt = new Date().toISOString();
  try {
    await fs.mkdir(path.dirname(backupAbsolutePath), { recursive: true });
    await fs.writeFile(backupAbsolutePath, decoded.buffer, { flag: "wx" });
    await fs.writeFile(`${backupAbsolutePath}.metadata.json`, JSON.stringify({
      ...metadataPayload,
      backupOf: storageKey,
      backupStorageKey,
      backupCreatedAt
    }, null, 2), { flag: "wx" });
  } catch (error) {
    await Promise.allSettled([
      fs.rm(absolutePath, { force: true }),
      fs.rm(`${absolutePath}.metadata.json`, { force: true }),
      fs.rm(backupAbsolutePath, { force: true }),
      fs.rm(`${backupAbsolutePath}.metadata.json`, { force: true })
    ]);
    const wrapped = new Error(`curriculum_backup_failed: ${error?.message || error}`);
    wrapped.statusCode = 500;
    throw wrapped;
  }
  send(res, 200, {
    ok: true,
    file: {
      versionId,
      fileName: originalFileName,
      fileType: contentType,
      fileSize: decoded.buffer.length,
      fileUrl,
      fileStorageKey: storageKey,
      storageKind: "ecs-file",
      serverStoragePath: absolutePath,
      backupStorageKey,
      backupKind: "ecs-live-backup",
      backupStoragePath: backupAbsolutePath,
      backupCreatedAt,
      contentSha256,
      uploadedAt,
      uploadedByName,
      uploadedByUsername
    }
  }, headers);
}

async function handleDownloadCurriculumFile(url, res, headers, authorization) {
  if (!await requireModuleAccess(res, headers, authorization, "jrc-curriculum-files", "curriculum", "read")) return;
  const prefix = "/curriculum-files/";
  const storageKey = decodeURIComponent(url.pathname.slice(prefix.length));
  const absolutePath = resolveUploadPath(storageKey);
  if (!absolutePath) {
    send(res, 400, { ok: false, error: "invalid_storage_key" }, headers);
    return;
  }

  try {
    const stats = await fs.stat(absolutePath);
    if (!stats.isFile()) {
      send(res, 404, { ok: false, error: "not found" }, headers);
      return;
    }
    const requestedName = sanitizeOriginalFileName(url.searchParams.get("fileName") || path.basename(absolutePath));
    const extension = path.extname(absolutePath).toLowerCase();
    const contentType = contentTypeByExtension.get(extension) || "application/octet-stream";
    res.writeHead(200, {
      ...headers,
      "Content-Type": contentType,
      "Content-Length": stats.size,
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(requestedName)}`
    });
    createReadStream(absolutePath).pipe(res);
  } catch (error) {
    if (error?.code === "ENOENT") {
      send(res, 404, { ok: false, error: "not found" }, headers);
      return;
    }
    throw error;
  }
}

async function handleAuditLog(req, res, headers, authorization) {
  const body = await readJson(req);
  const result = await pool.query(`
    insert into audit_logs (
      module_key, action_key, target_type, target_id, summary,
      operator_name, operator_username, operator_role, user_agent, created_at
    )
    values ($1, $2, $3, $4, $5, $6, $7, $8, $9, coalesce($10::timestamptz, now()))
    returning id
  `, [
    body.moduleKey || "unknown",
    body.actionKey || "unknown",
    body.targetType || null,
    body.targetId || null,
    body.summary || "-",
    authorization?.payload?.name || body.operatorName || "-",
    authorization?.payload?.sub || body.operatorUsername || "-",
    authorization?.payload?.role || body.operatorRole || "-",
    body.userAgent || req.headers["user-agent"] || "",
    body.clientCreatedAt || null
  ]);
  send(res, 200, { ok: true, id: result.rows[0].id }, headers);
}

async function handleBackupExport(req, res, headers, authorization) {
  const body = await readJson(req);
  const result = await pool.query(`
    insert into backup_exports (
      backup_version, source_url, entry_count, exported_by_name, exported_at, note
    )
    values ($1, $2, $3, $4, coalesce($5::timestamptz, now()), $6)
    returning id
  `, [
    body.backupVersion || "unknown",
    body.sourceUrl || "",
    Number(body.entryCount || 0),
    authorization?.payload?.name || authorization?.payload?.sub || body.exportedByName || body.exportedByUsername || "-",
    body.exportedAt || null,
    Array.isArray(body.storeKeys) ? `stores: ${body.storeKeys.join(", ")}` : ""
  ]);
  send(res, 200, { ok: true, id: result.rows[0].id }, headers);
}

function aiModeLabel(mode) {
  return {
    feedback: "课后反馈",
    classFeedback: "课堂反馈",
    admissionsFollowup: "招生跟进",
    parentCommunication: "学管沟通",
    attendanceFollowup: "点名缺勤跟进",
    curriculumArchive: "课件资料归档",
    financeCheck: "财务核对",
    todo: "待办事项",
    suggestion: "员工建议",
    task: "任务说明",
    help: "工作台使用问答",
    videoOpsReport: "短视频运营专家报告",
    health: "接口检测"
  }[mode] || "AI 整理";
}

function localAiDraft(body) {
  const text = String(body.text || "").trim();
  const mode = String(body.mode || "feedback");
  const label = aiModeLabel(mode);
  const parentMessage = mode === "classFeedback"
    ? ""
    : mode === "feedback"
      ? "建议老师确认后再发送给家长。"
      : "";
  return {
    title: body.target ? `${body.target}｜${label}` : label,
    summary: text ? `已按${label}整理为草稿。` : "AI 接口可用性检测。",
    polishedText: text,
    todoItems: mode === "todo" ? text.split(/[；;。\n]/).map((item) => item.trim()).filter(Boolean).slice(0, 8) : [],
    parentMessage,
    internalNote: mode === "classFeedback"
      ? "课堂反馈必须由 AI 模型生成；当前未生成本地兜底正文。"
      : "DeepSeek Key 尚未配置或接口暂不可用，本结果为本地草稿整理。",
    suggestedAction: ["feedback", "classFeedback"].includes(mode) ? "老师确认后归档学生服务，并复制发给家长。" : "",
    riskLevel: "正常",
    className: "",
    courseName: ""
  };
}

function normalizeFeedbackRecipient(target) {
  const raw = String(target || "").trim();
  if (!raw) return "家长您好";
  const first = raw.split(/[，,、\s/｜|]+/).filter(Boolean)[0] || raw;
  if (first === "家长") return "家长您好";
  if (/家长$/.test(first)) return `${first}您好`;
  if (/(爸爸|妈妈|父亲|母亲|父母)$/.test(first)) return `${first.replace(/^(.*?)(爸爸|妈妈|父亲|母亲|父母)$/, "$1的家长")}您好`;
  return `${first}的家长您好`;
}

function cleanExtractedText(value) {
  return String(value || "")
    .replace(/^[是为：:\s]+/, "")
    .replace(/[。；;，,\s]+$/, "")
    .replace(/^把/, "")
    .replace(/^(《|「|“|")/, "")
    .replace(/(》|」|”|")$/, "")
    .trim();
}

function looksLikeJsonText(value) {
  const raw = String(value || "").trim();
  if (!raw) return false;
  if (/^\{[\s\S]*\}$/.test(raw)) return true;
  return /\{[\s\S]*"(?:title|summary|polishedText|parentMessage|todoItems|structuredData)"\s*:/.test(raw)
    || /"(?:title|summary|polishedText|parentMessage|todoItems)"\s*:[\s\S]*\}/.test(raw);
}

function formatClassFeedbackText(value, target = "") {
  const greeting = normalizeFeedbackRecipient(target);
  let text = String(value || "")
    .replace(/^.{0,16}(妈妈|爸爸|父母|家长)[，,：:\s]*您好?[，,：:\s]*/, `${greeting}，`)
    .replace(/(?:^|\n)\s*(?:一、)?上课状态：/g, "\n\n一、上课状态：\n")
    .replace(/(?:^|\n)\s*(?:二、)?本次课上课内容：/g, "\n\n二、本次课上课内容：\n")
    .replace(/(?:^|\n)\s*(?:(?:二|三)、)?知识点要点：/g, "\n\n三、知识点要点：\n")
    .replace(/(?:^|\n)\s*(?:(?:三|四)、)?(?:学习掌握情况|学习情况反馈)：/g, "\n\n四、学习掌握情况：\n")
    .replace(/(?:^|\n)\s*(?:(?:四|五)、)?课后作业：/g, "\n\n五、课后作业：\n")
    .replace(/(一、上课状态：|二、本次课上课内容：|三、知识点要点：|四、学习掌握情况：|五、课后作业：)\n{2,}/g, "$1\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (text && !text.startsWith(greeting)) text = `${greeting}，\n\n${text}`;
  return text;
}

function chineseNumberToInt(value) {
  const raw = String(value || "").trim();
  if (/^\d+$/.test(raw)) return Number(raw);
  const map = { 零: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
  if (raw === "十") return 10;
  const tenIndex = raw.indexOf("十");
  if (tenIndex >= 0) {
    const left = raw.slice(0, tenIndex);
    const right = raw.slice(tenIndex + 1);
    return (left ? map[left] || 0 : 1) * 10 + (right ? map[right] || 0 : 0);
  }
  return map[raw] || 0;
}

function extractLessonNumberFromText(rawText) {
  const text = String(rawText || "");
  const match = text.match(/第\s*([0-9一二两三四五六七八九十]{1,4})\s*(?:次|节|讲|课)/);
  const value = chineseNumberToInt(match?.[1] || "");
  return value > 0 ? value : "";
}

function extractFeedbackSeason(rawText) {
  const text = String(rawText || "");
  if (/(暑假|暑期|夏季)/.test(text)) return "暑假";
  if (/(寒假|寒期|冬季)/.test(text)) return "寒假";
  if (/(秋季|秋期)/.test(text)) return "秋季";
  if (/(春季|春期)/.test(text)) return "春季";
  const month = new Date().getMonth() + 1;
  if (month >= 7 && month <= 8) return "暑假";
  if (month <= 2) return "寒假";
  if (month >= 9) return "秋季";
  return "春季";
}

function resolveFeedbackLessonNumber(target, rawText, meta = {}) {
  const manual = String(meta.lessonNumber || "").trim();
  const manualNumber = chineseNumberToInt(manual);
  if (manualNumber > 0) return manualNumber;
  const oralNumber = extractLessonNumberFromText(rawText);
  if (oralNumber) return oralNumber;
  const name = String(target || "").split(/[，,、\s/｜|]+/).filter(Boolean)[0] || "";
  return name ? "__" : "__";
}

function feedbackMeta(target, rawText, meta = {}) {
  return {
    lessonSeason: meta.lessonSeason || extractFeedbackSeason(rawText),
    lessonNumber: meta.lessonNumber || resolveFeedbackLessonNumber(target, rawText, meta)
  };
}

function aiSystemPrompt() {
  return [
    "你是匠人程教育工作台的内部 AI 助手。",
    "你服务中小学数学/科学教培机构员工，主要帮助整理课后反馈、招生跟进、学管沟通、点名缺勤跟进、课件资料归档、财务核对、待办、建议、任务说明和工作台使用问题。",
    "所有输出必须谨慎，涉及学生、家长、财务、考核的信息只能作为草稿，提醒员工人工确认。",
    "涉及财务、工资、课时费、分红、课销、退费、考核评级时，只能做核对清单、异常提示和下一步建议，不得替代最终结算或直接下结论。",
    "涉及招生转化时，输出要包含客户当前阶段、家长关注点、下一次跟进动作、可复制沟通话术和风险提醒，不要承诺提分结果。",
    "涉及学管沟通时，要区分“发家长的话”和“内部跟进动作”，语气要温和、具体、可执行。",
    "涉及点名缺勤时，要明确是否需要确认不销课、补课、视频课、迟到修正、出门测成绩佐证，并生成跟进待办。",
    "涉及课件资料归档时，要整理年级、体系、主题、资料类型、标签、适用场景、打印/使用建议和标准文件命名建议。",
    "课堂反馈要面向家长，语气温和、具体、有诊断感，避免夸大承诺、避免刺激性评价。",
    "课堂反馈由你主写，网页端只负责展示、保存和归档；请自然理解老师原始描述，生成可直接给家长看的完整草稿。",
    "课堂反馈不能写得过短，不能摘要式压缩老师原文；要尽量保留老师给出的细节，并把零散口语整理成家长看得懂、觉得内容扎实的反馈。",
    "课堂反馈必须使用五段结构：标题行 + 一、上课状态 + 二、本次课上课内容 + 三、知识点要点 + 四、学习掌握情况 + 五、课后作业。",
    "你负责根据老师原话区分课堂状态、上课内容、知识点、掌握情况和作业；知识点要点由你根据真实上课主题智能补充。",
    "不确定的次数、作业名称、具体知识点可保留 __ 等待老师确认。",
    "返回严格 JSON，不要 Markdown，不要解释，不要输出 <think>、分析过程、英文 reasoning、代码块或模板外文字。",
    "JSON 字段：title, summary, polishedText, todoItems, parentMessage, internalNote, suggestedAction, riskLevel, className, courseName, quickTags, structuredData。",
    "todoItems 必须是字符串数组。没有内容时填空字符串或空数组。"
  ].join("\n");
}

function buildAiUserPrompt(body) {
  const mode = String(body.mode || "feedback");
  const batchStudents = Array.isArray(body.batchStudents)
    ? body.batchStudents.map((name) => String(name || "").trim()).filter(Boolean)
    : [];
  return [
    `整理类型：${aiModeLabel(mode)}`,
    `关联对象：${body.target || "未填写"}`,
    batchStudents.length > 1 ? `同课学生名单：${batchStudents.join("、")}` : "",
    `课程阶段：${body.lessonSeason || "未填写"}`,
    `课次：${body.lessonNumber || "未填写"}`,
    `提交人：${body.operatorName || "-"}｜${body.operatorRole || "-"}`,
    "原始内容：",
    String(body.text || "").trim(),
    "",
    "整理要求：",
    mode === "feedback" ? "整理成课堂表现、学习内容、作业情况、需要家长配合、内部跟进建议。家长沟通建议要温和、具体、不过度承诺。" : "",
    mode === "classFeedback" ? [
      "请直接根据老师原始描述生成课堂反馈草稿，网页端不会替你拼接正文。",
      "parentMessage 必须是一段可直接微信发给家长的完整文字，使用下面五段模板：",
      "整体要求：内容要充实、具体、自然，单个学生建议 500-900 字；如果老师原始内容很多，可以更长。不要只写一两句空泛表扬，不要为了简短而删掉重要细节。",
      "写作边界：可以根据课堂主题补充必要的知识点解释、学习观察和家长配合建议，但不能编造成绩、作业完成情况、课堂事件或老师没有提供的事实；不确定处用 __ 留给老师确认。",
      batchStudents.length > 1 ? [
        "当前是多个学生：请直接为同课学生名单中的每个学生生成一份完整课堂反馈草稿。",
        "如果他们上的是同一节课，本次课上课内容、知识点要点、课后作业可以保持一致；上课状态和学习掌握情况要按老师原始描述分别写。",
        "structuredData 必须包含 students 数组；每个元素必须包含 name 和 parentMessage。",
        "students[].parentMessage 必须直接给出该学生可发给家长的完整五段课堂反馈正文，不要只返回片段。",
        "多个学生的公共上课内容可以一致，但每个学生的上课状态、学习掌握情况、后续提醒要结合姓名分别写，不能复制成完全相同的反馈。",
        "每份 parentMessage 里只写该学生姓名，不要写其他学生姓名。"
      ].join("\n") : "",
      "某某的家长您好，这是春季小课第__次课程反馈：",
      "一、上课状态：",
      "根据老师原始描述如实整理课堂表现、专注度、互动、纪律、提醒情况。至少写 2-4 句，既要有状态判断，也要有具体表现和后续提醒。",
      "二、本次课上课内容：",
      "1. 从老师原始描述中提取主要上课内容",
      "2. 建议写 3-5 条；每条尽量写清本节课做了什么、练了什么、老师带孩子解决了什么问题。",
      "三、知识点要点：",
      "请根据老师提到的上课主要内容，补充家长可查询、可询问孩子的核心定义、公式、定理、解题思路或知识要点；数学要尽量写清公式/方法，科学要尽量写清概念/现象/结论。建议写 3-6 条，每条不是只列名词，要说明它为什么重要、怎么用。",
      "四、学习掌握情况：",
      "1. 对应上课内容第 1 条写孩子掌握情况",
      "2. 对应上课内容第 2 条写孩子掌握情况",
      "3. 建议写 3-5 条，逐条说明已经掌握的地方、还需要巩固的地方、下次课老师会继续盯的点。不要输出 [object Object] 或任何对象结构。",
      "五、课后作业：",
      "《从老师原始描述中提取作业；没有则填 __》做完。可以补一句家长配合方式，例如提醒完成、订正错题、复述知识点，但不要增加老师没布置过的具体作业。",
      "如果原始描述中孩子状态一般或偏弱，要温和改写对应模块，不要强行写“非常棒”；如果信息缺失，用 __ 保留待老师确认。",
      "internalNote 写给学管，包含：本次反馈依据、需要老师确认的空缺字段、是否需要后续跟进、风险等级和下一步。"
    ].join("\n") : "",
    mode === "admissionsFollowup" ? [
      "把原始招生/试听沟通记录整理成可执行跟进方案。",
      "summary 写当前线索阶段、家长主要关注点和成交风险。",
      "parentMessage 写一段可直接复制给家长的微信跟进话术，语气真诚克制，不要硬销售。",
      "todoItems 列出 3-6 个下一步动作，例如预约试听、补发资料、确认时间、二次追踪、顾问回访。",
      "internalNote 写给招生顾问，说明线索温度、异议点、建议跟进节奏。",
      "structuredData 建议包含 leadStage, parentConcerns, nextContactTime, conversionRisk, ownerAction。"
    ].join("\n") : "",
    mode === "parentCommunication" ? [
      "把学管老师或任课老师的原始描述整理成家长沟通内容。",
      "parentMessage 写可直接发给家长的微信文字；要具体到课堂表现、学习问题、建议配合，不要刺激家长。",
      "polishedText 写内部记录版，便于归档到学生服务系统。",
      "todoItems 列出学管后续跟进动作，例如提醒作业、确认补课、关注成绩变化、下次课复盘。",
      "structuredData 建议包含 studentStatus, parentConcern, serviceRisk, followupOwner, followupDate。"
    ].join("\n") : "",
    mode === "attendanceFollowup" ? [
      "把点名、迟到、缺勤、出门测成绩、补课或视频课说明整理成跟进记录。",
      "summary 写清本节课考勤状态和是否需要二次确认。",
      "polishedText 写内部考勤记录版。",
      "parentMessage 写可发给家长确认的沟通话术。",
      "todoItems 必须列出：是否销课/不销课待确认、是否安排补课或视频课、是否用出门测成绩修正到课、谁负责跟进。",
      "structuredData 建议包含 attendanceStatus, makeUpNeeded, videoLessonNeeded, scoreEvidence, billingAttention。"
    ].join("\n") : "",
    mode === "curriculumArchive" ? [
      "把老师上传或描述的课件、讲义、题库、答案、板书照片整理成标准化资料归档信息。",
      "summary 写资料适用年级、体系和主题。",
      "polishedText 写资料简介和使用建议，便于教研课程系统展示。",
      "todoItems 列出归档动作，例如确认年级、确认体系、补充答案、统一命名、上传到对应文件夹。",
      "internalNote 写教研负责人需要审核的点。",
      "structuredData 建议包含 grade, system, subject, topic, materialType, tags, fileNameSuggestion, printAdvice。"
    ].join("\n") : "",
    mode === "financeCheck" ? [
      "把课时费、课销、补课提成、工资、分红或费用说明整理成财务核对清单。",
      "必须强调这是核对草稿，最终以财务确认和原始表格为准。",
      "summary 写本次要核对的对象、期间和核心金额/课时线索。",
      "polishedText 写核对过程和异常点。",
      "todoItems 列出需要人工确认的字段、缺失凭证、跨系统对账动作。",
      "internalNote 写风险提醒，不要直接给出最终应发工资或最终分红结论。",
      "structuredData 建议包含 period, teacher, amountClues, hourClues, missingFields, riskPoints。"
    ].join("\n") : "",
    mode === "videoOpsReport" ? [
      "你现在是中国大陆一到九年级数学教培短视频运营顾问，服务对象是校外数学培训机构。",
      "请只基于原始内容里的账号数据、视频数据、平台建议、同行公开样本和数据完整度做诊断；数据不足的地方要明确说明，不要假装已经知道。",
      "如果原始内容里包含 todayCommandCenter，必须先读取它作为今日执行主线；如果包含 weeklyShootingPlan 或 remakeBookmarkLibrary，也要优先读取：weeklyShootingPlan 是系统生成的一周排期，remakeBookmarkLibrary 是老师人工确认的复拍素材，优先级高于普通候选。",
      "如果包含 videoRankings 或 dataQualitySummary，必须继续读取这些榜单：播放榜代表本地影响力，涨粉/C粉榜代表账号增长，咨询线索榜代表招生转化，收藏转发榜代表家长保存和干货价值，recommendedRemakes 代表复拍清单，weakToReview 代表复盘清单。",
      "不要把高播放低咨询的视频简单判定为差；这类视频可能负责品牌曝光和本地认知，除非有留存、完播、评论或承接字段证明问题。",
      "诊断口径必须结合官方和成熟方法：用户互动、完播/复看、关注、评论、分享、标题/关键词/声音/话题等视频信息会影响推荐；前 3 秒负责留存，标题封面负责点击，收藏转发代表干货价值，主页访问/私信/线索代表招生转化。",
      "抖音和视频号必须分开判断：抖音按推荐流、搜索流、留存、涨粉、主页访问和线索判断；视频号按转发分享、评论质量、收藏、本地信任、微信私域承接和熟人圈传播判断。",
      "视频号数据不足时要明确建议先跑视频号小样本验证或视频号深采，不要把抖音结论直接套到视频号。",
      "重点不是泛娱乐短视频，而是数学培优、奥数、补弱、小升初、中考、暑假预习复习、家长焦虑、咨询转化、私域承接和教培合规表达。",
      "输出要给校长和运营老师看，语言直接、具体、可执行，不要空话。",
      "如果原始内容里包含 roleBriefs、bossBrief 或 teacherExecutionSheet，必须读取：bossBrief 用于校长看方向、风险和资源安排，teacherExecutionSheet 用于拍摄老师照着执行，不要把两者混成一篇难读报告。",
      "不要只写长篇诊断报告，必须把结论落成今天可以执行的拍摄闭环：今天拍什么、怎么拍、发布前怎么承接、2小时/24小时/72小时看什么数据。",
      "必须包含：1）一句话总判断；2）当前数据能不能下结论；3）账号优势；4）播放/涨粉/咨询/收藏转发四类榜单结论；5）抖音和视频号同题材对比；6）同一选题的抖音版和视频号版脚本；7）主要问题；8）每个问题的原因和解决动作；9）值得复拍的方向；10）发布后2小时/24小时/72小时复盘闭环；11）跨平台素材库分类；12）需要停止或重做的内容；13）下周拍摄清单；14）复拍收藏夹如何使用；15）采集器还需要补采哪些字段；16）数据可信度分层；17）合规风险提醒。",
      "每个主要问题都要写成：问题是什么、从哪些数据看出来、为什么会影响推荐或转化、今天怎么改、对应复拍/重剪哪条视频。",
      "可直接拍脚本必须包含：标题范例、前 3 秒开头、正文三步、结尾转化承接、适合年级/场景。",
      "同一内容双平台脚本必须分开写：抖音版突出前3秒刺激、痛点、搜索关键词、关注理由；视频号版突出家长信任、转发价值、本地升学场景、微信私域沟通。",
      "每个可执行脚本后面都要写验收标准：发布前检查、2小时检查、24小时检查、72小时复盘结论。",
      "发布后复盘必须明确：2小时看启动播放、前3秒/完播；24小时看收藏、转发、评论、涨粉、主页访问、咨询线索；72小时决定复拍、重剪、放弃或继续观察。",
      "如果原始内容里包含 publishOutcomeBoard，必须明确哪些内容进入复拍素材库、哪些进入重剪清单、哪些进入失败样本库、哪些继续观察，并说明理由。",
      "跨平台素材库必须分四类：抖音爆款结构、视频号信任结构、双平台核心结构、只适合某个平台/失败样本结构。",
      "数据可信度必须说明：哪些是真后台采到，哪些字段缺失，哪些只能轻判断，哪些可以深度复盘；缺字段时不能下重结论。",
      "下周拍摄清单要尽量具体到标题方向或选题脚本角度，例如“初一暑假数学不补会掉在哪里”“几何不开窍的三个信号”。",
      "下周拍摄清单要分成：品牌曝光型、涨粉/C粉型、招生转化型、收藏干货型；每类尽量给 1-3 个标题方向。",
      "如果有同行公开作品样本，请指出可以学习的标题、选题、开头、证明力和转化结构；如果只有标杆账号库而没有作品样本，要明确说明只能做账号名单和方向参考，不能下播放表现结论。",
      "如果看到 benchmarkAccounts 里有视频号待匹配字段，不要编造对应视频号，只提醒后续需要人工或平台内确认。",
      "parentMessage 留空；polishedText 写完整专家报告；todoItems 写 5-8 个下一步执行动作；summary 写 80 字以内摘要；riskLevel 写 正常/关注/高风险。",
      "structuredData 建议包含 dataReadiness, accountVerdict, strengths, weaknesses, problemSolutions, remakeDirections, executableScripts, crossPlatformComparison, dualPlatformScripts, executionLoop, postPublishReviewLoop, platformMaterialLibrary, remakeBookmarkLibrary, dataTrustTiers, stopDoing, weeklyShootingPlan, missingData, complianceRisks。",
      "其中 strengths、weaknesses、problemSolutions、remakeDirections、executableScripts、crossPlatformComparison、dualPlatformScripts、executionLoop、postPublishReviewLoop、platformMaterialLibrary、remakeBookmarkLibrary、dataTrustTiers、stopDoing、weeklyShootingPlan、missingData、complianceRisks 尽量用字符串数组，便于页面直接展示成行动卡片。"
    ].join("\n") : "",
    mode === "todo" ? "拆成明确待办，尽量包含负责人、截止时间线索和下一步动作。" : "",
    mode === "suggestion" ? "整理成正式管理建议，包含现象、影响、建议方案和预期收益。" : "",
    mode === "task" ? "整理成任务说明，包含目标、完成标准、子任务和验收口径。" : "",
    mode === "help" ? "用工作台现有模块回答，必要时说明进入哪个系统处理。模块包括排课、学管知识库、建议任务、财务、招生、教学质量、学生服务、教研课程、人事培训、校区运营。" : ""
  ].filter(Boolean).join("\n");
}

function stripThinkingText(text) {
  return String(text || "")
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/```(?:json)?/gi, "")
    .replace(/```/g, "")
    .trim();
}

function aiTextFromValue(value, depth = 0) {
  if (value == null || depth > 5) return "";
  if (typeof value === "string") {
    const raw = stripThinkingText(value);
    const firstBrace = raw.indexOf("{");
    const lastBrace = raw.lastIndexOf("}");
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      try {
        return aiTextFromValue(JSON.parse(raw.slice(firstBrace, lastBrace + 1)), depth + 1);
      } catch {
        // Keep raw text when it only looks like JSON.
      }
    }
    return raw;
  }
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    return value
      .map((item, index) => {
        const text = aiTextFromValue(item, depth + 1);
        if (!text) return "";
        return /^\s*(?:\d+[.、]|[一二三四五六七八九十]+、)/.test(text) ? text : `${index + 1}. ${text}`;
      })
      .filter(Boolean)
      .join("\n");
  }
  if (typeof value === "object") {
    const preferredKeys = [
      "parentMessage",
      "feedbackText",
      "message",
      "polishedText",
      "text",
      "content",
      "body",
      "value",
      "description",
      "summary"
    ];
    for (const key of preferredKeys) {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        const text = aiTextFromValue(value[key], depth + 1);
        if (text) return text;
      }
    }
    const sectionKeys = [
      ["classStatus", "一、上课状态："],
      ["status", "一、上课状态："],
      ["courseContent", "二、本次课上课内容："],
      ["contentItems", "二、本次课上课内容："],
      ["knowledgePoints", "三、知识点要点："],
      ["keyPoints", "三、知识点要点："],
      ["learningStatus", "四、学习掌握情况："],
      ["mastery", "四、学习掌握情况："],
      ["homework", "五、课后作业："]
    ];
    const sections = sectionKeys
      .filter(([key]) => Object.prototype.hasOwnProperty.call(value, key))
      .map(([key, label]) => {
        const text = aiTextFromValue(value[key], depth + 1);
        return text ? `${label}\n${text}` : "";
      })
      .filter(Boolean);
    if (sections.length) return sections.join("\n\n");
    return Object.entries(value)
      .filter(([key]) => !/^_/.test(key) && !["structuredData", "quickTags", "todoItems"].includes(key))
      .map(([key, item]) => {
        const text = aiTextFromValue(item, depth + 1);
        if (!text) return "";
        return /^\d+$/.test(key) ? text : `${key}：${text}`;
      })
      .filter(Boolean)
      .join("\n");
  }
  return "";
}

function parseAiJson(text, fallback) {
  const raw = stripThinkingText(text);
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return { ...fallback, ...parsed, todoItems: Array.isArray(parsed.todoItems) ? parsed.todoItems : fallback.todoItems };
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        const parsed = JSON.parse(match[0]);
        return { ...fallback, ...parsed, todoItems: Array.isArray(parsed.todoItems) ? parsed.todoItems : fallback.todoItems };
      } catch {
        // fall through to raw text.
      }
    }
    return { ...fallback, polishedText: raw, internalNote: fallback.internalNote || "模型返回非 JSON，已作为正文保留。" };
  }
}

function requireAiJson(text) {
  const raw = stripThinkingText(text);
  if (!raw) {
    const error = new Error("AI模型返回为空。");
    error.statusCode = 502;
    error.code = "ai_empty_response";
    throw error;
  }
  const candidates = [raw];
  const firstBrace = raw.indexOf("{");
  const lastBrace = raw.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) candidates.push(raw.slice(firstBrace, lastBrace + 1));
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      return {
        ...parsed,
        todoItems: Array.isArray(parsed.todoItems) ? parsed.todoItems : []
      };
    } catch {
      // Try next candidate.
    }
  }
  return {
    title: "课堂反馈",
    summary: "AI模型已返回内容，系统已按校区统一模板补齐格式。",
    polishedText: raw,
    parentMessage: raw,
    todoItems: [],
    internalNote: `AI模型返回了非 JSON 内容，系统已保留模型文字并继续套用课堂反馈模板。原始片段：${raw.slice(0, 240)}`,
    _rawAiText: raw
  };
}

function ensureClassFeedbackResult(result, body) {
  if (String(body?.mode || "") !== "classFeedback") return result;
  const structuredStudents = Array.isArray(result?.structuredData?.students)
    ? result.structuredData.students
    : Array.isArray(result?.structuredData?.studentFeedbacks)
      ? result.structuredData.studentFeedbacks
      : [];
  if (Array.isArray(body?.batchStudents) && body.batchStudents.length > 1 && structuredStudents.length) {
    const parentMessage = aiTextFromValue(result?.parentMessage || result?.polishedText || "同课多学生结构化课堂反馈");
    return {
      ...result,
      title: result?.title || `批量课堂反馈｜${body.batchStudents.length}人`,
      summary: result?.summary || "AI模型已按同一节课提取公共内容，并拆分每个学生个人表现。",
      parentMessage,
      polishedText: aiTextFromValue(result?.polishedText || result?.parentMessage || parentMessage),
      lessonSeason: result?.lessonSeason || body?.lessonSeason || extractFeedbackSeason(body?.text || ""),
      lessonNumber: result?.lessonNumber || body?.lessonNumber || resolveFeedbackLessonNumber(body?.target || "", body?.text || "", body),
      todoItems: Array.isArray(result?.todoItems) ? result.todoItems : [],
      internalNote: result?.internalNote || "AI模型已按一课多生模式返回结构化课堂反馈；系统会保持公共课程内容一致，并按学生拆分个人表现。"
    };
  }
  const rawAiText = aiTextFromValue(result?._rawAiText || result?.polishedText || result?.parentMessage || "");
  const parentMessage = aiTextFromValue(result?.parentMessage || rawAiText || "");
  const hasTemplate = parentMessage.includes("小课第") && parentMessage.includes("一、上课状态") && parentMessage.includes("本次课上课内容") && parentMessage.includes("知识点要点") && parentMessage.includes("学习掌握情况") && parentMessage.includes("课后作业");
  if (parentMessage && !looksLikeJsonText(parentMessage)) {
    const formatted = formatClassFeedbackText(parentMessage, body?.target || "");
    const noteParts = [
      result?.internalNote,
      hasTemplate
        ? "AI模型已主写课堂反馈，系统仅做称呼与段落格式校验。"
        : "AI模型已返回课堂反馈正文，但模板栏目不完整；系统保留模型原文，不再用本地模板覆盖，请老师按黄色提醒补齐后再归档。",
      rawAiText && rawAiText !== parentMessage ? "AI模型原始整理已保留在整理正文中。" : ""
    ].filter(Boolean);
    return {
      ...result,
      parentMessage: formatted,
      lessonSeason: result?.lessonSeason || body?.lessonSeason || extractFeedbackSeason(body?.text || ""),
      lessonNumber: result?.lessonNumber || body?.lessonNumber || resolveFeedbackLessonNumber(body?.target || "", body?.text || "", body),
      polishedText: result?.polishedText === parentMessage || !result?.polishedText ? formatted : result?.polishedText,
      internalNote: noteParts.join("\n")
    };
  }
  const error = new Error("AI模型没有返回可用的课堂反馈正文，本次不使用本地知识库硬凑正式反馈。");
  error.statusCode = 502;
  error.code = "ai_incomplete_class_feedback";
  error.retryable = true;
  throw error;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function stringifyAiContent(content) {
  if (Array.isArray(content)) {
    return content.map((item) => {
      if (typeof item === "string") return item;
      return item?.text || item?.content || item?.message || "";
    }).filter(Boolean).join("\n");
  }
  if (content && typeof content === "object") {
    return content.text || content.content || JSON.stringify(content);
  }
  return String(content || "");
}

function aiProviders() {
  return [{
    key: "deepseek",
    name: "DeepSeek",
    apiKey: deepseekApiKey,
    apiUrl: deepseekApiUrl,
    model: deepseekModel,
    timeoutMs: deepseekTimeoutMs,
    maxAttempts: deepseekMaxAttempts,
    headers: () => ({
      "Content-Type": "application/json",
      "Authorization": `Bearer ${deepseekApiKey}`
    }),
    payload: (body) => ({
      model: deepseekModel,
      messages: [
        { role: "system", content: aiSystemPrompt() },
        { role: "user", content: buildAiUserPrompt(body) }
      ],
      temperature: 0.25,
      max_tokens: String(body?.mode || "") === "classFeedback"
        ? (Array.isArray(body?.batchStudents) && body.batchStudents.length > 1 ? 7800 : 6500)
        : String(body?.mode || "") === "videoOpsReport"
          ? 7600
          : 5200
    })
  }];
}

function configuredAiProviders() {
  return aiProviders().filter((provider) => provider.apiKey && provider.apiUrl && provider.model);
}

function firstConfiguredAiProvider() {
  return configuredAiProviders()[0] || null;
}

function extractAiContent(data) {
  const choice = data?.choices?.[0] || {};
  return stringifyAiContent(
    choice.message?.content
      || choice.delta?.content
      || data?.reply
      || data?.output_text
      || data?.output?.text
      || data?.data?.text
      || data?.data?.reply
      || ""
  ).trim();
}

function aiStatusMessage(data) {
  if (!data || typeof data === "string") return String(data || "");
  return data?.error?.message
    || data?.message
    || data?.base_resp?.status_msg
    || data?.base_resp?.status_code
    || data?.code
    || "";
}

function isRetryableAiError(error) {
  const status = Number(error?.statusCode || 0);
  const code = String(error?.code || "");
  const message = String(error?.message || "");
  return error?.retryable
    || [408, 409, 425, 429, 500, 502, 503, 504].includes(status)
    || /(timeout|timed out|abort|ECONNRESET|ECONNREFUSED|EAI_AGAIN|fetch failed|network)/i.test(`${code} ${message}`);
}

function aiFriendlyError(error) {
  const status = Number(error?.statusCode || 0);
  const message = String(error?.message || error || "").slice(0, 240);
  const provider = error?.providerName || "AI模型";
  const timeoutMs = error?.timeoutMs || deepseekTimeoutMs;
  if (/timeout/i.test(String(error?.code || ""))) return `${provider} 接口超时 ${Math.round(timeoutMs / 1000)} 秒`;
  if (status === 429) return "接口限流或额度繁忙";
  if ([500, 502, 503, 504].includes(status)) return `${provider} 服务临时异常 HTTP ${status}`;
  if (status) return `HTTP ${status}：${message}`;
  return message || "网络或接口返回异常";
}

async function callAiProviderOnce(provider, body) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), provider.timeoutMs);
  let response;
  try {
    response = await fetch(provider.apiUrl, {
      method: "POST",
      headers: provider.headers(),
      signal: controller.signal,
      body: JSON.stringify(provider.payload(body))
    });
  } catch (error) {
    const wrapped = new Error(error?.name === "AbortError" ? `${provider.name} 请求超时。` : String(error?.message || error));
    wrapped.statusCode = error?.name === "AbortError" ? 504 : 502;
    wrapped.code = error?.name === "AbortError" ? `${provider.key}_timeout` : `${provider.key}_network_error`;
    wrapped.provider = provider.key;
    wrapped.providerName = provider.name;
    wrapped.timeoutMs = provider.timeoutMs;
    wrapped.retryable = true;
    throw wrapped;
  } finally {
    clearTimeout(timeout);
  }

  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!response.ok) {
    const error = new Error(aiStatusMessage(data) || (typeof data === "string" ? data : JSON.stringify(data || {})));
    error.statusCode = response.status;
    error.provider = provider.key;
    error.providerName = provider.name;
    error.timeoutMs = provider.timeoutMs;
    error.retryable = isRetryableAiError(error);
    throw error;
  }
  const baseRespCode = Number(data?.base_resp?.status_code || 0);
  if (baseRespCode) {
    const error = new Error(aiStatusMessage(data) || `${provider.name} base_resp status ${baseRespCode}`);
    error.statusCode = baseRespCode;
    error.code = `${provider.key}_base_resp_error`;
    error.provider = provider.key;
    error.providerName = provider.name;
    error.timeoutMs = provider.timeoutMs;
    error.retryable = isRetryableAiError(error);
    throw error;
  }
  const content = extractAiContent(data);
  if (!content) {
    const error = new Error(`${provider.name} 返回为空。`);
    error.statusCode = 502;
    error.code = `${provider.key}_empty_response`;
    error.provider = provider.key;
    error.providerName = provider.name;
    error.timeoutMs = provider.timeoutMs;
    error.retryable = true;
    throw error;
  }
  return content;
}

async function callAiProvider(provider, body) {
  let lastError = null;
  for (let attempt = 1; attempt <= provider.maxAttempts; attempt += 1) {
    try {
      const content = await callAiProviderOnce(provider, body);
      return { content, provider, attempts: attempt };
    } catch (error) {
      lastError = error;
      if (!isRetryableAiError(error) || attempt >= provider.maxAttempts) break;
      await wait(Math.min(3000, 700 * attempt));
    }
  }
  const wrapped = new Error(`${aiFriendlyError(lastError)}；已自动重试 ${provider.maxAttempts} 次。`);
  wrapped.statusCode = lastError?.statusCode || 502;
  wrapped.code = lastError?.code || `${provider.key}_failed`;
  wrapped.provider = provider.key;
  wrapped.providerName = provider.name;
  wrapped.timeoutMs = provider.timeoutMs;
  wrapped.cause = lastError;
  wrapped.attempts = provider.maxAttempts;
  throw wrapped;
}

async function callAiChat(body) {
  const providers = configuredAiProviders();
  if (!providers.length) {
    const error = new Error("DeepSeek Key 尚未配置。");
    error.statusCode = 503;
    error.code = "ai_key_missing";
    throw error;
  }
  const errors = [];
  for (const provider of providers) {
    try {
      return await callAiProvider(provider, body);
    } catch (error) {
      errors.push(error);
      if (!isRetryableAiError(error)) break;
    }
  }
  const lastError = errors[errors.length - 1] || new Error("AI 调用失败。");
  const wrapped = new Error(errors.map((error) => `${error.providerName || "AI模型"}：${aiFriendlyError(error)}`).join("；") || aiFriendlyError(lastError));
  wrapped.statusCode = lastError?.statusCode || 502;
  wrapped.code = lastError?.code || "ai_failed";
  wrapped.provider = lastError?.provider || "";
  wrapped.providerName = lastError?.providerName || "";
  wrapped.attempts = errors.reduce((sum, error) => sum + (Number(error?.attempts) || 1), 0);
  wrapped.cause = lastError;
  throw wrapped;
}

async function handleAiAssistant(req, res, headers, authorization) {
  if (!await requireModuleAccess(res, headers, authorization, "jrc-ai-assistant", "ai", "read")) return;
  const body = await readJson(req, 2 * 1024 * 1024);
  const text = String(body.text || "").trim();
  const fallback = localAiDraft(body);
  const isClassFeedback = String(body.mode || "") === "classFeedback";
  const requiresModel = ["classFeedback", "videoOpsReport"].includes(String(body.mode || ""));
  const primaryProvider = firstConfiguredAiProvider();
  if (body.mode === "health") {
    send(res, 200, {
      ok: true,
      provider: primaryProvider ? primaryProvider.key : "local",
      providerName: primaryProvider ? primaryProvider.name : "本地",
      configured: Boolean(primaryProvider),
      model: primaryProvider ? primaryProvider.model : "",
      availableProviders: configuredAiProviders().map((provider) => ({ provider: provider.key, providerName: provider.name, model: provider.model })),
      result: fallback
    }, headers);
    return;
  }
  if (!text) {
    send(res, 400, { ok: false, error: "empty_input", message: "请先输入文字或语音转文字内容。" }, headers);
    return;
  }
  if (!primaryProvider) {
    const payload = {
      ok: false,
      provider: "none",
      configured: false,
      error: "ai_key_missing",
      message: `${isClassFeedback ? "课堂反馈" : "AI 专家报告"}未生成：DeepSeek Key 尚未配置。请先在阿里云服务环境变量中配置 JRC_DEEPSEEK_API_KEY。`
    };
    if (!requiresModel) {
      send(res, 200, { ok: true, provider: "local", configured: false, result: fallback, warning: payload.error, message: payload.message }, headers);
      return;
    }
    send(res, 503, payload, headers);
    return;
  }
  try {
    const aiResult = await callAiChat({
      ...body,
      operatorName: authorization?.payload?.name || body.operatorName || "-",
      operatorUsername: authorization?.payload?.sub || body.operatorUsername || "-"
    });
    const content = aiResult.content;
    const parsed = isClassFeedback ? requireAiJson(content) : parseAiJson(content, fallback);
    const result = ensureClassFeedbackResult(parsed, body);
    send(res, 200, {
      ok: true,
      provider: aiResult.provider.key,
      providerName: aiResult.provider.name,
      configured: true,
      model: aiResult.provider.model,
      attempts: aiResult.attempts,
      result
    }, headers);
  } catch (error) {
    console.error("AI assistant failed", error);
    const payload = {
      ok: false,
      provider: error?.provider || primaryProvider?.key || "ai",
      providerName: error?.providerName || primaryProvider?.name || "AI模型",
      configured: true,
      model: primaryProvider?.model || "",
      error: error?.code || "ai_failed",
      statusCode: error?.statusCode || 500,
      attempts: error?.attempts || primaryProvider?.maxAttempts || 1,
      message: `${error?.providerName || primaryProvider?.name || "AI模型"} 调用失败，${isClassFeedback ? "课堂反馈" : "AI 专家报告"}未生成：${aiFriendlyError(error)}。请稍后再试；如果连续失败，请检查 DeepSeek API Key、额度、模型或服务器到 DeepSeek 的网络。`
    };
    if (!requiresModel) {
      send(res, 200, { ok: true, provider: "local", configured: true, warning: payload.error, message: payload.message, result: fallback }, headers);
      return;
    }
    send(res, 502, payload, headers);
  }
}

async function route(req, res) {
  const headers = corsHeaders(req);
  const url = new URL(req.url || "/", "http://localhost");
  if (req.method === "OPTIONS") {
    res.writeHead(204, headers);
    res.end();
    return;
  }
  if (req.method === "POST" && (url.pathname === "/login" || url.pathname === "/api/login")) {
    try {
      return await handleLogin(req, res, headers);
    } catch (error) {
      console.error(error);
      send(res, 500, { ok: false, error: String(error?.message || error) }, headers);
      return;
    }
  }

  const authorization = getAuthorization(req);
  if (!authorization) {
    send(res, 401, { ok: false, error: "unauthorized" }, headers);
    return;
  }

  try {
    if (req.method === "GET" && url.pathname === "/health") return await handleHealth(res, headers);
    if (req.method === "GET" && url.pathname === "/system-diagnostics") {
      if (!await requireAdminAccess(res, headers, authorization)) return;
      return await handleSystemDiagnostics(res, headers);
    }
    if (req.method === "GET" && url.pathname === "/employees") return await handleEmployees(res, headers);
    if (req.method === "POST" && url.pathname === "/employees") return await handleUpsertEmployee(req, res, headers, authorization);
    if (req.method === "GET" && url.pathname === "/permissions") return await handlePermissions(res, headers);
    if (req.method === "POST" && url.pathname === "/change-password") return await handleChangePassword(req, res, headers, authorization);
    if (req.method === "POST" && url.pathname === "/ai-assistant") return await handleAiAssistant(req, res, headers, authorization);
    if (req.method === "GET" && url.pathname === "/module-data") return await handleGetModuleData(url, res, headers, authorization);
    if (req.method === "PUT" && url.pathname === "/module-data") return await handlePutModuleData(req, res, headers, authorization);
    if (req.method === "POST" && url.pathname === "/paike/formal-import") return await handlePaikeFormalImport(req, res, headers, authorization);
    if (req.method === "POST" && url.pathname === "/paike/month-closure") return await handlePaikeMonthClosure(req, res, headers, authorization);
    if (req.method === "POST" && url.pathname === "/paike/migrate-course-ids") return await handlePaikeCourseIdMigration(req, res, headers, authorization);
    if (req.method === "POST" && url.pathname === "/import/june-regular-csv") {
      return await handleImportJuneRegularCsv(req, res, headers, authorization);
    }
    if (req.method === "POST" && url.pathname === "/import/june-regular-xlsx") {
      return await handleImportJuneRegularXlsx(res, headers);
    }
    if (req.method === "POST" && url.pathname === "/curriculum-files") {
      return await handleUploadCurriculumFile(req, res, headers, authorization);
    }
    if (req.method === "GET" && url.pathname.startsWith("/curriculum-files/")) {
      return await handleDownloadCurriculumFile(url, res, headers, authorization);
    }
    if (req.method === "POST" && url.pathname === "/audit-logs") return await handleAuditLog(req, res, headers, authorization);
    if (req.method === "POST" && url.pathname === "/backup-exports") return await handleBackupExport(req, res, headers, authorization);
    send(res, 404, { ok: false, error: "not found" }, headers);
  } catch (error) {
    console.error(error);
    send(res, error?.statusCode || 500, { ok: false, error: String(error?.message || error) }, headers);
  }
}

applyDepartedEmployeeLocks().then(applyModuleOwnerPermissionRules).finally(() => {
  http.createServer(route).listen(port, () => {
    console.log(`JRC cloud API listening on ${port}`);
  });
});
