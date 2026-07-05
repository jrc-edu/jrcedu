(function () {
  const RESULT_STORE_KEY = "jrc-business-ai-results-v1";

  const AI_CONFIGS = {
    admissions: {
      mode: "admissionsFollowup",
      title: "招生跟进 AI",
      badge: "生成话术",
      description: "读取线索、试听、报名和跟进记录，生成下一步动作、家长沟通话术和风险提示；不会自动改变报名状态。",
      buttonText: "生成今日招生建议",
      target: "招生跟进",
      permission: "admissions.access"
    },
    student: {
      mode: "attendanceFollowup",
      title: "学生服务 AI 预警",
      badge: "预警草稿",
      description: "结合出门测、缺勤、课堂反馈和家长沟通，判断是否需要联系家长，并生成可编辑说明。",
      buttonText: "生成学生预警建议",
      target: "学生服务预警",
      permission: "studentService.access"
    },
    curriculum: {
      mode: "curriculumArchive",
      title: "教研资料 AI 归档",
      badge: "归档建议",
      description: "读取资料库和授课大纲台账，生成简介、关键词、年级和资料类型建议，让新老师更容易检索和理解。",
      buttonText: "生成资料归档建议",
      target: "教研资料归档",
      permission: "curriculum.access"
    },
    operations: {
      mode: "financeCheck",
      title: "排课、财务、人事解释助手",
      badge: "只解释",
      description: "只解释数据、总结差异、提醒人工复核，不自动改课表、不自动改账、不自动改权限。",
      buttonText: "生成管理解释建议",
      target: "排课财务人事解释",
      permission: ""
    }
  };

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function normalizeText(value) {
    return String(value || "").trim();
  }

  function safeParse(raw, fallback) {
    try {
      const parsed = JSON.parse(raw || "null");
      return parsed ?? fallback;
    } catch {
      return fallback;
    }
  }

  function readStore(key, fallback) {
    try {
      return safeParse(localStorage.getItem(key), fallback);
    } catch {
      return fallback;
    }
  }

  function writeStore(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }

  function asArray(value) {
    if (Array.isArray(value)) return value;
    if (value && typeof value === "object") {
      if (Array.isArray(value.rows)) return value.rows;
      if (Array.isArray(value.items)) return value.items;
      if (Array.isArray(value.data)) return value.data;
    }
    return [];
  }

  function currentEmployee() {
    return window.JRC_CURRENT_EMPLOYEE || {};
  }

  function hasPermission(permission) {
    if (!permission) return true;
    if (typeof window.jrcHasPermission !== "function") return true;
    return window.jrcHasPermission(permission, currentEmployee());
  }

  function canUseOperationsHelper() {
    if (typeof window.jrcHasPermission !== "function") return true;
    return ["admin.access", "paike.access", "finance.access", "hr.access"].some((key) => window.jrcHasPermission(key, currentEmployee()));
  }

  function formatDate(value) {
    const text = normalizeText(value);
    return text ? text.slice(0, 10) : "";
  }

  function isWithinDays(value, days) {
    const time = Date.parse(value || "");
    if (!Number.isFinite(time)) return false;
    return Date.now() - time <= days * 24 * 60 * 60 * 1000;
  }

  function numeric(value) {
    const match = String(value ?? "").replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
    return match ? Number(match[0]) : null;
  }

  function scoreRate(score, fullScore) {
    const full = numeric(fullScore);
    if (score == null || !full || full <= 0) return null;
    return Math.round((score / full) * 1000) / 10;
  }

  function scoreLabel(item = {}) {
    if (item.score == null) return "暂无出门测";
    if (item.fullScore) return `${item.score}/${item.fullScore}，得分率${item.rate}%`;
    return `${item.score}分`;
  }

  function compactLine(parts) {
    return parts.map(normalizeText).filter(Boolean).join("｜");
  }

  function resultText(result = {}) {
    const data = result?.data?.result || result?.result || result || {};
    if (typeof data === "string") return data;
    const lines = [];
    if (data.title) lines.push(`【${data.title}】`);
    if (data.summary) lines.push(data.summary);
    if (data.polishedText) lines.push(`\n整理建议：\n${data.polishedText}`);
    if (data.parentMessage) lines.push(`\n可复制话术：\n${data.parentMessage}`);
    if (Array.isArray(data.todoItems) && data.todoItems.length) {
      lines.push(`\n下一步动作：\n${data.todoItems.map((item, index) => `${index + 1}. ${item}`).join("\n")}`);
    }
    if (data.internalNote) lines.push(`\n内部提醒：\n${data.internalNote}`);
    if (data.suggestedAction) lines.push(`\n建议动作：${data.suggestedAction}`);
    return lines.join("\n").trim() || "AI 已返回结果，但没有可展示文本。";
  }

  function saveAiResult(kind, response, promptText) {
    const rows = asArray(readStore(RESULT_STORE_KEY, []));
    const data = response?.data?.result || response?.result || {};
    rows.unshift({
      id: `business-ai-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      kind,
      mode: AI_CONFIGS[kind]?.mode || "",
      title: data.title || AI_CONFIGS[kind]?.title || "AI 建议",
      generatedAt: new Date().toISOString(),
      operatorName: currentEmployee().name || "",
      provider: response?.data?.provider || response?.provider || "",
      model: response?.data?.model || response?.model || "",
      text: resultText(response),
      promptPreview: String(promptText || "").slice(0, 2400)
    });
    writeStore(RESULT_STORE_KEY, rows.slice(0, 80));
  }

  function injectStyle() {
    if (document.getElementById("jrcBusinessAiStyle")) return;
    const style = document.createElement("style");
    style.id = "jrcBusinessAiStyle";
    style.textContent = `
      .jrc-business-ai-panel {
        margin: 16px 0;
        padding: 18px;
        border: 1px solid rgba(13, 148, 136, 0.16);
        border-radius: 18px;
        background: linear-gradient(180deg, rgba(255,255,255,0.96), rgba(240,253,250,0.72));
        box-shadow: 0 14px 34px rgba(15, 23, 42, 0.08);
      }
      .jrc-business-ai-head { display:flex; justify-content:space-between; gap:14px; align-items:flex-start; }
      .jrc-business-ai-head h2 { margin:0; font-size:21px; color:#18212f; }
      .jrc-business-ai-head p { margin:7px 0 0; color:#64748b; line-height:1.65; }
      .jrc-business-ai-badge { display:inline-flex; align-items:center; min-height:30px; padding:0 11px; border-radius:999px; background:rgba(13,148,136,0.11); color:#0f766e; font-size:12px; font-weight:800; white-space:nowrap; }
      .jrc-business-ai-stats { display:flex; flex-wrap:wrap; gap:8px; margin-top:13px; }
      .jrc-business-ai-chip { display:inline-flex; align-items:center; min-height:30px; padding:0 10px; border-radius:999px; border:1px solid rgba(15,23,42,0.08); background:#fff; color:#475569; font-size:12px; font-weight:700; }
      .jrc-business-ai-actions { display:flex; flex-wrap:wrap; gap:8px; margin-top:14px; }
      .jrc-business-ai-actions button {
        min-height: 38px; border: 0; border-radius: 999px; padding: 0 14px;
        background: #0d9488; color: #fff; font-weight: 800; cursor: pointer;
      }
      .jrc-business-ai-actions button.secondary { background:#fff; color:#1f2937; border:1px solid rgba(15,23,42,0.12); }
      .jrc-business-ai-actions button:disabled { opacity:0.58; cursor:not-allowed; }
      .jrc-business-ai-output {
        margin-top: 14px; padding: 14px; border: 1px solid rgba(15,23,42,0.08);
        border-radius: 14px; background:#fff; color:#263445; line-height:1.75; white-space:pre-wrap;
        max-height: 360px; overflow:auto;
      }
      .jrc-business-ai-output.empty { color:#64748b; white-space:normal; }
      @media (max-width: 720px) {
        .jrc-business-ai-head { display:grid; }
        .jrc-business-ai-panel { padding:15px; }
      }
    `;
    document.head.appendChild(style);
  }

  function admissionsContext() {
    const state = readStore("advice-system-stage-prototype", {});
    const leads = asArray(state.leads);
    const followups = asArray(state.followups);
    const risks = asArray(state.parentRiskRecords || state.parentRisks || state.risks);
    const openLeads = leads.filter((lead) => !/已报名|定金|报名/.test(String(lead.status || "")) && !Number(lead.enrolledAmount || 0));
    const hot = openLeads.filter((lead) => /A|高|试听完成|已预约试听|待转化/.test([lead.intent, lead.status].join(" ")));
    const stale = openLeads.filter((lead) => !isWithinDays(lead.updatedAt || lead.createdAt || lead.nextFollowupDate, 7));
    const recentFollowups = followups
      .slice()
      .sort((a, b) => String(b.time || b.createdAt || "").localeCompare(String(a.time || a.createdAt || "")))
      .slice(0, 12);
    const leadLines = openLeads
      .slice()
      .sort((a, b) => String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || "")))
      .slice(0, 18)
      .map((lead) => compactLine([
        lead.studentName || lead.name,
        lead.grade,
        lead.subject,
        lead.status,
        lead.intent,
        `负责人:${lead.owner || "未填"}`,
        lead.parentNeed ? `需求:${lead.parentNeed}` : "",
        lead.studentPainPoint ? `痛点:${lead.studentPainPoint}` : "",
        lead.objection ? `异议:${lead.objection}` : "",
        lead.nextAction ? `下一步:${lead.nextAction}` : "",
        lead.note
      ]));
    return {
      stats: [
        `线索 ${leads.length}`,
        `未成交 ${openLeads.length}`,
        `高意向 ${hot.length}`,
        `7天未动 ${stale.length}`,
        `风险家长 ${risks.length}`
      ],
      text: [
        "请基于以下招生系统数据生成今日招生跟进建议。",
        "要求：给出优先联系名单、每类家长的下一步动作、可复制微信话术、风险提醒；不要自动改变报名状态。",
        "",
        `线索总数：${leads.length}；未成交：${openLeads.length}；高意向/试听相关：${hot.length}；7天未更新：${stale.length}。`,
        "",
        "重点线索：",
        leadLines.join("\n") || "暂无未成交线索。",
        "",
        "近期跟进记录：",
        recentFollowups.map((row) => compactLine([row.leadName || row.studentName, formatDate(row.time || row.createdAt), row.method, row.text || row.content])).join("\n") || "暂无跟进记录。",
        "",
        "家长风险池：",
        risks.slice(0, 12).map((row) => compactLine([row.studentName, row.level, row.reason || row.note, row.status])).join("\n") || "暂无风险记录。"
      ].join("\n")
    };
  }

  function flattenAttendanceRows() {
    const sessions = asArray(readStore("jrc-class-attendance-v1", []));
    return sessions.flatMap((session) => asArray(session.rows).map((row) => ({
      ...row,
      date: session.date,
      teacher: row.teacher || session.teacher,
      className: row.className || session.className,
      sessionStatus: session.reviewStatus,
      sessionId: session.id
    })));
  }

  function studentContext() {
    const attendanceRows = flattenAttendanceRows();
    const serviceRows = asArray(readStore("jrc-student-service-v2", []));
    const feedbackRows = asArray(readStore("jrc-ai-assistant-drafts-v1", [])).filter((row) => /classFeedback|feedback|课堂反馈/.test([row.mode, row.modeLabel, row.title].join(" ")));
    const profiles = new Map();
    attendanceRows.forEach((row) => {
      const name = normalizeText(row.studentName || row.student || row.name);
      if (!name) return;
      const profile = profiles.get(name) || { name, total: 0, absent: 0, late: 0, scores: [], latestDate: "" };
      profile.total += 1;
      const status = normalizeText(row.status);
      if (/缺席|请假|待落实|未点名/.test(status)) profile.absent += 1;
      if (/迟到/.test(status)) profile.late += 1;
      const score = numeric(row.exitScore);
      const fullScore = numeric(row.exitFullScore);
      if (score != null) {
        profile.scores.push({
          score,
          fullScore,
          rate: scoreRate(score, fullScore),
          date: row.date,
          className: row.className,
          teacher: row.teacher
        });
      }
      if (String(row.date || "").localeCompare(profile.latestDate) > 0) profile.latestDate = row.date;
      profiles.set(name, profile);
    });
    const riskProfiles = [...profiles.values()].map((profile) => {
      const scores = profile.scores.slice(-4);
      const latest = scores[scores.length - 1] || null;
      const previous = scores[scores.length - 2] || null;
      const latestValue = latest?.rate ?? latest?.score ?? null;
      const previousValue = previous?.rate ?? previous?.score ?? null;
      const drop = latestValue != null && previousValue != null ? Math.round((latestValue - previousValue) * 10) / 10 : null;
      const risk = profile.absent >= 2 || (drop != null && drop <= -5) ? "需关注" : "正常";
      return { ...profile, latest, previous, drop, risk };
    }).filter((row) => row.risk === "需关注")
      .sort((a, b) => b.absent - a.absent || a.drop - b.drop)
      .slice(0, 18);
    return {
      stats: [
        `点名记录 ${attendanceRows.length}`,
        `学生 ${profiles.size}`,
        `需关注 ${riskProfiles.length}`,
        `反馈草稿 ${feedbackRows.length}`,
        `服务记录 ${serviceRows.length}`
      ],
      text: [
        "请基于以下学生服务数据生成学管预警建议。",
        "要求：判断哪些学生需要联系家长；生成内部跟进动作和可编辑家长沟通话术；不要自动发送给家长。",
        "",
        `点名记录：${attendanceRows.length}；学生数：${profiles.size}；服务记录：${serviceRows.length}；课堂反馈草稿/归档线索：${feedbackRows.length}。`,
        "",
        "需关注学生：",
        riskProfiles.map((row) => compactLine([
          row.name,
          `上课${row.total}次`,
          `缺勤/待落实${row.absent}次`,
          row.late ? `迟到${row.late}次` : "",
          `最近${scoreLabel(row.latest)}`,
          row.previous ? `上次${scoreLabel(row.previous)}` : "",
          row.drop != null ? `变化${row.drop}${row.latest?.rate != null || row.previous?.rate != null ? "个百分点" : "分"}` : "",
          row.latestDate
        ])).join("\n") || "暂无明显预警学生。",
        "",
        "最近服务记录：",
        serviceRows.slice(0, 12).map((row) => compactLine([
          row.studentName || row.student,
          row.className || row.class,
          row.type || row.serviceType,
          row.riskLevel || row.risk,
          row.nextAction,
          row.content || row.parentMessage
        ])).join("\n") || "暂无服务记录。"
      ].join("\n")
    };
  }

  function curriculumContext() {
    const rows = asArray(readStore("jrc-curriculum-products-v2", []));
    const visibleRows = rows.slice(0, 80);
    const missingTags = visibleRows.filter((row) => !row.tags && !row.keywords && !row.formula && !row.note);
    const missingGrade = visibleRows.filter((row) => !row.grade && !row.subject);
    const outlineRows = visibleRows.filter((row) => /大纲/.test([row.outlineCategory, row.type, row.name].join(" ")));
    return {
      stats: [
        `资料 ${rows.length}`,
        `大纲 ${outlineRows.length}`,
        `缺简介 ${missingTags.length}`,
        `缺年级 ${missingGrade.length}`
      ],
      text: [
        "请基于以下教研课程资料数据生成归档优化建议。",
        "要求：给出资料简介、关键词、年级/季节/资料类型建议、标准文件命名建议和需要人工复核的点；不要自动改文件。",
        "",
        `资料总数：${rows.length}；疑似大纲：${outlineRows.length}；缺简介/关键词：${missingTags.length}；缺年级：${missingGrade.length}。`,
        "",
        "资料样本：",
        visibleRows.slice(0, 30).map((row) => compactLine([
          row.name || row.fileName || row.title,
          row.grade,
          row.subject,
          row.outlineCategory,
          row.teacher,
          row.season,
          row.type,
          row.lesson,
          row.note || row.formula
        ])).join("\n") || "暂无资料台账。"
      ].join("\n")
    };
  }

  function operationsContext() {
    const paike = readStore("paike-june-system-v1", {});
    const preimport = readStore("jrc-paike-finance-preimport-2026-06-22", {});
    const finance = readStore("jrc-finance-ledger-v1", {});
    const hr = asArray(readStore("jrc-hr-training-tasks-v2", []));
    const paikeRows = asArray(paike.entries || paike.rows || paike.schedules || paike);
    const preimportRows = asArray(preimport.entries || preimport.rows || preimport.scheduleEntries || preimport);
    const financeRows = [
      ...asArray(finance.entries || finance.rows || finance.records),
      ...asArray(finance.teacherFinanceSummaryRows),
      ...asArray(finance.teacherSalaryRows)
    ];
    const hrPending = hr.filter((row) => !/完成|已处理|结束/.test(String(row.status || row.processStatus || "")));
    const financeReview = financeRows.filter((row) => /待|核|复核|差异|缺/.test([row.status, row.reason, row.reviewStatus, row.needsReview ? "待复核" : ""].join(" ")));
    return {
      stats: [
        `排课 ${paikeRows.length || preimportRows.length}`,
        `财务 ${financeRows.length}`,
        `待核 ${financeReview.length}`,
        `人事待处理 ${hrPending.length}`
      ],
      text: [
        "请基于以下排课、财务、人事数据生成解释和人工复核建议。",
        "要求：只解释数据、总结差异、提醒人工复核；不自动改课表、不自动改账、不自动改权限。",
        "",
        `排课记录：${paikeRows.length || preimportRows.length}；财务记录：${financeRows.length}；财务待核/异常：${financeReview.length}；人事待处理：${hrPending.length}。`,
        "",
        "排课样本：",
        (paikeRows.length ? paikeRows : preimportRows).slice(0, 15).map((row) => compactLine([
          row.date || row.courseDate,
          row.teacherName || row.teacher,
          row.className || row.studentName,
          row.startTime,
          row.endTime,
          row.room || row.classroomName,
          row.status
        ])).join("\n") || "暂无排课样本。",
        "",
        "财务待核样本：",
        financeReview.slice(0, 18).map((row) => compactLine([
          row.period,
          row.teacherName || row.teacher || row["姓名"],
          row.studentName,
          row.amount || row.courseFee || row["课时总收入"],
          row.status || row.reviewStatus,
          row.reason || row.sourceSheet
        ])).join("\n") || "暂无财务待核样本。",
        "",
        "人事待处理样本：",
        hrPending.slice(0, 12).map((row) => compactLine([
          row.employeeName || row.name || row.employee,
          row.type || row.taskType,
          row.role,
          row.status || row.processStatus,
          row.note
        ])).join("\n") || "暂无人事待处理样本。"
      ].join("\n")
    };
  }

  function buildContext(kind) {
    if (kind === "admissions") return admissionsContext();
    if (kind === "student") return studentContext();
    if (kind === "curriculum") return curriculumContext();
    if (kind === "operations") return operationsContext();
    return { stats: [], text: "" };
  }

  async function runBusinessAi(kind, panel) {
    const config = AI_CONFIGS[kind];
    if (!config || !panel) return;
    const output = panel.querySelector("[data-business-ai-output]");
    const button = panel.querySelector("[data-business-ai-run]");
    const copyButton = panel.querySelector("[data-business-ai-copy]");
    const context = buildContext(kind);
    if (!context.text.trim()) {
      output.textContent = "当前没有可分析的数据。";
      output.classList.remove("empty");
      return;
    }
    if (!window.JRC_CLOUD?.aiAssistant) {
      output.textContent = "AI 接口暂时不可用。请确认页面已加载 cloud-api.js，并检查登录状态。";
      output.classList.remove("empty");
      return;
    }
    if (button) button.disabled = true;
    if (copyButton) copyButton.disabled = true;
    output.classList.remove("empty");
    output.textContent = "正在调用 DeepSeek 生成建议，请稍等。";
    try {
      const employee = currentEmployee();
      const response = await window.JRC_CLOUD.aiAssistant({
        mode: config.mode,
        modeLabel: config.title,
        target: config.target,
        text: context.text,
        operatorName: employee.name || "",
        operatorUsername: employee.username || "",
        operatorRole: employee.role || ""
      });
      if (!response?.ok) throw new Error(response?.data?.message || response?.data?.error || response?.message || "AI 调用失败");
      const text = resultText(response);
      output.textContent = text || "AI 没有返回有效文本。";
      panel.dataset.latestBusinessAiText = text;
      saveAiResult(kind, response, context.text);
      if (copyButton) copyButton.disabled = false;
    } catch (error) {
      output.textContent = `AI 暂时没有生成成功：${error?.message || error || "未知错误"}\n\n你可以稍后重试；页面数据不会被自动修改。`;
    } finally {
      if (button) button.disabled = false;
    }
  }

  function createPanel(kind) {
    const config = AI_CONFIGS[kind];
    const context = buildContext(kind);
    const panel = document.createElement("section");
    panel.className = "jrc-business-ai-panel";
    panel.dataset.businessAiKind = kind;
    panel.innerHTML = `
      <div class="jrc-business-ai-head">
        <div>
          <h2>${escapeHtml(config.title)}</h2>
          <p>${escapeHtml(config.description)}</p>
        </div>
        <span class="jrc-business-ai-badge">${escapeHtml(config.badge)}</span>
      </div>
      <div class="jrc-business-ai-stats">
        ${context.stats.map((item) => `<span class="jrc-business-ai-chip">${escapeHtml(item)}</span>`).join("")}
      </div>
      <div class="jrc-business-ai-actions">
        <button type="button" data-business-ai-run>${escapeHtml(config.buttonText)}</button>
        <button class="secondary" type="button" data-business-ai-copy disabled>复制结果</button>
      </div>
      <div class="jrc-business-ai-output empty" data-business-ai-output>点击生成后，AI 会读取当前系统已有记录，给出可编辑建议。所有关键业务仍由人工确认。</div>
    `;
    panel.querySelector("[data-business-ai-run]")?.addEventListener("click", () => runBusinessAi(kind, panel));
    panel.querySelector("[data-business-ai-copy]")?.addEventListener("click", async () => {
      const text = panel.dataset.latestBusinessAiText || panel.querySelector("[data-business-ai-output]")?.textContent || "";
      if (!text.trim()) return;
      try {
        await navigator.clipboard?.writeText(text);
        panel.querySelector("[data-business-ai-copy]").textContent = "已复制";
        setTimeout(() => { panel.querySelector("[data-business-ai-copy]").textContent = "复制结果"; }, 1200);
      } catch {
        panel.querySelector("[data-business-ai-output]").textContent = `${text}\n\n复制失败，可以手动选中文字复制。`;
      }
    });
    return panel;
  }

  function insertAfter(anchor, node) {
    if (!anchor?.parentNode || !node) return false;
    anchor.parentNode.insertBefore(node, anchor.nextSibling);
    return true;
  }

  function insertAtTop(main, node) {
    if (!main || !node) return false;
    const first = main.firstElementChild;
    if (first) main.insertBefore(node, first.nextSibling || null);
    else main.appendChild(node);
    return true;
  }

  function mount(kind, anchorSelector, options = {}) {
    const config = AI_CONFIGS[kind];
    if (!config) return;
    if (config.permission && !hasPermission(config.permission)) return;
    if (kind === "operations" && !canUseOperationsHelper()) return;
    if (document.querySelector(`[data-business-ai-kind="${kind}"]`)) return;
    const panel = createPanel(kind);
    const anchor = anchorSelector ? document.querySelector(anchorSelector) : null;
    if (options.after && anchor && insertAfter(anchor, panel)) return;
    if (anchor) {
      anchor.appendChild(panel);
      return;
    }
    insertAtTop(document.querySelector("main") || document.body, panel);
  }

  function init() {
    injectStyle();
    const path = location.pathname;
    if (/\/advice-system\//.test(path)) {
      mount("admissions", ".trial-toolbar", { after: true });
      return;
    }
    if (/student-service\.html/.test(path)) {
      mount("student", "#studentServicePhaseEntrances", { after: true });
      return;
    }
    if (/curriculum-products\.html/.test(path)) {
      mount("curriculum", ".hero", { after: true });
      return;
    }
    if (/\/portal\/index\.html$|\/portal\/?$/.test(path)) {
      mount("operations", ".workbench-grid", { after: true });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
