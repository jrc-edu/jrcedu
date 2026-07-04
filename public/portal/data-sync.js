(function () {
  const backupVersion = "2026-06-21-local-backup-v2";
  const lastBackupKey = "jrc-last-local-backup-export";
  const managedStores = [
    { key: "paike-june-system-v1", label: "排课系统·平时课数据", shape: "paikeRegular" },
    { key: "paike-june-system-meta-v1", label: "排课系统·平时状态", shape: "object" },
    { key: "paike-system-prototype-v1", label: "排课系统·暑假数据", shape: "paikeHoliday" },
    { key: "paike-system-prototype-meta-v1", label: "排课系统·暑假状态", shape: "object" },
    { key: "paike-summer-import-review-v1", label: "排课系统·待确认项", shape: "array" },
    { key: "jrc-paike-legacy-cloud-transition-v1", label: "排课系统·数据同步索引", shape: "paikeBridge" },
    { key: "jrc-paike-finance-preimport-2026-06-22", label: "排课财务·预导入数据包", shape: "preimportBundle" },
    { key: "jrc-class-attendance-v1", label: "学生服务·点名出门测", shape: "attendance" },
    { key: "advice-system-stage-prototype", label: "招生系统", shape: "admissions" },
    { key: "jrc-suggestion-management-v2", label: "建议系统", shape: "array" },
    { key: "jrc-site-feedback-v1", label: "全站反馈问题", shape: "array" },
    { key: "jrc-ai-assistant-drafts-v1", label: "课堂反馈AI助手·课堂反馈草稿", shape: "array" },
    { key: "jrc-finance-ledger-v1", label: "财务系统", shape: "finance" },
    { key: "jrc-teaching-quality-system-v2-demo", label: "教学质量", shape: "object" },
    { key: "jrc-student-service-v2", label: "学生服务", shape: "array" },
    { key: "jrc-curriculum-products-v2", label: "教研课程", shape: "array" },
    { key: "jrc-hr-training-tasks-v2", label: "人事管理", shape: "array" },
    { key: "jrc-hr-summer-schedule-v1", label: "人事管理·暑假学管排班", shape: "array" },
    { key: "jrc-campus-operations-v2", label: "校区运营", shape: "array" },
    { key: "jrc-business-audit-log-v1", label: "操作日志", shape: "array" },
    { key: "jrc-system-link-events-v1", label: "系统联动日志", shape: "array" },
    { key: "jrc-system-usage-guides-v1", label: "系统使用方法库", shape: "usageGuides" },
    { key: "jrc-employee-directory-extra", label: "新增员工", shape: "array" }
  ];

  function $(id) {
    return document.getElementById(id);
  }

  function canManageBackup() {
    return typeof window.jrcHasPermission !== "function" || window.jrcHasPermission("admin.access");
  }

  function safeParse(raw, fallback = null) {
    try {
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  }

  function readStore(key) {
    const raw = localStorage.getItem(key);
    return {
      raw,
      parsed: raw ? safeParse(raw) : null
    };
  }

  function formatDateTime(value) {
    if (!value) return "暂无保存时间";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString("zh-CN", { hour12: false });
  }

  function detectSavedAt(parsed) {
    if (!parsed || typeof parsed !== "object") return "";
    return parsed.lastSavedAt || parsed.updatedAt || parsed.exportedAt || parsed.savedAt || "";
  }

  function countRows(store) {
    if (Array.isArray(store.parsed)) return store.parsed.length;
    if (!store.parsed || typeof store.parsed !== "object") return 0;
    if (store.shape === "paikeRegular") {
      return store.parsed.scheduleEntries?.length || 0;
    }
    if (store.shape === "paikeHoliday") {
      return [
        store.parsed.teachers?.length || 0,
        store.parsed.rooms?.length || 0,
        store.parsed.demands?.length || 0,
        store.parsed.settlementStatements?.length || 0,
        store.parsed.settlementLines?.length || 0,
        store.parsed.profitExpenseLines?.length || 0
      ].reduce((sum, count) => sum + count, 0);
    }
    if (store.shape === "paikeBridge") {
      return Object.keys(store.parsed.stores || {}).length;
    }
    if (store.shape === "preimportBundle") {
      return [
        store.parsed.scheduleSessions?.length || 0,
        store.parsed.salaryAttendance?.length || 0,
        store.parsed.expenseRows?.length || 0,
        store.parsed.reconciliationIssues?.length || 0,
        store.parsed.teacherMonthPrecheck?.length || 0
      ].reduce((sum, count) => sum + count, 0);
    }
    if (store.shape === "attendance") {
      return (store.parsed || []).reduce((sum, session) => {
        const rows = Array.isArray(session?.rows) ? session.rows.length : 0;
        return sum + 1 + rows;
      }, 0);
    }
    if (store.shape === "admissions") {
      return [
        store.parsed.leads?.length || 0,
        store.parsed.followups?.length || 0,
        store.parsed.auditLogs?.length || 0
      ].reduce((sum, count) => sum + count, 0);
    }
    if (store.shape === "paikeCloud") {
      return [
        store.parsed.sessions?.length || 0,
        store.parsed.changeRequests?.length || 0,
        store.parsed.auditLogs?.length || 0
      ].reduce((sum, count) => sum + count, 0);
    }
    if (store.key === "jrc-finance-ledger-v1") {
      return Object.keys(store.parsed.periods || {}).length;
    }
    if (store.shape === "usageGuides") {
      return Array.isArray(store.parsed.guides) ? store.parsed.guides.length : Array.isArray(store.parsed) ? store.parsed.length : 0;
    }
    return Object.keys(store.parsed).length;
  }

  function renderSummary() {
    const holder = $("dataSyncSummary");
    if (!holder) return;
    holder.innerHTML = managedStores.map((item) => {
      const store = { ...item, ...readStore(item.key) };
      const count = countRows(store);
      const savedAt = detectSavedAt(store.parsed);
      return `
        <div class="data-sync-item${store.raw === null ? " is-empty" : ""}">
          <span>${item.label}</span>
          <strong>${count}</strong>
          <em>${store.raw === null ? "当前账号暂无数据" : `最近保存：${formatDateTime(savedAt)}`}</em>
        </div>
      `;
    }).join("");
  }

  function renderStatusCards() {
    const holder = $("dataSyncStatusList");
    if (!holder) return;
    const existingStores = managedStores.filter((item) => localStorage.getItem(item.key) !== null);
    const backupReady = existingStores.length;
    const cloudEnabled = Boolean(window.JRC_CLOUD?.isEnabled?.());
    holder.innerHTML = `
      <div class="data-sync-status-card">
        <strong>当前数据来源</strong>
        ${cloudEnabled ? "已配置云端 API；本机仍保留备份兜底。" : "暂未接云数据库，当前以本浏览器数据为准。"}
      </div>
      <div class="data-sync-status-card">
        <strong>可备份数据</strong>
        当前账号检测到 ${backupReady} 类可导出的业务数据。
      </div>
      <div class="data-sync-status-card">
        <strong>下一步</strong>
        阿里云开通后，先同步账号、权限、操作日志和备份记录。
      </div>
    `;
  }

  function buildBackup() {
    const entries = {};
    managedStores.forEach((item) => {
      const raw = localStorage.getItem(item.key);
      if (raw !== null) entries[item.key] = raw;
    });
    return {
      version: backupVersion,
      exportedAt: new Date().toISOString(),
      source: window.location.href,
      entries
    };
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

  function setMessage(text) {
    const message = $("dataSyncMessage");
    if (message) message.textContent = text;
  }

  function exportBackup() {
    if (!canManageBackup()) {
      setMessage("当前账号暂无整站备份权限。");
      return;
    }
    const backup = buildBackup();
    const payload = JSON.stringify(backup, null, 2);
    const textarea = $("dataSyncPayload");
    if (textarea) textarea.value = payload;
    downloadJson(`匠人程整站本机备份-${new Date().toISOString().slice(0, 10)}.json`, backup);
    localStorage.setItem(lastBackupKey, JSON.stringify({ exportedAt: backup.exportedAt, version: backup.version }));
    window.JRC_CLOUD?.recordBackupExport?.(backup, { operator: window.JRC_CURRENT_EMPLOYEE || null });
    setMessage(`已生成整站本机备份，共包含 ${Object.keys(backup.entries).length} 类数据。`);
    renderStatusCards();
  }

  function restoreBackup(rawText) {
    if (!canManageBackup()) {
      setMessage("当前账号暂无恢复整站备份权限。");
      return;
    }
    const backup = safeParse(rawText);
    if (!backup?.entries || typeof backup.entries !== "object") {
      setMessage("恢复失败：请粘贴或选择从本中心导出的备份 JSON。");
      return;
    }
    const allowedKeys = new Set(managedStores.map((item) => item.key));
    const restored = [];
    Object.entries(backup.entries).forEach(([key, raw]) => {
      if (!allowedKeys.has(key)) return;
      if (safeParse(raw, undefined) === undefined) return;
      localStorage.setItem(key, String(raw));
      restored.push(key);
    });
    renderSummary();
    renderStatusCards();
    setMessage(`已恢复 ${restored.length} 类本机数据。请刷新页面查看最新结果。`);
  }

  function initDataSync() {
    if (!$("dataSyncSummary")) return;
    renderSummary();
    renderStatusCards();
    $("dataSyncExportButton")?.addEventListener("click", exportBackup);
    $("dataSyncChooseFileButton")?.addEventListener("click", () => $("dataSyncFileInput")?.click());
    $("dataSyncFileInput")?.addEventListener("change", (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const textarea = $("dataSyncPayload");
        if (textarea) textarea.value = String(reader.result || "");
        setMessage(`已读取备份文件：${file.name}。确认无误后点击恢复。`);
      };
      reader.readAsText(file);
      event.target.value = "";
    });
    $("dataSyncRestoreButton")?.addEventListener("click", () => restoreBackup($("dataSyncPayload")?.value || ""));
  }

  document.addEventListener("DOMContentLoaded", initDataSync);
})();
