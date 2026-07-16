(function () {
  const configKey = "jrc-cloud-api-config-v1";
  const pendingKey = "jrc-cloud-sync-pending-v1";
  const sessionKey = "jrc-portal-auth-session";

  function safeJsonParse(raw, fallback = null) {
    try {
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  }

  function safeStorageGet(key) {
    try {
      return window.localStorage?.getItem(key) || null;
    } catch {
      return null;
    }
  }

  function safeStorageSet(key, value) {
    try {
      window.localStorage?.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  }

  function readCookie(name) {
    try {
      const prefix = `${encodeURIComponent(name)}=`;
      return document.cookie
        .split(";")
        .map((item) => item.trim())
        .find((item) => item.startsWith(prefix))
        ?.slice(prefix.length) || "";
    } catch {
      return "";
    }
  }

  function writeCookie(name, value, maxAgeSeconds = 7 * 24 * 60 * 60) {
    try {
      document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; path=/; max-age=${maxAgeSeconds}; SameSite=Lax`;
    } catch {
      // Cookie fallback is best-effort only.
    }
  }

  function readSession() {
    const parsed = safeJsonParse(safeStorageGet(sessionKey) || decodeURIComponent(readCookie(sessionKey) || ""), {});
    return parsed && typeof parsed === "object" ? parsed : {};
  }

  function readConfig() {
    const parsedConfig = safeJsonParse(safeStorageGet(configKey), {});
    const config = parsedConfig && typeof parsedConfig === "object" ? parsedConfig : {};
    const session = readSession();
    const isGithubPages = location.hostname.endsWith("github.io");
    const sameOriginApiBase = `${location.origin}/api`;
    const apiBaseUrl = String(config.apiBaseUrl || (!isGithubPages ? sameOriginApiBase : "")).replace(/\/+$/g, "");
    return {
      enabled: Boolean((config.enabled && config.apiBaseUrl) || (!isGithubPages && apiBaseUrl)),
      apiBaseUrl,
      apiToken: String(config.apiToken || session.cloudApiToken || ""),
      siteId: String(config.siteId || "jrcedu-main")
    };
  }

  function readPendingQueue() {
    const rows = safeJsonParse(safeStorageGet(pendingKey), []);
    return Array.isArray(rows) ? rows : [];
  }

  function writePendingQueue(rows) {
    safeStorageSet(pendingKey, JSON.stringify(rows.slice(-200)));
  }

  function writeSession(session) {
    const serialized = JSON.stringify(session || {});
    safeStorageSet(sessionKey, serialized);
    writeCookie(sessionKey, serialized);
  }

  async function ensureSessionToken() {
    const config = readConfig();
    if (!config.enabled || config.apiToken) return config;
    return config;
  }

  function enqueue(kind, payload) {
    const serialized = JSON.stringify(payload || {});
    if (serialized.length > 2 * 1024 * 1024) return false;
    const rows = readPendingQueue().filter((row) => {
      return !(kind === "module-write" && row?.kind === "module-write" && row?.payload?.storeKey === payload?.storeKey);
    });
    rows.push({
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      kind,
      payload,
      createdAt: new Date().toISOString()
    });
    return safeStorageSet(pendingKey, JSON.stringify(rows.slice(-200)));
  }

  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function isTransientCloudFailure(result) {
    const status = Number(result?.status || 0);
    return status === 0 || status === 408 || status === 429 || status >= 500;
  }

  async function request(path, options = {}) {
    const config = await ensureSessionToken();
    if (!config.enabled) return { ok: false, skipped: true, reason: "cloud-disabled" };

    const headers = {
      "Content-Type": "application/json",
      ...(options.headers || {})
    };
    if (config.apiToken) headers.Authorization = `Bearer ${config.apiToken}`;

    const method = options.method || "GET";
    const timeoutMs = Math.max(2500, Number(options.timeoutMs || (method === "GET" ? 15000 : 30000)));
    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timeoutId = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
    try {
      const response = await fetch(`${config.apiBaseUrl}${path}`, {
        method,
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
        credentials: "include",
        signal: controller?.signal
      });

      const text = await response.text();
      let data = text ? safeJsonParse(text, text) : null;
      if (response.status === 401) {
        const message = "登录状态已失效，请退出工作台后重新登录。";
        data = data && typeof data === "object" ? { ...data, message } : { message };
        window.dispatchEvent(new CustomEvent("jrc-cloud-auth-expired", { detail: { path, status: response.status } }));
      } else if (response.status === 403) {
        const message = "当前账号没有该功能的数据访问权限，请联系管理员开通权限。";
        data = data && typeof data === "object" ? { ...data, message } : { message };
      }
      return {
        ok: response.ok,
        status: response.status,
        data
      };
    } catch (error) {
      const timedOut = error?.name === "AbortError";
      return {
        ok: false,
        status: timedOut ? 408 : 0,
        error: timedOut ? `请求超过 ${Math.round(timeoutMs / 1000)} 秒未返回` : String(error?.message || error)
      };
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  }

  function buildAuditPayload(entry) {
    return {
      siteId: readConfig().siteId,
      moduleKey: entry.module || entry.moduleKey || "unknown",
      actionKey: entry.action || entry.actionKey || "unknown",
      targetType: entry.targetType || null,
      targetId: entry.target || entry.targetId || null,
      summary: entry.summary || "-",
      operatorName: entry.operatorName || "-",
      operatorUsername: entry.operatorUsername || "-",
      operatorRole: entry.operatorRole || "-",
      clientCreatedAt: entry.at || new Date().toISOString(),
      userAgent: navigator.userAgent
    };
  }

  async function writeAuditLog(entry) {
    const payload = buildAuditPayload(entry);
    try {
      const result = await request("/audit-logs", {
        method: "POST",
        body: payload
      });
      if (!result.ok && !result.skipped) enqueue("audit-log", payload);
      return result;
    } catch (error) {
      enqueue("audit-log", payload);
      return { ok: false, error: String(error?.message || error) };
    }
  }

  function buildBackupExportPayload(backup, context = {}) {
    const entries = backup?.entries && typeof backup.entries === "object" ? backup.entries : {};
    return {
      siteId: readConfig().siteId,
      backupVersion: backup?.version || "unknown",
      sourceUrl: backup?.source || window.location.href,
      exportedAt: backup?.exportedAt || new Date().toISOString(),
      exportedByName: context.operator?.name || window.JRC_CURRENT_EMPLOYEE?.name || "-",
      exportedByUsername: context.operator?.username || window.JRC_CURRENT_EMPLOYEE?.username || "-",
      entryCount: Object.keys(entries).length,
      storeKeys: Object.keys(entries)
    };
  }

  async function recordBackupExport(backup, context = {}) {
    const payload = buildBackupExportPayload(backup, context);
    try {
      const result = await request("/backup-exports", {
        method: "POST",
        body: payload
      });
      if (!result.ok && !result.skipped) enqueue("backup-export", payload);
      return result;
    } catch (error) {
      enqueue("backup-export", payload);
      return { ok: false, error: String(error?.message || error) };
    }
  }

  async function listEmployees() {
    return request("/employees");
  }

  async function listPermissions() {
    return request("/permissions");
  }

  async function upsertEmployee(employee = {}, options = {}) {
    return request("/employees", {
      method: "POST",
      body: {
        ...employee,
        resetPassword: Boolean(options.resetPassword)
      }
    });
  }

  async function login(username, password) {
    const config = readConfig();
    if (!config.enabled) return { ok: false, skipped: true, reason: "cloud-disabled" };
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);
    try {
      const response = await fetch(`${config.apiBaseUrl}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
        credentials: "include",
        signal: controller.signal
      });
      const text = await response.text();
      return {
        ok: response.ok,
        status: response.status,
        data: text ? safeJsonParse(text, text) : null
      };
    } catch (error) {
      return { ok: false, error: String(error?.message || error) };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async function changePassword(currentPassword, newPassword) {
    return request("/change-password", {
      method: "POST",
      body: { currentPassword, newPassword }
    });
  }

  async function readModuleData(storeKey) {
    return request(`/module-data?storeKey=${encodeURIComponent(storeKey)}`, { timeoutMs: 15000 });
  }

  async function writeModuleData(storeKey, moduleKey, payload, context = {}) {
    const operator = context.operator || window.JRC_CURRENT_EMPLOYEE || {};
    const body = {
      storeKey,
      moduleKey,
      payload,
      replaceMode: context.replaceMode || "",
      operatorName: operator.name || "-",
      operatorUsername: operator.username || "-"
    };
    let result = null;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      result = await request("/module-data", {
        method: "PUT",
        timeoutMs: context.timeoutMs || 45000,
        body
      });
      if (result?.ok || !isTransientCloudFailure(result) || attempt === 3) break;
      await wait(attempt * 1200);
    }
    if (!result?.ok && !result?.skipped) {
      const queued = enqueue("module-write", body);
      return { ...result, queued };
    }
    return result;
  }

  async function importPaikeFormalSchedule(payload = {}, context = {}) {
    const operator = context.operator || window.JRC_CURRENT_EMPLOYEE || {};
    return request("/paike/formal-import", {
      method: "POST",
      timeoutMs: context.timeoutMs || 45000,
      body: {
        ...payload,
        operatorName: operator.name || "-",
        operatorUsername: operator.username || "-"
      }
    });
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(reader.error || new Error("file read failed"));
      reader.readAsDataURL(file);
    });
  }

  function encodePathSegments(value) {
    return String(value || "")
      .split("/")
      .map((part) => encodeURIComponent(part))
      .join("/");
  }

  async function uploadCurriculumFile(file, metadata = {}) {
    if (!file) return { ok: false, error: "missing-file" };
    const dataUrl = await readFileAsDataUrl(file);
    return request("/curriculum-files", {
      method: "POST",
      body: {
        fileName: file.name,
        contentType: file.type || "application/octet-stream",
        fileSize: file.size,
        dataUrl,
        metadata,
        operatorName: window.JRC_CURRENT_EMPLOYEE?.name || "-",
        operatorUsername: window.JRC_CURRENT_EMPLOYEE?.username || "-"
      }
    });
  }

  async function downloadCurriculumFile(fileRef = {}) {
    const config = await ensureSessionToken();
    if (!config.enabled) return { ok: false, skipped: true, reason: "cloud-disabled" };
    const storageKey = String(fileRef.fileStorageKey || fileRef.storageKey || "").trim();
    const fileUrl = String(fileRef.fileUrl || "").trim();
    let url = "";
    if (storageKey) {
      url = `${config.apiBaseUrl}/curriculum-files/${encodePathSegments(storageKey)}?fileName=${encodeURIComponent(fileRef.fileName || "课程资料")}`;
    } else if (/^https?:\/\//i.test(fileUrl)) {
      url = fileUrl;
    } else if (fileUrl.startsWith("/api/")) {
      url = `${location.origin}${fileUrl}${fileUrl.includes("?") ? "&" : "?"}fileName=${encodeURIComponent(fileRef.fileName || "课程资料")}`;
    } else {
      return { ok: false, error: "missing-file-url" };
    }

    const headers = {};
    if (config.apiToken) headers.Authorization = `Bearer ${config.apiToken}`;
    const response = await fetch(url, {
      method: "GET",
      headers,
      credentials: "include"
    });
    const blob = response.ok ? await response.blob() : null;
    return {
      ok: response.ok,
      status: response.status,
      blob,
      fileName: fileRef.fileName || "课程资料"
    };
  }

  async function aiAssistant(payload = {}) {
    return request("/ai-assistant", {
      method: "POST",
      // The server may retry DeepSeek after a transient timeout. Do not abort the browser request first.
      timeoutMs: 150000,
      body: payload
    });
  }

  async function getSystemDiagnostics() {
    return request("/system-diagnostics", { timeoutMs: 20000 });
  }

  async function flushPending() {
    const rows = readPendingQueue();
    if (!rows.length) return { ok: true, flushed: 0 };

    const remaining = [];
    let flushed = 0;
    for (const row of rows) {
      const moduleWrite = row.kind === "module-write";
      const path = moduleWrite ? "/module-data" : row.kind === "backup-export" ? "/backup-exports" : "/audit-logs";
      try {
        const result = await request(path, { method: moduleWrite ? "PUT" : "POST", timeoutMs: moduleWrite ? 45000 : undefined, body: row.payload });
        if (result.ok) flushed += 1;
        else remaining.push(row);
      } catch {
        remaining.push(row);
      }
    }
    writePendingQueue(remaining);
    return { ok: remaining.length === 0, flushed, remaining: remaining.length };
  }

  window.JRC_CLOUD = {
    readConfig,
    isEnabled: () => readConfig().enabled,
    request,
    writeAuditLog,
    recordBackupExport,
    listEmployees,
    listPermissions,
    upsertEmployee,
    login,
    changePassword,
    readModuleData,
    writeModuleData,
    importPaikeFormalSchedule,
    uploadCurriculumFile,
    downloadCurriculumFile,
    aiAssistant,
    getSystemDiagnostics,
    flushPending
  };

  window.addEventListener("online", () => { flushPending().catch(() => {}); });
  window.setTimeout(() => { flushPending().catch(() => {}); }, 2500);
})();
