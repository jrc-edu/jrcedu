(function () {
  const auditKey = "jrc-business-audit-log-v1";
  const linkEventKey = "jrc-system-link-events-v1";
  const cloudStoreModules = {
    "jrc-student-service-v2": "studentService",
    "jrc-curriculum-products-v2": "curriculum",
    "jrc-hr-training-tasks-v2": "hr",
    "jrc-hr-role-directory-v1": "hr",
    "jrc-campus-operations-v2": "campus",
    "jrc-video-ops-monitor-v1": "videoOps",
    "jrc-suggestion-management-v2": "suggestions"
  };
  const nowText = () => new Date().toLocaleString("zh-CN", { hour12: false });

  function $(id) {
    return document.getElementById(id);
  }

  function readStore(key, fallback) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || "null");
      return Array.isArray(parsed) ? parsed : fallback;
    } catch {
      return fallback;
    }
  }

  function buildRowFingerprint(row) {
    if (!row || typeof row !== "object") return "";
    const fields = [
      row.student,
      row.className,
      row.teacher,
      row.type,
      row.risk,
      row.next,
      row.content,
      row.name,
      row.subject,
      row.grade,
      row.track,
      row.outlineCategory,
      row.teacherName,
      row.season,
      row.lesson,
      row.version,
      row.owner,
      row.note,
      row.formula,
      row.fileName,
      row.employee,
      row.system,
      row.status,
      row.title,
      row.date,
      row.time,
      row.role,
      row.area,
      row.location,
      row.due,
      row.createdAt
    ];
    return fields.map((value) => normalizeText(value)).filter(Boolean).join("|");
  }

  function ensureRowId(row, prefix = "row") {
    if (!row || typeof row !== "object") return row;
    const existing = String(row.rowId || row.id || "").trim();
    if (existing) return { ...row, rowId: existing };
    const seed = buildRowFingerprint(row) || `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    let hash = 0;
    for (let index = 0; index < seed.length; index += 1) {
      hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
    }
    return { ...row, rowId: `${prefix}-${hash.toString(16)}` };
  }

  function mergeRowsById(rows, prefix = "row") {
    const map = new Map();
    const rowTime = (row) => {
      const value = String(row?.updatedAt || row?.createdAt || row?.at || row?.time || row?.date || "").trim();
      const parsed = Date.parse(value.replace(/\./g, "/"));
      return Number.isFinite(parsed) ? parsed : 0;
    };
    (Array.isArray(rows) ? rows : []).forEach((row) => {
      if (!row || typeof row !== "object") return;
      const normalized = ensureRowId(row, prefix);
      const rowId = String(normalized.rowId || "").trim();
      if (!rowId) return;
      const existing = map.get(rowId);
      if (!existing) {
        map.set(rowId, { ...normalized, rowId });
        return;
      }
      const incomingIsNewer = rowTime(normalized) >= rowTime(existing);
      map.set(rowId, incomingIsNewer
        ? { ...existing, ...normalized, rowId }
        : { ...normalized, ...existing, rowId });
    });
    return [...map.values()].sort((left, right) => {
      const rightDate = String(right.updatedAt || right.createdAt || "");
      const leftDate = String(left.updatedAt || left.createdAt || "");
      return rightDate.localeCompare(leftDate);
    });
  }

  function deletedRowsKey(key) {
    return `${key}-deleted-ids-v1`;
  }

  function readDeletedRowIds(key) {
    try {
      const parsed = JSON.parse(localStorage.getItem(deletedRowsKey(key)) || "[]");
      return new Set(Array.isArray(parsed) ? parsed.map((value) => String(value || "").trim()).filter(Boolean) : []);
    } catch {
      return new Set();
    }
  }

  function writeDeletedRowIds(key, ids) {
    const rows = [...ids].map((value) => String(value || "").trim()).filter(Boolean);
    localStorage.setItem(deletedRowsKey(key), JSON.stringify(rows));
    window.JRC_CLOUD?.writeModuleData?.(deletedRowsKey(key), cloudStoreModules[key] || "business", rows, { replaceMode: "replace" }).catch((error) => {
      console.warn("删除标记云端保存失败", key, error);
    });
  }

  function markRowDeleted(key, row) {
    const rowId = String(ensureRowId(row, key)?.rowId || "").trim();
    if (!rowId) return;
    const ids = readDeletedRowIds(key);
    ids.add(rowId);
    writeDeletedRowIds(key, ids);
  }

  function markRowsDeleted(key, rows) {
    const ids = readDeletedRowIds(key);
    (Array.isArray(rows) ? rows : []).forEach((row) => {
      const rowId = String(ensureRowId(row, key)?.rowId || "").trim();
      if (rowId) ids.add(rowId);
    });
    writeDeletedRowIds(key, ids);
  }

  function restoreDeletedRows(key, rows) {
    const ids = readDeletedRowIds(key);
    if (!ids.size) return;
    let changed = false;
    (Array.isArray(rows) ? rows : []).forEach((row) => {
      const rowId = String(ensureRowId(row, key)?.rowId || "").trim();
      if (rowId && ids.delete(rowId)) changed = true;
    });
    if (changed) writeDeletedRowIds(key, ids);
  }

  function filterDeletedRows(key, rows) {
    const ids = readDeletedRowIds(key);
    if (!ids.size) return rows;
    return (Array.isArray(rows) ? rows : []).filter((row) => {
      const rowId = String(ensureRowId(row, key)?.rowId || "").trim();
      return !ids.has(rowId);
    });
  }

  function readLinkEvents() {
    try {
      const parsed = JSON.parse(localStorage.getItem(linkEventKey) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function mergeLinkEvents(...groups) {
    const map = new Map();
    groups.flat().forEach((row) => {
      if (!row || typeof row !== "object") return;
      const fallbackFingerprint = [
        row.source,
        row.target,
        row.action,
        row.count,
        (Array.isArray(row.samples) ? row.samples : []).join("|")
      ].join("::");
      const fingerprint = String(row.fingerprint || fallbackFingerprint).trim();
      const id = String(row.id || fingerprint || row.at || "").trim();
      if (!id && !fingerprint) return;
      const key = fingerprint || id;
      const existing = map.get(key) || {};
      const existingTime = Date.parse(existing.at || "");
      const rowTime = Date.parse(row.at || "");
      const newer = !existing.at || (Number.isFinite(rowTime) && (!Number.isFinite(existingTime) || rowTime >= existingTime));
      map.set(key, newer ? { ...existing, ...row, id, fingerprint: key } : { ...row, ...existing, fingerprint: key });
    });
    return [...map.values()]
      .sort((left, right) => String(right.at || "").localeCompare(String(left.at || "")))
      .slice(0, 200);
  }

  function linkSample(rows, formatter = (row) => row?.student || row?.studentName || row?.title || "") {
    return (Array.isArray(rows) ? rows : [])
      .slice(0, 3)
      .map(formatter)
      .map((value) => normalizeText(value))
      .filter(Boolean);
  }

  function recordLinkEvent({ source, target, action, count = 0, samples = [], status = "已同步", note = "" }) {
    const existingRows = readLinkEvents();
    const fingerprint = [
      source,
      target,
      action,
      count,
      (Array.isArray(samples) ? samples : []).join("|")
    ].join("::");
    const duplicated = existingRows.find((row) => {
      const rowFingerprint = [
        row.source,
        row.target,
        row.action,
        row.count,
        (Array.isArray(row.samples) ? row.samples : []).join("|")
      ].join("::");
      const minutes = (Date.now() - Date.parse(row.at || "")) / 60000;
      return rowFingerprint === fingerprint && Number.isFinite(minutes) && minutes < 10;
    });
    if (duplicated) return duplicated;
    const event = {
      id: `link-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      source,
      target,
      action,
      count,
      fingerprint,
      samples,
      status,
      note,
      operatorName: currentOperator().name || "-",
      operatorUsername: currentOperator().username || "-",
      at: new Date().toISOString()
    };
    const rows = mergeLinkEvents([event], existingRows);
    localStorage.setItem(linkEventKey, JSON.stringify(rows));
    if (window.JRC_CLOUD?.writeModuleData) {
      const writeMerged = (remoteRows = []) => {
        const nextRows = mergeLinkEvents([event], existingRows, remoteRows);
        localStorage.setItem(linkEventKey, JSON.stringify(nextRows));
        return window.JRC_CLOUD.writeModuleData(linkEventKey, "systemLinks", nextRows).catch((error) => {
          console.warn("系统联动日志云端保存失败", error);
          return { ok: false, error };
        });
      };
      if (window.JRC_CLOUD.readModuleData) {
        window.JRC_CLOUD.readModuleData(linkEventKey)
          .then((result) => writeMerged(Array.isArray(result?.data?.payload) ? result.data.payload : []))
          .catch(() => writeMerged([]));
      } else {
        writeMerged([]);
      }
    }
    window.dispatchEvent(new CustomEvent("jrc-system-link-event", { detail: event }));
    return event;
  }

  function effectiveAttendancePresent(row) {
    return ["到课", "迟到"].includes(row?.status) || String(row?.exitScore ?? "").trim() !== "";
  }

  function attendanceFollowupHandled(row) {
    return row?.followupHandled === true || row?.followupStatus === "已处理";
  }

  function attendanceNeedsFollowup(row) {
    return (!effectiveAttendancePresent(row) || row?.followup === "待联系家长") && !attendanceFollowupHandled(row);
  }

  function attendanceRowToStudentService(session, row) {
    const student = normalizeName(row?.studentName || row?.student || "");
    if (!student) return null;
    const status = normalizeText(row?.status || "待核对");
    const exitScore = normalizeText(row?.exitScore || "");
    const followup = normalizeText(row?.followup || "");
    const risk = attendanceNeedsFollowup(row) ? "关注" : "正常";
    const scoreText = exitScore ? `；出门测 ${exitScore}` : "";
    const statusText = `${session.date || "-"} ${session.className || "未填课程"}：${status}${scoreText}`;
    const next = attendanceNeedsFollowup(row)
      ? (followup && followup !== "正常销课并计课时" ? followup : "确认补课/视频课/是否销课")
      : "常规课后反馈";
    return {
      rowId: `att-flow-${session.id || session.date || ""}-${student}`.replace(/\s+/g, ""),
      student,
      className: session.className || "-",
      teacher: session.teacher || row?.teacher || "-",
      type: exitScore ? "学习跟踪" : "课后反馈",
      risk,
      content: statusText,
      next,
      sourceModule: "attendance",
      sourceSessionId: session.id || "",
      sourceDate: session.date || "",
      sourceStatus: status,
      createdAt: session.createdAt || nowText(),
      updatedAt: nowText()
    };
  }

  function admissionLeadToStudentService(lead) {
    const student = normalizeName(lead?.studentName || lead?.name || "");
    if (!student) return null;
    const enrolledAmount = Number(lead?.enrolledAmount || 0);
    const status = normalizeText(lead?.status || "");
    const parentPhone = normalizePhone(lead?.parentPhone || lead?.phone || "");
    const owner = normalizeName(lead?.owner || "");
    const trialTeacher = normalizeName(lead?.trialTeacher || "");
    const className = normalizeName(lead?.grade || lead?.className || "待分班");
    const sourceId = normalizeText(lead?.leadId || lead?.id || `${student}-${parentPhone || owner}`);
    const note = [
      status ? `招生状态：${status}` : "",
      lead?.channel ? `来源：${lead.channel}` : "",
      owner ? `招生/学管：${owner}` : "",
      trialTeacher ? `试听老师：${trialTeacher}` : "",
      enrolledAmount ? `实收/报名金额：${enrolledAmount}` : "",
      parentPhone ? `家长电话：${parentPhone}` : ""
    ].filter(Boolean).join("；");
    return {
      rowId: `adm-flow-${sourceId}`.replace(/\s+/g, ""),
      student,
      className,
      teacher: trialTeacher || owner || "-",
      type: "入学交接",
      risk: "正常",
      content: note || "招生系统已报名学生自动进入学生服务候选。",
      next: "建立学生档案，安排首次家长沟通和正式排课",
      sourceModule: "admissions",
      sourceLeadId: sourceId,
      sourceStatus: status,
      parentPhone,
      channel: normalizeText(lead?.channel || ""),
      admissionsOwner: owner,
      trialTeacher,
      enrolledAmount,
      createdAt: lead?.createdAt || nowText(),
      updatedAt: nowText()
    };
  }

  function readAdmissionsState() {
    try {
      const parsed = JSON.parse(localStorage.getItem("advice-system-stage-prototype") || "{}");
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }

  function syncAdmissionsIntoStudentService(leads, options = {}) {
    const key = "jrc-student-service-v2";
    const incoming = (Array.isArray(leads) ? leads : [])
      .filter((lead) => String(lead?.status || "") === "定金 / 已报名" || Number(lead?.enrolledAmount || 0) > 0)
      .map(admissionLeadToStudentService)
      .filter(Boolean);
    if (!incoming.length) return [];
    const existing = readStore(key, []);
    const merged = mergeRowsById([...incoming, ...existing], key);
    localStorage.setItem(key, JSON.stringify(merged));
    if (window.JRC_CLOUD?.writeModuleData) {
      const writeMerged = (remoteRows = []) => {
        const nextRows = mergeRowsById([...incoming, ...remoteRows, ...existing], key);
        localStorage.setItem(key, JSON.stringify(nextRows));
        return window.JRC_CLOUD.writeModuleData(key, "studentService", nextRows).catch((error) => {
          console.warn("招生联动学生服务云端保存失败", error);
          return { ok: false, error };
        });
      };
      if (window.JRC_CLOUD.readModuleData) {
        window.JRC_CLOUD.readModuleData(key)
          .then((result) => writeMerged(Array.isArray(result?.data?.payload) ? result.data.payload : []))
          .catch(() => writeMerged([]));
      } else {
        writeMerged([]);
      }
    }
    if (options.dispatch !== false) {
      window.dispatchEvent(new CustomEvent("jrc-student-service-linked", {
        detail: { rows: incoming, source: "admissions" }
      }));
    }
    if (options.log !== false) {
      recordLinkEvent({
        source: "招生管理系统",
        target: "学生服务系统",
        action: "报名/实收学生转入学生服务",
        count: incoming.length,
        samples: linkSample(incoming, (row) => `${row.student}${row.className ? `｜${row.className}` : ""}`),
        note: "报名后自动形成入学交接候选，方便学管继续服务。"
      });
    }
    return incoming;
  }

  function syncAttendanceIntoStudentService(sessions, options = {}) {
    const key = "jrc-student-service-v2";
    const incoming = (Array.isArray(sessions) ? sessions : [])
      .flatMap((session) => (Array.isArray(session?.rows) ? session.rows : [])
        .map((row) => attendanceRowToStudentService(session, row)))
      .filter(Boolean);
    if (!incoming.length) return [];
    const existing = readStore(key, []);
    const merged = mergeRowsById([...incoming, ...existing], key);
    localStorage.setItem(key, JSON.stringify(merged));
    if (window.JRC_CLOUD?.writeModuleData) {
      const writeMerged = (remoteRows = []) => {
        const nextRows = mergeRowsById([...incoming, ...remoteRows, ...existing], key);
        localStorage.setItem(key, JSON.stringify(nextRows));
        return window.JRC_CLOUD.writeModuleData(key, "studentService", nextRows).catch((error) => {
          console.warn("点名联动学生服务云端保存失败", error);
          return { ok: false, error };
        });
      };
      if (window.JRC_CLOUD.readModuleData) {
        window.JRC_CLOUD.readModuleData(key)
          .then((result) => writeMerged(Array.isArray(result?.data?.payload) ? result.data.payload : []))
          .catch(() => writeMerged([]));
      } else {
        writeMerged([]);
      }
    }
    if (options.dispatch !== false) {
      window.dispatchEvent(new CustomEvent("jrc-student-service-linked", {
        detail: { rows: incoming, source: "attendance" }
      }));
    }
    if (options.log !== false) {
      recordLinkEvent({
        source: "点名出门测",
        target: "学生服务系统",
        action: "点名记录沉淀为学生服务",
        count: incoming.length,
        samples: linkSample(incoming, (row) => `${row.student}${row.sourceDate ? `｜${row.sourceDate}` : ""}`),
        note: "点名、出门测和缺席追踪进入学生服务，后续可用于学管沟通、课销和课时费核对。"
      });
    }
    return incoming;
  }

  function writeStore(key, rows, options = {}) {
    if (options.restoreDeleted !== false) restoreDeletedRows(key, rows);
    const mergedRows = filterDeletedRows(key, mergeRowsById(rows, key));
    localStorage.setItem(key, JSON.stringify(mergedRows));
    if (cloudStoreModules[key]) writeCloudStore(key, cloudStoreModules[key], mergedRows, options);
  }

  function readCloudStore(key, onRows) {
    if (!window.JRC_CLOUD?.readModuleData) return;
    const deletedTask = window.JRC_CLOUD.readModuleData(deletedRowsKey(key)).then((deletedResult) => {
      if (!deletedResult.ok || !deletedResult.data?.found || !Array.isArray(deletedResult.data.payload)) return;
      const localIds = readDeletedRowIds(key);
      deletedResult.data.payload.forEach((value) => {
        const id = String(value || "").trim();
        if (id) localIds.add(id);
      });
      localStorage.setItem(deletedRowsKey(key), JSON.stringify([...localIds]));
    }).catch((error) => {
      console.warn("删除标记云端读取失败", key, error);
    });
    window.JRC_CLOUD.readModuleData(key).then((result) => {
      if (!result.ok || !result.data?.found || !Array.isArray(result.data.payload)) return;
      deletedTask.finally(() => {
        const localRows = readStore(key, []);
        const mergedRows = filterDeletedRows(key, mergeRowsById([...(Array.isArray(localRows) ? localRows : []), ...result.data.payload], key));
        localStorage.setItem(key, JSON.stringify(mergedRows));
        if (JSON.stringify(mergedRows) !== JSON.stringify(result.data.payload) && mergedRows.length) {
          writeCloudStore(key, cloudStoreModules[key], mergedRows);
        }
        onRows(mergedRows);
      });
    }).catch((error) => {
      console.warn("云端数据读取失败", key, error);
    });
  }

  function writeCloudStore(key, moduleKey, rows, options = {}) {
    if (!window.JRC_CLOUD?.writeModuleData) return;
    const context = options.replaceMode === "replace" || (Array.isArray(rows) && rows.length === 0)
      ? { replaceMode: "replace" }
      : {};
    window.JRC_CLOUD.writeModuleData(key, moduleKey, filterDeletedRows(key, rows), context).catch((error) => {
      console.warn("云端数据保存失败", key, error);
    });
  }

  function hasPermission(permission) {
    if (!permission) return true;
    const operator = window.JRC_CURRENT_EMPLOYEE || {};
    const username = normalizeText(operator.username).toLowerCase();
    const name = normalizeName(operator.name);
    if (["chengzhihao", "czh"].includes(username) || name === "程志豪") return true;
    if (typeof window.jrcHasPermission !== "function") return true;
    return window.jrcHasPermission(permission);
  }

  function isCoreOpsAdmin() {
    const operator = window.JRC_CURRENT_EMPLOYEE || {};
    const username = normalizeText(operator.username).toLowerCase();
    const name = normalizeName(operator.name);
    return ["程志豪", "陈雨晴"].includes(name) || ["chengzhihao", "czh", "chenyuqing"].includes(username);
  }

  function fixedCapabilities(allowed) {
    return {
      create: Boolean(allowed),
      update: Boolean(allowed),
      delete: Boolean(allowed),
      import: Boolean(allowed),
      export: Boolean(allowed),
      reset: Boolean(allowed)
    };
  }

  function moduleCapabilities(moduleKey) {
    const manage = hasPermission(`${moduleKey}.edit`);
    return {
      create: manage || hasPermission(`${moduleKey}.create`),
      update: manage || hasPermission(`${moduleKey}.update`),
      delete: manage || hasPermission(`${moduleKey}.delete`),
      import: manage || hasPermission(`${moduleKey}.import`),
      export: manage || hasPermission(`${moduleKey}.export`),
      reset: manage || hasPermission(`${moduleKey}.reset`)
    };
  }

  function currentOperator() {
    return window.JRC_CURRENT_EMPLOYEE || {
      name: "未登录账号",
      username: "anonymous",
      role: "未知"
    };
  }

  function readAuditLog() {
    try {
      const parsed = JSON.parse(localStorage.getItem(auditKey) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function writeAuditLog(rows) {
    localStorage.setItem(auditKey, JSON.stringify(rows.slice(0, 300)));
  }

  function recordAudit(module, action, target, summary) {
    const operator = currentOperator();
    const entry = {
      module,
      action,
      target: target || "-",
      summary: summary || "-",
      operatorName: operator.name || "-",
      operatorUsername: operator.username || "-",
      operatorRole: operator.role || "-",
      at: nowText()
    };
    writeAuditLog([entry, ...readAuditLog()]);
    window.JRC_CLOUD?.writeAuditLog?.(entry);
  }

  function renderAuditLog(module, tableBodyId) {
    const body = $(tableBodyId);
    if (!body) return;
    const rows = readAuditLog().filter((entry) => entry.module === module).slice(0, 10);
    body.innerHTML = rows.length ? rows.map((entry) => `
      <tr>
        <td>${escapeHtml(entry.at)}</td>
        <td>${escapeHtml(entry.operatorName)}<br>${escapeHtml(entry.operatorRole)}</td>
        <td>${escapeHtml(entry.action)}</td>
        <td>${escapeHtml(entry.target)}</td>
        <td>${escapeHtml(entry.summary)}</td>
      </tr>
    `).join("") : `
      <tr>
        <td colspan="5">暂无操作记录。后续新增、修改、删除、导入或清空都会记录在这里。</td>
      </tr>
    `;
  }

  function denyAction(messageId, action = "修改") {
    setText(messageId, `当前账号暂无${action}权限。请联系管理员调整岗位权限。`);
  }

  function disableControl(id, title = "当前账号暂无权限") {
    const node = $(id);
    if (!node) return;
    node.disabled = true;
    node.style.opacity = "0.55";
    node.style.cursor = "not-allowed";
    node.title = title;
  }

  function applyCapabilityGate({ canWrite, messageId, buttonRules = [], fieldIds = [] }) {
    buttonRules.forEach(([id, allowed, action]) => {
      if (!allowed) disableControl(id, `当前账号暂无${action}权限`);
    });
    if (canWrite) return;
    fieldIds.forEach((id) => disableControl(id, "当前账号暂无新增或修改权限"));
    denyAction(messageId, "新增或修改");
  }

  function normalizeText(value) {
    return String(value ?? "").trim().replace(/\s+/g, " ");
  }

  function normalizeName(value) {
    return normalizeText(value).replace(/[，,。.;；:：]+$/g, "");
  }

  function normalizePhone(value) {
    return String(value ?? "").replace(/[^\d]/g, "");
  }

  function normalizeStatus(value, allowed, fallback) {
    const text = normalizeText(value);
    return allowed.includes(text) ? text : fallback;
  }

  function readField(row, aliases, fallback = "") {
    for (const key of aliases) {
      if (row?.[key] !== undefined && row[key] !== "") return row[key];
    }
    return fallback;
  }

  function parseCsvLine(line, delimiter) {
    const cells = [];
    let current = "";
    let quoted = false;
    for (let index = 0; index < line.length; index += 1) {
      const char = line[index];
      const next = line[index + 1];
      if (char === '"' && quoted && next === '"') {
        current += '"';
        index += 1;
      } else if (char === '"') {
        quoted = !quoted;
      } else if (char === delimiter && !quoted) {
        cells.push(current);
        current = "";
      } else {
        current += char;
      }
    }
    cells.push(current);
    return cells.map((cell) => normalizeText(cell));
  }

  function parseTableText(text) {
    const cleanText = String(text || "").replace(/^\uFEFF/, "").trim();
    if (!cleanText) return [];
    const lines = cleanText.split(/\r?\n/).filter((line) => line.trim());
    if (lines.length < 2) return [];
    const delimiter = lines[0].includes("\t") ? "\t" : ",";
    const headers = parseCsvLine(lines[0], delimiter).map((header) => normalizeText(header));
    return lines.slice(1).map((line) => {
      const cells = parseCsvLine(line, delimiter);
      return headers.reduce((row, header, index) => {
        row[header] = cells[index] || "";
        return row;
      }, {});
    });
  }

  function parseImportedRows(text) {
    const source = String(text || "").trim();
    if (!source) return [];
    try {
      const parsed = JSON.parse(source);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // Fall back to CSV/TSV pasted from Excel.
    }
    return parseTableText(source);
  }

  function bindTableImport({ buttonId, inputId, getRows, setRows, normalizeRow, onDone, onError, canUse = () => true, onDenied = () => {} }) {
    const button = $(buttonId);
    const input = $(inputId);
    if (!button || !input) return;

    button.addEventListener("click", () => {
      if (!canUse()) {
        onDenied();
        return;
      }
      input.click();
    });
    input.addEventListener("change", () => {
      if (!canUse()) {
        onDenied();
        input.value = "";
        return;
      }
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = parseImportedRows(reader.result);
          const imported = parsed.map(normalizeRow).filter(Boolean);
          if (imported.length === 0) throw new Error("No valid rows");
          setRows([...imported, ...getRows()]);
          onDone(imported.length);
        } catch {
          onError();
        } finally {
          input.value = "";
        }
      };
      reader.readAsText(file);
    });
  }

  function guardAction(allowed, messageId, action, callback) {
    if (!allowed) {
      denyAction(messageId, action);
      return;
    }
    callback();
  }

  function injectBusinessModuleStyles() {
    if (document.getElementById("jrcBusinessModuleResponsiveStyles")) return;
    const style = document.createElement("style");
    style.id = "jrcBusinessModuleResponsiveStyles";
    style.textContent = `
      .table-wrap {
        -webkit-overflow-scrolling: touch;
      }
      .table-wrap::after {
        content: "";
        display: block;
        height: 0;
      }
      @media (max-width: 720px) {
        body {
          -webkit-text-size-adjust: 100%;
        }
        .shell {
          width: min(100% - 20px, 1280px) !important;
          padding: 18px 0 34px !important;
        }
        .topbar,
        .card,
        .metric {
          border-radius: 16px !important;
        }
        .topbar,
        .card {
          padding: 16px !important;
        }
        .nav {
          width: 100%;
          flex-wrap: nowrap !important;
          overflow-x: auto;
          padding-bottom: 4px;
          scrollbar-width: thin;
        }
        .nav-link,
        .button {
          min-height: 44px !important;
          white-space: nowrap;
        }
        .actions {
          align-items: stretch !important;
        }
        .actions > input,
        .actions > select,
        .actions > button,
        .actions > a {
          width: 100% !important;
          flex: 1 1 100% !important;
        }
        .section-head {
          align-items: flex-start !important;
          flex-direction: column;
        }
        .table-wrap {
          margin-left: -4px;
          margin-right: -4px;
          border-radius: 12px !important;
          overflow-x: auto;
        }
        table {
          min-width: 720px !important;
        }
        th,
        td {
          padding: 10px !important;
          font-size: 12px !important;
        }
        .field input,
        .field select,
        .field textarea {
          min-height: 46px !important;
          font-size: 16px !important;
        }
        .metric {
          padding: 14px !important;
        }
        .metric strong {
          font-size: 24px !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function setText(id, value) {
    const node = $(id);
    if (node) node.textContent = String(value);
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);
  }

  function downloadJson(filename, data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  function csvCell(value) {
    const text = String(value ?? "");
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }

  function downloadCsv(filename, rows, columns) {
    const header = columns.map((column) => column.label);
    const body = rows.map((row) => columns.map((column) => {
      if (typeof column.value === "function") return column.value(row);
      return row[column.value] ?? "";
    }));
    const csv = [header, ...body].map((line) => line.map(csvCell).join(",")).join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  function formatFileSize(bytes) {
    const value = Number(bytes) || 0;
    if (value >= 1024 * 1024) return `${Math.round((value / 1024 / 1024) * 10) / 10} MB`;
    if (value >= 1024) return `${Math.round(value / 102.4) / 10} KB`;
    return `${value} B`;
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(reader.error || new Error("file read failed"));
      reader.readAsDataURL(file);
    });
  }

  function downloadDataUrl(filename, dataUrl) {
    if (!dataUrl) return;
    const anchor = document.createElement("a");
    anchor.href = dataUrl;
    anchor.download = filename || "课程资料";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  }

  function downloadBlob(filename, blob) {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename || "课程资料";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  function parseDateValue(value) {
    const time = Date.parse(String(value || "").replace(/\//g, "-"));
    return Number.isFinite(time) ? time : 0;
  }

  function formatDateOnly(value) {
    const text = normalizeText(value);
    return text ? text.slice(0, 10) : "";
  }

  function statusRank(value, priority) {
    const text = String(value || "");
    const index = priority.findIndex((item) => text.includes(item));
    return index >= 0 ? index : priority.length;
  }

  function getSortedEntries(rows, keyword, sortValue, statusSelector, priority) {
    return rows
      .map((row, index) => ({ row, index }))
      .filter(({ row }) => rowMatches(row, keyword))
      .sort((left, right) => {
        if (sortValue === "oldest") return parseDateValue(left.row.createdAt) - parseDateValue(right.row.createdAt);
        if (sortValue === "status") {
          return statusRank(statusSelector(left.row), priority) - statusRank(statusSelector(right.row), priority);
        }
        return parseDateValue(right.row.createdAt) - parseDateValue(left.row.createdAt);
      });
  }

  function tag(label, tone = "neutral") {
    const palette = {
      neutral: "background:rgba(23,33,50,0.07); color:#334155;",
      good: "background:rgba(15,118,110,0.10); color:#0f766e;",
      warn: "background:rgba(180,83,9,0.12); color:#b45309;",
      danger: "background:rgba(185,28,28,0.10); color:#b91c1c;",
      info: "background:rgba(37,99,235,0.10); color:#1d4ed8;"
    };
    return `<span style="display:inline-flex; align-items:center; min-height:24px; padding:0 9px; border-radius:999px; font-size:12px; font-weight:800; ${palette[tone] || palette.neutral}">${escapeHtml(label)}</span>`;
  }

  function riskTag(value) {
    if (value === "高风险") return tag(value, "danger");
    if (value === "关注") return tag(value, "warn");
    return tag(value || "正常", "good");
  }

  function workStatusTag(value) {
    if (value === "已完成" || value === "已录入") return tag(value, "good");
    if (value === "处理中") return tag(value, "info");
    if (value === "需复盘") return tag(value, "danger");
    return tag(value || "待处理", "warn");
  }

  function rowMatches(row, keyword) {
    if (!keyword) return true;
    return Object.entries(row).some(([key, value]) => {
      if (key === "fileDataUrl") return false;
      if (key === "fileStorageKey") return false;
      return String(value || "").toLowerCase().includes(keyword);
    });
  }

  function actionButtons(index, capabilities = {}) {
    const buttons = [];
    if (capabilities.update) {
      buttons.push(`<button type="button" data-action="edit" data-index="${index}" style="min-height:30px; padding:0 10px; border-radius:999px; border:1px solid rgba(23,33,50,0.12); background:#fff; color:#172132; cursor:pointer;">编辑</button>`);
    }
    if (capabilities.delete) {
      buttons.push(`<button type="button" data-action="delete" data-index="${index}" style="min-height:30px; padding:0 10px; border-radius:999px; border:1px solid rgba(185,28,28,0.18); background:rgba(185,28,28,0.08); color:#b91c1c; cursor:pointer;">删除</button>`);
    }
    if (buttons.length === 0) return tag("仅查看", "neutral");
    return `
      <div style="display:flex; gap:6px; flex-wrap:wrap;">
        ${buttons.join("")}
      </div>
    `;
  }

  function bindRowActions(tableBodyId, handlers, capabilities = {}, messageId = "") {
    const body = $(tableBodyId);
    if (!body) return;
    body.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-action]");
      if (!button) return;
      const action = button.getAttribute("data-action");
      const index = Number(button.getAttribute("data-index"));
      if (action === "edit") {
        guardAction(capabilities.update, messageId, "修改", () => handlers.onEdit(index));
      }
      if (action === "delete") {
        guardAction(capabilities.delete, messageId, "删除", () => handlers.onDelete(index));
      }
    });
  }

  function initStudentService() {
    if (!$("studentServiceTableBody")) return;
    const moduleKey = "studentService";
    const capabilities = moduleCapabilities(moduleKey);
    const key = "jrc-student-service-v2";
    const attendanceKey = "jrc-class-attendance-v1";
    const scienceTeachers = ["海滢滢", "姚老师", "朱永乐"];
    const defaults = {
      student: "",
      className: "",
      teacher: currentOperator().name || "",
      type: "课后反馈",
      risk: "正常",
      next: "",
      content: ""
    };
    function sanitizeRows(input) {
      return (Array.isArray(input) ? input : []).filter((row) => !["学生 A", "学生 B", "学生 C"].includes(row.student));
    }
    let rows = mergeRowsById(sanitizeRows(readStore(key, [])), key);
    let editingIndex = -1;

    function activeServiceModule() {
      const key = localStorage.getItem("jrc-student-service-active-module-v1") || "cheng";
      return ["cheng", "small", "science"].includes(key) ? key : "cheng";
    }

    function serviceModuleForRow(row = {}) {
      const explicit = String(row.serviceModule || "").trim();
      if (["cheng", "small", "science"].includes(explicit)) return explicit;
      const compact = (value) => String(value || "").replace(/\s+/g, "");
      const teacher = compact(row.teacher || row.teacherName || row.createdBy || row.operatorName || "");
      const text = compact([row.className, row.type, row.content, row.parentMessage, row.sourceText, row.student, row.studentName].filter(Boolean).join(" "));
      if (/程志豪|程老师/.test(teacher) || /程老师|程志豪/.test(text)) return "cheng";
      if (scienceTeachers.map(compact).includes(teacher) || /科学|物理|化学|实验|海滢滢|姚老师|朱永乐/.test(text)) return "science";
      return "small";
    }

    function visibleServiceRows(inputRows = rows) {
      const moduleKey = activeServiceModule();
      return (Array.isArray(inputRows) ? inputRows : []).filter((row) => serviceModuleForRow(row) === moduleKey);
    }

    function visibleServiceEntries(keyword, sortValue) {
      return rows
        .map((row, index) => ({ row, index }))
        .filter(({ row }) => serviceModuleForRow(row) === activeServiceModule())
        .filter(({ row }) => rowMatches(row, keyword))
        .sort((left, right) => {
          if (sortValue === "oldest") return parseDateValue(left.row.createdAt) - parseDateValue(right.row.createdAt);
          if (sortValue === "status") return statusRank(left.row.risk, ["高风险", "关注", "正常"]) - statusRank(right.row.risk, ["高风险", "关注", "正常"]);
          return parseDateValue(right.row.createdAt) - parseDateValue(left.row.createdAt);
        });
    }

    function hydrateFromAttendance() {
      const sessions = readStore(attendanceKey, []);
      const linkedRows = syncAttendanceIntoStudentService(sessions, { dispatch: false, log: false });
      if (linkedRows.length) {
        rows = mergeRowsById(sanitizeRows(readStore(key, [])), key);
      }
      return linkedRows.length;
    }

    function hydrateFromAdmissions() {
      const state = readAdmissionsState();
      const leads = Array.isArray(state.leads) ? state.leads : [];
      const linkedRows = syncAdmissionsIntoStudentService(leads, { dispatch: false, log: false });
      if (linkedRows.length) {
        rows = mergeRowsById(sanitizeRows(readStore(key, [])), key);
      }
      return linkedRows.length;
    }

    function fillForm(row) {
      $("studentNameInput").value = row.student || "";
      $("studentClassInput").value = row.className || "";
      $("studentTeacherInput").value = row.teacher || "";
      $("studentServiceTypeInput").value = row.type || "学习跟踪";
      $("studentRiskInput").value = row.risk || "正常";
      $("studentNextActionInput").value = row.next || "";
      $("studentContentInput").value = row.content || "";
    }

    function resetForm() {
      fillForm(defaults);
      editingIndex = -1;
      setText("studentSaveButton", "保存服务记录");
    }

    function previewText(value, maxLength = 88) {
      const text = normalizeText(value);
      if (text.length <= maxLength) return text;
      return `${text.slice(0, maxLength)}...`;
    }

    function studentFeedbackCell(row, index) {
      const sourceTags = [
        row.sourceModule === "attendance" ? "<br><span style=\"color:#0f766e;font-size:12px;font-weight:800;\">点名流转</span>" : "",
        row.sourceModule === "admissions" ? "<br><span style=\"color:#1d4ed8;font-size:12px;font-weight:800;\">招生转入</span>" : "",
        row.sourceModule === "aiAssistant" ? "<br><span style=\"color:#0f766e;font-size:12px;font-weight:800;\">AI 课堂反馈</span>" : ""
      ].join("");
      const parentMessage = String(row.parentMessage || "").trim();
      const content = String(row.content || "").trim();
      if (!parentMessage) return `${escapeHtml(row.type)}${sourceTags}<br>${escapeHtml(content || "-")}`;
      return `
        ${escapeHtml(row.type)}${sourceTags}
        <details class="feedback-details" style="margin-top:6px;">
          <summary>${escapeHtml(previewText(parentMessage || content, 96) || "查看家长版反馈")}</summary>
          <pre class="feedback-preview">${escapeHtml(parentMessage || content || "-")}</pre>
        </details>
        <button type="button" data-action="copy-parent-message" data-index="${index}" style="margin-top:6px; min-height:30px; padding:0 10px; border-radius:999px; border:1px solid rgba(13,148,136,0.28); background:rgba(13,148,136,0.08); color:#0f766e; cursor:pointer;">复制家长文案</button>
      `;
    }

    function render() {
      const keyword = $("studentFilterInput")?.value.trim().toLowerCase() || "";
      const sortValue = $("studentSortSelect")?.value || "newest";
      const filteredRows = visibleServiceRows();
      const entries = visibleServiceEntries(keyword, sortValue);
      $("studentServiceTableBody").innerHTML = entries.length ? entries
        .map(({ row, index }) => `
          <tr>
            <td>${escapeHtml(row.student)}</td>
            <td>${escapeHtml(row.className)}</td>
            <td>${escapeHtml(row.teacher)}</td>
            <td>${studentFeedbackCell(row, index)}</td>
            <td>${escapeHtml(row.createdAt || "-")}</td>
            <td>${riskTag(row.risk)}</td>
            <td>${escapeHtml(row.next)}</td>
            <td>${actionButtons(index, capabilities)}</td>
          </tr>
        `).join("") : `<tr><td colspan="8">暂无学生服务记录。可以先新增一条真实记录，或把 Excel 另存为 CSV 后导入。</td></tr>`;
      setText("studentMetricTotal", filteredRows.length);
      setText("studentMetricFeedback", filteredRows.filter((row) => row.type === "课后反馈").length);
      setText("studentMetricRisk", filteredRows.filter((row) => row.risk !== "正常").length);
      setText("studentMetricCommunication", filteredRows.filter((row) => row.type === "家长沟通").length);
      renderAuditLog(moduleKey, "studentAuditTableBody");
    }

    $("studentSaveButton")?.addEventListener("click", () => {
      const actionAllowed = editingIndex >= 0 ? capabilities.update : capabilities.create;
      if (!actionAllowed) {
        denyAction("studentServiceMessage", editingIndex >= 0 ? "修改" : "新增");
        return;
      }
      const student = normalizeName($("studentNameInput")?.value);
      if (!student) {
        setText("studentServiceMessage", "请先填写学生姓名。");
        return;
      }
      const payload = {
        student,
        className: normalizeName($("studentClassInput")?.value) || "-",
        teacher: normalizeName($("studentTeacherInput")?.value) || "-",
        type: $("studentServiceTypeInput")?.value || "学习跟踪",
        risk: $("studentRiskInput")?.value || "正常",
        content: normalizeText($("studentContentInput")?.value) || "-",
        next: normalizeText($("studentNextActionInput")?.value) || "-",
        serviceModule: editingIndex >= 0 ? rows[editingIndex].serviceModule || activeServiceModule() : activeServiceModule(),
        parentMessage: editingIndex >= 0 ? rows[editingIndex].parentMessage || "" : "",
        sourceModule: editingIndex >= 0 ? rows[editingIndex].sourceModule || "" : "",
        sourceText: editingIndex >= 0 ? rows[editingIndex].sourceText || "" : "",
        createdBy: editingIndex >= 0 ? rows[editingIndex].createdBy || currentOperator().name || "" : currentOperator().name || "",
        createdAt: editingIndex >= 0 ? rows[editingIndex].createdAt : nowText(),
        updatedAt: nowText()
      };
      if (editingIndex >= 0) {
        rows[editingIndex] = payload;
        recordAudit(moduleKey, "更新", student, `${payload.type} / ${payload.risk}`);
        setText("studentServiceMessage", `已更新 ${student} 的服务记录。`);
      } else {
        rows.unshift(payload);
        recordAudit(moduleKey, "新增", student, `${payload.type} / ${payload.risk}`);
        setText("studentServiceMessage", `已保存 ${student} 的服务记录。`);
      }
      writeStore(key, rows);
      resetForm();
      render();
    });
    $("studentFilterInput")?.addEventListener("input", render);
    $("studentSortSelect")?.addEventListener("change", render);
    window.addEventListener("storage", (event) => {
      if (event.key === "jrc-student-service-active-module-v1") render();
    });
    window.addEventListener("jrc-student-service-module-changed", render);
    $("studentExportButton")?.addEventListener("click", () => guardAction(capabilities.export, "studentServiceMessage", "导出", () => downloadCsv("学生与家长服务数据.csv", visibleServiceRows(), [
      { label: "学生", value: "student" },
      { label: "班级/课程", value: "className" },
      { label: "任课老师", value: "teacher" },
      { label: "服务类型", value: "type" },
      { label: "风险等级", value: "risk" },
      { label: "记录内容", value: "content" },
      { label: "家长版反馈", value: "parentMessage" },
      { label: "下一步", value: "next" },
      { label: "创建时间", value: "createdAt" },
      { label: "更新时间", value: "updatedAt" }
    ])));
    $("studentResetButton")?.addEventListener("click", () => {
      if (!capabilities.reset) {
        denyAction("studentServiceMessage", "清空");
        return;
      }
      const deletingRows = visibleServiceRows();
      markRowsDeleted(key, deletingRows);
      rows = rows.filter((row) => serviceModuleForRow(row) !== activeServiceModule());
      writeStore(key, rows, { restoreDeleted: false });
      recordAudit(moduleKey, "清空", "学生服务台账", `${deletingRows.length} 条`);
      resetForm();
      render();
      setText("studentServiceMessage", "已清空当前服务台台账，其他服务台数据保留。");
    });
    bindRowActions("studentServiceTableBody", {
      onEdit(index) {
        editingIndex = index;
        fillForm(rows[index]);
        setText("studentSaveButton", "保存修改");
        setText("studentServiceMessage", `正在编辑 ${rows[index].student}。`);
      },
      onDelete(index) {
        const removed = rows[index];
        markRowDeleted(key, removed);
        rows.splice(index, 1);
        writeStore(key, rows, { restoreDeleted: false });
        recordAudit(moduleKey, "删除", removed.student, removed.type);
        if (editingIndex === index) resetForm();
        render();
        setText("studentServiceMessage", `已删除 ${removed.student} 的记录。`);
      }
    }, capabilities, "studentServiceMessage");
    $("studentServiceTableBody")?.addEventListener("click", async (event) => {
      const button = event.target.closest("button[data-action='copy-parent-message']");
      if (!button) return;
      const index = Number(button.getAttribute("data-index"));
      const message = rows[index]?.parentMessage || "";
      if (!message) {
        setText("studentServiceMessage", "这条记录没有家长版文案。");
        return;
      }
      try {
        await navigator.clipboard?.writeText(message);
        setText("studentServiceMessage", `已复制 ${rows[index]?.student || "学生"} 的家长版反馈。`);
      } catch {
        setText("studentServiceMessage", "复制失败，可以手动选中文案复制。");
      }
    });
    bindTableImport({
      buttonId: "studentImportButton",
      inputId: "studentImportInput",
      getRows: () => rows,
      setRows(nextRows) {
        rows = nextRows;
        writeStore(key, rows);
        resetForm();
        render();
      },
      normalizeRow(row) {
        const student = normalizeName(readField(row, ["student", "学生", "学生姓名", "姓名"]));
        if (!student) return null;
        return {
          student,
          className: normalizeName(readField(row, ["className", "班级", "课程", "班级 / 课程"], "-")) || "-",
          teacher: normalizeName(readField(row, ["teacher", "老师", "任课老师"], "-")) || "-",
          type: normalizeStatus(readField(row, ["type", "服务类型", "类型"], "学习跟踪"), ["课后反馈", "家长沟通", "续费风险", "学习跟踪"], "学习跟踪"),
          risk: normalizeStatus(readField(row, ["risk", "风险", "风险等级", "续费风险"], "正常"), ["正常", "关注", "高风险"], "正常"),
          content: normalizeText(readField(row, ["content", "记录内容", "最近反馈", "反馈"], "-")) || "-",
          next: normalizeText(readField(row, ["next", "下一步", "跟进事项"], "-")) || "-",
          serviceModule: activeServiceModule(),
          createdAt: String(readField(row, ["createdAt", "创建时间", "时间"], nowText())),
          updatedAt: String(readField(row, ["updatedAt", "更新时间"], nowText()))
        };
      },
      onDone(count) {
        recordAudit(moduleKey, "导入", "学生服务台账", `${count} 条`);
        renderAuditLog(moduleKey, "studentAuditTableBody");
        setText("studentServiceMessage", `已导入 ${count} 条学生服务记录。`);
      },
      onError() {
        setText("studentServiceMessage", "导入失败。请上传 CSV/TSV/JSON；Excel 可以先另存为 CSV。");
      },
      canUse: () => capabilities.import,
      onDenied: () => denyAction("studentServiceMessage", "导入")
    });
    resetForm();
    const linkedCount = hydrateFromAttendance();
    const admissionsLinkedCount = hydrateFromAdmissions();
    render();
    if (linkedCount || admissionsLinkedCount) {
      setText("studentServiceMessage", `已自动联动：点名 ${linkedCount} 条，招生报名 ${admissionsLinkedCount} 条。`);
    }
    window.JRC_CLOUD?.readModuleData?.(attendanceKey).then((result) => {
      const remoteSessions = Array.isArray(result?.data?.payload) ? result.data.payload : [];
      const remoteLinkedCount = syncAttendanceIntoStudentService(remoteSessions, { dispatch: false, log: false }).length;
      if (!remoteLinkedCount) return;
      rows = mergeRowsById(sanitizeRows(readStore(key, [])), key);
      render();
      setText("studentServiceMessage", `已从云端点名同步 ${remoteLinkedCount} 条学生服务记录。`);
    }).catch((error) => {
      console.warn("云端点名联动学生服务读取失败", error);
    });
    window.JRC_CLOUD?.readModuleData?.("advice-system-stage-prototype").then((result) => {
      const remoteLeads = Array.isArray(result?.data?.payload?.leads) ? result.data.payload.leads : [];
      const remoteLinkedCount = syncAdmissionsIntoStudentService(remoteLeads, { dispatch: false, log: false }).length;
      if (!remoteLinkedCount) return;
      rows = mergeRowsById(sanitizeRows(readStore(key, [])), key);
      render();
      setText("studentServiceMessage", `已从云端招生同步 ${remoteLinkedCount} 条入学交接记录。`);
    }).catch((error) => {
      console.warn("云端招生联动学生服务读取失败", error);
    });
    readCloudStore(key, (cloudRows) => {
      rows = mergeRowsById(sanitizeRows(cloudRows), key);
      if (rows.length !== cloudRows.length) writeStore(key, rows);
      hydrateFromAttendance();
      hydrateFromAdmissions();
      rows = mergeRowsById(sanitizeRows(readStore(key, [])), key);
      resetForm();
      render();
      setText("studentServiceMessage", "已同步云端学生服务台账。");
    });
    window.addEventListener("jrc-attendance-saved", (event) => {
      const count = syncAttendanceIntoStudentService([event.detail?.session].filter(Boolean), { dispatch: false, log: false }).length;
      if (!count) return;
      rows = mergeRowsById(sanitizeRows(readStore(key, [])), key);
      render();
      setText("studentServiceMessage", `已从刚保存的点名同步 ${count} 条学生服务记录。`);
    });
    applyCapabilityGate({
      canWrite: capabilities.create || capabilities.update,
      messageId: "studentServiceMessage",
      buttonRules: [["studentSaveButton", capabilities.create || capabilities.update, "新增或修改"], ["studentImportButton", capabilities.import, "导入"], ["studentExportButton", capabilities.export, "导出"], ["studentResetButton", capabilities.reset, "清空"]],
      fieldIds: ["studentNameInput", "studentClassInput", "studentTeacherInput", "studentServiceTypeInput", "studentRiskInput", "studentNextActionInput", "studentContentInput"]
    });
  }

  function initCurriculumProducts() {
    if (!$("curriculumTableBody")) return;
    const moduleKey = "curriculum";
    const baseCapabilities = moduleCapabilities(moduleKey);
    const key = "jrc-curriculum-products-v2";
    const maxCloudFileBytes = 30 * 1024 * 1024;
    const currentEmployee = window.JRC_CURRENT_EMPLOYEE || {};
    const isChengOperator = ["chengzhihao", "czh"].includes(String(currentEmployee.username || "").toLowerCase()) || normalizeName(currentEmployee.name) === "程志豪";
    const capabilities = { ...baseCapabilities, delete: isChengOperator };
    const defaultGradeExpertRules = {
      liudajun: { grades: ["初一", "初二", "初三"], subject: "数学" },
      "刘大君": { grades: ["初一", "初二", "初三"], subject: "数学" },
      zhaoxuan: { grades: ["一年级", "二年级", "三年级", "四年级", "五年级", "六年级"], subject: "数学" },
      "赵萱": { grades: ["一年级", "二年级", "三年级", "四年级", "五年级", "六年级"], subject: "数学" }
    };
    const gradeExpertRules = { ...defaultGradeExpertRules, ...(window.JRC_CURRICULUM_GRADE_EXPERTS || {}) };
    const gradeExpertRule = gradeExpertRules[String(currentEmployee.username || "").toLowerCase()] || gradeExpertRules[String(currentEmployee.name || "").trim()] || null;
    const allGradeOptions = ["一年级", "二年级", "三年级", "四年级", "五年级", "六年级", "初一", "初二", "初三"];
    const defaultOutlineCategory = "普通课程资料";
    const outlineCategoryOptions = [defaultOutlineCategory, "程老师授课大纲", "科学老师授课大纲", "小课老师授课大纲"];
    const teachingOutlineCategories = ["程老师授课大纲", "小课老师授课大纲", "科学老师授课大纲"];
    const seasonOptions = ["春季", "暑假", "秋季", "寒假", "通用"];
    const outlineSeasonFolders = ["暑假", "秋季", "寒假", "春季"];
    const scienceOutlineTeachers = ["海滢滢", "姚老师", "朱永乐"];
    const teacherOutlineGradeDefaults = {
      "程老师": allGradeOptions,
      "程志豪": allGradeOptions,
      "海滢滢": ["一年级", "二年级", "三年级", "四年级", "五年级", "六年级"],
      "姚老师": ["一年级", "二年级", "三年级", "四年级", "五年级", "六年级"],
      "朱永乐": ["初一", "初二", "初三"]
    };
    const teacherOutlineGrades = { ...teacherOutlineGradeDefaults, ...(window.JRC_CURRICULUM_TEACHER_GRADES || {}) };
    const canViewAllGrades = hasPermission("admin.access") || hasPermission("curriculum.edit");
    const isGradeRestricted = !canViewAllGrades;
    const allowedGrades = isGradeRestricted ? (gradeExpertRule?.grades || []) : allGradeOptions;
    const allowedSubject = isGradeRestricted ? String(gradeExpertRule?.subject || "").trim() : "";
    const defaults = {
      name: "",
      subject: "",
      grade: allowedGrades[0] || "一年级",
      outlineCategory: defaultOutlineCategory,
      season: "春季",
      track: "课内体系",
      lesson: "",
      type: "课程大纲",
      classType: "暑假班",
      version: "V1.0",
      teacherName: "",
      owner: "",
      formula: "",
      note: "",
      fileName: "",
      fileType: "",
      fileSize: 0,
      fileDataUrl: "",
      fileUrl: "",
      fileStorageKey: "",
      storageKind: "",
      backupStorageKey: "",
      backupKind: "",
      serverStoragePath: "",
      backupStoragePath: ""
    };

    function normalizeOutlineCategory(value, type = "") {
      const text = normalizeText(value);
      if (outlineCategoryOptions.includes(text)) return text;
      if (text.includes("程老师")) return "程老师授课大纲";
      if (text.includes("科学")) return "科学老师授课大纲";
      if (text.includes("小课")) return "小课老师授课大纲";
      if (normalizeText(type) === "课程大纲") return "小课老师授课大纲";
      return defaultOutlineCategory;
    }

    function normalizeResourceType(value) {
      const text = normalizeText(value);
      if (/大纲/.test(text)) return "课程大纲";
      if (/讲义|word/i.test(text)) return "讲义";
      if (/专题/.test(text)) return "专题资料";
      if (/好题|题库|题目/.test(text)) return "好题资料";
      if (/试卷|测试/.test(text)) return "试卷";
      if (/课件|ppt|pdf/i.test(text)) return "课件";
      if (/答案/.test(text)) return "老师版答案";
      if (/板书/.test(text)) return "板书照片";
      if (["讲义", "专题资料", "好题资料", "试卷", "课件", "课程大纲", "老师版答案", "板书照片", "其他资料"].includes(text)) return text;
      return "其他资料";
    }

    function normalizeSeason(value) {
      const text = normalizeText(value);
      if (seasonOptions.includes(text)) return text;
      if (/春/.test(text)) return "春季";
      if (/暑|夏/.test(text)) return "暑假";
      if (/秋/.test(text)) return "秋季";
      if (/寒|冬/.test(text)) return "寒假";
      return "通用";
    }

    function isTeachingOutline(row) {
      return normalizeOutlineCategory(row?.outlineCategory, row?.type) !== defaultOutlineCategory;
    }

    function teachingTeacherNames() {
      const names = new Set();
      (Array.isArray(window.JRC_EMPLOYEES) ? window.JRC_EMPLOYEES : []).forEach((employee) => {
        if (!String(employee?.role || "").includes("授课老师")) return;
        const name = normalizeName(employee.name);
        if (name) names.add(name);
      });
      rows.forEach((row) => {
        const name = normalizeName(row.teacherName || row.teacher || "");
        if (name) names.add(name);
      });
      return Array.from(names).sort((left, right) => left.localeCompare(right, "zh-CN"));
    }

    function teacherFilterNamesForActiveOutline() {
      if (activeOutlineFilter === "科学老师授课大纲") return scienceOutlineTeachers;
      if (activeOutlineFilter === "小课老师授课大纲") {
        const scienceSet = new Set(scienceOutlineTeachers);
        return teachingTeacherNames().filter((name) => !scienceSet.has(name));
      }
      return [];
    }

    function teacherInputNamesForSelectedOutline() {
      const selectedOutline = normalizeOutlineCategory($("curriculumOutlineCategoryInput")?.value || activeOutlineFilter, "课程大纲");
      if (selectedOutline === "科学老师授课大纲") return scienceOutlineTeachers;
      if (selectedOutline === "小课老师授课大纲") {
        const scienceSet = new Set(scienceOutlineTeachers);
        return teachingTeacherNames().filter((name) => !scienceSet.has(name));
      }
      return teachingTeacherNames();
    }

    function applyTeacherOptions() {
      const names = teacherInputNamesForSelectedOutline();
      const input = $("curriculumTeacherInput");
      if (input) {
        const selected = input.value || "";
        input.innerHTML = `<option value="">按负责人 / 不指定</option>${names.map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("")}`;
        if (selected && names.includes(selected)) input.value = selected;
      }
      const filter = $("curriculumTeacherFilter");
      if (filter) {
        const selected = filter.value || "";
        const filterNames = teacherFilterNamesForActiveOutline();
        filter.innerHTML = `<option value="">全部授课老师</option>${filterNames.map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("")}`;
        if (selected && filterNames.includes(selected)) filter.value = selected;
      }
    }

    function outlineTeacherSelectId(category) {
      if (category === "小课老师授课大纲") return "curriculumSmallOutlineTeacherSelect";
      if (category === "科学老师授课大纲") return "curriculumScienceOutlineTeacherSelect";
      return "";
    }

    function selectedOutlineTeacher(category) {
      const id = outlineTeacherSelectId(category);
      return id ? normalizeName($(id)?.value || "") : "";
    }

    function folderIconHtml() {
      return `<span class="folder-icon" aria-hidden="true"></span>`;
    }

    function folderCount({ category = "", grade = "", teacher = "" } = {}) {
      return rows.filter((row) => {
        if (!rowVisibleToCurrentUser(row)) return false;
        if (category) {
          if (normalizeOutlineCategory(row.outlineCategory, row.type) !== category) return false;
        } else if (isTeachingOutline(row)) {
          return false;
        }
        if (grade && row.grade !== grade) return false;
        if (teacher && normalizeName(row.teacherName || row.owner) !== teacher) return false;
        return true;
      }).length;
    }

    function gradesForTeacherFolder(category, teacher) {
      const options = allowedGrades.length ? allowedGrades : allGradeOptions;
      if (category === "程老师授课大纲") return options;
      if (!teacher) return options;
      const uploadedGrades = rows
        .filter((row) => rowVisibleToCurrentUser(row))
        .filter((row) => normalizeOutlineCategory(row.outlineCategory, row.type) === category)
        .filter((row) => normalizeName(row.teacherName || row.owner) === teacher)
        .map((row) => row.grade)
        .filter((grade) => options.includes(grade));
      const uploadedUnique = [...new Set(uploadedGrades)];
      if (uploadedUnique.length) return uploadedUnique;
      const configured = teacherOutlineGrades[teacher] || teacherOutlineGrades[normalizeName(teacher)];
      const teacherGrades = Array.isArray(configured) && configured.length ? configured : [];
      return teacherGrades.filter((grade) => options.includes(grade));
    }

    function setActiveFolderLabel(label) {
      activeFolderLabel = label || "请先点击上方文件夹入口。";
      const node = $("curriculumFolderBreadcrumb");
      if (node) node.innerHTML = `<strong>当前文件夹</strong><span>${escapeHtml(activeFolderLabel)}</span>`;
    }

    function renderOutlineTeacherSelectors() {
      [
        ["小课老师授课大纲", "curriculumSmallOutlineTeacherSelect", "全部小课老师"],
        ["科学老师授课大纲", "curriculumScienceOutlineTeacherSelect", "全部科学老师"]
      ].forEach(([category, id, label]) => {
        const select = $(id);
        if (!select) return;
        const selected = select.value || "";
        const previousActive = activeOutlineFilter;
        activeOutlineFilter = category;
        const names = teacherFilterNamesForActiveOutline();
        activeOutlineFilter = previousActive;
        select.innerHTML = `<option value="">${escapeHtml(label)}</option>${names.map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("")}`;
        if (selected && names.includes(selected)) select.value = selected;
      });
    }

    function renderOutlineGradeDirectories() {
      teachingOutlineCategories.forEach((category) => {
        document.querySelectorAll(`[data-outline-grade-board="${category}"]`).forEach((board) => {
          const teacher = selectedOutlineTeacher(category);
          const teacherText = category === "程老师授课大纲"
            ? "程老师"
            : teacher || (category === "科学老师授课大纲" ? "全部科学老师" : "全部小课老师");
          const options = gradesForTeacherFolder(category, teacher);
          board.innerHTML = options.length ? options.map((grade) => `
            <button class="resource-tree-item" type="button" data-outline-grade-entry="${escapeHtml(category)}" data-outline-grade="${escapeHtml(grade)}">
              ${folderIconHtml()}
              <span><strong>${escapeHtml(grade)}</strong><br>${escapeHtml(teacherText)} / ${escapeHtml(category)} / ${folderCount({ category, grade, teacher })} 条</span>
            </button>
          `).join("") : `<div class="resource-tree-item">${folderIconHtml()}<span><strong>暂无年级文件夹</strong><br>这个老师暂未配置或上传年级大纲。</span></div>`;
        });
      });
    }

    function setOutlinePanel(category) {
      const normalized = normalizeOutlineCategory(category, "课程大纲");
      document.querySelectorAll("[data-outline-tab]").forEach((button) => {
        button.classList.toggle("active", normalizeOutlineCategory(button.getAttribute("data-outline-tab"), "课程大纲") === normalized);
      });
      document.querySelectorAll("[data-outline-panel]").forEach((panel) => {
        panel.hidden = normalizeOutlineCategory(panel.getAttribute("data-outline-panel"), "课程大纲") !== normalized;
      });
      renderOutlineTeacherSelectors();
      renderOutlineGradeDirectories();
    }

    function updateCurriculumFilterControls() {
      const teacherFilter = $("curriculumTeacherFilter");
      if (!teacherFilter) return;
      const shouldShowTeacherFilter = ["小课老师授课大纲", "科学老师授课大纲"].includes(activeOutlineFilter);
      teacherFilter.hidden = !shouldShowTeacherFilter;
      if (!shouldShowTeacherFilter) {
        teacherFilter.value = "";
        activeOutlineTeacherFilter = "";
      }
      applyTeacherOptions();
    }

    function isImageFile(row = {}) {
      const fileType = String(row.fileType || "").toLowerCase();
      const fileName = String(row.fileName || "").toLowerCase();
      return fileType.startsWith("image/") || /\.(png|jpe?g|gif|webp|bmp|svg|heic|heif)$/i.test(fileName);
    }

    function parseVersionValue(version) {
      const match = String(version || "").match(/(\d+(?:\.\d+)?)/);
      return match ? Number(match[1]) : 0;
    }

    function latestVersionEntries(entries) {
      const latestMap = new Map();
      entries.forEach((entry) => {
        const keyText = curriculumDuplicateKey(entry.row, entry.row.fileName);
        const existing = latestMap.get(keyText);
        if (!existing) {
          latestMap.set(keyText, entry);
          return;
        }
        const leftVersion = parseVersionValue(entry.row.version);
        const rightVersion = parseVersionValue(existing.row.version);
        const leftDate = parseDateValue(entry.row.updatedAt || entry.row.createdAt);
        const rightDate = parseDateValue(existing.row.updatedAt || existing.row.createdAt);
        if (leftVersion > rightVersion || (leftVersion === rightVersion && leftDate >= rightDate)) {
          latestMap.set(keyText, entry);
        }
      });
      return Array.from(latestMap.values());
    }

    function sanitizeRows(input) {
      const oldSeedNames = ["暑假数学提升课", "初一数学衔接课", "科学专题课"];
      return (Array.isArray(input) ? input : [])
        .filter((row) => !oldSeedNames.includes(row.name))
        .map((row) => ({
          ...row,
          outlineCategory: normalizeOutlineCategory(row.outlineCategory || row.outlineType || row.category, row.type),
          season: normalizeSeason(row.season || row.term || row.classType),
          teacherName: normalizeName(row.teacherName || row.teacher || row.instructor || ""),
          formula: normalizeText(row.formula || row.keyFormula || row.corePoints || ""),
          type: normalizeResourceType(row.type)
        }));
    }
    let rows = mergeRowsById(sanitizeRows(readStore(key, [])), key);
    let editingIndex = -1;
    let activeOutlineFilter = "";
    let activeOutlineTeacherFilter = "";
    let activeFolderLabel = "请先点击上方文件夹入口。";
    let activeFolderUploadContext = null;
    let activeFolderModalTitle = "文件夹内容";
    let curriculumPreviewObjectUrl = "";
    let curriculumPreviewZoom = 1;

    function gradeScopeText() {
      if (!isGradeRestricted) return "当前账号可查看全部年级课程资料。";
      if (!allowedGrades.length) return "当前账号还没有配置教研课程年级范围，请联系校区运营与人事系统管理员。";
      return `当前账号仅开放：${allowedGrades.join("、")}${allowedSubject ? `｜${allowedSubject}` : ""}。`;
    }

    function subjectMatchesScope(row) {
      if (!allowedSubject) return true;
      const subjectText = String(row.subject || "").trim();
      return Boolean(subjectText && subjectText !== "-" && subjectText.includes(allowedSubject));
    }

    function rowVisibleToCurrentUser(row) {
      if (!isGradeRestricted) return true;
      if (!allowedGrades.length) return false;
      return allowedGrades.includes(row.grade) && subjectMatchesScope(row);
    }

    function normalizeSubjectForScope(value, grade) {
      const text = normalizeText(value);
      if (!isGradeRestricted || !allowedSubject) return text || "-";
      return `${allowedSubject} / ${grade}`;
    }

    function applyGradeOptions() {
      const select = $("curriculumGradeInput");
      const options = allowedGrades.length ? allowedGrades : allGradeOptions;
      if (select) {
        select.innerHTML = options.map((grade) => `<option>${escapeHtml(grade)}</option>`).join("");
        select.disabled = isGradeRestricted && allowedGrades.length === 0;
      }
      const gradeFilter = $("curriculumGradeFilter");
      if (gradeFilter) {
        gradeFilter.innerHTML = `<option value="">全部年级</option>${options.map((grade) => `<option>${escapeHtml(grade)}</option>`).join("")}`;
      }
      const board = $("curriculumDirectoryBoard");
      if (board) {
        board.innerHTML = options.length
          ? options.map((grade) => `<button class="resource-tree-item" type="button" data-curriculum-grade-dir="${escapeHtml(grade)}">${folderIconHtml()}<span><strong>${escapeHtml(grade)}</strong><br>课程资料库 / ${folderCount({ grade })} 条</span></button>`).join("")
          : `<div class="resource-tree-item">${folderIconHtml()}<span><strong>暂无年级文件夹</strong><br>当前账号还没有配置负责年级。</span></div>`;
      }
      renderOutlineTeacherSelectors();
      renderOutlineGradeDirectories();
    }

    function visibleRows() {
      return rows.filter(rowVisibleToCurrentUser);
    }

    function fillForm(row) {
      $("curriculumNameInput").value = row.name || "";
      const grade = allowedGrades.includes(row.grade) || !isGradeRestricted ? (row.grade || allowedGrades[0] || "一年级") : (allowedGrades[0] || "一年级");
      $("curriculumSubjectInput").value = row.subject || (allowedSubject && grade ? `${allowedSubject} / ${grade}` : "");
      if ($("curriculumGradeInput")) $("curriculumGradeInput").value = grade;
      if ($("curriculumOutlineCategoryInput")) $("curriculumOutlineCategoryInput").value = normalizeOutlineCategory(row.outlineCategory, row.type);
      if ($("curriculumTeacherInput")) $("curriculumTeacherInput").value = row.teacherName || "";
      if ($("curriculumSeasonInput")) $("curriculumSeasonInput").value = normalizeSeason(row.season || row.classType);
      if ($("curriculumTrackInput")) $("curriculumTrackInput").value = row.track || "课内体系";
      $("curriculumTypeInput").value = row.type || "备课资料";
      $("curriculumClassTypeInput").value = row.classType || "";
      if ($("curriculumLessonInput")) $("curriculumLessonInput").value = row.lesson || "";
      $("curriculumVersionInput").value = row.version || "V1.0";
      $("curriculumOwnerInput").value = row.owner || currentEmployee.name || "";
      if ($("curriculumFormulaInput")) $("curriculumFormulaInput").value = row.formula || "";
      $("curriculumNoteInput").value = row.note || "";
      if ($("curriculumFileInput")) $("curriculumFileInput").value = "";
      renderFilePreview(row);
    }

    function resetForm() {
      fillForm(defaults);
      editingIndex = -1;
      setText("curriculumSaveButton", "保存课程资料");
    }

    function renderFilePreview(row = {}) {
      const preview = $("curriculumFilePreview");
      if (!preview) return;
      if (row.fileName) {
        preview.textContent = `当前文件：${row.fileName}（${formatFileSize(row.fileSize)}）。重新选择文件后会更新版本。`;
        return;
      }
      preview.textContent = "尚未选择文件。";
    }

    function closeCurriculumPreview() {
      const modal = $("curriculumPreviewModal");
      const image = $("curriculumPreviewImage");
      if (modal) modal.setAttribute("aria-hidden", "true");
      if (image) image.removeAttribute("src");
      curriculumPreviewZoom = 1;
      if (curriculumPreviewObjectUrl) {
        URL.revokeObjectURL(curriculumPreviewObjectUrl);
        curriculumPreviewObjectUrl = "";
      }
    }

    function applyCurriculumPreviewZoom() {
      const image = $("curriculumPreviewImage");
      if (!image) return;
      image.style.width = `${Math.round(curriculumPreviewZoom * 100)}%`;
      image.style.margin = "0 auto";
      image.style.display = "block";
    }

    function setCurriculumPreviewZoom(nextZoom) {
      curriculumPreviewZoom = Math.min(4, Math.max(0.5, nextZoom));
      applyCurriculumPreviewZoom();
    }

    async function previewCurriculumImage(row, button) {
      if (!row?.fileName) {
        setText("curriculumMessage", "这条资料还没有上传图片。");
        return;
      }
      if (!isImageFile(row)) {
        setText("curriculumMessage", "当前文件不是图片，建议下载后查看。");
        return;
      }
      const modal = $("curriculumPreviewModal");
      const image = $("curriculumPreviewImage");
      const title = $("curriculumPreviewTitle");
      if (!modal || !image) return;
      closeCurriculumPreview();
      if (title) title.textContent = row.fileName || "图片预览";
      setCurriculumPreviewZoom(1);
      if (row.fileDataUrl) {
        image.src = row.fileDataUrl;
        image.onload = applyCurriculumPreviewZoom;
        modal.setAttribute("aria-hidden", "false");
        setText("curriculumMessage", `正在预览 ${row.fileName}。`);
        return;
      }
      if (!window.JRC_CLOUD?.downloadCurriculumFile) {
        setText("curriculumMessage", "当前环境暂时不能预览云端图片。");
        return;
      }
      try {
        if (button) button.disabled = true;
        setText("curriculumMessage", `正在加载图片 ${row.fileName}...`);
        const result = await window.JRC_CLOUD.downloadCurriculumFile(row);
        if (!result.ok || !result.blob) {
          setText("curriculumMessage", "图片加载失败，请刷新后重试。");
          return;
        }
        curriculumPreviewObjectUrl = URL.createObjectURL(result.blob);
        image.src = curriculumPreviewObjectUrl;
        image.onload = applyCurriculumPreviewZoom;
        modal.setAttribute("aria-hidden", "false");
        setText("curriculumMessage", `正在预览 ${row.fileName}。`);
      } catch (error) {
        setText("curriculumMessage", error.message || "图片预览失败。");
      } finally {
        if (button) button.disabled = false;
      }
    }

    function fileBaseName(fileName) {
      return normalizeText(String(fileName || "").replace(/\.[^.]+$/g, "")) || "未命名资料";
    }

    function curriculumDuplicateKey(row, fileName = row?.fileName || "") {
      const logicalName = normalizeText(row?.name) || fileBaseName(fileName);
      return [
        row?.grade,
        row?.outlineCategory,
        row?.teacherName,
        row?.season,
        row?.track,
        row?.type,
        row?.lesson,
        logicalName
      ].map((value) => normalizeText(value).toLowerCase()).join("|");
    }

    function rowMatchesCurriculumFilters(row) {
      const outlineFilter = activeOutlineFilter || $("curriculumOutlineFilter")?.value || "";
      const teacherFilter = ["小课老师授课大纲", "科学老师授课大纲"].includes(activeOutlineFilter)
        ? (activeOutlineTeacherFilter || $("curriculumTeacherFilter")?.value || "")
        : "";
      const seasonFilter = $("curriculumSeasonFilter")?.value || "";
      const gradeFilter = $("curriculumGradeFilter")?.value || "";
      if (outlineFilter && normalizeOutlineCategory(row.outlineCategory, row.type) !== outlineFilter) return false;
      if (teacherFilter && normalizeName(row.teacherName || row.owner) !== teacherFilter) return false;
      if (seasonFilter && normalizeSeason(row.season || row.classType) !== seasonFilter) return false;
      if (gradeFilter && row.grade !== gradeFilter) return false;
      return true;
    }

    function bumpVersion(version) {
      const text = normalizeText(version) || "V1.0";
      const match = text.match(/^v?(\d+)(?:\.(\d+))?$/i);
      if (!match) return `${text}-新版`;
      const major = Number(match[1] || 1);
      const minor = Number(match[2] || 0) + 1;
      return `V${major}.${minor}`;
    }

    function findDuplicateCurriculumIndex(payload, fileName) {
      const keyText = curriculumDuplicateKey(payload, fileName);
      return rows.findIndex((row, index) => index !== editingIndex && curriculumDuplicateKey(row, row.fileName) === keyText);
    }

    function curriculumServerFilePath(row = {}) {
      if (row.serverStoragePath) return row.serverStoragePath;
      return row.fileStorageKey ? `/opt/jrcedu-uploads/${row.fileStorageKey}` : "";
    }

    function curriculumBackupFilePath(row = {}) {
      if (row.backupStoragePath) return row.backupStoragePath;
      return row.backupStorageKey ? `/opt/jrcedu-backups/curriculum/${row.backupStorageKey}` : "";
    }

    function shellQuoted(value) {
      return String(value || "").replace(/(["\\$`])/g, "\\$1");
    }

    function curriculumCopyCommand(row = {}) {
      const source = curriculumServerFilePath(row);
      if (!source) return "";
      const targetName = row.fileName || "课程资料";
      return `sudo cp "${shellQuoted(source)}" "/目标文件夹/${shellQuoted(targetName)}"`;
    }

    function fileStorageTags(row = {}) {
      if (row.storageKind === "ecs-file") {
        return row.backupStorageKey || row.backupStoragePath
          ? `${tag("服务器已备份", "good")}`
          : `${tag("服务器已上传", "info")}`;
      }
      if (row.fileDataUrl) return `${tag("旧本地资料", "warn")}`;
      return "";
    }

    function curriculumUploadStorageMessage(uploadedRows = []) {
      const serverRows = uploadedRows.filter((row) => row?.fileStorageKey);
      if (!serverRows.length) return "";
      const lines = [
        `本次 ${serverRows.length} 份文件已上传服务器，并已生成即时备份。`
      ];
      if (!isChengOperator) {
        lines.push("服务器已完成保存和即时备份；如需拷贝服务器原文件，请联系程老师或管理员。");
        return lines.join("\n");
      }
      serverRows.slice(0, 3).forEach((row, index) => {
        lines.push(`${index + 1}. ${row.fileName || "课程资料"}`);
        lines.push(`主文件：${curriculumServerFilePath(row)}`);
        lines.push(`即时备份：${curriculumBackupFilePath(row) || "/opt/jrcedu-backups/curriculum/live"}`);
      });
      if (serverRows.length > 3) lines.push(`其余 ${serverRows.length - 3} 份文件同样已按年级、体系和月份存入服务器。`);
      lines.push("每日压缩备份目录：/opt/jrcedu-backups/curriculum");
      lines.push("程老师拷贝方法：");
      serverRows.slice(0, 3).forEach((row) => lines.push(curriculumCopyCommand(row)));
      lines.push("把 /目标文件夹/ 替换成要拷贝到的真实目录；也可以在网页里点“下载”或“打开图片”后另存。");
      return lines.join("\n");
    }

    async function selectedFilePayload(existing = {}, metadata = {}, fileOverride = null) {
      const file = fileOverride || $("curriculumFileInput")?.files?.[0];
      if (!file) {
        return {
          fileName: existing.fileName || "",
          fileType: existing.fileType || "",
          fileSize: existing.fileSize || 0,
          fileDataUrl: existing.fileDataUrl || "",
          fileUrl: existing.fileUrl || "",
          fileStorageKey: existing.fileStorageKey || "",
          storageKind: existing.storageKind || "",
          backupStorageKey: existing.backupStorageKey || "",
          backupKind: existing.backupKind || "",
          backupCreatedAt: existing.backupCreatedAt || "",
          serverStoragePath: existing.serverStoragePath || "",
          backupStoragePath: existing.backupStoragePath || ""
        };
      }
      if (!window.JRC_CLOUD?.isEnabled?.() || !window.JRC_CLOUD?.uploadCurriculumFile) {
        throw new Error("资料必须先上传并备份到服务器。当前云端上传未连接，请刷新页面或联系管理员后重试。");
      }
      if (file.size > maxCloudFileBytes) {
        throw new Error(`文件超过 ${formatFileSize(maxCloudFileBytes)}。请先压缩或拆分后上传。`);
      }
      setText("curriculumMessage", `正在上传并即时备份 ${file.name}...`);
      let result = null;
      try {
        result = await window.JRC_CLOUD.uploadCurriculumFile(file, metadata);
      } catch (error) {
        throw new Error(`资料必须先备份到服务器。本次云端上传失败：${error?.message || error}。请检查网络或联系管理员后重试。`);
      }
      if (!result.ok || !result.data?.file) {
        const message = result.data?.message || result.data?.error || result.error || `HTTP ${result.status || "-"}`;
        throw new Error(`资料必须先备份到服务器。本次云端上传失败：${message}。请检查网络或联系管理员后重试。`);
      }
      const uploaded = result.data.file;
      return {
        ...uploaded,
        fileDataUrl: "",
        serverStoragePath: curriculumServerFilePath(uploaded),
        backupStoragePath: curriculumBackupFilePath(uploaded)
      };
    }

    function fileCell(row, index) {
      if (!row.fileName) return `${tag("未上传", "neutral")}`;
      const canDownload = row.fileDataUrl || row.fileStorageKey || row.fileUrl;
      if (!canDownload) return `<div style="display:grid; gap:6px;">${tag("待上传", "warn")}<span>${escapeHtml(row.fileName)}</span></div>`;
      const storageTags = fileStorageTags(row);
      if (isImageFile(row)) {
        return `
          <div style="display:grid; gap:6px;">
            <button type="button" data-preview-curriculum="${index}" style="min-height:30px; padding:0 10px; border-radius:999px; border:1px solid rgba(37,99,235,0.18); background:rgba(37,99,235,0.10); color:#1d4ed8; cursor:pointer;">打开图片</button>
            <span>${escapeHtml(row.fileName)}</span>
            <small>${formatFileSize(row.fileSize)}</small>
            ${storageTags ? `<div>${storageTags}</div>` : ""}
          </div>
        `;
      }
      return `
        <div style="display:grid; gap:6px;">
          <button type="button" data-download-curriculum="${index}" style="min-height:30px; padding:0 10px; border-radius:999px; border:1px solid rgba(37,99,235,0.18); background:rgba(37,99,235,0.10); color:#1d4ed8; cursor:pointer;">下载</button>
          <span>${escapeHtml(row.fileName)}</span>
          <small>${formatFileSize(row.fileSize)}</small>
          ${storageTags ? `<div>${storageTags}</div>` : ""}
        </div>
      `;
    }

    function curriculumDeleteBlockedMessage() {
      return "课程资料上传后不能直接删除。如果要改进教案，请更新版本后重新放入；如果是误传需要删除，请联系管理员。只有程老师有权限删除。";
    }

    function curriculumEntries({ keyword = "", sortValue = "newest" } = {}) {
      const normalizedKeyword = String(keyword || "").trim().toLowerCase();
      return latestVersionEntries(rows
        .map((row, index) => ({ row, index }))
        .filter(({ row }) => rowVisibleToCurrentUser(row))
        .filter(({ row }) => rowMatchesCurriculumFilters(row))
        .filter(({ row }) => rowMatches(row, normalizedKeyword)))
        .sort((left, right) => {
          if (sortValue === "oldest") return parseDateValue(left.row.createdAt) - parseDateValue(right.row.createdAt);
          if (sortValue === "status") {
            return statusRank(left.row.status, ["待导入", "待整理", "待上传", "已录入"]) - statusRank(right.row.status, ["待导入", "待整理", "待上传", "已录入"]);
          }
          return parseDateValue(right.row.createdAt) - parseDateValue(left.row.createdAt);
        });
    }

    function curriculumRowHtml(row, index) {
      return `
        <tr>
          <td>${escapeHtml(row.grade || "-")}<br>${tag(normalizeSeason(row.season || row.classType), "neutral")}<br>${tag(row.track || "未分体系", "info")}</td>
          <td>${tag(normalizeOutlineCategory(row.outlineCategory, row.type), isTeachingOutline(row) ? "good" : "neutral")}</td>
          <td><strong>${escapeHtml(row.name)}</strong><br>${escapeHtml(row.subject)}</td>
          <td>${tag(row.type, "info")}<br>${escapeHtml(row.classType)}</td>
          <td>${escapeHtml(row.lesson || "-")}<br>${escapeHtml(row.version)}</td>
          <td>${fileCell(row, index)}</td>
          <td>${escapeHtml(row.teacherName || row.owner || "-")}${row.teacherName && row.owner && row.teacherName !== row.owner ? `<br><span style="color:#94a3b8;">负责人：${escapeHtml(row.owner)}</span>` : ""}</td>
          <td>${row.formula ? `<strong>公式重点</strong><br>${escapeHtml(row.formula)}<br>` : ""}${escapeHtml(row.note)}</td>
          <td>${curriculumActionButtons(index)}</td>
        </tr>
      `;
    }

    function curriculumEmptyMessage() {
      return isGradeRestricted && !allowedGrades.length ? "当前账号还没有配置负责年级。" : "当前负责范围内暂无课程资料。";
    }

    function curriculumRowsHtml(entries, emptyMessage = curriculumEmptyMessage()) {
      return entries.length
        ? entries.map(({ row, index }) => curriculumRowHtml(row, index)).join("")
        : `<tr><td colspan="9">${escapeHtml(emptyMessage)}</td></tr>`;
    }

    function folderImageSrc(row = {}) {
      if (!isImageFile(row)) return "";
      if (row.fileDataUrl) return row.fileDataUrl;
      const fileUrl = String(row.fileUrl || "").trim();
      if (fileUrl.startsWith("/")) return fileUrl;
      return "";
    }

    function fileExtensionLabel(row = {}) {
      const fileName = String(row.fileName || row.name || "");
      const extension = fileName.includes(".") ? fileName.split(".").pop() : "";
      if (extension) return extension.slice(0, 5).toUpperCase();
      if (isImageFile(row)) return "IMG";
      return "FILE";
    }

    function curriculumFolderAdminButtons(index) {
      const buttons = [];
      if (capabilities.update) {
        buttons.push(`<button type="button" data-action="edit" data-index="${index}">编辑</button>`);
      }
      if (capabilities.delete) {
        buttons.push(`<button type="button" data-action="delete" data-index="${index}">删除</button>`);
      }
      return buttons.length ? `<div class="folder-file-admin">${buttons.join("")}</div>` : "";
    }

    function curriculumFileCardHtml(row, index) {
      const imageSrc = folderImageSrc(row);
      const fileName = row.fileName || row.name || "未命名资料";
      const openButton = isImageFile(row)
        ? `<button type="button" data-preview-curriculum="${index}">打开</button>`
        : "";
      const thumb = imageSrc
        ? `<button class="folder-file-thumb" type="button" data-preview-curriculum="${index}" aria-label="打开 ${escapeHtml(fileName)}"><img src="${escapeHtml(imageSrc)}" alt="${escapeHtml(fileName)}"></button>`
        : `<button class="folder-file-thumb" type="button" ${isImageFile(row) ? `data-preview-curriculum="${index}"` : `data-download-curriculum="${index}"`} aria-label="${isImageFile(row) ? "打开" : "下载"} ${escapeHtml(fileName)}"><span class="folder-file-icon"><span>${escapeHtml(fileExtensionLabel(row))}</span></span></button>`;
      return `
        <article class="folder-file-card">
          ${thumb}
          <div class="folder-file-name">${escapeHtml(fileName)}</div>
          <div class="folder-file-size">${row.fileSize ? escapeHtml(formatFileSize(row.fileSize)) : "文件"}</div>
          <div class="folder-file-actions">
            ${openButton}
            <button type="button" data-download-curriculum="${index}">下载</button>
          </div>
          ${curriculumFolderAdminButtons(index)}
        </article>
      `;
    }

    function curriculumFileCardsHtml(entries, emptyMessage = "这个文件夹里还没有资料。") {
      return entries.length
        ? entries.map(({ row, index }) => curriculumFileCardHtml(row, index)).join("")
        : `<div class="folder-empty">${escapeHtml(emptyMessage)}</div>`;
    }

    function curriculumActionButtons(index) {
      const buttons = [];
      if (capabilities.update) {
        buttons.push(`<button type="button" data-action="edit" data-index="${index}" style="min-height:30px; padding:0 10px; border-radius:999px; border:1px solid rgba(23,33,50,0.12); background:#fff; color:#172132; cursor:pointer;">编辑</button>`);
      }
      if (capabilities.delete) {
        buttons.push(`<button type="button" data-action="delete" data-index="${index}" style="min-height:30px; padding:0 10px; border-radius:999px; border:1px solid rgba(185,28,28,0.18); background:rgba(185,28,28,0.08); color:#b91c1c; cursor:pointer;">删除</button>`);
      }
      return buttons.length
        ? `<div style="display:flex; gap:6px; flex-wrap:wrap;">${buttons.join("")}</div>`
        : tag("仅查看", "neutral");
    }

    function folderContextNeedsTeacher(context = {}) {
      if (!normalizeText(context.category)) return false;
      return ["小课老师授课大纲", "科学老师授课大纲"].includes(normalizeOutlineCategory(context.category, ""));
    }

    function folderContextIsOutline(context = {}) {
      if (!normalizeText(context.category)) return false;
      return normalizeOutlineCategory(context.category, "") !== defaultOutlineCategory;
    }

    function folderContextNeedsSeason(context = {}) {
      if (!folderContextIsOutline(context)) return false;
      return !outlineSeasonFolders.includes(normalizeSeason(context.season || ""));
    }

    function renderCurriculumFolderModal() {
      const list = $("curriculumFolderFileList");
      if (!list) return;
      const needsSeason = folderContextNeedsSeason(activeFolderUploadContext);
      const entries = needsSeason ? [] : curriculumEntries({ sortValue: "newest" });
      list.innerHTML = needsSeason
        ? `<div class="folder-empty">请先点击上方季节子文件夹，再查看或上传对应大纲。</div>`
        : curriculumFileCardsHtml(entries);
      setText("curriculumFolderModalTitle", activeFolderModalTitle);
      setText("curriculumFolderModalMeta", needsSeason ? `${activeFolderModalTitle}｜请选择季节子文件夹` : `${activeFolderModalTitle}｜${entries.length} 条最新版本资料`);
      const subfolderBoard = $("curriculumFolderSubfolders");
      if (subfolderBoard) {
        subfolderBoard.hidden = !folderContextIsOutline(activeFolderUploadContext);
        subfolderBoard.innerHTML = folderContextIsOutline(activeFolderUploadContext)
          ? outlineSeasonFolders.map((season) => `
            <button class="resource-tree-item" type="button" data-curriculum-season-folder="${escapeHtml(season)}">
              ${folderIconHtml()}
              <span><strong>${escapeHtml(season)}</strong><br>${normalizeSeason(activeFolderUploadContext?.season) === season ? "当前子文件夹" : "点击进入子文件夹"}</span>
            </button>
          `).join("")
          : "";
      }
      const needsTeacher = folderContextNeedsTeacher(activeFolderUploadContext);
      const canUploadHere = Boolean(activeFolderUploadContext?.grade) && !needsSeason && (!needsTeacher || Boolean(activeFolderUploadContext?.teacher));
      const pickButton = $("curriculumFolderPickButton");
      if (pickButton) pickButton.disabled = !canUploadHere || !capabilities.create;
      setText("curriculumFolderDropHint", canUploadHere
        ? "系统会按当前文件夹自动填写年级、大纲板块和授课老师；季节、体系、课次默认沿用下方高级面板当前设置。"
        : needsTeacher
          ? "请先选择具体老师，再进入年级文件夹上传。"
          : needsSeason
            ? "请先点击暑假、秋季、寒假、春季中的一个子文件夹，再拖拽上传大纲。"
            : "全部年级文件夹只用于查看，上传请先进入某一个具体年级文件夹。");
    }

    function openCurriculumFolderModal(title, context = {}) {
      activeFolderModalTitle = title || "文件夹内容";
      activeFolderUploadContext = context ? { ...context, baseTitle: context.baseTitle || title || "文件夹内容" } : null;
      renderCurriculumFolderModal();
      $("curriculumFolderModal")?.setAttribute("aria-hidden", "false");
    }

    function closeCurriculumFolderModal() {
      $("curriculumFolderModal")?.setAttribute("aria-hidden", "true");
      const input = $("curriculumFolderFileInput");
      if (input) input.value = "";
      $("curriculumFolderDropzone")?.classList.remove("dragging");
    }

    function render() {
      const keyword = $("curriculumFilterInput")?.value.trim().toLowerCase() || "";
      const sortValue = $("curriculumSortSelect")?.value || "newest";
      const entries = curriculumEntries({ keyword, sortValue });
      const scopedRows = latestVersionEntries(visibleRows().map((row, index) => ({ row, index }))).map(({ row }) => row);
      $("curriculumTableBody").innerHTML = curriculumRowsHtml(entries);
      setText("curriculumMetricOutline", scopedRows.filter((row) => row.type === "课程大纲" || isTeachingOutline(row)).length);
      setText("curriculumMetricMaterials", scopedRows.filter((row) => ["课件PDF", "讲义Word", "题目图片", "老师版答案", "题库"].includes(row.type)).length);
      setText("curriculumMetricProducts", new Set(scopedRows.map((row) => `${row.grade || ""}|${row.track || ""}`).filter(Boolean)).size);
      setText("curriculumMetricPreparation", scopedRows.filter((row) => row.fileName).length);
      setActiveFolderLabel(activeFolderLabel);
      renderOutlineGradeDirectories();
      renderAuditLog(moduleKey, "curriculumAuditTableBody");
    }

    function folderUploadBasePayload() {
      const context = activeFolderUploadContext || {};
      const selectedGrade = context.grade || "";
      const selectedOutlineCategory = normalizeOutlineCategory(context.category || defaultOutlineCategory, "课程大纲");
      const selectedType = selectedOutlineCategory === defaultOutlineCategory
        ? normalizeResourceType($("curriculumTypeInput")?.value === "课程大纲" ? "讲义" : ($("curriculumTypeInput")?.value || "讲义"))
        : "课程大纲";
      return {
        subject: normalizeSubjectForScope($("curriculumSubjectInput")?.value || "", selectedGrade),
        grade: selectedGrade,
        outlineCategory: selectedOutlineCategory,
        teacherName: normalizeName(context.teacher || ""),
        season: normalizeSeason(context.season || $("curriculumSeasonFilter")?.value || $("curriculumSeasonInput")?.value || "通用"),
        track: $("curriculumTrackInput")?.value || "课内体系",
        type: selectedType,
        classType: $("curriculumClassTypeInput")?.value || "-",
        lesson: normalizeText($("curriculumLessonInput")?.value) || "-",
        status: "已录入",
        version: normalizeText($("curriculumVersionInput")?.value) || "V1.0",
        owner: currentEmployee.name || "-",
        formula: normalizeText($("curriculumFormulaInput")?.value) || "",
        note: normalizeText($("curriculumNoteInput")?.value) || "从文件夹拖拽上传",
        updatedAt: nowText()
      };
    }

    async function uploadFilesToActiveFolder(fileList) {
      const files = Array.from(fileList || []).filter(Boolean);
      if (!files.length) return;
      if (!capabilities.create) {
        denyAction("curriculumMessage", "上传");
        return;
      }
      if (!activeFolderUploadContext?.grade) {
        setText("curriculumMessage", "请先打开某一个具体年级文件夹，再把资料拖进去上传。");
        return;
      }
      if (folderContextNeedsTeacher(activeFolderUploadContext) && !activeFolderUploadContext.teacher) {
        setText("curriculumMessage", "请先选择具体老师，再进入年级文件夹上传。");
        return;
      }
      if (folderContextNeedsSeason(activeFolderUploadContext)) {
        setText("curriculumMessage", "请先进入暑假、秋季、寒假、春季中的一个子文件夹，再上传大纲。");
        renderCurriculumFolderModal();
        return;
      }
      const basePayload = folderUploadBasePayload();
      if (isGradeRestricted && (!allowedGrades.length || !allowedGrades.includes(basePayload.grade))) {
        setText("curriculumMessage", "当前账号只能上传自己负责年级的课程资料。");
        return;
      }
      let addedCount = 0;
      let updatedCount = 0;
      const uploadedFileRows = [];
      try {
        for (const file of files) {
          const rowName = fileBaseName(file.name);
          const duplicateKey = curriculumDuplicateKey({ ...basePayload, name: rowName }, file.name);
          const targetIndex = rows.findIndex((row) => curriculumDuplicateKey(row, row.fileName) === duplicateKey);
          const existing = targetIndex >= 0 ? rows[targetIndex] : {};
          const nextVersion = targetIndex >= 0 ? bumpVersion(existing.version || basePayload.version) : basePayload.version;
          const rowBase = {
            ...existing,
            ...basePayload,
            name: rowName,
            version: nextVersion,
            createdAt: existing.createdAt || nowText()
          };
          const filePayload = await selectedFilePayload(existing, rowBase, file);
          if (filePayload.fileStorageKey) uploadedFileRows.push({ ...rowBase, ...filePayload });
          const payload = {
            ...rowBase,
            ...filePayload,
            versionHistory: targetIndex >= 0
              ? [
                  ...(Array.isArray(existing.versionHistory) ? existing.versionHistory : []),
                  {
                    version: existing.version || "V1.0",
                    fileName: existing.fileName || "",
                    updatedAt: existing.updatedAt || existing.createdAt || nowText()
                  }
                ].slice(-10)
              : (Array.isArray(existing.versionHistory) ? existing.versionHistory : [])
          };
          if (targetIndex >= 0) {
            rows[targetIndex] = payload;
            updatedCount += 1;
          } else {
            rows.unshift(payload);
            addedCount += 1;
          }
        }
      } catch (error) {
        setText("curriculumMessage", error.message || "文件上传失败。");
        renderCurriculumFolderModal();
        return;
      }
      recordAudit(moduleKey, "文件夹上传", activeFolderModalTitle, `新增 ${addedCount} 条 / 更新 ${updatedCount} 条`);
      writeStore(key, rows);
      render();
      renderCurriculumFolderModal();
      const storageMessage = curriculumUploadStorageMessage(uploadedFileRows);
      setText("curriculumMessage", [
        `已上传到：${activeFolderModalTitle}。新增 ${addedCount} 条，更新 ${updatedCount} 条；重复资料已自动升级版本。`,
        storageMessage
      ].filter(Boolean).join("\n"));
    }

    $("curriculumFileInput")?.addEventListener("change", () => {
      const files = Array.from($("curriculumFileInput")?.files || []);
      if (!files.length) {
        renderFilePreview(editingIndex >= 0 ? rows[editingIndex] : {});
        return;
      }
      const preview = $("curriculumFilePreview");
      if (preview) {
        const totalSize = files.reduce((sum, file) => sum + Number(file.size || 0), 0);
        preview.textContent = files.length === 1
          ? `已选择：${files[0].name}（${formatFileSize(files[0].size)}）`
          : `已选择 ${files.length} 个文件，总计 ${formatFileSize(totalSize)}。保存后逐个上传并即时备份。`;
      }
    });

    $("curriculumSaveButton")?.addEventListener("click", async () => {
      const actionAllowed = editingIndex >= 0 ? capabilities.update : capabilities.create;
      if (!actionAllowed) {
        denyAction("curriculumMessage", editingIndex >= 0 ? "修改" : "新增");
        return;
      }
      const files = Array.from($("curriculumFileInput")?.files || []);
      const inputName = normalizeName($("curriculumNameInput")?.value);
      const name = inputName || (files.length ? fileBaseName(files[0].name) : "");
      if (!name) {
        setText("curriculumMessage", "请填写资料名称，或先选择要上传的文件。");
        return;
      }
      const selectedGrade = $("curriculumGradeInput")?.value || "";
      if (isGradeRestricted && (!allowedGrades.length || !allowedGrades.includes(selectedGrade))) {
        setText("curriculumMessage", "当前账号只能上传自己负责年级的课程资料。");
        return;
      }
      const selectedType = normalizeResourceType($("curriculumTypeInput")?.value || "其他资料");
      const selectedOutlineCategory = normalizeOutlineCategory($("curriculumOutlineCategoryInput")?.value, selectedType);
      const selectedTeacherName = normalizeName($("curriculumTeacherInput")?.value) || "";
      if (!selectedGrade) {
        setText("curriculumMessage", "请先选择年级，资料会按年级目录归档。");
        return;
      }
      if (selectedOutlineCategory === defaultOutlineCategory && !selectedType) {
        setText("curriculumMessage", "请先选择资料类型：讲义、专题资料、好题资料、试卷、课件或其他资料。");
        return;
      }
      const basePayload = {
        subject: normalizeSubjectForScope($("curriculumSubjectInput")?.value, selectedGrade),
        grade: selectedGrade || "-",
        outlineCategory: selectedOutlineCategory,
        teacherName: selectedTeacherName,
        season: normalizeSeason($("curriculumSeasonInput")?.value),
        track: $("curriculumTrackInput")?.value || "-",
        type: selectedOutlineCategory === defaultOutlineCategory ? selectedType : "课程大纲",
        classType: $("curriculumClassTypeInput")?.value || "-",
        lesson: normalizeText($("curriculumLessonInput")?.value) || "-",
        status: editingIndex >= 0 ? rows[editingIndex].status : "已录入",
        version: normalizeText($("curriculumVersionInput")?.value) || "V1.0",
        owner: normalizeName($("curriculumOwnerInput")?.value) || currentEmployee.name || "-",
        formula: normalizeText($("curriculumFormulaInput")?.value) || "",
        note: normalizeText($("curriculumNoteInput")?.value) || "-",
        updatedAt: nowText()
      };
      const uploadFiles = files.length ? files : [null];
      let addedCount = 0;
      let updatedCount = 0;
      const uploadedFileRows = [];
      try {
        for (const file of uploadFiles) {
          const rowName = inputName || (file ? fileBaseName(file.name) : name);
          const duplicateIndex = file ? findDuplicateCurriculumIndex({ ...basePayload, name: rowName }, file.name) : -1;
          const targetIndex = editingIndex >= 0 && uploadFiles.length === 1 ? editingIndex : duplicateIndex;
          const existing = targetIndex >= 0 ? rows[targetIndex] : {};
          const nextVersion = targetIndex >= 0 ? bumpVersion(existing.version || basePayload.version) : basePayload.version;
          const rowBase = {
            ...existing,
            ...basePayload,
            name: rowName,
            version: nextVersion,
            createdAt: existing.createdAt || nowText()
          };
          const filePayload = await selectedFilePayload(existing, rowBase, file);
          if (file && filePayload.fileStorageKey) {
            uploadedFileRows.push({ ...rowBase, ...filePayload });
          }
          const payload = {
            ...rowBase,
            ...filePayload,
            versionHistory: targetIndex >= 0
              ? [
                  ...(Array.isArray(existing.versionHistory) ? existing.versionHistory : []),
                  {
                    version: existing.version || "V1.0",
                    fileName: existing.fileName || "",
                    updatedAt: existing.updatedAt || existing.createdAt || nowText()
                  }
                ].slice(-10)
              : (Array.isArray(existing.versionHistory) ? existing.versionHistory : [])
          };
          if (targetIndex >= 0) {
            rows[targetIndex] = payload;
            updatedCount += 1;
          } else {
            rows.unshift(payload);
            addedCount += 1;
          }
        }
      } catch (error) {
        setText("curriculumMessage", error.message || "文件读取失败。");
        return;
      }
      recordAudit(moduleKey, addedCount && updatedCount ? "批量保存" : updatedCount ? "更新" : "新增", name, `新增 ${addedCount} 条 / 更新 ${updatedCount} 条`);
      const directoryText = selectedOutlineCategory === defaultOutlineCategory
        ? `课程资料库 / ${selectedGrade} / ${selectedType}`
        : `授课大纲 / ${selectedOutlineCategory} / ${normalizeSeason($("curriculumSeasonInput")?.value)} / ${selectedGrade}`;
      const storageMessage = curriculumUploadStorageMessage(uploadedFileRows);
      setText("curriculumMessage", [
        `已保存到：${directoryText}。新增 ${addedCount} 条，更新 ${updatedCount} 条；重复资料已自动升级版本。`,
        storageMessage
      ].filter(Boolean).join("\n"));
      writeStore(key, rows);
      applyTeacherOptions();
      updateCurriculumFilterControls();
      resetForm();
      render();
    });
    $("curriculumFilterInput")?.addEventListener("input", render);
    $("curriculumDirectoryBoard")?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-curriculum-grade-dir]");
      if (!button) return;
      activeOutlineFilter = defaultOutlineCategory;
      activeOutlineTeacherFilter = "";
      updateCurriculumFilterControls();
      const grade = button.getAttribute("data-curriculum-grade-dir") || "";
      if ($("curriculumGradeFilter")) $("curriculumGradeFilter").value = grade;
      if ($("curriculumSeasonFilter")) $("curriculumSeasonFilter").value = "";
      if ($("curriculumOutlineCategoryInput")) $("curriculumOutlineCategoryInput").value = defaultOutlineCategory;
      if ($("curriculumGradeInput") && grade) $("curriculumGradeInput").value = grade;
      if ($("curriculumTypeInput") && $("curriculumTypeInput").value === "课程大纲") $("curriculumTypeInput").value = "讲义";
      render();
      const folderLabel = grade ? `课程资料库 / ${grade}` : "课程资料库 / 全部年级";
      setActiveFolderLabel(folderLabel);
      setText("curriculumMessage", `已打开：${folderLabel}。`);
      openCurriculumFolderModal(folderLabel, { category: defaultOutlineCategory, grade, teacher: "" });
    });
    document.querySelectorAll("[data-outline-tab]").forEach((button) => {
      button.addEventListener("click", () => {
        const category = normalizeOutlineCategory(button.getAttribute("data-outline-tab"), "课程大纲");
        setOutlinePanel(category);
        setText("curriculumMessage", category === "程老师授课大纲"
          ? "已打开程老师授课大纲入口，请选择年级。"
          : `已打开${category}入口，请先选老师，再选择年级。`);
      });
    });
    document.querySelectorAll("[data-outline-grade-board]").forEach((board) => {
      board.addEventListener("click", (event) => {
        const button = event.target.closest("[data-outline-grade-entry]");
        if (!button) return;
        const category = normalizeOutlineCategory(button.getAttribute("data-outline-grade-entry"), "课程大纲");
        const grade = button.getAttribute("data-outline-grade") || "";
        activeOutlineFilter = category;
        activeOutlineTeacherFilter = selectedOutlineTeacher(category);
        updateCurriculumFilterControls();
        if ($("curriculumGradeFilter")) $("curriculumGradeFilter").value = grade;
        if ($("curriculumSeasonFilter")) $("curriculumSeasonFilter").value = "";
        if ($("curriculumOutlineCategoryInput")) $("curriculumOutlineCategoryInput").value = category;
        if ($("curriculumTypeInput")) $("curriculumTypeInput").value = "课程大纲";
        if ($("curriculumGradeInput")) $("curriculumGradeInput").value = grade;
        if ($("curriculumTeacherInput") && activeOutlineTeacherFilter) $("curriculumTeacherInput").value = activeOutlineTeacherFilter;
        if ($("curriculumTeacherFilter") && activeOutlineTeacherFilter) $("curriculumTeacherFilter").value = activeOutlineTeacherFilter;
        render();
        const teacherText = activeOutlineTeacherFilter ? `${activeOutlineTeacherFilter} / ` : "";
        const folderLabel = `授课大纲 / ${teacherText}${category} / ${grade}`;
        setActiveFolderLabel(folderLabel);
        setText("curriculumMessage", `已打开：${teacherText}${category} / ${grade}。`);
        openCurriculumFolderModal(folderLabel, { category, grade, teacher: activeOutlineTeacherFilter });
      });
    });
    ["curriculumSmallOutlineTeacherSelect", "curriculumScienceOutlineTeacherSelect"].forEach((id) => {
      $(id)?.addEventListener("change", () => {
        const category = id === "curriculumScienceOutlineTeacherSelect" ? "科学老师授课大纲" : "小课老师授课大纲";
        if (activeOutlineFilter === category) activeOutlineTeacherFilter = normalizeName($(id)?.value || "");
        renderOutlineGradeDirectories();
      });
    });
    document.querySelectorAll("[data-outline-filter]").forEach((button) => {
      button.addEventListener("click", () => {
        const category = normalizeOutlineCategory(button.getAttribute("data-outline-filter"), "课程大纲");
        activeOutlineFilter = category;
        activeOutlineTeacherFilter = "";
        setOutlinePanel(category);
        updateCurriculumFilterControls();
        if ($("curriculumOutlineCategoryInput")) $("curriculumOutlineCategoryInput").value = category;
        if ($("curriculumTypeInput")) $("curriculumTypeInput").value = "课程大纲";
        render();
        setText("curriculumMessage", `已切换到：${category}。可继续按季节和年级查看，或在右侧上传大纲。`);
      });
    });
    $("curriculumOutlineFilter")?.addEventListener("change", render);
    $("curriculumTeacherFilter")?.addEventListener("change", render);
    $("curriculumSeasonFilter")?.addEventListener("change", render);
    $("curriculumGradeFilter")?.addEventListener("change", render);
    $("curriculumOutlineCategoryInput")?.addEventListener("change", () => {
      if ($("curriculumOutlineCategoryInput").value !== defaultOutlineCategory && $("curriculumTypeInput")) {
        $("curriculumTypeInput").value = "课程大纲";
      }
      applyTeacherOptions();
    });
    $("curriculumSortSelect")?.addEventListener("change", render);
    $("curriculumExportButton")?.addEventListener("click", () => guardAction(capabilities.export, "curriculumMessage", "导出", () => downloadCsv("教研与课程产品数据.csv", visibleRows(), [
      { label: "资料名称", value: "name" },
      { label: "学科/年级", value: "subject" },
      { label: "年级", value: "grade" },
      { label: "大纲板块", value: "outlineCategory" },
      { label: "授课老师", value: "teacherName" },
      { label: "季节", value: "season" },
      { label: "课程体系", value: "track" },
      { label: "资料类型", value: "type" },
      { label: "适用班型", value: "classType" },
      { label: "课次/专题", value: "lesson" },
      { label: "状态", value: "status" },
      { label: "版本", value: "version" },
      { label: "负责人", value: "owner" },
      { label: "公式/定义/核心重点", value: "formula" },
      { label: "文件名", value: "fileName" },
      { label: "文件大小", value: (row) => row.fileName ? formatFileSize(row.fileSize) : "" },
      { label: "文件地址", value: "fileUrl" },
      { label: "存储方式", value: "storageKind" },
      { label: "服务器主路径", value: (row) => curriculumServerFilePath(row) },
      { label: "即时备份路径", value: (row) => curriculumBackupFilePath(row) },
      { label: "说明", value: "note" },
      { label: "创建时间", value: "createdAt" }
    ])));
    $("curriculumResetButton")?.addEventListener("click", () => {
      if (!capabilities.reset) {
        denyAction("curriculumMessage", "清空");
        return;
      }
      markRowsDeleted(key, rows);
      rows = [];
      writeStore(key, rows, { restoreDeleted: false });
      recordAudit(moduleKey, "清空", "教研课程台账", "0 条");
      resetForm();
      render();
      setText("curriculumMessage", "已清空本页台账。后续可新增或导入真实课程资料。");
    });
    function editCurriculumRow(index) {
      editingIndex = index;
      fillForm(rows[index]);
      const advancedPanel = $("curriculumAdvancedUploadPanel");
      if (advancedPanel) advancedPanel.open = true;
      const fromFolderModal = $("curriculumFolderModal")?.getAttribute("aria-hidden") === "false";
      if (fromFolderModal) {
        closeCurriculumFolderModal();
        advancedPanel?.scrollIntoView({ block: "start", behavior: "smooth" });
      }
      setText("curriculumSaveButton", "保存修改");
      setText("curriculumMessage", `正在编辑 ${rows[index].name}。`);
    }

    async function deleteCurriculumRow(index) {
      if (!isChengOperator) {
        alert(curriculumDeleteBlockedMessage());
        setText("curriculumMessage", curriculumDeleteBlockedMessage());
        return;
      }
      const removed = rows[index];
      if (!removed) return;
      const label = removed.fileName || removed.name || "这条课程资料";
      const password = window.prompt(`删除“${label}”需要验证程老师当前登录密码。`);
      if (password == null) return;
      if (!String(password).trim()) {
        setText("curriculumMessage", "没有输入密码，已取消删除。");
        return;
      }
      setText("curriculumMessage", "正在验证密码...");
      const verified = typeof window.jrcVerifyCurrentPassword === "function"
        ? await window.jrcVerifyCurrentPassword(password, currentEmployee)
        : false;
      if (!verified) {
        setText("curriculumMessage", "密码不正确，已取消删除。");
        alert("密码不正确，已取消删除。");
        return;
      }
      if (!window.confirm(`密码已通过。确定删除“${label}”吗？删除后会同步到云端，普通老师无法恢复。`)) {
        setText("curriculumMessage", "已取消删除。");
        return;
      }
      markRowDeleted(key, removed);
      rows.splice(index, 1);
      editingIndex = -1;
      writeStore(key, rows);
      recordAudit(moduleKey, "删除", removed.name || removed.fileName, `${removed.grade || "-"}｜${removed.outlineCategory || removed.type || "-"}`);
      applyTeacherOptions();
      updateCurriculumFilterControls();
      resetForm();
      render();
      setText("curriculumMessage", `已删除课程资料：${label}。`);
    }

    const curriculumRowHandlers = {
      onEdit: editCurriculumRow,
      onDelete: deleteCurriculumRow
    };
    bindRowActions("curriculumTableBody", curriculumRowHandlers, capabilities, "curriculumMessage");
    bindRowActions("curriculumFolderFileList", curriculumRowHandlers, capabilities, "curriculumMessage");

    async function handleCurriculumFileTableClick(event) {
      const previewButton = event.target.closest("[data-preview-curriculum]");
      if (previewButton) {
        const index = Number(previewButton.getAttribute("data-preview-curriculum"));
        await previewCurriculumImage(rows[index], previewButton);
        return true;
      }
      const button = event.target.closest("[data-download-curriculum]");
      if (!button) return false;
      const index = Number(button.getAttribute("data-download-curriculum"));
      const row = rows[index];
      if (!row?.fileName) {
        setText("curriculumMessage", "这条资料还没有上传文件。");
        return true;
      }
      if (row.fileDataUrl) {
        downloadDataUrl(row.fileName, row.fileDataUrl);
        setText("curriculumMessage", `正在下载 ${row.fileName}。`);
        return true;
      }
      if (!row.fileStorageKey && !row.fileUrl) {
        setText("curriculumMessage", "这条资料只有文件名，还没有上传文件内容。");
        return true;
      }
      if (!window.JRC_CLOUD?.downloadCurriculumFile) {
        setText("curriculumMessage", "当前环境暂时不能下载云端文件。");
        return true;
      }
      try {
        button.disabled = true;
        setText("curriculumMessage", `正在下载 ${row.fileName}...`);
        const result = await window.JRC_CLOUD.downloadCurriculumFile(row);
        if (!result.ok || !result.blob) {
          setText("curriculumMessage", "下载失败，请刷新后重试。");
          return true;
        }
        downloadBlob(row.fileName, result.blob);
        setText("curriculumMessage", `正在下载 ${row.fileName}。`);
      } catch (error) {
        setText("curriculumMessage", error.message || "下载失败。");
      } finally {
        button.disabled = false;
      }
      return true;
    }

    $("curriculumTableBody")?.addEventListener("click", handleCurriculumFileTableClick);
    $("curriculumFolderFileList")?.addEventListener("click", handleCurriculumFileTableClick);
    $("curriculumFolderModalCloseButton")?.addEventListener("click", closeCurriculumFolderModal);
    $("curriculumFolderSubfolders")?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-curriculum-season-folder]");
      if (!button || !activeFolderUploadContext) return;
      const season = normalizeSeason(button.getAttribute("data-curriculum-season-folder") || "");
      const baseTitle = activeFolderUploadContext.baseTitle || activeFolderModalTitle;
      activeFolderUploadContext = { ...activeFolderUploadContext, season, baseTitle };
      activeFolderModalTitle = `${baseTitle} / ${season}`;
      if ($("curriculumSeasonFilter")) $("curriculumSeasonFilter").value = season;
      if ($("curriculumSeasonInput")) $("curriculumSeasonInput").value = season;
      render();
      renderCurriculumFolderModal();
      setText("curriculumMessage", `已打开：${activeFolderModalTitle}。`);
    });
    $("curriculumFolderPickButton")?.addEventListener("click", () => {
      if (!activeFolderUploadContext?.grade) {
        setText("curriculumMessage", "请先进入具体年级文件夹，再上传资料。");
        return;
      }
      $("curriculumFolderFileInput")?.click();
    });
    $("curriculumFolderFileInput")?.addEventListener("change", async () => {
      const input = $("curriculumFolderFileInput");
      await uploadFilesToActiveFolder(input?.files || []);
      if (input) input.value = "";
    });
    const folderDropzone = $("curriculumFolderDropzone");
    folderDropzone?.addEventListener("dragover", (event) => {
      event.preventDefault();
      folderDropzone.classList.add("dragging");
    });
    folderDropzone?.addEventListener("dragleave", () => {
      folderDropzone.classList.remove("dragging");
    });
    folderDropzone?.addEventListener("drop", async (event) => {
      event.preventDefault();
      folderDropzone.classList.remove("dragging");
      await uploadFilesToActiveFolder(event.dataTransfer?.files || []);
    });
    $("curriculumPreviewCloseButton")?.addEventListener("click", closeCurriculumPreview);
    $("curriculumPreviewZoomOutButton")?.addEventListener("click", () => setCurriculumPreviewZoom(curriculumPreviewZoom - 0.25));
    $("curriculumPreviewZoomResetButton")?.addEventListener("click", () => setCurriculumPreviewZoom(1));
    $("curriculumPreviewZoomInButton")?.addEventListener("click", () => setCurriculumPreviewZoom(curriculumPreviewZoom + 0.25));
    $("curriculumPreviewModal")?.addEventListener("click", (event) => {
      if (event.target === $("curriculumPreviewModal")) closeCurriculumPreview();
    });
    bindTableImport({
      buttonId: "curriculumImportButton",
      inputId: "curriculumImportInput",
      getRows: () => rows,
      setRows(nextRows) {
        rows = nextRows;
        writeStore(key, rows);
        applyTeacherOptions();
        updateCurriculumFilterControls();
        resetForm();
        render();
      },
      normalizeRow(row) {
        const name = normalizeName(readField(row, ["name", "资料名称", "课程名称", "名称"]));
        if (!name) return null;
        const grade = normalizeText(readField(row, ["grade", "年级", "适用年级"], "")) || "-";
        const subject = normalizeSubjectForScope(readField(row, ["subject", "学科", "年级", "学科 / 年级"], "-"), grade);
        const importedType = normalizeStatus(readField(row, ["type", "资料类型", "类型"], "备课资料"), ["课程大纲", "课件PDF", "讲义Word", "题目图片", "老师版答案", "板书照片", "题库", "备课资料", "其他"], "备课资料");
        const outlineCategory = normalizeOutlineCategory(readField(row, ["outlineCategory", "大纲板块", "授课大纲", "大纲分类"], ""), importedType);
        const teacherName = normalizeName(readField(row, ["teacherName", "授课老师", "老师", "任课老师", "主讲老师"], ""));
        const normalized = {
          name,
          subject,
          grade,
          outlineCategory,
          teacherName,
          season: normalizeSeason(readField(row, ["season", "季节", "学期", "课程季节"], "通用")),
          track: normalizeStatus(readField(row, ["track", "课程体系", "体系"], "课内体系"), ["课内体系", "培优体系", "奥数体系", "强基重高选拔体系"], "课内体系"),
          type: outlineCategory === defaultOutlineCategory ? importedType : "课程大纲",
          classType: normalizeText(readField(row, ["classType", "适用班型", "班型"], "-")) || "-",
          lesson: normalizeText(readField(row, ["lesson", "课次", "专题", "课次 / 专题"], "-")) || "-",
          status: normalizeStatus(readField(row, ["status", "状态"], "已录入"), ["待导入讲义", "待整理题库", "待上传资料", "已录入"], "已录入"),
          version: normalizeText(readField(row, ["version", "当前版本", "版本"], "V1.0")) || "V1.0",
          owner: normalizeName(readField(row, ["owner", "负责人"], "-")) || "-",
          formula: normalizeText(readField(row, ["formula", "公式", "公式/定义/核心重点", "核心重点"], "")),
          note: normalizeText(readField(row, ["note", "版本说明", "说明", "备注"], "-")) || "-",
          fileName: normalizeText(readField(row, ["fileName", "文件名", "附件"], "")),
          fileType: normalizeText(readField(row, ["fileType", "文件类型"], "")),
          fileSize: Number(readField(row, ["fileSize", "文件大小"], 0)) || 0,
          fileDataUrl: String(readField(row, ["fileDataUrl", "文件数据"], "")),
          fileUrl: String(readField(row, ["fileUrl", "文件地址"], "")),
          fileStorageKey: String(readField(row, ["fileStorageKey", "文件存储键"], "")),
          storageKind: String(readField(row, ["storageKind", "存储方式"], "")),
          createdAt: String(readField(row, ["createdAt", "创建时间", "时间"], nowText())),
          updatedAt: String(readField(row, ["updatedAt", "更新时间"], nowText()))
        };
        return rowVisibleToCurrentUser(normalized) ? normalized : null;
      },
      onDone(count) {
        recordAudit(moduleKey, "导入", "教研课程台账", `${count} 条`);
        renderAuditLog(moduleKey, "curriculumAuditTableBody");
        setText("curriculumMessage", `已导入 ${count} 条课程资料。`);
      },
      onError() {
        setText("curriculumMessage", "导入失败。请上传 CSV/TSV/JSON；Excel 可以先另存为 CSV。");
      },
      canUse: () => capabilities.import,
      onDenied: () => denyAction("curriculumMessage", "导入")
    });
    applyGradeOptions();
    applyTeacherOptions();
    updateCurriculumFilterControls();
    setOutlinePanel("程老师授课大纲");
    resetForm();
    render();
    setText("curriculumMessage", gradeScopeText());
    readCloudStore(key, (cloudRows) => {
      rows = mergeRowsById(sanitizeRows(cloudRows), key);
      if (rows.length !== cloudRows.length) writeStore(key, rows);
      applyTeacherOptions();
      updateCurriculumFilterControls();
      resetForm();
      render();
      setText("curriculumMessage", "已同步云端教研课程台账。");
    });
    applyCapabilityGate({
      canWrite: capabilities.create || capabilities.update,
      messageId: "curriculumMessage",
      buttonRules: [["curriculumSaveButton", capabilities.create || capabilities.update, "新增或修改"], ["curriculumImportButton", capabilities.import, "导入"], ["curriculumExportButton", capabilities.export, "导出"], ["curriculumResetButton", capabilities.reset, "清空"]],
      fieldIds: ["curriculumNameInput", "curriculumSubjectInput", "curriculumGradeInput", "curriculumOutlineCategoryInput", "curriculumTeacherInput", "curriculumSeasonInput", "curriculumTrackInput", "curriculumTypeInput", "curriculumClassTypeInput", "curriculumLessonInput", "curriculumVersionInput", "curriculumOwnerInput", "curriculumFileInput", "curriculumFormulaInput", "curriculumNoteInput"]
    });
  }

  function initHrTraining() {
    if (!$("hrTaskTableBody") && !$("hrRoleBoard")) return;
    const moduleKey = "hr";
    const canManageCoreOps = isCoreOpsAdmin();
    const capabilities = fixedCapabilities(canManageCoreOps);
    const key = "jrc-hr-training-tasks-v2";
    const roleDirectoryKey = "jrc-hr-role-directory-v1";
    const canViewHrPrivate = canManageCoreOps;
    const canEditSummerSchedule = () => canManageCoreOps;
    const defaults = {
      type: "入职",
      employee: "",
      phone: "",
      role: "授课老师",
      hireDate: "",
      regularDate: "",
      system: "员工档案、登录账号、岗位权限",
      status: "待处理",
      owner: currentOperator().name || "",
      next: "保存后自动同步员工名单和默认权限",
      note: ""
    };
    const departedEmployeePattern = /离职|停用|禁用|已离开|departed|inactive|disabled/i;
    const hrTypeGuides = {
      入职: {
        system: "统一登录、人事档案、权限、岗位设置",
        next: "填写登录账号、手机号、岗位、入职日期和转正日期",
        notePlaceholder: "可选：写试用安排、培训安排或特别说明。",
        hint: "<strong>入职事项怎么填：</strong>填写姓名、登录账号、手机号、岗位、入职日期即可；系统会按岗位给默认权限，初始密码 10281028。"
      },
      转正: {
        system: "人事档案、权限、财务",
        next: "核对入职日期和转正日期，确认薪资/提成/权限是否调整",
        notePlaceholder: "建议写清：原入职日期、转正日期、考核结论、薪资或提成是否调整、权限是否变化。",
        hint: "<strong>转正事项怎么填：</strong>员工姓名从在职名单选择；关联系统通常是人事档案、权限和财务；下一步写清是否需要调整工资、提成或权限；事项说明记录转正日期、考核结论和调整依据。"
      },
      离职: {
        system: "统一登录、权限、排课、财务、学生服务",
        next: "确认离职日期；停用账号权限；保留排课上课和本月结算记录",
        notePlaceholder: "建议写清：离职日期、最后上课/排课日期、账号权限停用、工作交接、财务结算月份和是否仍需保留历史排课/上课数据。",
        hint: "<strong>离职办理口径：</strong>员工姓名请从在职名单选择；关联系统用于提醒统一登录、权限、排课、财务、学生服务同步处理；下一步用于写清还差哪一步；事项说明记录离职日期、交接内容、账号停用和本月结算口径。"
      },
      权限调整: {
        system: "统一登录、系统权限",
        next: "确认需要开通或关闭的模块权限，并通知本人复核",
        notePlaceholder: "建议写清：调整原因、开通/关闭哪些系统、是否允许新增/编辑/导出、生效时间。",
        hint: "<strong>权限调整怎么填：</strong>员工姓名从在职名单选择；关联系统写需要变更的模块；下一步写清谁确认、何时生效；事项说明记录具体开通或关闭的权限，避免只写“调权限”。"
      },
      提成调整: {
        system: "财务、人事档案",
        next: "确认新提成口径、生效月份，并同步财务核算",
        notePlaceholder: "建议写清：调整前后提成口径、生效月份、适用课程/岗位、审批原因和财务同步方式。",
        hint: "<strong>提成调整怎么填：</strong>员工姓名从在职名单选择；关联系统重点写财务；下一步写清生效月份和谁复核；事项说明记录调整前后口径，方便月结对账。"
      },
      培训记录: {
        system: "人事培训、学管知识库",
        next: "归档培训主题、参训人、考核结果和后续补训安排",
        notePlaceholder: "建议写清：培训主题、培训时间、参训人员、考核结果、是否需要补训或复盘。",
        hint: "<strong>培训记录怎么填：</strong>员工姓名可填个人，也可以填小组；关联系统通常是人事培训和知识库；下一步写清是否还要补训、考核或复盘；事项说明记录培训主题、结果和后续要求。"
      }
    };

    function employeeStatusText(employee) {
      return normalizeText([
        employee?.status,
        employee?.employmentStatus,
        employee?.workStatus,
        employee?.employeeStatus,
        employee?.accountStatus
      ].filter(Boolean).join(" "));
    }

    function isActiveHrEmployee(employee) {
      const name = normalizeName(employee?.name);
      if (!name) return false;
      const statusText = employeeStatusText(employee);
      return !departedEmployeePattern.test(statusText);
    }

    function activeHrEmployees() {
      return (Array.isArray(window.JRC_EMPLOYEES) ? window.JRC_EMPLOYEES : [])
        .filter(isActiveHrEmployee)
        .sort((left, right) => normalizeName(left.name).localeCompare(normalizeName(right.name), "zh-CN"));
    }

    function renderHrEmployeeOptions() {
      const datalist = $("hrActiveEmployeeOptions");
      if (!datalist) return;
      datalist.innerHTML = activeHrEmployees().map((employee) => {
        const name = normalizeName(employee.name);
        const meta = [employee.role, employee.subject, employee.scope].map(normalizeText).filter(Boolean).join(" / ");
        return `<option value="${escapeHtml(name)}"${meta ? ` label="${escapeHtml(meta)}"` : ""}></option>`;
      }).join("");
    }

    function matchActiveHrEmployee(name) {
      const target = normalizeName(name);
      if (!target) return null;
      return activeHrEmployees().find((employee) => normalizeName(employee.name) === target) || null;
    }

    function buildOffboardingChecklist(employee) {
      return [
        { key: "account", label: "停用账号和系统权限", done: false },
        { key: "directory", label: "确认可以从在职员工名单移出", done: false },
        { key: "schedule", label: "检查未来排课并改派/取消", done: false },
        { key: "history", label: "保留历史排课、点名、上课记录", done: true },
        { key: "finance", label: "生成本月离职结算提醒", done: false },
        { key: "handover", label: "确认学生服务、资料和未完成事项交接", done: false }
      ].map((item) => ({ ...item, employee, updatedAt: item.done ? nowText() : "" }));
    }

    function offboardingProgress(row) {
      const checklist = Array.isArray(row?.offboardingChecklist) ? row.offboardingChecklist : [];
      if (!checklist.length) return "";
      const done = checklist.filter((item) => item.done).length;
      return `离职流程 ${done}/${checklist.length}`;
    }

    function isOffboardingReady(row) {
      const checklist = Array.isArray(row?.offboardingChecklist) ? row.offboardingChecklist : [];
      return row?.type === "离职" && checklist.length > 0 && checklist.every((item) => item.done);
    }

    function renderOffboardingChecklist(row, index) {
      if (row?.type !== "离职") return "";
      const checklist = Array.isArray(row.offboardingChecklist) && row.offboardingChecklist.length
        ? row.offboardingChecklist
        : buildOffboardingChecklist(row.employee || "");
      const ready = checklist.every((item) => item.done);
      return `
        <div style="margin-top:8px; display:grid; gap:6px;">
          ${checklist.map((item, itemIndex) => `
            <label style="display:flex; gap:6px; align-items:flex-start; color:#637083;">
              <input type="checkbox" data-hr-offboard="${index}" data-offboard-item="${itemIndex}" ${item.done ? "checked" : ""}>
              <span>${escapeHtml(item.label)}${item.updatedAt ? `｜${escapeHtml(item.updatedAt)}` : ""}</span>
            </label>
          `).join("")}
          ${ready && row.status !== "已完成" ? `<button type="button" data-hr-complete-offboard="${index}" style="width:max-content; min-height:32px; padding:0 12px; border-radius:999px; border:1px solid rgba(15,118,110,0.18); background:rgba(15,118,110,0.10); color:#0f766e; cursor:pointer;">完成离职并归档</button>` : ""}
          ${row.status === "已完成" ? `<span class="tag green">离职已完成归档</span>` : ""}
        </div>
      `;
    }

    function updateHrTypeGuidance(options = {}) {
      const type = $("hrTypeInput")?.value || "入职";
      const flowHint = $("hrFlowHint");
      const noteInput = $("hrNoteInput");
      const guide = hrTypeGuides[type] || hrTypeGuides.培训记录;
      if (noteInput) noteInput.placeholder = guide.notePlaceholder;
      if (flowHint) {
        const simpleHints = {
          入职: "入职：填写姓名、登录账号、手机号、岗位、入职日期即可；登录账号建议用姓名拼音，初始密码 10281028。",
          离职: "离职：从候选名单选择员工姓名，保存后会出现离职清单；清单完成后再归档。",
          转正: "转正：选择员工姓名，简单写转正结论即可；系统会保留记录。",
          权限调整: "权限调整：选择员工姓名，备注写需要开通或关闭的权限即可。",
          提成调整: "提成调整：选择员工姓名，备注写调整口径和生效月份即可。",
          培训记录: "培训记录：写员工姓名和培训内容即可。"
        };
        flowHint.innerHTML = simpleHints[type] || guide.hint;
      }
    }

    function applyHrVisibility() {
      document.querySelectorAll("[data-hr-private]").forEach((node) => {
        node.hidden = !canViewHrPrivate;
      });
    }

    function initSummerSchedule() {
      const roleBoard = $("hrRoleBoard");
      if (!roleBoard) return;
      const canEdit = canEditSummerSchedule();
      const roleEditor = $("hrRoleEditorPanel");
      const roleEditorToggle = $("hrRoleEditorToggle");
      const roleAdminToolbar = $("hrRoleAdminToolbar");
      const roleTableWrap = $("hrRoleTableWrap");
      if (roleEditor) roleEditor.hidden = true;
      if (roleAdminToolbar) roleAdminToolbar.hidden = !canEdit;
      if (roleTableWrap) roleTableWrap.hidden = !canEdit;
      setText("hrRoleMessage", canEdit
        ? "岗位宣传栏对全员展示；你可以在这里维护岗位设置。"
        : "岗位宣传栏对全员展示；只有陈雨晴和程志豪可以新增、修改和删除。");
      let roleRows = mergeRowsById(readStore(roleDirectoryKey, []), roleDirectoryKey);
      let editingRoleIndex = -1;
      let currentRoleMembers = [];

      function uniqueNames(values) {
        return [...new Set((Array.isArray(values) ? values : []).map((value) => normalizeName(value)).filter(Boolean))]
          .sort((left, right) => left.localeCompare(right, "zh-CN"));
      }

      function roleTitleOf(row) {
        return normalizeText(row?.title || row?.role);
      }

      function roleDescriptionOf(row) {
        return normalizeText(row?.description || row?.note);
      }

      function roleSortOrderOf(row) {
        const value = Number(row?.sortOrder);
        return Number.isFinite(value) && value > 0 ? value : 9999;
      }

      function roleMemberListOf(row) {
        return uniqueNames(Array.isArray(row?.members)
          ? row.members
          : String(row?.membersText || row?.employee || "")
            .split(/[、,，/]+/));
      }

      function roleRowIdOf(row) {
        return String(ensureRowId(row, roleDirectoryKey)?.rowId || "").trim();
      }

      function cssAttrEscape(value) {
        const text = String(value || "");
        return window.CSS?.escape ? window.CSS.escape(text) : text.replace(/["\\\]]/g, "\\$&");
      }

      function nextRoleSortOrder() {
        const max = roleRows.reduce((highest, row) => Math.max(highest, roleSortOrderOf(row)), 0);
        return max >= 9999 ? 10 : max + 10;
      }

      function roleRowTime(row) {
        const value = normalizeText(row?.updatedAt || row?.createdAt || row?.at || "");
        const parsed = Date.parse(value.replace(/[年月.]/g, "/").replace(/日/g, " "));
        return Number.isFinite(parsed) ? parsed : 0;
      }

      function isSystemPresetRoleRow(row) {
        const createdBy = normalizeText(row?.createdBy);
        const updatedBy = normalizeText(row?.updatedBy);
        return createdBy === "系统预置" && (!updatedBy || updatedBy === "系统预置");
      }

      function roleManualRank(row) {
        const operators = [row?.createdBy, row?.updatedBy].map(normalizeText).filter(Boolean);
        if (operators.some((operator) => operator !== "系统预置")) return 2;
        return isSystemPresetRoleRow(row) ? 0 : 1;
      }

      function preferredRoleRow(rows) {
        return [...rows].sort((left, right) => {
          return roleManualRank(right) - roleManualRank(left)
            || roleRowTime(right) - roleRowTime(left)
            || roleSortOrderOf(left) - roleSortOrderOf(right);
        })[0];
      }

      function dedupeRoleRowsByTitle(rows) {
        const groups = new Map();
        mergeRowsById(rows, roleDirectoryKey).forEach((row) => {
          if (isSystemPresetRoleRow(row)) return;
          const normalized = ensureRowId(row, roleDirectoryKey);
          const title = roleTitleOf(normalized);
          const key = title ? `title:${title}` : `row:${roleRowIdOf(normalized)}`;
          if (!groups.has(key)) groups.set(key, []);
          groups.get(key).push(normalized);
        });
        return [...groups.values()].map((group) => {
          const preferred = preferredRoleRow(group) || group[0];
          const fallbackMembers = group.map(roleMemberListOf).find((members) => members.length) || [];
          const members = roleMemberListOf(preferred).length ? roleMemberListOf(preferred) : fallbackMembers;
          const description = roleDescriptionOf(preferred) || group.map(roleDescriptionOf).find(Boolean) || "";
          const title = roleTitleOf(preferred);
          return ensureRowId({
            ...preferred,
            title,
            role: title || normalizeText(preferred?.role) || "",
            sortOrder: roleSortOrderOf(preferred),
            description,
            note: description,
            members,
            membersText: members.join("、"),
            employee: members.join("、")
          }, roleDirectoryKey);
        }).sort((left, right) => {
          return roleSortOrderOf(left) - roleSortOrderOf(right)
            || roleTitleOf(left).localeCompare(roleTitleOf(right), "zh-CN");
        });
      }

      function normalizeRoleRows(options = {}) {
        const nextRows = dedupeRoleRowsByTitle(roleRows);
        const changed = JSON.stringify(nextRows) !== JSON.stringify(roleRows);
        roleRows = nextRows;
        if (canEdit && options.persist !== false && (changed || options.forceWrite)) {
          writeStore(roleDirectoryKey, roleRows, { restoreDeleted: false, replaceMode: "replace" });
        }
        return changed;
      }

      function syncRoleEmployeeOptions() {
        const datalist = $("hrRoleEmployeeOptions");
        if (!datalist) return;
        datalist.innerHTML = activeHrEmployees().map((employee) => {
          const name = normalizeName(employee.name);
          const meta = [employee.role, employee.subject, employee.scope].map(normalizeText).filter(Boolean).join(" / ");
          return `<option value="${escapeHtml(name)}"${meta ? ` label="${escapeHtml(meta)}"` : ""}></option>`;
        }).join("");
      }

      function syncRoleNameOptions() {
        const datalist = $("hrRoleNameOptions");
        if (!datalist) return;
        const names = new Set();
        roleRows.forEach((row) => {
          const name = roleTitleOf(row);
          if (name) names.add(name);
        });
        datalist.innerHTML = [...names].sort((left, right) => left.localeCompare(right, "zh-CN"))
          .map((name) => `<option value="${escapeHtml(name)}"></option>`)
          .join("");
      }

      function renderSelectedRoleMembers() {
        const container = $("hrRoleSelectedMembers");
        if (!container) return;
        if (!currentRoleMembers.length) {
          container.innerHTML = `<span style="color:#637083; font-size:12px;">还没有添加人员。输入老师姓名后点击“加入人员”。</span>`;
          return;
        }
        container.innerHTML = currentRoleMembers.map((name) => `
          <span class="person-chip">
            ${escapeHtml(name)}
            <button type="button" data-role-member-remove="${escapeHtml(name)}" aria-label="移除 ${escapeHtml(name)}">×</button>
          </span>
        `).join("");
      }

      function resetRoleForm() {
        ["hrRoleTitleInput", "hrRoleLocationInput", "hrRoleDescriptionInput", "hrRoleMemberInput", "hrRoleSortInput"].forEach((id) => {
          const node = $(id);
          if (node) node.value = "";
        });
        const statusInput = $("hrRoleStatusInput");
        if (statusInput) statusInput.value = "启用";
        const sortInput = $("hrRoleSortInput");
        if (sortInput) sortInput.value = String(nextRoleSortOrder());
        currentRoleMembers = [];
        editingRoleIndex = -1;
        renderSelectedRoleMembers();
        setText("hrRoleSaveButton", "保存岗位设置");
      }

      function closeRoleEditor() {
        if (roleEditor) roleEditor.hidden = true;
        setText("hrRoleEditorToggle", "新增岗位");
        resetRoleForm();
      }

      function openRoleEditor(row, index) {
        if (!roleEditor) return;
        roleEditor.hidden = false;
        setText("hrRoleEditorToggle", "收起编辑");
        $("hrRoleSortInput").value = String(roleSortOrderOf(row));
        $("hrRoleTitleInput").value = roleTitleOf(row) || "";
        $("hrRoleLocationInput").value = normalizeText(row?.location) || "";
        $("hrRoleStatusInput").value = normalizeText(row?.status) || "启用";
        $("hrRoleDescriptionInput").value = roleDescriptionOf(row) || "";
        $("hrRoleMemberInput").value = "";
        currentRoleMembers = roleMemberListOf(row);
        editingRoleIndex = index;
        renderSelectedRoleMembers();
        setText("hrRoleSaveButton", "保存修改");
      }

      function sortedRoleEntries() {
        return roleRows
          .map((row, index) => ({ row, index }))
          .sort((left, right) => {
            const leftStatus = normalizeText(left.row?.status) === "停用" ? 1 : 0;
            const rightStatus = normalizeText(right.row?.status) === "停用" ? 1 : 0;
            return leftStatus - rightStatus
              || roleSortOrderOf(left.row) - roleSortOrderOf(right.row)
              || roleTitleOf(left.row).localeCompare(roleTitleOf(right.row), "zh-CN");
          });
      }

      function renderRoleBoard() {
        const entries = sortedRoleEntries();
        if (!entries.length) {
          roleBoard.innerHTML = `<div class="role-empty">暂无岗位设置。新增后，这里会展示负责人、岗位和职责说明。</div>`;
          return;
        }
        roleBoard.innerHTML = entries.map(({ row }) => {
          const title = roleTitleOf(row) || "未命名岗位";
          const members = roleMemberListOf(row);
          const displayName = members.length ? members.join("、") : "待安排";
          const description = roleDescriptionOf(row) || "岗位职责待补充。";
          const rowId = roleRowIdOf(row);
          return `
            <div class="role-card" ${canEdit ? `draggable="true" data-role-row-id="${escapeHtml(rowId)}"` : ""}>
              <div class="role-card-name">${escapeHtml(displayName)}</div>
              <div class="role-card-title">${escapeHtml(title)}</div>
              <p>${escapeHtml(description)}</p>
              ${canEdit ? `<span class="role-drag-hint">拖动调整展示顺序</span>` : ""}
            </div>
          `;
        }).join("");
      }

      function renderRoleTable() {
        const tableBody = $("hrRoleTableBody");
        if (!tableBody) return;
        const entries = sortedRoleEntries();
        tableBody.innerHTML = entries.length ? entries.map(({ row, index }) => `
          <tr>
            <td>${escapeHtml(String(roleSortOrderOf(row)))}</td>
            <td><strong>${escapeHtml(roleTitleOf(row) || "-")}</strong></td>
            <td>${roleMemberListOf(row).length ? roleMemberListOf(row).map((name) => `<span class="person-chip">${escapeHtml(name)}</span>`).join("") : "-"}</td>
            <td>${escapeHtml(normalizeText(row?.location) || "-")}</td>
            <td>${normalizeText(row?.status) === "停用" ? tag("停用", "warn") : tag("启用", "good")}</td>
            <td>${escapeHtml(roleDescriptionOf(row) || "-")}</td>
            <td>${canEdit ? actionButtons(index, { update: true, delete: true }) : tag("仅查看", "neutral")}</td>
          </tr>
        `).join("") : `<tr><td colspan="7">暂无岗位设置。新增后，这里会形成长期岗位台账。</td></tr>`;
      }

      function renderRoleViews() {
        syncRoleEmployeeOptions();
        syncRoleNameOptions();
        renderSelectedRoleMembers();
        renderRoleBoard();
        renderRoleTable();
      }

      function saveRoleBoardOrder() {
        if (!canEdit) return;
        const orderedIds = [...roleBoard.querySelectorAll(".role-card[data-role-row-id]")]
          .map((node) => normalizeText(node.getAttribute("data-role-row-id")))
          .filter(Boolean);
        if (!orderedIds.length) return;
        const idSet = new Set(orderedIds);
        const byId = new Map(roleRows.map((row) => [roleRowIdOf(row), row]));
        const orderedRows = orderedIds.map((id) => byId.get(id)).filter(Boolean);
        const restRows = roleRows.filter((row) => !idSet.has(roleRowIdOf(row)));
        roleRows = [...orderedRows, ...restRows].map((row, index) => ({
          ...row,
          sortOrder: (index + 1) * 10,
          updatedAt: nowText(),
          updatedBy: currentOperator().name || ""
        }));
        normalizeRoleRows({ forceWrite: true });
        renderRoleViews();
        recordAudit(moduleKey, "调整岗位顺序", "岗位宣传栏", `${orderedRows.length} 个岗位`);
        setText("hrRoleMessage", "岗位展示顺序已保存到云端，其他老师刷新后会看到新顺序。");
      }

      let draggedRoleRowId = "";
      roleBoard.addEventListener("dragstart", (event) => {
        if (!canEdit) return;
        const card = event.target.closest(".role-card[data-role-row-id]");
        if (!card) return;
        draggedRoleRowId = normalizeText(card.getAttribute("data-role-row-id"));
        card.classList.add("dragging");
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", draggedRoleRowId);
      });
      roleBoard.addEventListener("dragover", (event) => {
        if (!canEdit || !draggedRoleRowId) return;
        const draggedCard = roleBoard.querySelector(`.role-card[data-role-row-id="${cssAttrEscape(draggedRoleRowId)}"]`);
        const targetCard = event.target.closest(".role-card[data-role-row-id]");
        if (!draggedCard || !targetCard || targetCard === draggedCard) return;
        event.preventDefault();
        const rect = targetCard.getBoundingClientRect();
        const beforeTarget = event.clientY < rect.top + rect.height / 2;
        roleBoard.insertBefore(draggedCard, beforeTarget ? targetCard : targetCard.nextSibling);
      });
      roleBoard.addEventListener("dragend", () => {
        if (!canEdit || !draggedRoleRowId) return;
        roleBoard.querySelectorAll(".role-card.dragging").forEach((node) => node.classList.remove("dragging"));
        draggedRoleRowId = "";
        saveRoleBoardOrder();
      });

      if (roleEditorToggle) {
        roleEditorToggle.addEventListener("click", () => {
          if (!roleEditor) return;
          if (roleEditor.hidden) {
            if (editingRoleIndex < 0) resetRoleForm();
            roleEditor.hidden = false;
            setText("hrRoleEditorToggle", "收起编辑");
            return;
          }
          closeRoleEditor();
        });
      }

      $("hrRoleAddMemberButton")?.addEventListener("click", () => {
        if (!canEdit) {
          setText("hrRoleMessage", "当前账号只能查看岗位设置，不能修改。");
          return;
        }
        const input = $("hrRoleMemberInput");
        const rawName = normalizeName(input?.value);
        if (!rawName) {
          setText("hrRoleMessage", "请先输入要加入岗位的老师姓名。");
          return;
        }
        const matched = matchActiveHrEmployee(rawName);
        if (activeHrEmployees().length && !matched) {
          setText("hrRoleMessage", "请从在职员工名单里选择完整姓名后再加入。");
          return;
        }
        const employeeName = normalizeName(matched?.name || rawName);
        if (currentRoleMembers.includes(employeeName)) {
          setText("hrRoleMessage", `${employeeName} 已经在当前岗位人员里了。`);
          return;
        }
        currentRoleMembers = uniqueNames([...currentRoleMembers, employeeName]);
        if (input) input.value = "";
        renderSelectedRoleMembers();
        setText("hrRoleMessage", `已把 ${employeeName} 加入当前岗位人员。`);
      });

      $("hrRoleMemberInput")?.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        $("hrRoleAddMemberButton")?.click();
      });

      $("hrRoleSelectedMembers")?.addEventListener("click", (event) => {
        const button = event.target.closest("[data-role-member-remove]");
        if (!button) return;
        const targetName = normalizeName(button.getAttribute("data-role-member-remove"));
        currentRoleMembers = currentRoleMembers.filter((name) => name !== targetName);
        renderSelectedRoleMembers();
        setText("hrRoleMessage", `已移除 ${targetName}。`);
      });

      $("hrRoleSaveButton")?.addEventListener("click", () => {
        if (!canEdit) {
          setText("hrRoleMessage", "当前账号只能查看岗位设置，不能修改。");
          return;
        }
        const title = normalizeText($("hrRoleTitleInput")?.value);
        if (!title) {
          setText("hrRoleMessage", "请先填写岗位名称。");
          return;
        }
        const duplicated = roleRows.find((row, index) => roleTitleOf(row) === title && index !== editingRoleIndex);
        if (duplicated) {
          setText("hrRoleMessage", `岗位“${title}”已经存在，请直接编辑原岗位，避免重复建立。`);
          return;
        }
        const members = uniqueNames(currentRoleMembers);
        const payload = {
          title,
          role: title,
          sortOrder: Math.max(1, Number($("hrRoleSortInput")?.value) || nextRoleSortOrder()),
          location: normalizeText($("hrRoleLocationInput")?.value) || "-",
          status: normalizeText($("hrRoleStatusInput")?.value) || "启用",
          description: normalizeText($("hrRoleDescriptionInput")?.value) || "-",
          note: normalizeText($("hrRoleDescriptionInput")?.value) || "-",
          members,
          membersText: members.join("、"),
          employee: members.join("、"),
          updatedAt: nowText(),
          updatedBy: currentOperator().name || ""
        };
        if (editingRoleIndex >= 0) {
          roleRows[editingRoleIndex] = {
            ...roleRows[editingRoleIndex],
            ...payload,
            createdAt: roleRows[editingRoleIndex].createdAt || nowText(),
            createdBy: roleRows[editingRoleIndex].createdBy || currentOperator().name || ""
          };
          recordAudit(moduleKey, "更新岗位设置", title, payload.membersText || "未安排人员");
          setText("hrRoleMessage", `已更新岗位“${title}”。`);
        } else {
          roleRows.unshift({
            ...payload,
            createdAt: nowText(),
            createdBy: currentOperator().name || ""
          });
          recordAudit(moduleKey, "新增岗位设置", title, payload.membersText || "未安排人员");
          setText("hrRoleMessage", `已新增岗位“${title}”。`);
        }
        normalizeRoleRows({ forceWrite: true });
        renderRoleViews();
        closeRoleEditor();
      });

      $("hrRoleCancelButton")?.addEventListener("click", () => {
        closeRoleEditor();
        setText("hrRoleMessage", "已取消岗位设置编辑。");
      });

      bindRowActions("hrRoleTableBody", {
        onEdit(index) {
          if (!canEdit) return;
          openRoleEditor(roleRows[index], index);
          setText("hrRoleMessage", `正在编辑岗位“${roleTitleOf(roleRows[index]) || "未命名岗位"}”。`);
        },
        onDelete(index) {
          if (!canEdit) return;
          const row = roleRows[index];
          const title = roleTitleOf(row) || "未命名岗位";
          if (!window.confirm(`确定删除岗位“${title}”吗？`)) return;
          markRowDeleted(roleDirectoryKey, row);
          roleRows.splice(index, 1);
          normalizeRoleRows({ forceWrite: true });
          recordAudit(moduleKey, "删除岗位设置", title, row?.membersText || "未安排人员");
          closeRoleEditor();
          renderRoleViews();
          setText("hrRoleMessage", `已删除岗位“${title}”。`);
        }
      }, { update: canEdit, delete: canEdit }, "hrRoleMessage");

      normalizeRoleRows({ persist: !window.JRC_CLOUD?.readModuleData, forceWrite: !window.JRC_CLOUD?.readModuleData });
      renderRoleViews();
      readCloudStore(roleDirectoryKey, (cloudRows) => {
        roleRows = mergeRowsById(cloudRows, roleDirectoryKey);
        normalizeRoleRows({ forceWrite: true });
        renderRoleViews();
        setText("hrRoleMessage", canEdit ? "已同步云端岗位设置，可继续维护。" : "已同步云端岗位设置。");
      });
    }

    applyHrVisibility();
    initSummerSchedule();
    if (!canViewHrPrivate || !$("hrTaskTableBody")) return;

    function sanitizeRows(input) {
      const oldSeedTypes = ["员工基础档案核对", "系统权限分组", "培训记录归档"];
      return (Array.isArray(input) ? input : []).filter((row) => !oldSeedTypes.includes(row.type));
    }
    let rows = mergeRowsById(sanitizeRows(readStore(key, [])), key);
    let editingIndex = -1;

    function fillForm(row) {
      $("hrTypeInput").value = row.type || "培训记录";
      $("hrEmployeeInput").value = row.employee || "";
      $("hrUsernameInput").value = row.username || "";
      $("hrPhoneInput").value = row.phone || "";
      $("hrRoleInput").value = row.role || "授课老师";
      $("hrHireDateInput").value = formatDateOnly(row.hireDate) || "";
      $("hrRegularDateInput").value = formatDateOnly(row.regularDate) || "";
      $("hrNoteInput").value = row.note || "";
      updateHrTypeGuidance();
    }

    function resetForm() {
      fillForm(defaults);
      editingIndex = -1;
      setText("hrSaveButton", "保存人事管理事项");
      updateHrTypeGuidance();
    }

    function buildRegularizationReminders(employees) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const remindDays = 30;
      const remindEnd = new Date(today);
      remindEnd.setDate(remindEnd.getDate() + remindDays);
      return (Array.isArray(employees) ? employees : [])
        .map((employee) => {
          const name = normalizeName(employee?.name);
          if (!name) return null;
          const hireDate = formatDateOnly(employee?.hireDate);
          const regularDate = formatDateOnly(employee?.regularDate);
          if (!hireDate || !regularDate) {
            const missing = [
              !hireDate ? "入职日期" : "",
              !regularDate ? "转正日期" : ""
            ].filter(Boolean).join("、");
            return {
              name,
              reason: `未填${missing}`,
              sortTime: 0,
              type: "missing"
            };
          }
          const regularTime = parseDateValue(regularDate);
          if (!regularTime) {
            return {
              name,
              reason: `转正日期格式需核对：${regularDate}`,
              sortTime: 0,
              type: "invalid"
            };
          }
          const regularDay = new Date(regularTime);
          regularDay.setHours(0, 0, 0, 0);
          if (regularDay.getTime() === today.getTime()) {
            return {
              name,
              reason: `今日转正：${regularDate}，请确认是否已办理`,
              sortTime: regularDay.getTime(),
              type: "today"
            };
          }
          if (regularDay < today) return null;
          if (regularDay <= remindEnd) {
            const daysLeft = Math.max(1, Math.ceil((regularDay.getTime() - today.getTime()) / 86400000));
            return {
              name,
              reason: `${regularDate} 转正，剩 ${daysLeft} 天`,
              sortTime: regularDay.getTime(),
              type: "upcoming"
            };
          }
          return null;
        })
        .filter(Boolean)
        .sort((left, right) => left.sortTime - right.sortTime || left.name.localeCompare(right.name, "zh-CN"));
    }

    function renderRegularizationMetric(employees) {
      const reminders = buildRegularizationReminders(employees);
      setText("hrMetricRegular", reminders.length);
      setText("hrMetricRegularHint", reminders.length ? "点击查看对应员工" : "未来 30 天暂无提醒");
      const detailNode = $("hrMetricRegularDetail");
      if (detailNode) {
        detailNode.textContent = reminders.length
          ? reminders.slice(0, 3).map((item) => `${item.name}：${item.reason}`).join("；")
          : "暂无待处理";
        detailNode.classList.toggle("warning", reminders.length > 0);
      }
      const card = $("hrRegularMetricCard");
      if (card) {
        card.dataset.employee = reminders[0]?.name || "";
        card.title = reminders.length
          ? `点击查看：${reminders.map((item) => item.name).join("、")}`
          : "暂无待转正提醒";
      }
    }

    function showRegularizationEmployee() {
      const card = $("hrRegularMetricCard");
      const targetName = normalizeName(card?.dataset.employee);
      const directory = document.querySelector("[data-employee-directory]");
      const toggle = document.querySelector("[data-employee-directory-toggle]");
      const search = document.querySelector("[data-employee-search]");
      if (!directory || !targetName) return;
      directory.hidden = false;
      if (toggle) {
        toggle.setAttribute("aria-expanded", "true");
        toggle.textContent = "收起名单";
      }
      if (search) {
        search.value = targetName;
        search.dispatchEvent(new Event("input", { bubbles: true }));
      }
      directory.querySelectorAll(".jrc-employee-card").forEach((node) => {
        node.style.outline = "";
        node.style.boxShadow = "";
      });
      const targetCard = [...directory.querySelectorAll(".jrc-employee-card")].find((node) => {
        return (node.getAttribute("data-employee-name") || "").includes(targetName.toLowerCase());
      });
      if (targetCard) {
        targetCard.hidden = false;
        targetCard.style.outline = "2px solid rgba(180, 83, 9, 0.45)";
        targetCard.style.boxShadow = "0 0 0 6px rgba(180, 83, 9, 0.10)";
        targetCard.scrollIntoView({ behavior: "smooth", block: "center" });
      } else {
        directory.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }

    function render() {
      const keyword = $("hrFilterInput")?.value.trim().toLowerCase() || "";
      const sortValue = $("hrSortSelect")?.value || "newest";
      const entries = getSortedEntries(rows, keyword, sortValue, (row) => row.status, ["待处理", "处理中", "已完成"]);
      $("hrTaskTableBody").innerHTML = entries.length ? entries
        .map(({ row, index }) => `
          <tr>
            <td>${escapeHtml(row.type)}</td>
            <td>${escapeHtml(row.employee)}</td>
            <td>${escapeHtml([row.role, row.phone].map(normalizeText).filter(Boolean).join(" / ") || "-")}</td>
            <td>${workStatusTag(row.status)}${isOffboardingReady(row) && row.status !== "已完成" ? "<br><span class=\"tag green\">可完成</span>" : ""}</td>
            <td>${escapeHtml([row.hireDate ? `入职：${row.hireDate}` : "", row.regularDate ? `转正：${row.regularDate}` : "", row.note].filter(Boolean).join("；") || row.next || "-")}${offboardingProgress(row) ? `<br><span class="tag green">${escapeHtml(offboardingProgress(row))}</span>` : ""}${renderOffboardingChecklist(row, index)}</td>
            <td>${actionButtons(index, capabilities)}</td>
          </tr>
        `).join("") : `<tr><td colspan="6">暂无人事事项。新增入职、离职、转正或培训后会显示在这里。</td></tr>`;
      const employees = Array.isArray(window.JRC_EMPLOYEES) ? window.JRC_EMPLOYEES : [];
      renderHrEmployeeOptions();
      setText("hrMetricEmployees", employees.length || 0);
      renderRegularizationMetric(employees);
      setText("hrMetricCommission", employees.filter((employee) => employee.commissionRate).length);
      setText("hrMetricTraining", rows.filter((row) => row.type === "培训记录" || row.system.includes("知识库")).length);
      renderAuditLog(moduleKey, "hrAuditTableBody");
    }

    $("hrRegularMetricCard")?.addEventListener("click", showRegularizationEmployee);
    $("hrRegularMetricCard")?.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      showRegularizationEmployee();
    });

    $("hrSaveButton")?.addEventListener("click", async () => {
      const actionAllowed = editingIndex >= 0 ? capabilities.update : capabilities.create;
      if (!actionAllowed) {
        denyAction("hrMessage", editingIndex >= 0 ? "修改" : "新增");
        return;
      }
      const employee = normalizeName($("hrEmployeeInput")?.value);
      if (!employee) {
        setText("hrMessage", "请先填写员工姓名或对象。");
        return;
      }
      const type = $("hrTypeInput")?.value || "培训记录";
      const exactEmployeeRequiredTypes = ["离职", "转正", "权限调整", "提成调整"];
      if (exactEmployeeRequiredTypes.includes(type) && activeHrEmployees().length && !matchActiveHrEmployee(employee)) {
        setText("hrMessage", `${type}事项请从在职员工候选里选择完整员工姓名。可以输入姓氏或名字后，在弹出的候选里点选。`);
        return;
      }
      const role = normalizeText($("hrRoleInput")?.value) || "授课老师";
      const username = normalizeText($("hrUsernameInput")?.value).toLowerCase();
      const phone = normalizeText($("hrPhoneInput")?.value);
      const hireDate = formatDateOnly($("hrHireDateInput")?.value);
      const regularDate = formatDateOnly($("hrRegularDateInput")?.value);
      const note = normalizeText($("hrNoteInput")?.value);
      if (type === "入职" && !username) {
        setText("hrMessage", "入职请填写登录账号，建议使用姓名拼音。");
        return;
      }
      let accountMessage = "";
      if (type === "入职" && typeof window.JRC_UPSERT_EMPLOYEE_FROM_HR === "function") {
        const result = await window.JRC_UPSERT_EMPLOYEE_FROM_HR({
          name: employee,
          employee,
          username,
          phone,
          role,
          hireDate,
          regularDate,
          permissions: []
        });
        if (!result.ok) {
          setText("hrMessage", result.message || "员工账号保存失败，请核对姓名和手机号。");
          return;
        }
        accountMessage = result.message || "";
      }
      const systemByType = {
        入职: "员工档案、登录账号、岗位权限",
        离职: "员工档案、登录账号、权限、财务结算",
        转正: "员工档案、转正记录",
        权限调整: "员工档案、系统权限",
        提成调整: "员工档案、财务提成",
        培训记录: "人事培训"
      };
      const nextByType = {
        入职: "已按岗位生成默认权限，后续可在全员名单微调",
        离职: "按离职清单逐项确认",
        转正: "已记录转正结果",
        权限调整: "按备注调整权限",
        提成调整: "同步财务核对",
        培训记录: "培训记录已归档"
      };
      const payload = {
        type,
        employee,
        phone,
        username,
        role,
        hireDate,
        regularDate,
        system: systemByType[type] || "-",
        status: type === "离职" ? "处理中" : "已完成",
        owner: currentOperator().name || "-",
        next: nextByType[type] || "-",
        note: note || "-",
        offboardingChecklist: type === "离职"
          ? editingIndex >= 0 && Array.isArray(rows[editingIndex].offboardingChecklist)
            ? rows[editingIndex].offboardingChecklist
            : buildOffboardingChecklist(employee)
          : undefined,
        createdAt: editingIndex >= 0 ? rows[editingIndex].createdAt : nowText(),
        updatedAt: nowText()
      };
      if (editingIndex >= 0) {
        rows[editingIndex] = payload;
        recordAudit(moduleKey, "更新", employee, `${payload.type} / ${payload.status}`);
        setText("hrMessage", type === "离职" ? `已更新 ${employee} 的离职流程。清单全部确认后，请点击“完成离职并归档”结束流程。` : `已更新 ${employee} 的事项。`);
      } else {
        rows.unshift(payload);
        recordAudit(moduleKey, "新增", employee, `${payload.type} / ${payload.status}`);
        setText("hrMessage", type === "离职" ? `已创建 ${employee} 的离职流程。清单全部确认后，会出现“完成离职并归档”按钮。` : `${accountMessage || `已保存 ${employee} 的事项。`}`);
      }
      writeStore(key, rows);
      resetForm();
      render();
    });
    $("hrTypeInput")?.addEventListener("change", () => {
      updateHrTypeGuidance({ forceDefaults: true });
    });
    $("hrEmployeeInput")?.addEventListener("change", () => {
      const type = $("hrTypeInput")?.value || "";
      const employee = normalizeName($("hrEmployeeInput")?.value);
      if (["离职", "转正", "权限调整", "提成调整"].includes(type) && employee && activeHrEmployees().length && !matchActiveHrEmployee(employee)) {
        setText("hrMessage", `${type}事项建议从候选名单选择完整姓名，避免只填姓氏或同名误选。`);
      }
    });
    $("hrFilterInput")?.addEventListener("input", render);
    $("hrSortSelect")?.addEventListener("change", render);
    $("hrTaskTableBody")?.addEventListener("change", (event) => {
      const checkbox = event.target.closest("[data-hr-offboard]");
      if (!checkbox) return;
      if (!capabilities.update) {
        checkbox.checked = !checkbox.checked;
        denyAction("hrMessage", "修改");
        return;
      }
      const rowIndex = Number(checkbox.getAttribute("data-hr-offboard"));
      const itemIndex = Number(checkbox.getAttribute("data-offboard-item"));
      if (!rows[rowIndex]) return;
      const checklist = Array.isArray(rows[rowIndex].offboardingChecklist) && rows[rowIndex].offboardingChecklist.length
        ? rows[rowIndex].offboardingChecklist
        : buildOffboardingChecklist(rows[rowIndex].employee || "");
      if (!checklist[itemIndex]) return;
      checklist[itemIndex] = {
        ...checklist[itemIndex],
        done: checkbox.checked,
        updatedAt: checkbox.checked ? nowText() : ""
      };
      rows[rowIndex] = { ...rows[rowIndex], offboardingChecklist: checklist, updatedAt: nowText() };
      writeStore(key, rows);
      recordAudit(moduleKey, "离职流程", rows[rowIndex].employee, `${checklist[itemIndex].label}：${checkbox.checked ? "已完成" : "未完成"}`);
      render();
      setText("hrMessage", `已更新 ${rows[rowIndex].employee} 的离职流程。`);
    });
    $("hrTaskTableBody")?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-hr-complete-offboard]");
      if (!button) return;
      if (!capabilities.update) {
        denyAction("hrMessage", "修改");
        return;
      }
      const rowIndex = Number(button.getAttribute("data-hr-complete-offboard"));
      const row = rows[rowIndex];
      if (!row || row.type !== "离职") return;
      const checklist = Array.isArray(row.offboardingChecklist) ? row.offboardingChecklist : [];
      if (!checklist.length || !checklist.every((item) => item.done)) {
        setText("hrMessage", "离职流程还没有全部勾选完成，暂不能归档。");
        return;
      }
      if (typeof window.JRC_MARK_EMPLOYEE_DEPARTED === "function") {
        const result = window.JRC_MARK_EMPLOYEE_DEPARTED(row.employee, { reason: row.note || "离职流程完成归档" });
        if (!result.ok) {
          setText("hrMessage", result.message || "离职归档失败，请确认员工是否仍在在职名单。");
          return;
        }
      }
      rows[rowIndex] = {
        ...row,
        status: "已完成",
        next: "离职流程已完成归档",
        offboardingCompletedAt: nowText(),
        updatedAt: nowText()
      };
      writeStore(key, rows);
      recordAudit(moduleKey, "完成离职", row.employee, "离职流程已完成归档");
      render();
      setText("hrMessage", `${row.employee} 的离职流程已完成归档，并已从在职员工名单移出。`);
    });
    $("hrExportButton")?.addEventListener("click", () => guardAction(capabilities.export, "hrMessage", "导出", () => downloadCsv("人事管理事项数据.csv", rows, [
      { label: "事项类型", value: "type" },
      { label: "员工姓名", value: "employee" },
      { label: "登录账号", value: "username" },
      { label: "手机号", value: "phone" },
      { label: "岗位", value: "role" },
      { label: "入职日期", value: "hireDate" },
      { label: "转正日期", value: "regularDate" },
      { label: "状态", value: "status" },
      { label: "备注", value: "note" },
      { label: "创建时间", value: "createdAt" }
    ])));
    $("hrResetButton")?.addEventListener("click", () => {
      if (!capabilities.reset) {
        denyAction("hrMessage", "清空");
        return;
      }
      markRowsDeleted(key, rows);
      rows = [];
      writeStore(key, rows, { restoreDeleted: false });
      recordAudit(moduleKey, "清空", "人事管理台账", "0 条");
      resetForm();
      render();
      setText("hrMessage", "已清空本页台账。员工账号名单不受影响。");
    });
    bindRowActions("hrTaskTableBody", {
      onEdit(index) {
        editingIndex = index;
        fillForm(rows[index]);
        setText("hrSaveButton", "保存修改");
        setText("hrMessage", `正在编辑 ${rows[index].employee} 的事项。`);
      },
      onDelete(index) {
        const removed = rows[index];
        markRowDeleted(key, removed);
        rows.splice(index, 1);
        writeStore(key, rows, { restoreDeleted: false });
        recordAudit(moduleKey, "删除", removed.employee, removed.type);
        if (editingIndex === index) resetForm();
        render();
        setText("hrMessage", `已删除 ${removed.employee} 的事项。`);
      }
    }, capabilities, "hrMessage");
    bindTableImport({
      buttonId: "hrImportButton",
      inputId: "hrImportInput",
      getRows: () => rows,
      setRows(nextRows) {
        rows = nextRows;
        writeStore(key, rows);
        resetForm();
        render();
      },
      normalizeRow(row) {
        const employee = normalizeName(readField(row, ["employee", "员工姓名", "老师姓名", "对象", "姓名"]));
        if (!employee) return null;
        return {
          type: normalizeStatus(readField(row, ["type", "事项类型", "类型"], "培训记录"), ["入职", "转正", "权限调整", "提成调整", "培训记录", "员工基础档案核对", "系统权限分组"], "培训记录"),
          employee,
          username: normalizeText(readField(row, ["username", "登录账号", "用户名", "账号"], "")),
          phone: normalizeText(readField(row, ["phone", "手机号", "电话", "联系电话"], "")),
          role: normalizeText(readField(row, ["role", "岗位", "角色"], "")),
          hireDate: formatDateOnly(readField(row, ["hireDate", "入职日期", "入职时间"], "")),
          regularDate: formatDateOnly(readField(row, ["regularDate", "转正日期", "转正时间"], "")),
          system: normalizeText(readField(row, ["system", "关联系统", "系统"], "-")) || "-",
          status: normalizeStatus(readField(row, ["status", "处理状态", "状态"], "待处理"), ["待处理", "处理中", "已完成"], "待处理"),
          owner: normalizeName(readField(row, ["owner", "负责人"], "-")) || "-",
          next: normalizeText(readField(row, ["next", "下一步"], "-")) || "-",
          note: normalizeText(readField(row, ["note", "事项说明", "说明", "备注"], "-")) || "-",
          createdAt: String(readField(row, ["createdAt", "创建时间", "时间"], nowText())),
          updatedAt: String(readField(row, ["updatedAt", "更新时间"], nowText()))
        };
      },
      onDone(count) {
        recordAudit(moduleKey, "导入", "人事管理台账", `${count} 条`);
        renderAuditLog(moduleKey, "hrAuditTableBody");
        setText("hrMessage", `已导入 ${count} 条人事事项。`);
      },
      onError() {
        setText("hrMessage", "导入失败。请上传 CSV/TSV/JSON；Excel 可以先另存为 CSV。");
      },
      canUse: () => capabilities.import,
      onDenied: () => denyAction("hrMessage", "导入")
    });
    resetForm();
    render();
    readCloudStore(key, (cloudRows) => {
      rows = mergeRowsById(sanitizeRows(cloudRows), key);
      if (rows.length !== cloudRows.length) writeStore(key, rows);
      resetForm();
      render();
      setText("hrMessage", "已同步云端人事管理台账。");
    });
    applyCapabilityGate({
      canWrite: capabilities.create || capabilities.update,
      messageId: "hrMessage",
      buttonRules: [["hrSaveButton", capabilities.create || capabilities.update, "新增或修改"], ["hrImportButton", capabilities.import, "导入"], ["hrExportButton", capabilities.export, "导出"], ["hrResetButton", capabilities.reset, "清空"]],
      fieldIds: ["hrTypeInput", "hrEmployeeInput", "hrUsernameInput", "hrPhoneInput", "hrRoleInput", "hrHireDateInput", "hrRegularDateInput", "hrNoteInput"]
    });
  }

  function initCampusOperations() {
    if (!$("campusDisplayGrid") && !$("campusAnnouncementGrid") && !$("campusWorkflowGrid")) return;
    const moduleKey = "campus";
    const canManageCoreOps = isCoreOpsAdmin();
    const capabilities = fixedCapabilities(canManageCoreOps);
    const key = "jrc-campus-operations-v2";
    const campusEmbeddedMode = Boolean($("campusAnnouncementGrid") || $("campusWorkflowGrid"));
    const sectionNames = ["公告公示类", "工作流程类"];
    const categoryMap = {
      公告公示类: ["校区公告", "值班表", "卫生值日表", "学管排班表", "招聘情况", "临时通知"],
      工作流程类: ["新教师试岗筛选流程", "招聘流程", "面试流程", "试用淘汰流程", "入职流程", "离职流程", "请假调课制度", "日常工作制度"]
    };
    const legacyTypes = new Set(["教室", "卫生", "安全检查", "值班", "岗位排班", "暑假排班", "异常记录"]);
    let activeSection = sectionNames.includes(localStorage.getItem("jrc-campus-active-section-v1"))
      ? localStorage.getItem("jrc-campus-active-section-v1")
      : "公告公示类";
    let editingIndex = -1;
    const canEditCampus = canManageCoreOps;
    const campusEditor = $("campusEditorPanel");
    const campusEditorToggle = $("campusEditorToggle");
    const campusExportButton = $("campusExportButton");
    const defaults = {
      section: activeSection,
      category: activeSection === "工作流程类" ? "招聘流程" : "校区公告",
      title: "",
      owner: "全体老师",
      displayDate: "长期有效",
      sortOrder: "",
      content: ""
    };
    const campusDefaultRows = [{
      rowId: "campus-flow-new-teacher-3-4-day-screening-v1",
      section: "工作流程类",
      category: "新教师试岗筛选流程",
      title: "新教师 3～4 天极速筛选上岗流程",
      owner: "招聘及人事负责人 / 教学主管",
      displayDate: "长期有效",
      sortOrder: "1",
      content: `核心目标

3～4 天内判断新教师的学习能力、勤劳度、人品、授课表现力和团队匹配度。合格进入上岗排课，不合格及时淘汰，避免后期用人风险。

总体原则

1. 先刷题，再考试，再试讲，再面谈，再投票。
2. 每天有任务，每天有结果，不养闲人，不拖时间。
3. 第 1 个月保底 6000；只有全部达标后才进入正式排课。
4. 未达标不予上岗、不予录用，不提前形成正式用工依赖。

第 1 天：基础能力 + 学习力 + 勤劳度测试

目标：筛掉基础薄弱、不愿刷题、学习能力弱的人。

执行内容：
1. 入职当天发放对应学段高频题、易错题、典型题。
2. 要求当天刷完指定题量，自行整理错题并标注思路。

观察重点：
1. 是否主动刷题，是否拖延。
2. 做题速度和正确率。
3. 遇到不会的题，是放弃，还是钻研或请教。

当天考核：
晚上进行第一次笔试，内容为当天刷题内容和基础知识点。
合格线：85 分以上。低于 85 分，直接淘汰，当天结束试用。

第 2 天：专业深化 + 态度人品 + 执行力测试

目标：判断是否勤劳、是否愿意钻研、人品是否端正。

执行内容：
1. 针对第 1 天错题进行二次讲解与复盘。
2. 要求新老师独立讲清错题思路，检验吸收能力。
3. 加量刷题，并完成题型归纳。

观察重点：
1. 是否主动多做。
2. 是否抱怨、敷衍、拖延。
3. 是否懒惰、混日子、玻璃心、情绪不稳定。

主管面谈：
围绕职业规划、责任心、抗压能力、纪律意识进行一对一沟通，判断价值观、稳定性和团队匹配度。

当天考核：
晚上进行第二次笔试，难度略提升。
合格线：80 分以上。不达标直接淘汰。

第 3 天：登台试讲 + 团队评分

目标：检验表现力、控场能力、表达能力、台风和学生接受度。

上午准备：
给定题目，独立准备 10～15 分钟试讲内容，观察备课效率和认真程度。

下午试讲：
正式登台试讲，全体老师旁听评分。

评分维度：
1. 表达清晰流畅。
2. 逻辑结构完整。
3. 教态自然大方。
4. 有互动感和控场能力。
5. 知识点准确无误。
6. 课堂节奏把控合理。
7. 有亲和力和感染力。
8. 有应变能力。
9. 备课认真。
10. 整体匹配学校教学风格。

团队投票：
当场匿名投票，选项为：同意上岗 / 继续观察 / 淘汰。
反对票超过 1/3，直接不予录用。

第 4 天：心理沟通 + 最终综合判定

适用情况：需要进一步观察时启用。

主管深度沟通：
重点看性格、边界感、团队协作、服从管理意识。

重点识别：
负能量、斤斤计较、心机重、难以管理、稳定性差的人。

综合判定：
结合两次考试成绩、刷题态度、试讲得分、团队投票、人品与心理状态，当场给出结果。

结果处理：
合格：进入上岗排课流程，第 1 个月保底 6000。
不合格：感谢参与，不予录用，当天结束。

最终上岗硬标准

以下条件缺一不可：
1. 两次笔试成绩达标。
2. 刷题积极主动，无拖延、无敷衍。
3. 试讲评分不低于 85 分。
4. 团队投票通过率不低于 2/3。
5. 人品端正，态度积极，服从管理。
6. 表达清晰，课堂表现力合格。
7. 学习能力强，吸收快，肯钻研。

淘汰原则

只要有一项关键指标不达标，3～4 天内直接淘汰，不进入正式排课，不进入正式用工。

为什么这样做

1. 属于试岗筛选，不合格不录用，风险更低。
2. 每天有产出、有数据、有评分，淘汰理由充分。
3. 学习能力弱，用考试筛掉。
4. 懒惰不钻研，用刷题态度筛掉。
5. 人品不好、心态差，用面谈和观察筛掉。
6. 讲课不行，用试讲和投票筛掉。

执行提醒

这套流程对标郑老师当年的考核模式，核心是快速、公开、可量化。招聘及人事负责人、教学主管需要每天记录结果，做到当天任务当天反馈，合格留用，不合格及时结束试岗。`,
      createdAt: "2026-06-30 00:00:00",
      updatedAt: "2026-06-30 00:00:00"
    }];

    function normalizeContent(value) {
      return String(value || "")
        .replace(/\r\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
    }

    function normalizeSection(value) {
      const text = normalizeText(value);
      return sectionNames.includes(text) ? text : "公告公示类";
    }

    function normalizeCategory(section, value) {
      const text = normalizeText(value);
      if (text) return text;
      return section === "工作流程类" ? "工作流程" : "校区公告";
    }

    function normalizeCampusRow(row) {
      if (!row || typeof row !== "object") return null;
      const rawType = normalizeText(row.section || row.type || row.category || "");
      const section = normalizeSection(row.section || (rawType.includes("流程") || rawType.includes("制度") || rawType.includes("面试") || rawType.includes("招聘") && !rawType.includes("情况") ? "工作流程类" : "公告公示类"));
      const category = normalizeCategory(section, row.category || (legacyTypes.has(rawType) ? (rawType === "暑假排班" || rawType === "岗位排班" || rawType === "值班" ? "值班表" : rawType) : rawType));
      const title = normalizeName(row.title || row.name || row.item || row.事项名称 || row.标题 || "");
      const content = normalizeContent(row.content || row.note || row.description || row.展示正文 || row.正文 || row.说明 || row.备注 || "");
      if (!title && !content) return null;
      return ensureRowId({
        ...row,
        section,
        category,
        title: title || category,
        owner: normalizeText(row.owner || row.scope || row.area || row.适用范围 || row.负责人 || "全体老师") || "全体老师",
        displayDate: normalizeText(row.displayDate || row.date || row.due || row.展示日期 || row.日期 || "长期有效") || "长期有效",
        sortOrder: normalizeText(row.sortOrder || row.order || row.展示排序 || row.排序 || ""),
        content: content || normalizeContent([row.area, row.status, row.due, row.note].filter(Boolean).join("\n")),
        createdAt: String(row.createdAt || row.创建时间 || nowText()),
        updatedAt: String(row.updatedAt || row.更新时间 || nowText())
      }, key);
    }

    function sanitizeRows(input) {
      const oldSeedTitles = ["教室可用状态核对", "暑假值班表", "门店异常记录"];
      return (Array.isArray(input) ? input : [])
        .map(normalizeCampusRow)
        .filter(Boolean)
        .filter((row) => !oldSeedTitles.includes(row.title));
    }

    function mergeCampusRows(input) {
      const incoming = Array.isArray(input) ? input : [];
      return filterDeletedRows(key, mergeRowsById(sanitizeRows([...campusDefaultRows, ...incoming]), key));
    }

    let rows = mergeCampusRows(readStore(key, []));

    function allCategories() {
      const baseSections = campusEmbeddedMode ? sectionNames : [activeSection];
      const set = new Set(baseSections.flatMap((section) => categoryMap[section] || []));
      rows
        .filter((row) => campusEmbeddedMode || row.section === activeSection)
        .forEach((row) => row.category && set.add(row.category));
      return [...set].filter(Boolean);
    }

    function refreshCategoryControls() {
      const categories = allCategories();
      const filter = $("campusCategoryFilter");
      if (filter) {
        const current = filter.value;
        filter.innerHTML = `<option value="">全部类别</option>${categories.map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join("")}`;
        filter.value = categories.includes(current) ? current : "";
      }
      const datalist = $("campusCategoryOptions");
      if (datalist) {
        const all = new Set([...categoryMap["公告公示类"], ...categoryMap["工作流程类"]]);
        rows.forEach((row) => row.category && all.add(row.category));
        datalist.innerHTML = [...all].map((category) => `<option value="${escapeHtml(category)}"></option>`).join("");
      }
    }

    function fillForm(row) {
      const data = row || defaults;
      $("campusSectionInput").value = data.section || activeSection;
      $("campusCategoryInput").value = data.category || "";
      $("campusTitleInput").value = data.title || "";
      $("campusOwnerInput").value = data.owner || "";
      $("campusDateInput").value = data.displayDate || "";
      $("campusOrderInput").value = data.sortOrder || "";
      $("campusContentInput").value = data.content || "";
    }

    function resetForm() {
      editingIndex = -1;
      fillForm({ ...defaults, section: activeSection, category: activeSection === "工作流程类" ? "招聘流程" : "校区公告" });
      setText("campusSaveButton", "保存展示内容");
    }

    function orderValue(row) {
      const number = Number(row.sortOrder);
      return Number.isFinite(number) && number > 0 ? number : 9999;
    }

    function visibleEntries(section = activeSection) {
      const keyword = $("campusFilterInput")?.value.trim().toLowerCase() || "";
      const category = $("campusCategoryFilter")?.value || "";
      return rows
        .map((row, index) => ({ row, index }))
        .filter(({ row }) => row.section === section)
        .filter(({ row }) => !category || row.category === category)
        .filter(({ row }) => rowMatches(row, keyword))
        .sort((left, right) => orderValue(left.row) - orderValue(right.row) || parseDateValue(right.row.updatedAt || right.row.createdAt) - parseDateValue(left.row.updatedAt || left.row.createdAt));
    }

    function openCampusDetail(index) {
      const row = rows[index];
      const modal = $("campusDetailModal");
      if (!row || !modal) return;
      setText("campusDetailTitle", row.title || row.category || "展示内容");
      setText("campusDetailMeta", row.section || "校区运营");
      const content = $("campusDetailContent");
      if (content) content.textContent = row.content || "内容待补充。";
      modal.hidden = false;
      document.body.classList.add("campus-modal-open");
    }

    function closeCampusDetail() {
      const modal = $("campusDetailModal");
      if (!modal) return;
      modal.hidden = true;
      document.body.classList.remove("campus-modal-open");
    }

    function renderCard(row, index) {
      return `
        <article class="campus-display-card">
          <button type="button" data-action="view" data-index="${index}" style="width:100%; display:flex; align-items:center; gap:10px; border:0; background:transparent; padding:0; color:#172132; text-align:left; cursor:pointer;">
            <span aria-hidden="true" style="display:inline-flex; align-items:center; justify-content:center; width:24px; height:24px; border-radius:999px; background:rgba(15,118,110,0.10); color:#0f766e; font-weight:900; flex:0 0 auto;">›</span>
            <strong style="font-size:16px; line-height:1.45;">${escapeHtml(row.title || row.category || "未命名内容")}</strong>
          </button>
          ${canEditCampus ? `<div class="campus-card-actions">${actionButtons(index, capabilities)}</div>` : ""}
        </article>
      `;
    }

    function renderGrid(gridId, section) {
      const grid = $(gridId);
      if (!grid) return;
      const entries = visibleEntries(section);
      grid.innerHTML = entries.length
        ? entries.map(({ row, index }) => renderCard(row, index)).join("")
        : `<div class="campus-empty">当前还没有${escapeHtml(section)}内容。管理员可以点击“编辑校区运营”新增内容。</div>`;
    }

    function render() {
      document.querySelectorAll("[data-campus-section]").forEach((button) => {
        const active = button.getAttribute("data-campus-section") === activeSection;
        button.classList.toggle("active", active);
      });
      const noticeCount = rows.filter((row) => row.section === "公告公示类").length;
      const workflowCount = rows.filter((row) => row.section === "工作流程类").length;
      setText("campusDisplayStatus", campusEmbeddedMode ? `公告 ${noticeCount} 条｜流程 ${workflowCount} 条` : `${activeSection}｜${rows.filter((row) => row.section === activeSection).length} 条`);
      refreshCategoryControls();
      const grid = $("campusDisplayGrid");
      if (grid) {
        const entries = visibleEntries(activeSection);
        grid.innerHTML = entries.length
          ? entries.map(({ row, index }) => renderCard(row, index)).join("")
          : `<div class="campus-empty">当前还没有${escapeHtml(activeSection)}内容。管理员可以点击“编辑校区运营”新增值班表、学管排班表、招聘情况或工作流程。</div>`;
      }
      renderGrid("campusAnnouncementGrid", "公告公示类");
      renderGrid("campusWorkflowGrid", "工作流程类");
      renderAuditLog(moduleKey, "campusAuditTableBody");
    }

    function saveRows(nextRows, options = {}) {
      rows = mergeRowsById(sanitizeRows(nextRows), key);
      writeStore(key, rows, options);
      render();
    }

    function buildPayloadFromForm() {
      const section = normalizeSection($("campusSectionInput")?.value);
      const title = normalizeName($("campusTitleInput")?.value);
      const content = normalizeContent($("campusContentInput")?.value);
      if (!title && !content) return null;
      return ensureRowId({
        ...(editingIndex >= 0 ? rows[editingIndex] : {}),
        section,
        category: normalizeCategory(section, $("campusCategoryInput")?.value),
        title: title || normalizeCategory(section, $("campusCategoryInput")?.value),
        owner: normalizeText($("campusOwnerInput")?.value) || "全体老师",
        displayDate: normalizeText($("campusDateInput")?.value) || "长期有效",
        sortOrder: normalizeText($("campusOrderInput")?.value),
        content,
        createdAt: editingIndex >= 0 ? rows[editingIndex].createdAt : nowText(),
        updatedAt: nowText()
      }, key);
    }

    if (campusEditor) campusEditor.hidden = true;
    if (campusExportButton) campusExportButton.hidden = !canEditCampus;
    if (campusEditorToggle) {
      campusEditorToggle.hidden = !canEditCampus;
      campusEditorToggle.addEventListener("click", () => {
        if (!campusEditor) return;
        campusEditor.hidden = !campusEditor.hidden;
        setText("campusEditorToggle", campusEditor.hidden ? "编辑校区运营" : "收起编辑");
      });
    }

    document.querySelectorAll("[data-campus-section]").forEach((button) => {
      button.addEventListener("click", () => {
        const section = normalizeSection(button.getAttribute("data-campus-section"));
        activeSection = section;
        localStorage.setItem("jrc-campus-active-section-v1", activeSection);
        resetForm();
        render();
      });
    });

    $("campusSaveButton")?.addEventListener("click", () => {
      const actionAllowed = editingIndex >= 0 ? capabilities.update : capabilities.create;
      if (!actionAllowed) return denyAction("campusMessage", editingIndex >= 0 ? "修改" : "新增");
      const payload = buildPayloadFromForm();
      if (!payload) {
        setText("campusMessage", "请至少填写标题或展示正文。");
        return;
      }
      if (editingIndex >= 0) {
        rows[editingIndex] = payload;
        recordAudit(moduleKey, "更新", payload.title, `${payload.section} / ${payload.category}`);
        setText("campusMessage", `已更新展示内容：${payload.title}。`);
      } else {
        rows.unshift(payload);
        recordAudit(moduleKey, "新增", payload.title, `${payload.section} / ${payload.category}`);
        setText("campusMessage", `已保存展示内容：${payload.title}。`);
      }
      saveRows(rows);
      activeSection = payload.section;
      localStorage.setItem("jrc-campus-active-section-v1", activeSection);
      resetForm();
      render();
    });

    $("campusCancelButton")?.addEventListener("click", () => {
      resetForm();
      setText("campusMessage", "已取消编辑。");
    });

    $("campusBulkSaveButton")?.addEventListener("click", () => {
      if (!capabilities.create) return denyAction("campusMessage", "新增");
      const rawText = normalizeContent($("campusBulkTextInput")?.value);
      const titleInput = normalizeName($("campusBulkTitleInput")?.value);
      if (!rawText && !titleInput) {
        setText("campusMessage", "请先粘贴正文或填写标题。");
        return;
      }
      const lines = rawText.split("\n").map((line) => line.trim()).filter(Boolean);
      const title = titleInput || lines[0] || "校区展示内容";
      const content = titleInput ? rawText : lines.slice(1).join("\n") || rawText;
      const section = normalizeSection($("campusBulkSectionInput")?.value);
      const payload = ensureRowId({
        section,
        category: normalizeCategory(section, $("campusBulkCategoryInput")?.value),
        title,
        owner: "全体老师",
        displayDate: "长期有效",
        sortOrder: "",
        content: normalizeContent(content),
        createdAt: nowText(),
        updatedAt: nowText()
      }, key);
      rows.unshift(payload);
      saveRows(rows);
      activeSection = section;
      localStorage.setItem("jrc-campus-active-section-v1", activeSection);
      $("campusBulkTitleInput").value = "";
      $("campusBulkCategoryInput").value = "";
      $("campusBulkTextInput").value = "";
      recordAudit(moduleKey, "粘贴新增", payload.title, `${payload.section} / ${payload.category}`);
      setText("campusMessage", `已根据粘贴内容生成展示：${payload.title}。`);
      render();
    });

    $("campusFilterInput")?.addEventListener("input", render);
    $("campusCategoryFilter")?.addEventListener("change", render);
    $("campusExportButton")?.addEventListener("click", () => guardAction(capabilities.export, "campusMessage", "导出", () => downloadCsv("校区运营展示内容.csv", rows, [
      { label: "所属板块", value: "section" },
      { label: "内容类别", value: "category" },
      { label: "标题", value: "title" },
      { label: "适用范围/负责人", value: "owner" },
      { label: "展示日期", value: "displayDate" },
      { label: "展示排序", value: "sortOrder" },
      { label: "展示正文", value: "content" },
      { label: "创建时间", value: "createdAt" },
      { label: "更新时间", value: "updatedAt" }
    ])));

    $("campusResetButton")?.addEventListener("click", () => {
      if (!capabilities.reset) return denyAction("campusMessage", "清空");
      if (!window.confirm("确定清空全部校区运营展示内容吗？")) return;
      markRowsDeleted(key, rows);
      rows = [];
      writeStore(key, rows, { restoreDeleted: false, replaceMode: "replace" });
      recordAudit(moduleKey, "清空", "校区运营展示内容", "0 条");
      resetForm();
      render();
      setText("campusMessage", "已清空校区运营展示内容。后续可重新新增或导入。");
    });

    function bindCampusGridActions(gridId) {
      $(gridId)?.addEventListener("click", (event) => {
        const button = event.target.closest("button[data-action]");
        if (!button) return;
        const action = button.getAttribute("data-action");
        const index = Number(button.getAttribute("data-index"));
        if (action === "view") {
          openCampusDetail(index);
          return;
        }
        if (action === "edit") {
          guardAction(capabilities.update, "campusMessage", "修改", () => {
            editingIndex = index;
            fillForm(rows[index]);
            if (campusEditor) campusEditor.hidden = false;
            setText("campusEditorToggle", "收起编辑");
            setText("campusSaveButton", "保存修改");
            setText("campusMessage", `正在编辑：${rows[index].title}。`);
          });
        }
        if (action === "delete") {
          guardAction(capabilities.delete, "campusMessage", "删除", () => {
            const removed = rows[index];
            if (!window.confirm(`确定删除“${removed.title}”吗？`)) return;
            markRowDeleted(key, removed);
            rows.splice(index, 1);
            writeStore(key, rows, { restoreDeleted: false });
            recordAudit(moduleKey, "删除", removed.title, removed.category);
            if (editingIndex === index) resetForm();
            render();
            setText("campusMessage", `已删除展示内容：${removed.title}。`);
          });
        }
      });
    }

    bindCampusGridActions("campusDisplayGrid");
    bindCampusGridActions("campusAnnouncementGrid");
    bindCampusGridActions("campusWorkflowGrid");

    document.querySelectorAll("[data-campus-modal-close]").forEach((node) => {
      node.addEventListener("click", closeCampusDetail);
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !$("campusDetailModal")?.hidden) closeCampusDetail();
    });

    bindTableImport({
      buttonId: "campusImportButton",
      inputId: "campusImportInput",
      getRows: () => rows,
      setRows(nextRows) {
        saveRows(nextRows);
        resetForm();
      },
      normalizeRow(row) {
        const section = normalizeSection(readField(row, ["section", "所属板块", "板块", "类型"], activeSection));
        const title = normalizeName(readField(row, ["title", "标题", "名称", "事项名称"]));
        const content = normalizeContent(readField(row, ["content", "展示正文", "正文", "内容", "说明", "备注"]));
        if (!title && !content) return null;
        return ensureRowId({
          section,
          category: normalizeCategory(section, readField(row, ["category", "内容类别", "类别", "分类"], "")),
          title: title || normalizeCategory(section, readField(row, ["category", "内容类别", "类别", "分类"], "")),
          owner: normalizeText(readField(row, ["owner", "适用范围", "负责人", "范围"], "全体老师")) || "全体老师",
          displayDate: normalizeText(readField(row, ["displayDate", "展示日期", "日期", "时间"], "长期有效")) || "长期有效",
          sortOrder: normalizeText(readField(row, ["sortOrder", "展示排序", "排序"], "")),
          content,
          createdAt: String(readField(row, ["createdAt", "创建时间"], nowText())),
          updatedAt: String(readField(row, ["updatedAt", "更新时间"], nowText()))
        }, key);
      },
      onDone(count) {
        recordAudit(moduleKey, "导入", "校区运营展示内容", `${count} 条`);
        renderAuditLog(moduleKey, "campusAuditTableBody");
        setText("campusMessage", `已导入 ${count} 条展示内容。`);
      },
      onError() {
        setText("campusMessage", "导入失败。请上传 CSV/TSV/JSON；Excel 可以先另存为 CSV。字段可用：所属板块、内容类别、标题、适用范围、展示日期、展示正文、展示排序。");
      },
      canUse: () => capabilities.import,
      onDenied: () => denyAction("campusMessage", "导入")
    });

    resetForm();
    render();
    readCloudStore(key, (cloudRows) => {
      rows = mergeCampusRows(cloudRows);
      if (JSON.stringify(rows) !== JSON.stringify(cloudRows)) writeStore(key, rows, { replaceMode: "replace" });
      resetForm();
      render();
      setText("campusMessage", canEditCampus ? "已同步云端展示内容；需要维护时点击“编辑校区运营”。" : "已同步云端展示内容。");
    });
    applyCapabilityGate({
      canWrite: capabilities.create || capabilities.update,
      messageId: "campusMessage",
      buttonRules: [["campusSaveButton", capabilities.create || capabilities.update, "新增或修改"], ["campusBulkSaveButton", capabilities.create, "粘贴新增"], ["campusImportButton", capabilities.import, "导入"], ["campusExportButton", capabilities.export, "导出"], ["campusResetButton", capabilities.reset, "清空"]],
      fieldIds: ["campusSectionInput", "campusCategoryInput", "campusTitleInput", "campusOwnerInput", "campusDateInput", "campusOrderInput", "campusContentInput", "campusBulkTitleInput", "campusBulkSectionInput", "campusBulkCategoryInput", "campusBulkTextInput"]
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    injectBusinessModuleStyles();
    initStudentService();
    initCurriculumProducts();
    initHrTraining();
    initCampusOperations();
  });

  window.JRC_BUSINESS_MODULES = {
    ...(window.JRC_BUSINESS_MODULES || {}),
    recordLinkEvent,
    readLinkEvents,
    syncAttendanceIntoStudentService,
    syncAdmissionsIntoStudentService
  };
})();
