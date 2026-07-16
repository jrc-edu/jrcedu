import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const root = process.cwd();

function readText(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function countMatches(text, pattern) {
  return [...text.matchAll(pattern)].length;
}

function extractPreimportBundle() {
  const source = readText("portal/preimport-data.js");
  const context = { window: {} };
  context.window.window = context.window;
  vm.runInNewContext(source, context, { filename: "portal/preimport-data.js" });
  return context.window.JRC_PREIMPORT_BUNDLE || context.window.JRC_PREIMPORT_SUMMARY || {};
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function statusLine(status, title, detail) {
  return `${status.padEnd(4)} ${title} - ${detail}`;
}

function sourceHas(file, pattern) {
  return pattern.test(readText(file));
}

const files = {
  auth: readText("portal/auth.js"),
  dashboard: readText("portal/dashboard.js"),
  business: readText("portal/business-modules.js"),
  paike: readText("portal/paike.html"),
  finance: readText("portal/finance.html"),
  student: readText("portal/student-service.html"),
  ai: readText("portal/ai-assistant.html"),
  suggestions: readText("portal/suggestions.html"),
  trialFeedback: readText("portal/trial-feedback.html"),
  teachingQuality: readText("portal/teaching-quality.html"),
  admissions: readText("public/advice-system/app.js"),
  cloud: readText("portal/cloud-api.js"),
  dataSync: readText("portal/data-sync.js"),
  mobile: readText("portal/mobile-unified.js"),
  api: readText("deploy/aliyun/api/server.mjs")
};

const preimport = extractPreimportBundle();
const scheduleSessions = Array.isArray(preimport.scheduleSessions) ? preimport.scheduleSessions : [];
const salaryAttendance = Array.isArray(preimport.salaryAttendance) ? preimport.salaryAttendance : [];
const salaryRevenueAttendance = Array.isArray(preimport.salaryRevenueAttendance) ? preimport.salaryRevenueAttendance : [];
const teacherSummary = Array.isArray(preimport.teacherFinanceSummaryRows) ? preimport.teacherFinanceSummaryRows : [];
const issues = Array.isArray(preimport.reconciliationIssues) ? preimport.reconciliationIssues : [];
const periods = unique(scheduleSessions.map((row) => row.period));
const teachers = unique(scheduleSessions.map((row) => row.teacherName));

const checks = [
  {
    title: "排课预导入数据",
    pass: scheduleSessions.length > 0,
    detail: `${scheduleSessions.length} 节排课，${periods.join("、") || "无月份"}，${teachers.length} 位老师。`
  },
  {
    title: "排课系统读取正式/预导入数据",
    pass: /readCloud\(stores\.preimport/.test(files.paike) && /scheduleSessionsFromPreimport/.test(files.paike) && /paikeDataSourceGrid/.test(files.paike),
    detail: "排课页会读取预导入/正式排课 store，并显示排课、点名、招生待排课来源。"
  },
  {
    title: "排课页可导入正式排课明细",
    pass: /paikeFormalImportButton/.test(files.paike) && /readFormalScheduleFile/.test(files.paike) && /saveFormalScheduleEntries/.test(files.paike) && /writeModuleData\(stores\.regular/.test(files.paike),
    detail: "排课负责人可在新排课页导入 CSV/XLSX 正式明细，并写入云端正式排课 store。"
  },
  {
    title: "排课 Excel 变更差异预览",
    pass: /buildFormalImportDiff/.test(files.paike)
      && /lastImportChangeSummary/.test(files.paike)
      && /buildPaikeImportDiff/.test(files.api)
      && /已有点名关联/.test(files.paike),
    detail: "上传 Excel 后会先识别新增、调整、取消和不变课程；已有点名关联的旧课保留追溯，并将服务器复算结果写入导入记录。"
  },
  {
    title: "排课固定课程编号与月结保护",
    pass: /assignPaikeCourseIds/.test(files.api)
      && /month-closure/.test(files.api)
      && /sourceCourseId/.test(files.paike)
      && /sourceCourseId/.test(files.student)
      && /sourceCourseId/.test(files.finance),
    detail: "正式课导入会生成稳定课程编号，点名和财务携带该编号追溯；已月结月份会拦截普通 Excel 修改，并支持管理员恢复修改后留痕修正。"
  },
  {
    title: "排课与财务老师工作台入口",
    pass: /teacherWorkbenchPanel/.test(files.paike)
      && /renderTeacherWorkbench/.test(files.paike)
      && /financeTeacherWorkbenchPanel/.test(files.finance)
      && /renderFinanceTeacherWorkbench/.test(files.finance),
    detail: "排课页和财务页都有老师优先的工作台入口，先显示今天/本周课程、工资单合计、待点名和待对账。"
  },
  {
    title: "排课冲突检测入口",
    pass: /buildScheduleConflicts/.test(files.paike)
      && /scheduleConflictRows/.test(files.paike)
      && /data-teacher-workbench-action="conflicts"/.test(files.paike)
      && /疑似排课冲突/.test(files.paike),
    detail: "排课工作台会提示同一老师、教室、学生/班级同时间疑似冲突，并可一键筛出。"
  },
  {
    title: "学生服务读取排课并生成点名名单",
    pass: /readModuleData\(PREIMPORT_STORE_KEY\)/.test(files.student)
      && /renderPreimportOptions/.test(files.student)
      && /attendanceNextPanel/.test(files.student)
      && /renderAttendanceNextStep/.test(files.student)
      && /attendanceFinanceLink/.test(files.student)
      && /attendanceTeacher/.test(files.student),
    detail: "学生服务会按日期、老师、班级从排课源生成点名候选，保存后提示异常处理、财务核对和回排课确认，并可直达对应财务筛选。"
  },
  {
    title: "点名保存后写入云端",
    pass: /writeModuleData\(STORE_KEY, "studentService", mergedRows\)/.test(files.student),
    detail: "点名出门测保存到 jrc-class-attendance-v1。"
  },
  {
    title: "点名沉淀学生服务",
    pass: /syncAttendanceIntoStudentService/.test(files.student) && /attendanceRowToStudentService/.test(files.business),
    detail: "到课、迟到、缺勤处理和出门测会沉淀到学生服务台账。"
  },
  {
    title: "财务读取点名",
    pass: /readModuleData\?\.\(ATTENDANCE_STORAGE_KEY\)/.test(files.finance) || /readModuleData\(ATTENDANCE_STORAGE_KEY\)/.test(files.finance),
    detail: "财务页会读取 jrc-class-attendance-v1，用于课时费/课销候选。"
  },
  {
    title: "财务核对状态标准化",
    pass: /financeReviewStatusMeta/.test(files.finance)
      && /缺产值总表/.test(files.finance)
      && /数据变化需重核/.test(files.finance)
      && /点名已确认/.test(files.finance),
    detail: "财务页把可核对、缺产值总表、待对账、已核对、数据变化需重核统一展示，并显示点名确认闭环。"
  },
  {
    title: "点名形成财务核对入口",
    pass: /attendanceFinanceSection/.test(files.finance)
      && /renderAttendanceSettlementPreview/.test(files.finance)
      && /attendanceSettlementFinanceBody/.test(files.finance)
      && /attendanceDetailFinanceBody/.test(files.finance)
      && /attendanceSettlementReviews/.test(files.finance)
      && /confirmAttendanceSettlementById/.test(files.finance)
      && /data-confirm-attendance-settlement/.test(files.finance)
      && /attendanceDecisionGrid/.test(files.finance)
      && /filteredAttendanceDetailRows/.test(files.finance)
      && /applyAttendanceDeepLinkFilters/.test(files.finance)
      && /scrollAttendanceDeepLink/.test(files.finance),
    detail: "财务页已按老师/月展示点名课时费、家长课销、单独结算和待追踪明细，支持判断卡筛选、深链定位与财务确认留痕。"
  },
  {
    title: "排课点名财务操作闭环",
    pass: /attendanceHrefForRow/.test(files.paike)
      && /#attendanceSection/.test(files.paike)
      && /sourceScheduleKey/.test(files.paike)
      && /scheduleSourceKey/.test(files.paike)
      && /点名异常待处理/.test(files.paike)
      && /applyAttendanceDeepLink/.test(files.student)
      && /sourceScheduleKey/.test(files.student)
      && /scheduleSourceKeyFromParts/.test(files.student)
      && /排课链接/.test(files.student)
      && /sourceType/.test(files.finance)
      && /排课来源键/.test(files.finance),
    detail: "排课课表可一键进入点名并携带来源键；点名保存排课来源；财务逐学生明细和导出可回溯来源。"
  },
  {
    title: "财务读取原始工资/排课预导入",
    pass: (/readModuleData\?\.\(PREIMPORT_STORE_KEY\)/.test(files.finance) || /readModuleData\(PREIMPORT_STORE_KEY\)/.test(files.finance))
      && /teacherWageReviews/.test(files.finance)
      && /confirmTeacherWageReview/.test(files.finance)
      && /confirmTeacherWageReviewButton/.test(files.finance),
    detail: `${salaryAttendance.length} 行工资课时，${salaryRevenueAttendance.length} 行收入，${teacherSummary.length} 行老师汇总，${issues.length} 条待核差异；老师工资单支持人工核对留痕。`
  },
  {
    title: "招生报名沉淀学生服务",
    pass: /syncAdmissionsIntoStudentService/.test(files.admissions) && /admissionLeadToStudentService/.test(files.business),
    detail: "招生报名/实收后会生成学生服务入学交接候选。"
  },
  {
    title: "招生报名生成排课待办",
    pass: /flow-admissions-to-paike/.test(files.dashboard) && /admissionSchedulePanel/.test(files.paike) && /applyAdmissionScheduleAction/.test(files.paike),
    detail: "报名学生未排课时，会进入周珊首页任务，并在排课系统显示待排课名单，可直接定位课表和教室。"
  },
  {
    title: "招生系统使用问答入口",
    pass: /admissionsHelpFaqs/.test(files.admissions)
      && /answerAdmissionsHelp/.test(files.admissions)
      && /mode:\s*"help"/.test(files.admissions)
      && /buildAdmissionsHelpPrompt/.test(files.admissions)
      && /mobile-unified\.js/.test(readText("public/advice-system/index.html"))
      && /招生管理系统/.test(files.mobile)
      && /advice-system/i.test(files.mobile),
    detail: "招生页接入全站绿色使用方法 AI 提问助手；本地方法库优先，手动提问才调用 DeepSeek，不再放重复页面内面板。"
  },
  {
    title: "全站系统使用方法库",
    pass: /jrc-system-usage-guides-v1/.test(files.mobile)
      && /usageHelpGuideSections/.test(files.mobile)
      && /hydrateUsageGuidesFromCloud/.test(files.mobile)
      && /usageGuideText/.test(files.mobile)
      && /系统使用方法库/.test(files.dataSync),
    detail: "每个分系统都有内置使用方法库；云端 jrc-system-usage-guides-v1 可覆盖更新，并纳入整站备份。"
  },
  {
    title: "财务主动读取招生云端数据",
    pass: /ADMISSIONS_STORE_KEY/.test(files.finance)
      && /hydrateFinanceLinkedStores/.test(files.finance)
      && /admissionsFinanceCandidateBody/.test(files.finance)
      && /admissionReceipts/.test(files.finance)
      && /confirmAdmissionReceiptById/.test(files.finance)
      && /data-confirm-admission-receipt/.test(files.finance),
    detail: "财务页会主动补水招生 store，显示招生实收归因候选，并支持财务人工确认入账。"
  },
  {
    title: "财务主动读取教学质量云端数据",
    pass: /TEACHING_QUALITY_STORE_KEY/.test(files.finance) && /hydrateFinanceLinkedStores/.test(files.finance) && /renderQualityFinanceCandidates/.test(files.finance) && /qualityFinanceCandidateBody/.test(files.finance),
    detail: "财务页会主动补水教学质量 store，并显示教学质量系数候选。"
  },
  {
    title: "教学质量写入云端",
    pass: /writeModuleData\(STORAGE_KEY, "teachingQuality", mergedState\)/.test(files.teachingQuality),
    detail: "巡课、问卷、整改数据保存到 jrc-teaching-quality-system-v2-demo。"
  },
  {
    title: "AI课堂反馈归档学生服务",
    pass: /writeStudentServiceRows\(nextRows\)/.test(files.ai) && /writeModuleData\(STUDENT_SERVICE_KEY, "studentService", nextRows\)/.test(files.ai) && /jrc-student-service-linked/.test(files.ai),
    detail: "老师确认后归档到学生服务，而不是 AI 自动直接发给家长。"
  },
  {
    title: "AI课堂反馈由 DeepSeek 直写",
    pass: /looksLikeJsonText/.test(files.ai)
      && /课堂反馈AI助手/.test(files.ai)
      && /type="hidden" value="classFeedback"/.test(files.ai)
      && !/整理类型/.test(files.ai)
      && /targetNameTokens/.test(files.ai)
      && /removeOtherStudentReferences/.test(files.ai)
      && /renderTargetTokens/.test(files.ai)
      && /renderBatchSplitPreview/.test(files.ai)
      && /feedbackCrossNameItems/.test(files.ai)
      && /ensureClassFeedbackTemplate/.test(files.ai)
      && /buildAiWrittenBatchFeedbackResults/.test(files.ai)
      && /structuredData 必须包含 students 数组/.test(files.api)
      && /students\[\]\.parentMessage/.test(files.api)
      && /max_tokens:\s*String\(body\?\.mode \|\| ""\) === "classFeedback"/.test(files.api)
      && /7800/.test(files.api)
      && /6500/.test(files.api)
      && !/buildBatchFeedbackResults/.test(files.ai)
      && !/normalizeSharedLesson/.test(files.ai)
      && !/buildClassFeedbackTemplate/.test(files.ai)
      && !/buildClassFeedbackTemplate/.test(files.api),
    detail: "课堂反馈正文交给 DeepSeek 生成；多个关联对象要求 DeepSeek 返回 students[].parentMessage，网页端只做展示、保存、归档、格式提醒和串名拦截。"
  },
  {
    title: "DeepSeek调用超时重试保护",
    pass: /deepseekMaxAttempts/.test(files.api)
      && /AbortController/.test(files.api)
      && /isRetryableAiError/.test(files.api)
      && /extractAiContent/.test(files.api),
    detail: "DeepSeek 临时限流、超时、网络错误和 5xx 会自动短重试，并返回更明确的失败原因。"
  },
  {
    title: "云端保存自动补同步",
    pass: /isTransientCloudFailure/.test(files.cloud)
      && /module-write/.test(files.cloud)
      && /flushPending/.test(files.cloud)
      && /window\.addEventListener\("online"/.test(files.cloud),
    detail: "统一云端写入遇到短暂网络异常会重试，并在网络恢复或下次打开页面时自动补传小型业务数据。"
  },
  {
    title: "管理员健康诊断与服务器备份",
    pass: /handleSystemDiagnostics/.test(files.api)
      && /system-diagnostics/.test(files.api)
      && /portalSystemHealthList/.test(files.dashboard)
      && fs.existsSync(path.join(root, "deploy/aliyun/backup-postgres.sh"))
      && fs.existsSync(path.join(root, "deploy/aliyun/check-system-health.sh")),
    detail: "管理员诊断区可查看服务器、AI、数据量、权限和备份；服务器支持每日数据库备份与健康巡检。"
  },
  {
    title: "全站反馈转任务",
    pass: /FEEDBACK_STORAGE_KEY/.test(files.suggestions) && /sourceFeedbackId|t-feedback-/.test(files.suggestions),
    detail: "反馈问题可转建议任务，并让提出人复核。"
  },
  {
    title: "试用反馈整改独立系统",
    pass: /jrc-site-feedback-v1/.test(files.trialFeedback)
      && /试用反馈整改系统/.test(files.trialFeedback)
      && /导出本轮(?:待讨论)? CSV/.test(files.trialFeedback)
      && /sourceFeedbackId/.test(files.trialFeedback)
      && /feedback-review-plan\.js\?v=20260629b/.test(files.trialFeedback)
      && /系统自动整改标注/.test(files.trialFeedback)
      && /trial-feedback\.html/.test(files.dashboard)
      && /trial-feedback\.html/.test(readText("portal/index.html"))
      && /trial-feedback\.html/.test(readText("portal/mobile-unified.js")),
    detail: "试用反馈、新问题、整改复核和本轮导出已拆成临时专项页面，并接入自动整改标注规则。"
  },
  {
    title: "系统流动断点进入我的任务",
    pass: /mergeSystemFlowTasks/.test(files.dashboard) && /systemFlowTaskDetailHtml/.test(files.dashboard),
    detail: "报名未排课、今日未点名、缺勤未处理会进入负责人首页任务。"
  },
  {
    title: "云端托管 store 覆盖核心模块",
    pass: [
      "jrc-paike-finance-preimport-2026-06-22",
      "jrc-class-attendance-v1",
      "advice-system-stage-prototype",
      "jrc-student-service-v2",
      "jrc-finance-ledger-v1",
      "jrc-teaching-quality-system-v2-demo",
      "jrc-hr-summer-schedule-v1",
      "jrc-suggestion-management-v2"
    ].every((key) => files.dataSync.includes(key)),
    detail: "data-sync.js 已纳入核心数据副本范围。"
  }
];

const warnings = [];
if (scheduleSessions.length && !sourceHas("portal/paike.html", /saveFormalScheduleEntries/)) {
  warnings.push("排课页还不能直接导入正式排课明细，需要继续增强。");
}
if (!/admissionSchedulePanel/.test(files.paike) || !/advice-system-stage-prototype/.test(files.paike)) {
  warnings.push("排课系统没有直接展示招生待排课名单，招生→排课只能依赖首页任务提醒。");
} else {
  warnings.push("招生→排课已在排课页显示待排课名单，并能定位课表/教室；最终仍由排课负责人确认老师、时间、教室后手动排入课表，避免自动乱塞课。");
}
if (!/writeModuleData\(FINANCE_STORAGE_KEY, "finance"/.test(files.admissions)) {
  warnings.push("招生实收没有直接写入正式财务月结，当前是财务联动候选和归因展示，最终仍需财务复核。");
}
if (countMatches(files.finance, /待对账|待核/g) > 20) {
  warnings.push("财务系统仍有大量待核/待对账口径，适合试运行对照人工表，不适合直接作为唯一结算依据。");
}

const failed = checks.filter((check) => !check.pass);
const passed = checks.length - failed.length;
const lines = [
  "匠人程工作台数据链路审计",
  `检查时间：${new Date().toLocaleString("zh-CN", { hour12: false })}`,
  `结果：${passed}/${checks.length} 通过，${failed.length} 个失败，${warnings.length} 个提示。`,
  "",
  ...checks.map((check) => statusLine(check.pass ? "PASS" : "FAIL", check.title, check.detail)),
  "",
  "提示：",
  ...(warnings.length ? warnings.map((item, index) => `${index + 1}. ${item}`) : ["无"]),
  ""
];

console.log(lines.join("\n"));
process.exitCode = failed.length ? 1 : 0;
