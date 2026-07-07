const STORAGE_KEY = "advice-system-stage-prototype";

const defaultState = {
  activeView: "dashboard",
  activeLeadFilter: "all",
  funnelStage: "",
  leadSearchQuery: "",
  leadOwnerFilter: "",
  leadChannelFilter: "",
  leadIntentFilter: "",
  selectedLeadName: "",
  employees: [],
  auditLogs: [],
  importSummary: {
    added: 0,
    duplicates: 0,
    missingOwner: 0,
    missingFields: 0,
    results: [],
  },
  leads: [],
  followups: [],
  referralLearningReports: [],
};

const state = loadState();
let cloudStoreReady = false;
let cloudSaveTimer = null;
let activeViewApplier = null;
let toastTimer = null;

const statusClassMap = {
  "已沟通待邀约": "amber",
  "试听完成待转化": "red",
  "搁置待回访": "amber",
};

const ownerOptions = ["待分配", "陈雨晴", "高芳燕", "颜雨涵", "周珊", "徐嘉丽", "程志豪"];
const trialTeacherOptions = ["待安排", "叶源泽", "李舒", "赵萱", "朱永乐", "郑嘉艺", "潘云贵", "曹德顺", "吴水琴", "吴建勇", "海滢滢", "程志豪"];
const channelOptions = ["待补来源", "线上客户", "老生家长转介绍", "扩科", "其他"];
const courseProductOptions = ["程老师班课", "科学班课", "数学小班课", "科学小班课", "数学一对一", "科学一对一"];
const startTimeOptions = ["周五 18:00", "周五 19:30", "周六 08:30", "周六 10:20", "周六 13:30", "周六 15:30", "周六 16:40-18:10", "周六 18:30", "周日 08:30", "周日 10:20", "周日 13:30", "周日 15:30", "周日 16:40-18:10", "周日 18:30"];
const channelOwnerOptions = ["待补渠道归属", "陈雨晴", "颜雨涵", "高芳燕", "周珊", "前台"];
const importTemplateFields = [
  "学生姓名",
  "年级",
  "家长姓名",
  "家长电话",
  "意向学科",
  "生源来源",
  "推荐人",
  "当前负责人",
  "当前状态",
  "意向等级",
  "试听时间",
  "试听老师",
  "是否进群",
  "首条备注",
  "下一步动作",
].join("\t");
const admissionsHelpKnowledgeBase = [
  "招生系统目标：先用最简单的五步跑起来：登记咨询、约试听、填试听反馈、报名或搁置、找班和转介绍返现。复杂台账、导入和统计只在需要核对时使用。",
  "日常第一屏用法：先在“新增咨询客户”登记新咨询，再在“当前客户处理区”看每个客户处在哪一步，直接点约试听、填反馈、报名或搁置。",
  "新咨询录入：最少填写学生姓名、年级、家长电话、生源来源、负责人和咨询内容；后续学校、微信、班级等信息可以在试听或详情里补。",
  "生源来源必须填：线上客户、老生家长转介绍、扩科、其他。选择其他时要补一句来源说明；转介绍要写推荐人。",
  "约试听：选择学生后填写试听日期时间、试听老师、试听班级、联系方式和预约备注；保存后客户进入待试听。",
  "试听反馈：试听后当天填写课堂反馈、家长异议、意向等级和下次跟进时间；反馈后再判断报名、继续跟进或搁置。",
  "搁置待回访：家长暂不报名但以后可能继续联系时使用。系统会保留历史记录，并默认提醒后续回访。",
  "试听流程：录入或选择线索，预约试听，记录试听老师和时间，试听结束后填试听反馈，再选择下一步状态。",
  "报名归属锁定：报名后负责人和渠道归属会锁定；需要调整时走解锁并留痕，避免后续归属和提成争议。",
  "转介绍：记录推荐人、被推荐学生、奖励金额、发放状态，后续按转介绍贡献做统计和排序。",
  "招生看板：按日、周、月、年查看线索、试听、报名、转化等数据，用来核对招生老师工作量和转化效率。",
  "导出 Excel：用于每周和每月复盘、人工核对、向管理层汇总招生数据。"
];
const admissionsHelpFaqs = [
  {
    title: "每天按什么顺序用？",
    keywords: ["每天", "顺序", "怎么用", "流程", "简单"],
    answer: [
      "日常按五步走，不需要先看复杂表格：",
      "1. 有新咨询，先在首页“新增咨询客户”登记。",
      "2. 能约试听的，在“当前客户处理区”里点“约试听”。",
      "3. 试听结束后，点“填反馈”，当天补课堂反馈和下一步。",
      "4. 报名的点“报名”，暂时不报名的点“搁置”。",
      "5. 报名后再补课程、开课时间、推荐人返现信息。"
    ].join("\n")
  },
  {
    title: "新咨询怎么录入？",
    keywords: ["新线索", "新咨询", "录入", "新增", "线索怎么", "客户怎么"],
    answer: [
      "1. 在首页“新增咨询客户”里，先填学生姓名、年级、联系方式、生源来源、负责人和咨询内容。",
      "2. 生源来源一定要选清楚：线上客户、老生家长转介绍、扩科、其他。",
      "3. 如果是转介绍，推荐人 / 其他来源说明里写推荐人；如果是其他来源，写几字说明。",
      "4. 保存后，这个学生会进入首页“当前客户处理区”，后面可以继续跟进、预约试听、报名或搁置。"
    ].join("\n")
  },
  {
    title: "试听中心必须填哪些字段？",
    keywords: ["试听", "必填", "试听中心", "试听字段"],
    answer: [
      "试听中心要把“约课”和“试听后反馈”分开看。",
      "预约时重点填：学生、试听日期时间、试听老师、试听班级、联系方式。",
      "试听结束后重点填：到课情况、试听反馈、意向等级、下一步状态、下次跟进时间。",
      "如果下拉里找不到学生，可以先回首页新增咨询客户，再回来预约试听。"
    ].join("\n")
  },
  {
    title: "暂时不报名怎么处理？",
    keywords: ["搁置", "不报名", "暂时", "回访", "沉睡"],
    answer: [
      "家长暂时不报名时，不要直接删除。",
      "1. 在首页“当前客户处理区”对应学生卡片点“搁置”。",
      "2. 系统会把状态改为“搁置待回访”，并保留前面的咨询和试听记录。",
      "3. 后面定期回访时再写新的跟进记录；如果重新有意向，可以继续约试听或报名。"
    ].join("\n")
  },
  {
    title: "报名后归属锁定怎么处理？",
    keywords: ["归属", "锁定", "解锁", "改不了", "报名后"],
    answer: [
      "报名后负责人、渠道归属、推荐人等信息会锁定，这是为了避免后面提成和转介绍归属争议。",
      "确实录错时，进入线索详情，使用“解锁归属链”后再修改。",
      "系统会记录谁在什么时候解锁、原来的归属是什么，后续财务核对时能追溯。"
    ].join("\n")
  },
  {
    title: "生源来源怎么填？",
    keywords: ["生源", "来源", "渠道", "线上", "扩科", "转介绍"],
    answer: [
      "生源来源必须填，建议按这四类选：",
      "1. 线上客户：从网络、广告、线上咨询来的新客户。",
      "2. 老生家长转介绍：老家长推荐的新学生，要写清推荐人。",
      "3. 扩科：原本在读学生新增其他课程。",
      "4. 其他：不属于上面三类时选择，并补一句说明。"
    ].join("\n")
  },
  {
    title: "招生看板日周月年怎么看？",
    keywords: ["看板", "日", "周", "月", "年", "统计", "数据"],
    answer: [
      "招生看板主要看三件事：线索数量、试听推进、报名转化。",
      "日统计适合看今天有没有漏跟进；周统计适合开周会复盘；月统计适合算招生结果和提成；年统计适合看长期渠道效果。",
      "如果数据看起来不对，先检查线索有没有负责人、生源来源、试听状态和报名状态。"
    ].join("\n")
  },
  {
    title: "导出 Excel 在哪里？",
    keywords: ["导出", "Excel", "表格", "下载", "复盘"],
    answer: [
      "进入“线索中心”后，可以按负责人、渠道、意向等级筛选，再点导出。",
      "导出表主要用于每周/月人工复盘和核对，不建议直接改导出的表再倒回系统。",
      "如果账号看不到导出按钮，通常是没有招生导出权限，需要管理员开放。"
    ].join("\n")
  }
];

function byId(id) {
  return document.getElementById(id);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function setInlineMessage(id, text, type = "") {
  const node = byId(id);
  if (!node) return;
  node.textContent = text || "";
  node.classList.remove("success", "error");
  if (type) node.classList.add(type);
}

function showToast(text, type = "") {
  const node = byId("toastMessage");
  if (!node || !text) return;
  clearTimeout(toastTimer);
  node.textContent = text;
  node.classList.toggle("error", type === "error");
  node.classList.add("show");
  toastTimer = setTimeout(() => {
    node.classList.remove("show");
  }, 2200);
}

function setAdmissionsHelpAnswer(text, stateClass = "") {
  const box = byId("admissionsHelpAnswer");
  if (!box) return;
  box.classList.remove("loading", "error");
  if (stateClass) box.classList.add(stateClass);
  box.innerHTML = `<strong>${stateClass === "error" ? "暂时无法回答" : "使用方法"}</strong>${escapeHtml(text || "").replace(/\n/g, "<br>")}`;
}

function matchAdmissionsHelpFaq(question) {
  const normalized = String(question || "").trim().toLowerCase();
  if (!normalized) return null;
  return admissionsHelpFaqs.find((faq) => {
    const title = faq.title.toLowerCase();
    return title.includes(normalized) || faq.keywords.some((keyword) => normalized.includes(String(keyword).toLowerCase()));
  }) || null;
}

function buildAdmissionsHelpPrompt(question) {
  return [
    "你是匠人程工作台的招生管理系统使用助手，只回答招生系统怎么用，不回答无关聊天。",
    "回答对象是一线招生老师，要求短、清楚、能照着做。",
    "如果老师的问题涉及具体数据准确性，提醒老师先按页面字段核对，再通过“提交反馈”说明学生、页面和操作步骤。",
    "",
    "招生系统知识库：",
    admissionsHelpKnowledgeBase.map((item, index) => `${index + 1}. ${item}`).join("\n"),
    "",
    "老师问题：",
    question,
    "",
    "请用 3-6 条步骤回答；不要写长篇解释；最后提醒老师看不懂可以点“提交反馈”。"
  ].join("\n");
}

function normalizeAiHelpText(result) {
  const data = result?.data?.result || result?.result || result?.data || {};
  const candidates = [
    data.parentMessage,
    data.polishedText,
    data.summary,
    typeof data === "string" ? data : ""
  ];
  const text = candidates.map((item) => String(item || "").trim()).find(Boolean);
  if (text) return text;
  return "";
}

async function answerAdmissionsHelp(question) {
  const text = String(question || "").trim();
  if (!text) {
    setAdmissionsHelpAnswer("请先输入你想问的招生系统使用问题。", "error");
    return;
  }
  const faq = matchAdmissionsHelpFaq(text);
  if (faq) {
    setAdmissionsHelpAnswer(faq.answer);
    return;
  }
  if (!window.JRC_CLOUD?.aiAssistant) {
    setAdmissionsHelpAnswer("AI 使用问答暂时不可用。常见问题仍可直接点上方按钮查看；页面其他招生功能不受影响。", "error");
    return;
  }
  const button = byId("askAdmissionsHelpButton");
  if (button) button.disabled = true;
  setAdmissionsHelpAnswer("正在请 AI 按招生系统使用规则回答，请稍等。", "loading");
  try {
    const employee = getCurrentEmployee() || {};
    const response = await window.JRC_CLOUD.aiAssistant({
      mode: "help",
      target: "招生管理系统",
      text: buildAdmissionsHelpPrompt(text),
      operatorName: employee.name || "",
      operatorUsername: employee.username || "",
      operatorRole: employee.role || ""
    });
    if (!response?.ok) throw new Error(response?.message || response?.error || "AI 调用失败");
    if (response.data?.warning || response.data?.provider === "local") {
      throw new Error(response.data?.message || "AI 暂时不可用");
    }
    const answer = normalizeAiHelpText(response);
    if (/招生系统知识库|你是匠人程工作台/.test(answer)) {
      throw new Error("AI 返回了内部提示词");
    }
    if (!answer) throw new Error("AI 没有返回有效答案");
    setAdmissionsHelpAnswer(answer);
  } catch (error) {
    console.warn("招生系统 AI 使用问答失败", error);
    setAdmissionsHelpAnswer("AI 暂时不可用，请稍后重试；页面其他功能不受影响。常见问题可以继续点上方按钮查看。", "error");
  } finally {
    if (button) button.disabled = false;
  }
}

function switchAdmissionView(target, selector = "") {
  if (typeof activeViewApplier === "function") {
    activeViewApplier(target);
  } else {
    state.activeView = target;
  }
  window.setTimeout(() => {
    const targetNode = selector ? document.querySelector(selector) : null;
    if (targetNode) {
      targetNode.scrollIntoView({ behavior: "smooth", block: "center" });
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, 30);
}

function defaultTrialDateTime() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(19, 0, 0, 0);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}T19:00`;
}

function addDaysDateString(days) {
  const date = new Date();
  date.setDate(date.getDate() + Number(days || 0));
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseMaybeDate(value) {
  if (!value) return null;
  const date = new Date(String(value).replace(" ", "T"));
  return Number.isNaN(date.getTime()) ? null : date;
}

function daysSince(value) {
  const date = parseMaybeDate(value);
  if (!date) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  return Math.floor((today.getTime() - date.getTime()) / 86400000);
}

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function isWithinDays(value, days) {
  const date = parseMaybeDate(value);
  if (!date) return false;
  const start = startOfToday();
  const from = new Date(start);
  from.setDate(from.getDate() - Math.max(0, days - 1));
  return date >= from;
}

function isCurrentMonth(value) {
  const date = parseMaybeDate(value);
  if (!date) return false;
  const today = new Date();
  return date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth();
}

function isCurrentYear(value) {
  const date = parseMaybeDate(value);
  if (!date) return false;
  return date.getFullYear() === new Date().getFullYear();
}

function isAdmissionDormantStatus(status) {
  return status === "搁置待回访" || status === "无效沉睡线索";
}

function isAdmissionEnrolled(lead) {
  return Number(lead?.enrolledAmount || 0) > 0 || lead?.status === "定金 / 已报名";
}

function leadActivityDate(lead) {
  return lead?.enrolledAt || lead?.trialTime || lead?.createdAt || "";
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return normalizeState(structuredClone(defaultState));
    const parsed = JSON.parse(raw);
    return normalizeState({
      ...structuredClone(defaultState),
      ...parsed,
    });
  } catch {
    return normalizeState(structuredClone(defaultState));
  }
}

function buildAdmissionsId(prefix, parts) {
  const seed = (Array.isArray(parts) ? parts : [parts]).map((value) => String(value || "").trim()).filter(Boolean).join("|")
    || `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  return `${prefix}-${hash.toString(16)}`;
}

function ensureLeadId(lead) {
  const existing = String(lead?.leadId || lead?.id || "").trim();
  if (existing) return { ...lead, leadId: existing };
  return {
    ...lead,
    leadId: buildAdmissionsId("lead", [
      lead?.studentName,
      normalizePhone(lead?.parentPhone),
      lead?.createdAt
    ])
  };
}

function ensureFollowupId(item) {
  const existing = String(item?.followupId || item?.id || "").trim();
  if (existing) return { ...item, followupId: existing };
  return {
    ...item,
    followupId: buildAdmissionsId("followup", [
      item?.studentName,
      item?.time,
      item?.text
    ])
  };
}

function ensureAuditId(item) {
  const existing = String(item?.auditId || item?.id || "").trim();
  if (existing) return { ...item, auditId: existing };
  return {
    ...item,
    auditId: buildAdmissionsId("audit", [
      item?.time,
      item?.operator,
      item?.action,
      item?.studentName,
      item?.detail
    ])
  };
}

function mergeLeadRows(...groups) {
  const map = new Map();
  const rowTime = (lead) => {
    const value = String(lead?.updatedAt || lead?.enrolledAt || lead?.createdAt || "").trim();
    const parsed = Date.parse(value.replace(" ", "T"));
    return Number.isFinite(parsed) ? parsed : 0;
  };
  groups.flat().forEach((lead) => {
    if (!lead || typeof lead !== "object") return;
    const safeLead = ensureLeadId(lead);
    const key = safeLead.leadId;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        ...safeLead,
        leadId: key,
        renewalRecords: Array.isArray(safeLead.renewalRecords) ? safeLead.renewalRecords : []
      });
      return;
    }
    const incomingIsNewer = rowTime(safeLead) >= rowTime(existing);
    const mergedRenewals = mergeLeadRenewalRecords(existing.renewalRecords || [], safeLead.renewalRecords || []);
    map.set(key, incomingIsNewer
      ? { ...existing, ...safeLead, leadId: key, renewalRecords: mergedRenewals }
      : { ...safeLead, ...existing, leadId: key, renewalRecords: mergedRenewals });
  });
  return [...map.values()].sort((left, right) => String(right.createdAt || "").localeCompare(String(left.createdAt || "")));
}

function mergeLeadRenewalRecords(...groups) {
  const map = new Map();
  groups.flat().forEach((record) => {
    if (!record || typeof record !== "object") return;
    const key = String(record.id || [record.createdAt, record.courseName, record.amount, record.type].filter(Boolean).join("|")).trim();
    if (!key) return;
    const existing = map.get(key) || {};
    map.set(key, { ...existing, ...record, id: record.id || key });
  });
  return [...map.values()].sort((left, right) => String(right.createdAt || "").localeCompare(String(left.createdAt || "")));
}

function touchLead(lead) {
  if (lead && typeof lead === "object") lead.updatedAt = new Date().toISOString();
  return lead;
}

function mergeFollowupRows(...groups) {
  const map = new Map();
  groups.flat().forEach((item) => {
    if (!item || typeof item !== "object") return;
    const safeItem = ensureFollowupId(item);
    const existing = map.get(safeItem.followupId) || {};
    map.set(safeItem.followupId, { ...existing, ...safeItem, followupId: safeItem.followupId });
  });
  return [...map.values()].sort((left, right) => String(right.time || "").localeCompare(String(left.time || "")));
}

function mergeAuditRows(...groups) {
  const map = new Map();
  groups.flat().forEach((item) => {
    if (!item || typeof item !== "object") return;
    const safeItem = ensureAuditId(item);
    const existing = map.get(safeItem.auditId) || {};
    map.set(safeItem.auditId, { ...existing, ...safeItem, auditId: safeItem.auditId });
  });
  return [...map.values()].sort((left, right) => String(right.time || "").localeCompare(String(left.time || ""))).slice(0, 120);
}

function referralReportId(row) {
  return String(row?.id || buildAdmissionsId("referral-report", [row?.leadId, row?.studentName, row?.nodeKey])).trim();
}

function mergeReferralReportRows(...groups) {
  const map = new Map();
  groups.flat().forEach((row) => {
    if (!row || typeof row !== "object") return;
    const id = referralReportId(row);
    const existing = map.get(id) || {};
    map.set(id, { ...existing, ...row, id });
  });
  return [...map.values()].sort((left, right) => String(right.updatedAt || right.createdAt || "").localeCompare(String(left.updatedAt || left.createdAt || "")));
}

function normalizeState(nextState) {
  nextState.leads = mergeLeadRows((nextState.leads || []).map((lead) => ({
    ...lead,
    parentNeed: lead.parentNeed || "",
    studentPainPoint: lead.studentPainPoint || "",
    objection: lead.objection || "暂无明确异议",
    nextFollowupDate: lead.nextFollowupDate || "",
    renewalRecords: Array.isArray(lead.renewalRecords) ? lead.renewalRecords : [],
  })));
  nextState.followups = mergeFollowupRows(Array.isArray(nextState.followups) ? nextState.followups : []);
  nextState.auditLogs = mergeAuditRows(Array.isArray(nextState.auditLogs) ? nextState.auditLogs : []);
  nextState.referralLearningReports = mergeReferralReportRows(Array.isArray(nextState.referralLearningReports) ? nextState.referralLearningReports : []);
  return nextState;
}

function persistState() {
  try {
    if (Array.isArray(window.JRC_EMPLOYEES) && window.JRC_EMPLOYEES.length) {
      state.employees = window.JRC_EMPLOYEES.map((employee) => ({
        name: employee.name,
        username: employee.username,
        role: employee.role,
        phone: employee.phone,
        wechat: employee.wechat,
        scope: employee.scope,
        hireDate: employee.hireDate,
        regularDate: employee.regularDate || "",
        subject: employee.subject || "",
        commissionRate: employee.commissionRate || ""
      }));
    }
    state.leads = mergeLeadRows(state.leads);
    state.followups = mergeFollowupRows(state.followups);
    state.auditLogs = mergeAuditRows(state.auditLogs);
    state.referralLearningReports = mergeReferralReportRows(state.referralLearningReports || []);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    scheduleCloudPersist();
  } catch {}
}

function scheduleCloudPersist() {
  if (!cloudStoreReady || !window.JRC_CLOUD?.writeModuleData) return;
  clearTimeout(cloudSaveTimer);
  cloudSaveTimer = setTimeout(async () => {
    try {
      let remoteState = normalizeState(structuredClone(defaultState));
      if (window.JRC_CLOUD?.readModuleData) {
        const result = await window.JRC_CLOUD.readModuleData(STORAGE_KEY);
        if (result.ok && result.data?.found && result.data.payload) {
          remoteState = normalizeState({
            ...structuredClone(defaultState),
            ...result.data.payload,
          });
        }
      }
      const mergedState = normalizeState({
        ...structuredClone(defaultState),
        ...remoteState,
        ...state,
        leads: mergeLeadRows(remoteState.leads || [], state.leads || []),
        followups: mergeFollowupRows(remoteState.followups || [], state.followups || []),
        auditLogs: mergeAuditRows(remoteState.auditLogs || [], state.auditLogs || []),
        referralLearningReports: mergeReferralReportRows(remoteState.referralLearningReports || [], state.referralLearningReports || [])
      });
      Object.keys(state).forEach((key) => delete state[key]);
      Object.assign(state, mergedState);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      await window.JRC_CLOUD.writeModuleData(STORAGE_KEY, "admissions", state);
    } catch (error) {
      console.warn("招生系统云端保存失败", error);
    }
  }, 450);
}

async function hydrateCloudState() {
  if (!window.JRC_CLOUD?.readModuleData) {
    cloudStoreReady = true;
    return;
  }
  try {
    const result = await window.JRC_CLOUD.readModuleData(STORAGE_KEY);
    if (result.ok && result.data?.found && result.data.payload) {
      const nextState = normalizeState({
        ...structuredClone(defaultState),
        ...result.data.payload,
      });
      const mergedState = normalizeState({
        ...structuredClone(defaultState),
        ...state,
        ...nextState,
        leads: mergeLeadRows(state.leads || [], nextState.leads || []),
        followups: mergeFollowupRows(state.followups || [], nextState.followups || []),
        auditLogs: mergeAuditRows(state.auditLogs || [], nextState.auditLogs || []),
        referralLearningReports: mergeReferralReportRows(state.referralLearningReports || [], nextState.referralLearningReports || [])
      });
      Object.keys(state).forEach((key) => delete state[key]);
      Object.assign(state, mergedState);
      cloudStoreReady = true;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      if (JSON.stringify(mergedState) !== JSON.stringify(nextState)) scheduleCloudPersist();
      renderAll();
      return;
    }
    cloudStoreReady = true;
    scheduleCloudPersist();
  } catch (error) {
    console.warn("招生系统云端读取失败，暂用本机数据", error);
    cloudStoreReady = true;
  }
}

function getCurrentEmployee() {
  return window.JRC_CURRENT_EMPLOYEE || null;
}

function hasPermission(permissionKey) {
  if (typeof window.jrcHasPermission === "function") {
    return window.jrcHasPermission(permissionKey, getCurrentEmployee());
  }
  return true;
}

function canEditAdmissions() {
  return hasPermission("admissions.edit");
}

function canImportAdmissions() {
  return hasPermission("admissions.import");
}

function canViewAdmissionFinance() {
  return hasPermission("admissions.finance") || hasPermission("finance.access");
}

function canExportAdmissions() {
  return hasPermission("admissions.export") || canImportAdmissions();
}

function formatNowStamp() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hour = String(now.getHours()).padStart(2, "0");
  const minute = String(now.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day} ${hour}:${minute}`;
}

function getOperatorLabel() {
  const employee = getCurrentEmployee();
  if (!employee) return "系统访客";
  return `${employee.name}（${employee.role}）`;
}

function logAudit(action, studentName, detail) {
  if (!Array.isArray(state.auditLogs)) {
    state.auditLogs = [];
  }
  state.auditLogs = mergeAuditRows([{
    time: formatNowStamp(),
    operator: getOperatorLabel(),
    action,
    studentName: studentName || "-",
    detail
  }], state.auditLogs);
}

function formatTrialDisplay(trialTime) {
  if (!trialTime) return "待确认时间";
  return trialTime.replace("T", " ");
}

function normalizeDateTimeLocal(value) {
  if (!value) return "";
  if (value.includes("T")) return value.slice(0, 16);
  if (value.includes(" ")) return value.replace(" ", "T").slice(0, 16);
  return value;
}

function getSelectedLead() {
  return (
    state.leads.find((item) => item.studentName === state.selectedLeadName) ||
    state.leads[0] ||
    null
  );
}

function deriveReferrerText(channelMeta) {
  if (!channelMeta) return "无";
  if (channelMeta.includes("推荐人：")) {
    return channelMeta.replace("推荐人：", "").trim() || "无";
  }
  return "无";
}

function deriveChannelOwner(lead) {
  if (lead.channelOwner) return lead.channelOwner;
  if (lead.channelMeta?.includes("网销归属：")) {
    return lead.channelMeta.replace("网销归属：", "").trim() || "待补渠道归属";
  }
  if (normalizeLeadChannelValue(lead.channel) === "线上客户") return "待补渠道归属";
  if (lead.channel === "自然到访") return "前台";
  return "待补渠道归属";
}

function normalizeLeadChannelValue(channel) {
  const value = String(channel || "").trim();
  if (!value) return "待补来源";
  if (value === "老家长转介绍") return "老生家长转介绍";
  if (value.startsWith("其他：")) return value;
  if (["抖音投流", "官网表单", "线上表单", "视频号", "小红书"].includes(value)) return "线上客户";
  if (["续费扩科", "内部扩科", "扩科报名"].includes(value)) return "扩科";
  return value;
}

function isReferralChannel(channel) {
  return normalizeLeadChannelValue(channel).includes("转介绍");
}

function buildChannelMeta(channel, channelOwner, referrerName, otherNote = "") {
  const normalizedChannel = normalizeLeadChannelValue(channel);
  if (isReferralChannel(normalizedChannel) && referrerName) return `推荐人：${referrerName}`;
  if (normalizedChannel === "线上客户" && channelOwner && channelOwner !== "待补渠道归属") {
    return `网销归属：${channelOwner}`;
  }
  if ((normalizedChannel === "扩科" || channel === "自然到访") && channelOwner && channelOwner !== "待补渠道归属") {
    return `${channelOwner}登记`;
  }
  if (normalizeLeadChannelForSelect(normalizedChannel) === "其他" && otherNote) return `其他来源：${otherNote}`;
  if (referrerName) return `推荐人：${referrerName}`;
  return "待补推荐人";
}

function normalizeLeadChannelForSelect(channel) {
  const value = normalizeLeadChannelValue(channel);
  if (!value || value === "待补来源") return "待补来源";
  if (channelOptions.includes(value)) return value;
  if (value.startsWith("其他：")) return "其他";
  if (["自然到访", "内部员工推荐", "异业合作"].includes(value)) return "其他";
  return "其他";
}

function normalizePhone(phone) {
  return String(phone || "").replace(/\D/g, "");
}

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function percent(part, total) {
  if (!total) return "0%";
  return `${Math.round((part / total) * 1000) / 10}%`;
}

function uniqueValues(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function createImportResult(studentName, status, detail) {
  return { studentName, status, detail };
}

function pushFollowup(studentName, text, time = "刚刚") {
  if (!Array.isArray(state.followups)) {
    state.followups = [];
  }
  state.followups = mergeFollowupRows(state.followups, [{ studentName, time, text }]);
}

function csvEscape(value) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function downloadTextFile(filename, content, type = "text/csv;charset=utf-8") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function buildAttributionSnapshot(lead) {
  return {
    channel: normalizeLeadChannelValue(lead.channel),
    channelOwner: deriveChannelOwner(lead),
    owner: lead.owner,
    referrerName: lead.referrerName || deriveReferrerText(lead.channelMeta) || "",
  };
}

function refreshEnrollmentStartTimeOptions() {
  const select = byId("enrollStartTimeSelect");
  if (!select) return;
  const saved = Array.isArray(state.customStartTimeOptions) ? state.customStartTimeOptions : [];
  const values = Array.from(new Set([...startTimeOptions, ...saved].filter(Boolean)));
  const current = select.value;
  select.innerHTML = [`<option value="">选择常用时间</option>`, ...values.map((value) => `<option>${escapeHtml(value)}</option>`)].join("");
  if (values.includes(current)) select.value = current;
}

function resolveEnrollmentChannel() {
  const channel = byId("enrollChannel")?.value || "";
  const other = byId("enrollChannelOther")?.value.trim() || "";
  return channel === "其他" && other ? `其他：${other}` : channel;
}

function validateLeadSource(channel, referrerName = "", otherNote = "") {
  const normalizedChannel = normalizeLeadChannelForSelect(channel);
  if (!normalizedChannel || normalizedChannel === "待补来源") {
    return { ok: false, message: "请选择生源来源：线上客户、老生家长转介绍、扩科或其他。" };
  }
  if (isReferralChannel(normalizedChannel) && !String(referrerName || "").trim()) {
    return { ok: false, message: "生源来源为转介绍时，必须填写推荐人 / 转介绍人。" };
  }
  if (normalizedChannel === "其他" && !String(otherNote || "").trim()) {
    return { ok: false, message: "生源来源为其他时，请写清楚具体来源。" };
  }
  return { ok: true, channel: normalizedChannel };
}

function resolveEnrollmentStartTime() {
  const manual = byId("enrollStartDate")?.value.trim() || "";
  const selected = byId("enrollStartTimeSelect")?.value || "";
  const value = manual || selected;
  if (manual) {
    state.customStartTimeOptions = Array.isArray(state.customStartTimeOptions) ? state.customStartTimeOptions : [];
    if (!state.customStartTimeOptions.includes(manual) && !startTimeOptions.includes(manual)) {
      state.customStartTimeOptions.push(manual);
      state.customStartTimeOptions = state.customStartTimeOptions.slice(-30);
      refreshEnrollmentStartTimeOptions();
    }
  }
  return value;
}

function formatAttributionSnapshot(snapshot) {
  if (!snapshot) return "未锁定";
  return `${snapshot.channel} / ${snapshot.channelOwner} / ${snapshot.owner}${snapshot.referrerName ? ` / 推荐人 ${snapshot.referrerName}` : ""}`;
}

function buildFinanceSettlementSummary(lead) {
  const attribution = lead.attributionLocked && lead.attributionSnapshot
    ? lead.attributionSnapshot
    : buildAttributionSnapshot(lead);
  const financeProfile = lead.financeProfile || {
    settledAmount: lead.enrolledAmount || 0,
    pendingCommission: "待结算",
    referralReward: attribution.referrerName ? "待判断" : "无",
  };
  return {
    firstPaidAmount: lead.enrolledAmount || 0,
    totalPaidAmount: financeProfile.settledAmount,
    consultantOwner: attribution.owner,
    channelSettlementOwner: attribution.channelOwner,
    referralSettlementOwner: attribution.referrerName || "无",
    commissionStatus: financeProfile.pendingCommission,
    referralRewardStatus: financeProfile.referralReward,
  };
}

function referralNameForLead(lead) {
  const direct = String(lead?.referrerName || "").trim();
  if (direct && direct !== "无") return direct;
  const fromMeta = deriveReferrerText(lead?.channelMeta);
  return fromMeta && fromMeta !== "无" ? fromMeta : "";
}

function isReferralLead(lead) {
  return Boolean(referralNameForLead(lead)) || String(lead?.channel || "").includes("转介绍") || String(lead?.channel || "").includes("推荐");
}

function estimateReferralReward(amount, enrolledCount) {
  if (!enrolledCount) return 0;
  const value = Number(amount || 0);
  if (!value) return enrolledCount * 100;
  return Math.round(Math.max(enrolledCount * 100, Math.min(value * 0.02, enrolledCount * 300)));
}

function collectMissingLeadFields(lead) {
  const missing = [];
  const channel = normalizeLeadChannelForSelect(lead.channel);
  if (!lead.channel || channel === "待补来源") missing.push("缺生源来源");
  if (!lead.owner || lead.owner === "待分配") missing.push("缺负责人");
  if (channel === "线上客户" && (!deriveChannelOwner(lead) || deriveChannelOwner(lead) === "待补渠道归属")) {
    missing.push("缺渠道归属");
  }
  if (isReferralChannel(channel) && !lead.referrerName && deriveReferrerText(lead.channelMeta) === "无") {
    missing.push("缺推荐人");
  }
  if (channel === "其他" && !String(lead.channelOtherNote || "").trim() && !String(lead.channel || "").startsWith("其他：")) {
    missing.push("缺其他来源说明");
  }
  if (!lead.note || lead.note === "待补首条记录") missing.push("缺首条备注");
  return missing;
}

function buildAdmissionTasks() {
  const tasks = [];
  state.leads.forEach((lead) => {
    const missing = collectMissingLeadFields(lead);
    if (missing.length) {
      tasks.push({
        priority: "high",
        label: "紧急",
        lead,
        action: `补齐字段：${missing.join("、")}`,
        target: "先补字段，否则跟进和归属链会乱。",
      });
    }
    if (lead.status === "新建未联系") {
      tasks.push({
        priority: "high",
        label: "紧急",
        lead,
        action: "尽快首联家长",
        target: "确认年级、薄弱点、可试听时间和是否愿意进群。",
      });
    }
    if (lead.status === "已沟通待邀约" || lead.status === "持续跟进中") {
      tasks.push({
        priority: lead.intent?.startsWith("A") ? "high" : "medium",
        label: lead.intent?.startsWith("A") ? "紧急" : "重要",
        lead,
        action: lead.intent?.startsWith("A") ? "推动报名或锁定试听" : "继续邀约试听",
        target: lead.nextAction || "补明确下一步动作。",
      });
    }
    if (lead.status === "已预约试听") {
      tasks.push({
        priority: "medium",
        label: "重要",
        lead,
        action: "确认试听到场并准备反馈",
        target: `${lead.trialTeacher || "待定老师"} / ${lead.trialTime ? formatTrialDisplay(lead.trialTime) : lead.trial}`,
      });
    }
    if (lead.status === "试听完成待转化") {
      tasks.push({
        priority: "high",
        label: "紧急",
        lead,
        action: "补试听反馈并追报名方案",
        target: lead.nextAction || "48 小时内给报名方案。",
      });
    }
  });
  const score = { high: 0, medium: 1, normal: 2 };
  return tasks.sort((a, b) => score[a.priority] - score[b.priority]).slice(0, 12);
}

function buildSopTasks() {
  const activeLeads = state.leads.filter(
    (lead) => lead.status === "试听完成待转化" && lead.enrolledAmount <= 0
  );
  const sopRows = [];
  activeLeads.forEach((lead) => {
    const level = lead.intent || "B 中意向";
    sopRows.push({
      node: "试听当天",
      lead,
      action: "发送学情反馈、课堂表现总结、老师建议",
      goal: "让家长记住试听价值，趁热推进报名方案。",
    });
    if (level.startsWith("A") || level.startsWith("B")) {
      sopRows.push({
        node: "第 3 天",
        lead,
        action: "发送提分案例、班型方案、价格解释",
        goal: "处理核心异议，推进定金或报名。",
      });
    }
    if (level.startsWith("B") || level.startsWith("C")) {
      sopRows.push({
        node: "第 7 天",
        lead,
        action: "邀约公开课、活动课或二次试听",
        goal: "重新拉回兴趣，不让线索自然流失。",
      });
    }
    if (level.startsWith("C") || level.startsWith("D")) {
      sopRows.push({
        node: "第 14 天",
        lead,
        action: "转入资料培育群或低频运营池",
        goal: "降低人工高频追踪成本，保留长期转化可能。",
      });
    }
  });
  return sopRows;
}

function getFilteredLeads() {
  return state.leads.filter((lead) => {
    if (state.funnelStage === "communicated" && !(lead.status === "已沟通待邀约" || lead.status === "持续跟进中")) return false;
    if (state.funnelStage === "trial-pending" && lead.status !== "已预约试听") return false;
    if (state.funnelStage === "feedback-pending" && !(lead.status === "试听完成待转化" && !isAdmissionEnrolled(lead))) return false;
    if (state.funnelStage === "high-intent" && !(String(lead.intent || "").startsWith("A") && !isAdmissionEnrolled(lead))) return false;
    if (state.activeLeadFilter === "new" && lead.status !== "新建未联系") return false;
    if (state.activeLeadFilter === "trial")
      if (!(lead.status === "已预约试听" || lead.status === "试听完成待转化")) return false;
    if (state.activeLeadFilter === "enrolled" && !isAdmissionEnrolled(lead)) return false;
    const query = normalizeText(state.leadSearchQuery);
    if (query) {
      const haystack = normalizeText([
        lead.studentName,
        lead.parentPhone,
        lead.grade,
        lead.subject,
        lead.channel,
        lead.channelMeta,
        lead.owner,
        lead.status,
        lead.intent,
        lead.parentNeed,
        lead.studentPainPoint,
        lead.objection,
        lead.note,
        lead.nextAction,
      ].join(" "));
      if (!haystack.includes(query)) return false;
    }
    if (state.leadOwnerFilter && lead.owner !== state.leadOwnerFilter) return false;
    if (state.leadChannelFilter && normalizeLeadChannelValue(lead.channel) !== state.leadChannelFilter) return false;
    if (state.leadIntentFilter && lead.intent !== state.leadIntentFilter) return false;
    return true;
  });
}

function parseImportLine(line, headerMap) {
  const cols = line.split("\t").map((item) => item.trim());
  if (headerMap) {
    const at = (...names) => {
      const key = names.find((name) => headerMap.has(name));
      return key ? cols[headerMap.get(key)] || "" : "";
    };
    return {
      studentName: at("学生姓名", "student_name"),
      grade: at("年级", "当前年级", "grade"),
      parentName: at("家长姓名", "parent_name"),
      parentPhone: at("家长电话", "联系电话", "手机号", "parent_phone"),
      subject: at("意向学科", "学科", "subject") || "数学",
      channel: at("生源来源", "来源渠道", "渠道", "channel"),
      referrer: at("推荐人", "转介绍人", "referrer"),
      owner: at("当前负责人", "负责人", "owner"),
      status: at("当前状态", "状态", "lead_status"),
      intent: at("意向等级", "意向", "intention_level"),
      trialTime: at("试听时间", "trial_date"),
      trialTeacher: at("试听老师", "trial_teacher"),
      inGroup: at("是否进群", "is_in_parent_group"),
      note: at("首条备注", "备注", "followup_note"),
      parentNeed: at("家长核心诉求", "家长诉求", "parent_need"),
      studentPainPoint: at("学生薄弱点", "薄弱点", "student_pain_point"),
      objection: at("报名异议", "异议", "objection"),
      nextFollowupDate: at("下次跟进日期", "next_followup_date"),
      nextAction: at("下一步动作", "next_action"),
    };
  }
  const [
    studentName = "",
    grade = "",
    parentPhone = "",
    subject = "数学",
    channel = "",
    referrer = "",
    owner = "",
    note = "",
  ] = cols;
  return { studentName, grade, parentPhone, subject, channel, referrer, owner, note };
}

function maybeBuildImportHeaderMap(lines) {
  if (!lines.length) return null;
  const firstCols = lines[0].split("\t").map((item) => item.trim());
  const hasHeader = firstCols.some((item) =>
    ["学生姓名", "student_name", "家长电话", "parent_phone", "生源来源", "来源渠道", "channel"].includes(item)
  );
  if (!hasHeader) return null;
  return new Map(firstCols.map((item, index) => [item, index]));
}

function syncSelectedLead(leadName) {
  if (!leadName) return;
  const exists = state.leads.some((lead) => lead.studentName === leadName);
  if (!exists) return;
  state.selectedLeadName = leadName;

  const followupSelect = byId("followupLeadSelect");
  if (followupSelect) followupSelect.value = leadName;

  const quickFollowupSelect = byId("quickFollowupLeadSelect");
  if (quickFollowupSelect) quickFollowupSelect.value = leadName;

  const feedbackSelect = byId("feedbackLeadSelect");
  if (feedbackSelect && Array.from(feedbackSelect.options).some((option) => option.value === leadName)) {
    feedbackSelect.value = leadName;
  }

  const trialSelect = byId("trialLeadSelect");
  if (trialSelect && Array.from(trialSelect.options).some((option) => option.value === leadName)) {
    trialSelect.value = leadName;
  }

  const enrollInput = byId("enrollStudentName");
  if (enrollInput) enrollInput.value = leadName;
}

function saveFollowupRecord({
  leadName,
  text,
  method = "沟通",
  parentNeed = "",
  painPoint = "",
  objection = "暂无明确异议",
  nextDate = "",
}) {
  const target = state.leads.find((lead) => lead.studentName === leadName);
  const cleanText = String(text || "").trim();
  if (!target || !cleanText) return false;
  touchLead(target);
  target.lastFollowup = "刚刚";
  if (parentNeed) target.parentNeed = parentNeed;
  if (painPoint) target.studentPainPoint = painPoint;
  target.objection = objection || "暂无明确异议";
  target.nextFollowupDate = nextDate || "";
  target.nextAction = nextDate ? `下次跟进：${nextDate}` : target.nextAction;
  const structuredText = [
    `${method}跟进。`,
    parentNeed ? `家长诉求：${parentNeed}。` : "",
    painPoint ? `学生薄弱点：${painPoint}。` : "",
    objection && objection !== "暂无明确异议" ? `报名异议：${objection}。` : "",
    `沟通记录：${cleanText}`,
    nextDate ? `下次跟进：${nextDate}。` : "",
  ].filter(Boolean).join("");
  target.note = structuredText;
  pushFollowup(leadName, structuredText);
  logAudit("新增跟进", target.studentName, structuredText);
  syncSelectedLead(target.studentName);
  return true;
}

function renderLeadTable() {
  const body = byId("leadTableBody");
  if (!body) return;
  const editable = canEditAdmissions();
  const filteredLeads = getFilteredLeads();
  renderLeadCards(filteredLeads, editable);
  body.innerHTML = filteredLeads
    .map(
      (lead) => `
        <tr>
          <td>${lead.studentName}<br>家长：${lead.parentPhone}<br>${lead.grade} / ${lead.subject}</td>
          <td><span class="tag ${lead.channel.includes("转介绍") ? "green" : lead.channel.includes("自然") ? "red" : ""}">${lead.channel}</span><br>${lead.channelMeta}</td>
          <td>
            <div>招生顾问：${lead.owner}</div>
            <select data-owner-select="${lead.studentName}" ${editable ? "" : "disabled"}>
              ${ownerOptions
                .map(
                  (owner) =>
                    `<option value="${owner}" ${lead.owner === owner ? "selected" : ""}>${owner}</option>`
                )
                .join("")}
            </select>
          </td>
          <td><span class="tag ${statusClassMap[lead.status] || ""}">${lead.status}</span></td>
          <td>${lead.trial}${lead.trialTeacher ? `<br>试听老师：${lead.trialTeacher}` : ""}</td>
          <td>${lead.intent}</td>
          <td>${lead.inGroup}</td>
          <td>${lead.lastFollowup}<br>${lead.note}</td>
          <td>${lead.nextAction}</td>
          <td>
            <button class="button small secondary" type="button" data-action="view-detail" data-student="${lead.studentName}">查看详情</button>
            <button class="button small" type="button" data-action="advance-status" data-student="${lead.studentName}" ${editable ? "" : "disabled"}>推进状态</button>
            <button class="button small secondary" type="button" data-action="assign-trial" data-student="${lead.studentName}" ${editable ? "" : "disabled"}>预约试听</button>
            <button class="button small secondary" type="button" data-action="complete-trial" data-student="${lead.studentName}" ${editable ? "" : "disabled"}>完成试听</button>
            <button class="button small secondary" type="button" data-action="reassign-owner" data-student="${lead.studentName}" ${editable ? "" : "disabled"}>重分配</button>
          </td>
        </tr>
      `
    )
    .join("") || `
      <tr>
        <td colspan="10">当前筛选条件下没有客户。可以清空搜索或切换筛选条件。</td>
      </tr>
    `;
  bindLeadActions();
}

function renderLeadCards(filteredLeads, editable) {
  const box = byId("leadCardList");
  if (!box) return;
  box.innerHTML = filteredLeads.length
    ? filteredLeads
        .map(
          (lead) => `
            <article class="lead-card">
              <div class="lead-card-head">
                <div class="lead-card-title">
                  <strong>${escapeHtml(lead.studentName)}</strong>
                  <span>${escapeHtml(lead.grade)} / ${escapeHtml(lead.subject)} / ${escapeHtml(lead.parentPhone)}</span>
                </div>
                <span class="tag ${statusClassMap[lead.status] || ""}">${escapeHtml(lead.status)}</span>
              </div>
              <div class="lead-card-grid">
                <div class="lead-kv">负责人：${escapeHtml(lead.owner)}</div>
                <div class="lead-kv">意向：${escapeHtml(lead.intent)}</div>
                <div class="lead-kv">来源：${escapeHtml(lead.channel)}</div>
                <div class="lead-kv">进群：${escapeHtml(lead.inGroup)}</div>
                <div class="lead-kv">试听：${escapeHtml(lead.trialTime ? formatTrialDisplay(lead.trialTime) : lead.trial)}</div>
                <div class="lead-kv">老师：${escapeHtml(lead.trialTeacher || "待安排")}</div>
              </div>
              <div class="lead-card-note">${escapeHtml(lead.nextAction || lead.note || "待补下一步")}</div>
              <div class="lead-card-actions">
                <button class="button small secondary" type="button" data-action="view-detail" data-student="${escapeHtml(lead.studentName)}">详情</button>
                <button class="button small" type="button" data-action="advance-status" data-student="${escapeHtml(lead.studentName)}" ${editable ? "" : "disabled"}>推进</button>
                <button class="button small secondary" type="button" data-action="assign-trial" data-student="${escapeHtml(lead.studentName)}" ${editable ? "" : "disabled"}>约试听</button>
                <button class="button small secondary" type="button" data-action="complete-trial" data-student="${escapeHtml(lead.studentName)}" ${editable ? "" : "disabled"}>已试听</button>
              </div>
            </article>
          `
        )
        .join("")
    : `
      <article class="lead-card">
        <div class="lead-card-title">
          <strong>没有匹配客户</strong>
          <span>清空搜索条件，或先新增一个咨询客户。</span>
        </div>
      </article>
    `;
}

function renderLeadFilterControls() {
  const searchInput = byId("leadSearchInput");
  if (searchInput && searchInput.value !== state.leadSearchQuery) {
    searchInput.value = state.leadSearchQuery || "";
  }

  const ownerSelect = byId("leadOwnerFilter");
  if (ownerSelect) {
    const current = ownerSelect.value || state.leadOwnerFilter || "";
    ownerSelect.innerHTML = `<option value="">全部负责人</option>${uniqueValues(state.leads.map((lead) => lead.owner))
      .map((owner) => `<option value="${owner}">${owner}</option>`)
      .join("")}`;
    ownerSelect.value = Array.from(ownerSelect.options).some((option) => option.value === current)
      ? current
      : "";
    state.leadOwnerFilter = ownerSelect.value;
  }

  const channelSelect = byId("leadChannelFilter");
  if (channelSelect) {
    const current = channelSelect.value || state.leadChannelFilter || "";
    channelSelect.innerHTML = `<option value="">全部生源</option>${uniqueValues(state.leads.map((lead) => normalizeLeadChannelValue(lead.channel)))
      .map((channel) => `<option value="${channel}">${channel}</option>`)
      .join("")}`;
    channelSelect.value = Array.from(channelSelect.options).some((option) => option.value === current)
      ? current
      : "";
    state.leadChannelFilter = channelSelect.value;
  }

  const intentSelect = byId("leadIntentFilter");
  if (intentSelect) {
    const current = state.leadIntentFilter || "";
    intentSelect.value = Array.from(intentSelect.options).some((option) => option.value === current)
      ? current
      : "";
    state.leadIntentFilter = intentSelect.value;
  }
}

function renderAdmissionTasks() {
  const body = byId("admissionsTaskBody");
  if (!body) return;
  const tasks = buildAdmissionTasks();
  const urgentCount = tasks.filter((task) => task.priority === "high").length;
  const missingCount = state.leads.filter((lead) => collectMissingLeadFields(lead).length > 0).length;
  if (byId("urgentTaskChip")) byId("urgentTaskChip").textContent = `紧急 ${urgentCount}`;
  if (byId("missingFieldChip")) byId("missingFieldChip").textContent = `待补字段 ${missingCount}`;
  body.innerHTML = tasks.length
    ? tasks
        .map(
          (task) => `
            <tr>
              <td><span class="priority-dot ${task.priority}">${task.label}</span></td>
              <td>${task.lead.studentName}<br>${task.lead.grade} / ${task.lead.subject}<br>${task.lead.parentPhone}</td>
              <td>${task.action}<br><span class="hint">${task.target}</span></td>
              <td>${task.lead.owner}</td>
              <td><button class="button small secondary" type="button" data-action="view-detail" data-student="${task.lead.studentName}">查看详情</button></td>
            </tr>
          `
        )
        .join("")
    : `
        <tr>
          <td>暂无</td>
          <td>当前没有紧急招生待办</td>
          <td>可以继续录入新咨询客户，或查看统计看板。</td>
          <td>-</td>
          <td>-</td>
        </tr>
      `;
  bindLeadActions();
}

function getSimplePipelineStage(lead) {
  if (isAdmissionEnrolled(lead)) return "enrolled";
  if (lead.status === "已预约试听") return "trial";
  if (lead.status === "试听完成待转化") return "feedback";
  if (lead.status === "持续跟进中" || isAdmissionDormantStatus(lead.status)) return "followup";
  return "consult";
}

function buildPipelineActionButtons(lead, stageKey, editable) {
  const studentName = escapeHtml(lead.studentName);
  const disabled = editable ? "" : "disabled";
  const button = (label, action, primary = false) =>
    `<button class="button small ${primary ? "" : "secondary"}" type="button" data-action="${action}" data-student="${studentName}" ${action === "view-detail" ? "" : disabled}>${label}</button>`;

  if (stageKey === "consult") {
    return [
      button("约试听", "assign-trial", true),
      button("详情", "view-detail"),
    ].join("");
  }
  if (stageKey === "trial") {
    return [
      button("填反馈", "complete-trial", true),
      button("详情", "view-detail"),
    ].join("");
  }
  if (stageKey === "feedback") {
    return [
      button("报名", "enroll-lead", true),
      button("搁置", "mark-shelved"),
    ].join("");
  }
  if (stageKey === "followup") {
    return [
      button("报名", "enroll-lead", true),
      button("约试听", "assign-trial"),
      button("搁置", "mark-shelved"),
      button("详情", "view-detail"),
    ].join("");
  }
  return button("详情", "view-detail", true);
}

function renderSimplePipelineBoard() {
  const box = byId("simplePipelineBoard");
  if (!box) return;
  const editable = canEditAdmissions();
  const stages = [
    {
      key: "consult",
      title: "登记咨询",
      hint: "新加微信、转介绍、线上咨询，先首联并确认是否约试听。",
      empty: "暂无新咨询。",
    },
    {
      key: "trial",
      title: "待试听",
      hint: "已经定好试听，重点确认到场和老师时间。",
      empty: "暂无待试听。",
    },
    {
      key: "feedback",
      title: "试听后",
      hint: "试听已完成，先填反馈，再判断报名或搁置。",
      empty: "暂无待反馈客户。",
    },
    {
      key: "followup",
      title: "跟进/搁置",
      hint: "还没报名，继续跟进；暂时不报就定期回访。",
      empty: "暂无跟进或搁置客户。",
    },
    {
      key: "enrolled",
      title: "已报名",
      hint: "补班级、开课时间、推荐人和返现信息。",
      empty: "暂无已报名客户。",
    },
  ];
  const grouped = stages.reduce((result, stage) => {
    result[stage.key] = [];
    return result;
  }, {});
  state.leads.forEach((lead) => {
    const key = getSimplePipelineStage(lead);
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(lead);
  });
  Object.keys(grouped).forEach((key) => {
    grouped[key].sort((a, b) => String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || "")));
  });

  box.innerHTML = stages
    .map((stage) => {
      const leads = grouped[stage.key] || [];
      const visible = leads.slice(0, 6);
      const hiddenCount = Math.max(0, leads.length - visible.length);
      const cards = visible.length
        ? visible.map((lead) => `
          <article class="pipeline-card">
            <strong>${escapeHtml(lead.studentName || "未命名学生")}</strong>
            <p>${escapeHtml([lead.grade, lead.parentPhone || lead.wechat || "待补联系方式"].filter(Boolean).join(" / "))}</p>
            <p>${escapeHtml(`负责人：${lead.owner || "待分配"}｜来源：${normalizeLeadChannelValue(lead.channel)}`)}</p>
            <p>${escapeHtml(lead.nextAction || lead.note || "待补下一步动作")}</p>
            <div class="pipeline-actions">${buildPipelineActionButtons(lead, stage.key, editable)}</div>
          </article>
        `).join("")
        : `<div class="pipeline-empty">${stage.empty}</div>`;
      return `
        <section class="pipeline-column">
          <h3>${stage.title}<span>${leads.length}</span></h3>
          <div class="pipeline-list">
            ${cards}
            ${hiddenCount ? `<div class="pipeline-empty">还有 ${hiddenCount} 条，点“咨询名单总表”查看全部。</div>` : ""}
          </div>
        </section>
      `;
    })
    .join("");
  bindLeadActions();
}

function renderSopTasks() {
  const body = byId("sopTaskBody");
  if (!body) return;
  const rows = buildSopTasks();
  body.innerHTML = rows.length
    ? rows
        .map(
          (row) => `
            <tr>
              <td>${row.node}</td>
              <td>${row.lead.studentName} / ${row.lead.intent}<br>${row.lead.owner}</td>
              <td>${row.action}</td>
              <td>${row.goal}</td>
            </tr>
          `
        )
        .join("")
    : `
        <tr>
          <td>暂无</td>
          <td>当前没有试听后待转化线索</td>
          <td>试听完成后，系统会自动把对应学生放进这里。</td>
          <td>先保证试听反馈当天回填。</td>
        </tr>
      `;
}

function exportLeads(leads, scopeLabel = "当前筛选") {
  const headers = [
    "学生姓名",
    "年级",
    "家长电话",
    "意向学科",
    "生源来源",
    "渠道归属",
    "推荐人",
    "当前负责人",
    "当前状态",
    "意向等级",
    "是否进群",
    "试听时间",
    "试听老师",
    "实收金额",
    "家长核心诉求",
    "学生薄弱点",
    "报名异议",
    "下次跟进日期",
    "下一步动作",
    "最近备注",
    "归属链",
    "归属锁定",
    "解锁记录",
    "创建时间",
  ];
  const rows = leads.map((lead) => {
    const attribution = lead.attributionLocked && lead.attributionSnapshot
      ? lead.attributionSnapshot
      : buildAttributionSnapshot(lead);
    return [
      lead.studentName,
      lead.grade,
      lead.parentPhone,
      lead.subject,
      lead.channel,
      deriveChannelOwner(lead),
      lead.referrerName || deriveReferrerText(lead.channelMeta),
      lead.owner,
      lead.status,
      lead.intent,
      lead.inGroup,
      lead.trialTime ? formatTrialDisplay(lead.trialTime) : lead.trial,
      lead.trialTeacher,
      lead.enrolledAmount || 0,
      lead.parentNeed,
      lead.studentPainPoint,
      lead.objection,
      lead.nextFollowupDate,
      lead.nextAction,
      lead.note,
      formatAttributionSnapshot(attribution),
      lead.attributionLocked ? "已锁定" : "未锁定",
      lead.attributionUnlockLog || "",
      lead.createdAt || "",
    ];
  });
  const csv = [
    headers.map(csvEscape).join(","),
    ...rows.map((row) => row.map(csvEscape).join(",")),
  ].join("\n");
  const date = new Date().toISOString().slice(0, 10);
  downloadTextFile(`招生线索${scopeLabel}-${date}.csv`, `\ufeff${csv}`);
  logAudit("导出招生线索", scopeLabel, `导出 ${leads.length} 条线索。`);
  persistState();
}

function exportFilteredLeads() {
  exportLeads(getFilteredLeads(), "当前筛选");
}

function exportAllLeads() {
  exportLeads(state.leads, "全部");
}

function renderTrialTable() {
  const body = byId("trialTableBody");
  if (!body) return;
  const trialLeads = state.leads.filter(
    (lead) =>
      lead.status === "已预约试听" || lead.status === "试听完成待转化"
  );
  body.innerHTML = trialLeads.length
    ? trialLeads
        .map(
          (lead) => `
        <tr>
          <td>${lead.studentName}</td>
          <td>${lead.trialTime ? formatTrialDisplay(lead.trialTime) : lead.trial}</td>
          <td>${lead.trialTeacher || "待安排"}</td>
          <td>${lead.owner}</td>
          <td>${lead.status === "已预约试听" ? "试听后回填反馈单，并决定是否转 A / B / C / D 意向。" : "已上课但还没定最终报价版本，需补反馈和报名推进意见。"}
          </td>
        </tr>
      `
        )
        .join("")
    : `
        <tr>
          <td colspan="5">当前没有待处理的试听记录。</td>
        </tr>
      `;
}

function renderFollowupLeadOptions() {
  const select = byId("followupLeadSelect");
  const quickSelect = byId("quickFollowupLeadSelect");
  const options = state.leads
    .map((lead) => `<option value="${lead.studentName}">${lead.studentName}</option>`)
    .join("");
  [select, quickSelect].forEach((targetSelect) => {
    if (!targetSelect) return;
    const currentValue = targetSelect.value || state.selectedLeadName;
    targetSelect.innerHTML = options;
    targetSelect.value = state.leads.some((lead) => lead.studentName === currentValue)
      ? currentValue
      : state.leads[0]?.studentName || "";
  });
}

function renderQuickFollowupDefaults() {
  const lead = getSelectedLead();
  const select = byId("quickFollowupLeadSelect");
  if (select && lead) select.value = lead.studentName;
  const nextDateInput = byId("quickFollowupNextDateInput");
  if (nextDateInput && lead && !nextDateInput.value) {
    nextDateInput.value = lead.nextFollowupDate || "";
  }
}

function renderFeedbackLeadOptions() {
  const select = byId("feedbackLeadSelect");
  const manualInput = byId("feedbackLeadNameInput");
  if (!select) return;
  const currentValue = select.value;
  const options = state.leads
    .filter(
      (lead) =>
        lead.status === "已预约试听" || lead.status === "试听完成待转化"
    )
    .map((lead) => `<option value="${lead.studentName}">${lead.studentName}</option>`)
    .join("");
  select.innerHTML = options || `<option value="">暂无待反馈学生</option>`;
  if (currentValue) {
    select.value = Array.from(select.options).some((option) => option.value === currentValue)
      ? currentValue
      : select.options[0]?.value || "";
  }
  if (manualInput && select.value && document.activeElement !== manualInput) {
    manualInput.value = select.value;
  }
}

function renderLeadDetail() {
  const lead = getSelectedLead();
  if (!lead) {
    const unlockButton = byId("unlockAttributionButton");
    if (unlockButton) unlockButton.disabled = true;
    byId("detailStudentName").textContent = "暂无客户";
    byId("detailGradeSubject").textContent = "请先新增咨询客户或批量导入";
    byId("detailOwner").textContent = "-";
    byId("detailStatus").textContent = "待录入";
    byId("detailChannel").textContent = "-";
    byId("detailChannelMeta").textContent = "-";
    byId("detailNextAction").textContent = "先新增咨询客户，或到更多里批量导入。";
    byId("detailFollowup").textContent = "暂无跟进记录";
    byId("detailFollowupCount").textContent = "0 条记录";
    byId("detailFollowupTimeline").innerHTML = `
      <div class="timeline-item">
        <div class="timeline-time">暂无客户</div>
        <p>新增或导入客户后，这里会显示该学生的完整跟进历史。</p>
      </div>
    `;
    return;
  }
  byId("detailStudentName").textContent = lead.studentName;
  byId("detailGradeSubject").textContent = `${lead.grade} / ${lead.subject}`;
  byId("detailOwner").textContent = lead.owner;
  byId("detailStatus").textContent = lead.status;
  byId("detailChannel").textContent = lead.channel;
  byId("detailChannelMeta").textContent = lead.channelMeta;
  byId("detailNextAction").textContent = lead.nextAction;
  byId("detailFollowup").textContent = `${lead.lastFollowup} / ${lead.note}`;
  byId("detailOwnerSelect").value = lead.owner;
  byId("detailStatusSelect").value = lead.status;
  byId("detailIntentSelect").value = lead.intent;
  byId("detailInGroupSelect").value = lead.inGroup;
  byId("detailChannelOwnerSelect").value = deriveChannelOwner(lead);
  byId("detailReferrerInput").value = lead.referrerName || deriveReferrerText(lead.channelMeta) || "";
  byId("detailAttributionLock").value = lead.attributionLocked
    ? `已锁定：${formatAttributionSnapshot(lead.attributionSnapshot)}`
    : "未锁定";
  const unlockButton = byId("unlockAttributionButton");
  if (unlockButton) {
    const canUnlock = Boolean(lead.attributionLocked && canEditAdmissions());
    unlockButton.disabled = !canUnlock;
    unlockButton.title = canUnlock ? "解锁后可以修改渠道归属、招生顾问和推荐人" : "只有已锁定报名线索才需要解锁";
  }
  byId("detailNextActionInput").value = lead.nextAction;
  byId("detailNeedInput").value = lead.parentNeed || "";
  byId("detailPainInput").value = lead.studentPainPoint || "";
  byId("detailObjectionSelect").value = lead.objection || "暂无明确异议";
  byId("detailNextFollowupDateInput").value = lead.nextFollowupDate || "";
  byId("detailNoteInput").value = lead.note;
  renderLeadDetailFollowups(lead);
}

function renderLeadDetailFollowups(lead) {
  const timeline = byId("detailFollowupTimeline");
  if (!timeline || !lead) return;
  const items = state.followups
    .filter((item) => item.studentName === lead.studentName)
    .slice()
    .reverse();
  const countNode = byId("detailFollowupCount");
  if (countNode) countNode.textContent = `${items.length} 条记录`;
  timeline.innerHTML = items.length
    ? items
        .map(
          (item) => `
            <div class="timeline-item">
              <div class="timeline-time">${item.time} · ${item.studentName}</div>
              <p>${item.text}</p>
            </div>
          `
        )
        .join("")
    : `
        <div class="timeline-item">
          <div class="timeline-time">暂无跟进记录</div>
          <p>新增跟进、状态推进、试听反馈、报名登记后，这里会自动留下历史。</p>
        </div>
      `;
}

function renderImportSummary() {
  const summary = state.importSummary || defaultState.importSummary;
  byId("importAddedCount").textContent = String(summary.added || 0);
  byId("importDuplicateCount").textContent = String(summary.duplicates || 0);
  byId("importMissingOwnerCount").textContent = String(summary.missingOwner || 0);
  byId("importMissingFieldCount").textContent = String(summary.missingFields || 0);

  const body = byId("importResultBody");
  if (!body) return;
  body.innerHTML = (summary.results || []).length
    ? summary.results
        .map(
          (item) => `
            <tr>
              <td>${item.studentName}</td>
              <td>${item.status}</td>
              <td>${item.detail}</td>
            </tr>
          `
        )
        .join("")
    : `
        <tr>
          <td>尚未执行导入</td>
          <td>待处理</td>
          <td>把 Excel 一批线索复制后粘贴到上面的文本框，再点导入。</td>
        </tr>
      `;
}

function renderPendingLeadFixes() {
  const body = byId("pendingLeadFixBody");
  if (!body) return;
  const editable = canEditAdmissions();
  const pendingLeads = state.leads
    .map((lead) => ({ lead, missing: collectMissingLeadFields(lead) }))
    .filter((item) => item.missing.length > 0);

  body.innerHTML = pendingLeads.length
    ? pendingLeads
        .map(
          ({ lead, missing }) => `
            <tr>
              <td>${lead.studentName}</td>
              <td>${lead.parentPhone}</td>
              <td>${missing.join("；")}</td>
              <td>
                <div class="section-actions">
                  <button class="button small secondary" type="button" data-action="focus-pending-lead" data-student="${lead.studentName}">定位线索</button>
                  <select data-pending-owner-select="${lead.studentName}" ${editable ? "" : "disabled"}>
                    ${ownerOptions
                      .map(
                        (owner) =>
                          `<option value="${owner}" ${lead.owner === owner ? "selected" : ""}>${owner}</option>`
                      )
                      .join("")}
                  </select>
                  <button class="button small" type="button" data-action="apply-pending-owner" data-student="${lead.studentName}" ${editable ? "" : "disabled"}>补负责人</button>
                </div>
                <div class="section-actions">
                  <select data-pending-channel-select="${lead.studentName}" ${editable ? "" : "disabled"}>
                    ${channelOptions
                      .map(
                        (channel) =>
                          `<option value="${channel}" ${lead.channel === channel ? "selected" : ""}>${channel}</option>`
                      )
                      .join("")}
                  </select>
                  <button class="button small secondary" type="button" data-action="apply-pending-channel" data-student="${lead.studentName}" ${editable ? "" : "disabled"}>补来源</button>
                </div>
                <div class="section-actions">
                  <select data-pending-channel-owner-select="${lead.studentName}" ${editable ? "" : "disabled"}>
                    ${channelOwnerOptions
                      .map(
                        (channelOwner) =>
                          `<option value="${channelOwner}" ${deriveChannelOwner(lead) === channelOwner ? "selected" : ""}>${channelOwner}</option>`
                      )
                      .join("")}
                  </select>
                  <button class="button small secondary" type="button" data-action="apply-pending-channel-owner" data-student="${lead.studentName}" ${editable ? "" : "disabled"}>补渠道归属</button>
                </div>
                <div class="section-actions">
                  <input data-pending-referrer-input="${lead.studentName}" value="${lead.referrerName || ""}" ${editable ? "" : "disabled"}>
                  <button class="button small secondary" type="button" data-action="apply-pending-referrer" data-student="${lead.studentName}" ${editable ? "" : "disabled"}>补推荐人</button>
                </div>
                <div class="section-actions">
                  <input data-pending-note-input="${lead.studentName}" value="${lead.note === "待补首条记录" ? "" : lead.note}" ${editable ? "" : "disabled"}>
                  <button class="button small secondary" type="button" data-action="apply-pending-note" data-student="${lead.studentName}" ${editable ? "" : "disabled"}>补备注</button>
                </div>
              </td>
            </tr>
          `
        )
        .join("")
    : `
        <tr>
          <td>当前没有待补字段线索</td>
          <td>-</td>
          <td>-</td>
          <td>导入后如果有缺失，会在这里集中列出。</td>
        </tr>
      `;

  bindPendingLeadFixActions();
}

function bindPendingLeadFixActions() {
  document.querySelectorAll("[data-action='focus-pending-lead']").forEach((button) => {
    button.onclick = () => {
      const studentName = button.getAttribute("data-student");
      syncSelectedLead(studentName);
      renderAll();
    };
  });

  document.querySelectorAll("[data-action='apply-pending-owner']").forEach((button) => {
    button.onclick = () => {
      const studentName = button.getAttribute("data-student");
      const target = state.leads.find((lead) => lead.studentName === studentName);
      if (!target) return;
      if (!canEditAdmissions()) return;
      const ownerSelect = document.querySelector(
        `[data-pending-owner-select="${studentName}"]`
      );
      const nextOwner = ownerSelect?.value || "待分配";
      target.owner = nextOwner;
      touchLead(target);
      target.lastFollowup = "刚刚补负责人";
      target.nextAction =
        nextOwner === "待分配" ? "仍待分配负责人" : "负责人已补齐，尽快首联";
      pushFollowup(target.studentName, `在待补字段处理中补齐负责人：${nextOwner}。`);
      logAudit("待补字段-补负责人", target.studentName, `改为 ${nextOwner}。`);
      syncSelectedLead(target.studentName);
      renderAll();
    };
  });

  document.querySelectorAll("[data-action='apply-pending-channel']").forEach((button) => {
    button.onclick = () => {
      const studentName = button.getAttribute("data-student");
      const target = state.leads.find((lead) => lead.studentName === studentName);
      if (!target) return;
      if (!canEditAdmissions()) return;
      const channelSelect = document.querySelector(
        `[data-pending-channel-select="${studentName}"]`
      );
      const nextChannel = normalizeLeadChannelForSelect(channelSelect?.value || "待补来源");
      target.channel = nextChannel;
      touchLead(target);
      target.channelMeta = buildChannelMeta(nextChannel, target.channelOwner, target.referrerName, target.channelOtherNote);
      target.lastFollowup = "刚刚补来源";
      pushFollowup(target.studentName, `在待补字段处理中补齐生源来源：${nextChannel}。`);
      logAudit("待补字段-补来源", target.studentName, `改为 ${nextChannel}。`);
      syncSelectedLead(target.studentName);
      renderAll();
    };
  });

  document.querySelectorAll("[data-action='apply-pending-note']").forEach((button) => {
    button.onclick = () => {
      const studentName = button.getAttribute("data-student");
      const target = state.leads.find((lead) => lead.studentName === studentName);
      if (!target) return;
      if (!canEditAdmissions()) return;
      const noteInput = document.querySelector(
        `[data-pending-note-input="${studentName}"]`
      );
      const nextNote = noteInput?.value.trim();
      if (!nextNote) return;
      target.note = nextNote;
      touchLead(target);
      target.lastFollowup = "刚刚补备注";
      pushFollowup(target.studentName, `在待补字段处理中补齐首条备注：${nextNote}。`);
      logAudit("待补字段-补备注", target.studentName, nextNote);
      syncSelectedLead(target.studentName);
      renderAll();
    };
  });

  document.querySelectorAll("[data-action='apply-pending-channel-owner']").forEach((button) => {
    button.onclick = () => {
      const studentName = button.getAttribute("data-student");
      const target = state.leads.find((lead) => lead.studentName === studentName);
      if (!target) return;
      if (!canEditAdmissions()) return;
      const input = document.querySelector(
        `[data-pending-channel-owner-select="${studentName}"]`
      );
      const nextChannelOwner = input?.value || "待补渠道归属";
      target.channelOwner = nextChannelOwner;
      touchLead(target);
      target.channelMeta = buildChannelMeta(target.channel, target.channelOwner, target.referrerName, target.channelOtherNote);
      target.lastFollowup = "刚刚补渠道归属";
      pushFollowup(target.studentName, `在待补字段处理中补齐渠道归属：${nextChannelOwner}。`);
      logAudit("待补字段-补渠道归属", target.studentName, `改为 ${nextChannelOwner}。`);
      syncSelectedLead(target.studentName);
      renderAll();
    };
  });

  document.querySelectorAll("[data-action='apply-pending-referrer']").forEach((button) => {
    button.onclick = () => {
      const studentName = button.getAttribute("data-student");
      const target = state.leads.find((lead) => lead.studentName === studentName);
      if (!target) return;
      if (!canEditAdmissions()) return;
      const input = document.querySelector(
        `[data-pending-referrer-input="${studentName}"]`
      );
      const nextReferrer = input?.value.trim();
      if (!nextReferrer) return;
      target.referrerName = nextReferrer;
      touchLead(target);
      target.channelMeta = buildChannelMeta(target.channel, target.channelOwner, target.referrerName, target.channelOtherNote);
      target.lastFollowup = "刚刚补推荐人";
      pushFollowup(target.studentName, `在待补字段处理中补齐推荐人：${nextReferrer}。`);
      logAudit("待补字段-补推荐人", target.studentName, nextReferrer);
      syncSelectedLead(target.studentName);
      renderAll();
    };
  });
}

function renderEnrollmentLeadOptions() {
  const input = byId("enrollStudentName");
  if (!input) return;
  const lead = getSelectedLead();
  if (lead && !isAdmissionEnrolled(lead)) {
    input.value = lead.studentName;
  } else if (!input.value) {
    const candidate = state.leads.find((leadItem) => !isAdmissionEnrolled(leadItem));
    if (candidate) {
      input.value = candidate.studentName;
    }
  }

  const activeLead =
    state.leads.find((leadItem) => leadItem.studentName === input.value) || lead;
  if (!activeLead) {
    input.value = "";
    byId("enrollChannel").value = "";
    if (byId("enrollChannelOther")) byId("enrollChannelOther").value = "";
    byId("enrollOwner").value = "";
    byId("enrollReferrer").value = "";
    byId("enrollAttributionPreview").value = "暂无可报名线索";
    byId("enrollRemark").value = "请先新增或导入线索，再登记报名。";
    byId("renewStudentName").value = "";
    byId("renewAttributionPreview").value = "暂无可续费/扩科学生";
    return;
  }

  const channelValue = String(activeLead.channel || "");
  const normalizedChannel = normalizeLeadChannelForSelect(channelValue);
  if (channelOptions.includes(normalizedChannel)) {
    byId("enrollChannel").value = normalizedChannel;
    if (byId("enrollChannelOther")) byId("enrollChannelOther").value = "";
  } else if (channelValue.startsWith("其他：")) {
    byId("enrollChannel").value = "其他";
    if (byId("enrollChannelOther")) byId("enrollChannelOther").value = channelValue.replace(/^其他：/, "");
  } else {
    byId("enrollChannel").value = "其他";
    if (byId("enrollChannelOther")) byId("enrollChannelOther").value = channelValue;
  }
  if (byId("enrollCourseProduct") && activeLead.courseProduct) byId("enrollCourseProduct").value = activeLead.courseProduct;
  if (byId("enrollStartDate")) byId("enrollStartDate").value = activeLead.startDate || activeLead.startTime || "";
  byId("enrollOwner").value = activeLead.owner;
  byId("enrollReferrer").value = activeLead.referrerName || deriveReferrerText(activeLead.channelMeta);
  if (byId("enrollChannelOther")) byId("enrollChannelOther").value = activeLead.channelOtherNote || byId("enrollChannelOther").value || "";
  byId("enrollAttributionPreview").value = formatAttributionSnapshot(buildAttributionSnapshot(activeLead));
  byId("enrollRemark").value =
    activeLead.enrolledAmount > 0
      ? `已报名，实收 ${activeLead.enrolledAmount}。续费扩科沿用当前归属链。`
      : `${activeLead.nextAction}。如果扩科或续费，需要继承当前顾问和来源归属。当前链路：${activeLead.channel} / ${deriveChannelOwner(activeLead)} / ${activeLead.owner}${(activeLead.referrerName || deriveReferrerText(activeLead.channelMeta)) !== "无" ? ` / 推荐人 ${activeLead.referrerName || deriveReferrerText(activeLead.channelMeta)}` : ""}`;

  byId("renewStudentName").value = activeLead.studentName;
  byId("renewAttributionPreview").value = formatAttributionSnapshot(
    activeLead.attributionLocked && activeLead.attributionSnapshot
      ? activeLead.attributionSnapshot
      : buildAttributionSnapshot(activeLead)
  );
}

function renderStudentArchive() {
  const archiveLead =
    state.leads.find((lead) => lead.status === "定金 / 已报名" && lead.studentName === state.selectedLeadName) ||
    state.leads.find((lead) => lead.status === "定金 / 已报名");

  if (!archiveLead) {
    byId("archiveStudentName").textContent = "待选择";
    byId("archiveStudentMeta").textContent = "报名后这里显示学员主信息";
    byId("archiveAttributionTitle").textContent = "未锁定";
    byId("archiveAttributionMeta").textContent = "报名后自动锁定来源、渠道归属、招生顾问、推荐人";
    byId("archiveRenewalTitle").textContent = "暂无记录";
    byId("archiveRenewalMeta").textContent = "每次续费扩科都从这里追踪继承链";
    byId("archiveFinanceTitle").textContent = "待结算";
    byId("archiveFinanceMeta").textContent = "预留给财务系统做实收、提成、转介绍奖励联动";
    byId("archiveDetailBody").innerHTML = `
      <tr>
        <td>档案状态</td>
        <td>当前还没有已报名学员可展示</td>
      </tr>
    `;
    byId("financeCandidateBody").innerHTML = `
      <tr>
        <td>暂无候选信息</td>
        <td>报名后这里自动汇总实收、顾问、渠道归属、推荐人、奖励口径。</td>
      </tr>
    `;
    return;
  }

  const lastRenewal = archiveLead.renewalRecords?.[archiveLead.renewalRecords.length - 1];
  const financeProfile = archiveLead.financeProfile || {
    settledAmount: archiveLead.enrolledAmount || 0,
    pendingCommission: "待结算",
    referralReward: archiveLead.referrerName ? "待判断" : "无",
  };
  const settlementSummary = buildFinanceSettlementSummary(archiveLead);

  byId("archiveStudentName").textContent = archiveLead.studentName;
  byId("archiveStudentMeta").textContent = `${archiveLead.grade} / ${archiveLead.subject} / 家长 ${archiveLead.parentPhone}`;
  byId("archiveAttributionTitle").textContent = archiveLead.attributionLocked ? "已锁定" : "未锁定";
  byId("archiveAttributionMeta").textContent = archiveLead.attributionLocked
    ? formatAttributionSnapshot(archiveLead.attributionSnapshot)
    : "当前还未完成首报锁定";
  byId("archiveRenewalTitle").textContent = lastRenewal
    ? `${lastRenewal.type} ${lastRenewal.amount}`
    : "暂无记录";
  byId("archiveRenewalMeta").textContent = lastRenewal
    ? `${lastRenewal.courseName} / ${formatAttributionSnapshot(lastRenewal.attributionSnapshot)}`
    : "每次续费扩科都从这里追踪继承链";
  byId("archiveFinanceTitle").textContent = `实收 ${financeProfile.settledAmount}`;
  byId("archiveFinanceMeta").textContent = `提成 ${financeProfile.pendingCommission} / 转介绍奖励 ${financeProfile.referralReward}`;

  byId("archiveDetailBody").innerHTML = `
    <tr>
      <td>首报归属链</td>
      <td>${archiveLead.attributionLocked ? formatAttributionSnapshot(archiveLead.attributionSnapshot) : "未锁定"}</td>
    </tr>
    <tr>
      <td>当前招生顾问</td>
      <td>${archiveLead.owner}</td>
    </tr>
    <tr>
      <td>累计实收</td>
      <td>${financeProfile.settledAmount}</td>
    </tr>
    <tr>
      <td>最近续费 / 扩科</td>
      <td>${lastRenewal ? `${lastRenewal.type} / ${lastRenewal.courseName} / ${lastRenewal.amount}` : "暂无记录"}</td>
    </tr>
    <tr>
      <td>财务预留</td>
      <td>提成：${financeProfile.pendingCommission}；转介绍奖励：${financeProfile.referralReward}</td>
    </tr>
  `;

  if (!canViewAdmissionFinance()) {
    byId("archiveFinanceTitle").textContent = "受限";
    byId("archiveFinanceMeta").textContent = "当前岗位可以看招生流程，但不能查看财务结算口径。";
    byId("financeCandidateBody").innerHTML = `
      <tr>
        <td>财务结算候选项</td>
        <td>当前登录岗位未开放查看。需要学管、财务或管理员账号。</td>
      </tr>
    `;
    return;
  }

  byId("financeCandidateBody").innerHTML = `
    <tr>
      <td>首报实收</td>
      <td>${settlementSummary.firstPaidAmount}</td>
    </tr>
    <tr>
      <td>累计实收</td>
      <td>${settlementSummary.totalPaidAmount}</td>
    </tr>
    <tr>
      <td>招生顾问结算口径</td>
      <td>${settlementSummary.consultantOwner}</td>
    </tr>
    <tr>
      <td>渠道归属结算口径</td>
      <td>${settlementSummary.channelSettlementOwner}</td>
    </tr>
    <tr>
      <td>推荐人奖励口径</td>
      <td>${settlementSummary.referralSettlementOwner}</td>
    </tr>
    <tr>
      <td>财务当前建议</td>
      <td>提成状态：${settlementSummary.commissionStatus}；转介绍奖励：${settlementSummary.referralRewardStatus}</td>
    </tr>
  `;
}

function renderTrialLeadOptions() {
  const select = byId("trialLeadSelect");
  if (!select) return;
  const currentValue = select.value;
  const candidates = state.leads.filter(
    (lead) =>
      !isAdmissionEnrolled(lead) && !isAdmissionDormantStatus(lead.status)
  );
  select.innerHTML = candidates.length
    ? candidates
        .map((lead) => `<option value="${lead.studentName}">${lead.studentName}</option>`)
        .join("")
    : `<option value="">暂无可预约学生</option>`;
  const selectedLead = getSelectedLead();
  const preferredValue =
    candidates.some((lead) => lead.studentName === state.selectedLeadName)
      ? state.selectedLeadName
      : currentValue;
  select.value = Array.from(select.options).some((option) => option.value === preferredValue)
    ? preferredValue
    : select.options[0]?.value || "";

  const currentLead = candidates.find((lead) => lead.studentName === select.value) || selectedLead;
  if (!currentLead) return;
  byId("trialTeacherSelect").value = currentLead.trialTeacher || trialTeacherOptions[0];
  byId("trialTimeInput").value =
    normalizeDateTimeLocal(currentLead.trialTime) || defaultTrialDateTime();
  byId("trialRemarkInput").value =
    currentLead.nextAction || "试听后当天必须回填反馈";
}

function renderFollowups() {
  const timeline = byId("followupTimeline");
  if (!timeline) return;
  const selectedLead = getSelectedLead();
  const targetFollowups = selectedLead
    ? state.followups.filter((item) => item.studentName === selectedLead.studentName)
    : state.followups;
  timeline.innerHTML = targetFollowups
    .slice()
    .reverse()
    .map(
      (item) => `
        <div class="timeline-item">
          <div class="timeline-time">${item.time} · ${item.studentName}</div>
          <p>${item.text}</p>
        </div>
      `
    )
    .join("") || "<div class=\"timeline-item\"><div class=\"timeline-time\">当前线索暂无跟进记录</div><p>先补第一条沟通记录，后面系统才能形成完整闭环。</p></div>";
}

function renderPublicPool() {
  const box = byId("publicPoolList");
  if (!box) return;
  const editable = canEditAdmissions();
  const publicPool = state.leads.filter(
    (lead) =>
      lead.status === "新建未联系" ||
      lead.nextAction.includes("尽快首联")
  );
  box.innerHTML = publicPool.length
    ? publicPool
        .map(
          (lead) => `
            <p>${lead.studentName} / ${lead.channel} / ${lead.lastFollowup} / ${lead.nextAction}</p>
            <div class="section-actions">
              <select data-public-owner-select="${lead.studentName}" ${editable ? "" : "disabled"}>
                ${ownerOptions
                  .map(
                    (owner) =>
                      `<option value="${owner}" ${lead.owner === owner ? "selected" : ""}>${owner}</option>`
                  )
                  .join("")}
              </select>
              <button class="button small secondary" type="button" data-action="public-reassign" data-student="${lead.studentName}" ${editable ? "" : "disabled"}>重新分配</button>
            </div>
          `
        )
        .join("")
    : "<p>当前没有待回收或待重新分配的公海线索。</p>";
}

function renderMetrics() {
  const total = state.leads.length;
  const online = state.leads.filter((lead) => normalizeLeadChannelValue(lead.channel) === "线上客户").length;
  const referral = state.leads.filter((lead) => lead.channel.includes("转介绍")).length;
  const visit = state.leads.filter((lead) => normalizeLeadChannelValue(lead.channel) === "其他").length;
  const scheduled = state.leads.filter((lead) => lead.status === "已预约试听").length;
  const feedbackPending = state.leads.filter((lead) => lead.status === "试听完成待转化").length;
  const enrolled = state.leads.filter((lead) => isAdmissionEnrolled(lead)).length;
  const enrolledAmount = state.leads.reduce((sum, lead) => sum + (lead.enrolledAmount || 0), 0);
  const highIntent = state.leads.filter((lead) => lead.intent.startsWith("A") && lead.enrolledAmount <= 0).length;
  const contacted = state.leads.filter((lead) => lead.status !== "新建未联系").length;
  const trialTotal = state.leads.filter((lead) =>
    lead.status === "已预约试听" ||
    lead.status === "试听完成待转化" ||
    isAdmissionEnrolled(lead)
  ).length;

  byId("todayFollowupChip").textContent = `今日待跟进 ${state.leads.filter((lead) => !isAdmissionEnrolled(lead) && !isAdmissionDormantStatus(lead.status)).length}`;
  byId("todayTrialChip").textContent = `待约试听 ${scheduled}`;
  byId("todayFeedbackChip").textContent = `待反馈 ${feedbackPending}`;
  byId("weeklyLeadCount").textContent = String(total);
  byId("weeklyLeadBreakdown").textContent = `线上 ${online} / 转介绍 ${referral} / 到访 ${visit}`;
  byId("scheduledTrialCount").textContent = String(scheduled + feedbackPending);
  byId("scheduledTrialMeta").textContent = `待上课 ${scheduled} / 已试听待反馈 ${feedbackPending}`;
  byId("enrolledCount").textContent = String(enrolled);
  byId("enrolledMeta").textContent = `实收 ${enrolledAmount.toLocaleString()} / 已报名 ${enrolled}`;
  byId("highIntentCount").textContent = String(highIntent);
  if (byId("funnelTotalCount")) byId("funnelTotalCount").textContent = String(total);
  if (byId("funnelContactedCount")) byId("funnelContactedCount").textContent = String(contacted);
  if (byId("funnelContactedRate")) byId("funnelContactedRate").textContent = `接通率 ${percent(contacted, total)}`;
  if (byId("funnelTrialCount")) byId("funnelTrialCount").textContent = String(trialTotal);
  if (byId("funnelTrialRate")) byId("funnelTrialRate").textContent = `邀约率 ${percent(trialTotal, total)}`;
  if (byId("funnelEnrollCount")) byId("funnelEnrollCount").textContent = String(enrolled);
  if (byId("funnelEnrollRate")) byId("funnelEnrollRate").textContent = `成交率 ${percent(enrolled, total)}`;
  renderFunnelActions();
}

function buildFunnelActions() {
  const notContacted = state.leads.filter((lead) => lead.status === "新建未联系");
  const communicatedNotTrial = state.leads.filter((lead) =>
    !isAdmissionEnrolled(lead) &&
    (lead.status === "已沟通待邀约" || lead.status === "持续跟进中")
  );
  const trialPending = state.leads.filter((lead) => lead.status === "已预约试听");
  const feedbackPending = state.leads.filter((lead) =>
    lead.status === "试听完成待转化" && !isAdmissionEnrolled(lead)
  );
  const highIntentUnpaid = state.leads.filter((lead) =>
    String(lead.intent || "").startsWith("A") && !isAdmissionEnrolled(lead)
  );
  return [
    {
      key: "new",
      count: notContacted.length,
      title: "未首联线索",
      detail: "先确认年级、薄弱点、可试听时间和家长真实需求。",
      filter: "new"
    },
    {
      key: "communicated",
      count: communicatedNotTrial.length,
      title: "已沟通但未约试听",
      detail: "核心动作是给出明确试听时间，不要停留在泛泛跟进。",
      filter: "all",
      stage: "communicated"
    },
    {
      key: "trial",
      count: trialPending.length,
      title: "已预约待到课",
      detail: "课前提醒、老师准备和试听后反馈要连起来。",
      filter: "trial",
      stage: "trial-pending"
    },
    {
      key: "feedback",
      count: feedbackPending.length,
      title: "试听完成未报名",
      detail: "48 小时内补反馈、报价和下一步报名方案。",
      filter: "trial",
      stage: "feedback-pending"
    },
    {
      key: "high-intent",
      count: highIntentUnpaid.length,
      title: "A 类高意向未报名",
      detail: "优先处理异议、优惠口径和班型选择，避免热度流失。",
      filter: "all",
      stage: "high-intent"
    }
  ];
}

function renderFunnelActions() {
  const holder = byId("funnelActionList");
  if (!holder) return;
  const actions = buildFunnelActions().filter((item) => item.count > 0).slice(0, 4);
  holder.innerHTML = actions.length ? actions.map((item) => `
    <div class="funnel-action-card">
      <div>
        <strong>${escapeHtml(item.title)}</strong>
        <p>${escapeHtml(item.detail)}</p>
      </div>
      <div>
        <b>${escapeHtml(item.count)}</b>
        <button class="button small secondary" type="button" data-funnel-action="${escapeHtml(item.key)}">去处理</button>
      </div>
    </div>
  `).join("") : `
    <div class="funnel-action-card">
      <div>
        <strong>当前漏斗没有明显卡点</strong>
        <p>继续录入新线索、保存跟进记录，系统会自动更新这里。</p>
      </div>
      <div><b>0</b></div>
    </div>
  `;
}

function applyFunnelAction(key) {
  const action = buildFunnelActions().find((item) => item.key === key);
  if (!action) return;
  state.activeLeadFilter = action.filter || "all";
  state.funnelStage = action.stage || "";
  state.leadSearchQuery = "";
  state.leadIntentFilter = "";
  state.leadOwnerFilter = "";
  state.leadChannelFilter = "";
  const searchInput = byId("leadSearchInput");
  if (searchInput) searchInput.value = "";
  const intentSelect = byId("leadIntentFilter");
  if (intentSelect) intentSelect.value = state.leadIntentFilter;
  const ownerSelect = byId("leadOwnerFilter");
  if (ownerSelect) ownerSelect.value = "";
  const channelSelect = byId("leadChannelFilter");
  if (channelSelect) channelSelect.value = "";
  renderLeadFilterControls();
  renderLeadTable();
  byId("leadTableSection")?.scrollIntoView({ block: "start", behavior: "smooth" });
  showToast(`已打开：${action.title}，共 ${action.count} 条。`);
}

function getDormantLeads() {
  return state.leads
    .filter((lead) => !isAdmissionEnrolled(lead))
    .map((lead) => {
      const gap = daysSince(lead.nextFollowupDate || lead.createdAt || "");
      const isDormantStatus = isAdmissionDormantStatus(lead.status);
      return {
        lead,
        days: gap === null && isDormantStatus ? 30 : gap,
        isDormant: isDormantStatus || (gap !== null && gap > 0),
      };
    })
    .filter((item) => item.isDormant);
}

function renderDormantStats() {
  const dormant = getDormantLeads();
  const countByMinDays = (minDays) => dormant.filter((item) => Number(item.days || 0) >= minDays).length;
  const highIntentDormant = dormant.filter((item) => String(item.lead.intent || "").startsWith("A")).length;
  if (byId("dormant30Count")) byId("dormant30Count").textContent = String(countByMinDays(30));
  if (byId("dormant60Count")) byId("dormant60Count").textContent = String(countByMinDays(60));
  if (byId("dormant90Count")) byId("dormant90Count").textContent = String(countByMinDays(90));
  if (byId("dormantHighIntentCount")) byId("dormantHighIntentCount").textContent = String(highIntentDormant);
  if (byId("adminDormantRiskCount")) byId("adminDormantRiskCount").textContent = String(dormant.length);
  if (byId("reminderDormantCount")) byId("reminderDormantCount").textContent = String(highIntentDormant || dormant.length);
}

function renderChannelRoi() {
  const body = byId("channelRoiBody");
  if (!body) return;
  if (!state.leads.length) {
    body.innerHTML = `<tr><td colspan="6">导入真实线索和报名金额后自动统计。</td></tr>`;
    return;
  }
  const groups = new Map();
  state.leads.forEach((lead) => {
    const key = lead.channel || "待补来源";
    if (!groups.has(key)) {
      groups.set(key, { channel: key, leads: 0, enrolled: 0, amount: 0 });
    }
    const item = groups.get(key);
    item.leads += 1;
    if (isAdmissionEnrolled(lead)) {
      item.enrolled += 1;
      item.amount += Number(lead.enrolledAmount || 0);
    }
  });
  body.innerHTML = Array.from(groups.values())
    .sort((a, b) => b.amount - a.amount || b.leads - a.leads)
    .map((row) => {
      const conversion = percent(row.enrolled, row.leads);
      const rewardText = row.channel.includes("转介绍")
        ? "转介绍奖励待财务确认"
        : row.channel.includes("抖音") || row.channel.includes("官网")
          ? "渠道提成待财务确认"
          : "暂不计渠道提成";
      return `
        <tr>
          <td>${escapeHtml(row.channel)}</td>
          <td>${row.leads}</td>
          <td>${row.enrolled}</td>
          <td>${row.amount.toLocaleString()}</td>
          <td>${rewardText}</td>
          <td>转化率 ${conversion}</td>
        </tr>
      `;
    })
    .join("");
}

function renderConsultantStats() {
  const employee = getCurrentEmployee();
  const isManager = hasPermission("admin.access") || hasPermission("admissions.finance");
  const targetName = employee && !isManager ? employee.name : "";
  const leads = targetName ? state.leads.filter((lead) => lead.owner === targetName) : state.leads;
  const trialCount = leads.filter((lead) =>
    ["已预约试听", "试听完成待转化"].includes(lead.status) || isAdmissionEnrolled(lead)
  ).length;
  const enrolled = leads.filter((lead) => isAdmissionEnrolled(lead));
  const amount = enrolled.reduce((sum, lead) => sum + Number(lead.enrolledAmount || 0), 0);
  if (byId("consultantLeadCount")) byId("consultantLeadCount").textContent = String(leads.length);
  if (byId("consultantLeadMeta")) byId("consultantLeadMeta").textContent = targetName ? `${targetName}负责线索` : "全部招生线索";
  if (byId("consultantTrialRate")) byId("consultantTrialRate").textContent = percent(trialCount, leads.length);
  if (byId("consultantEnrollCount")) byId("consultantEnrollCount").textContent = String(enrolled.length);
  if (byId("consultantEnrollMeta")) byId("consultantEnrollMeta").textContent = `实收 ${amount.toLocaleString()}`;
  if (byId("consultantCommissionLabel")) byId("consultantCommissionLabel").textContent = amount > 0 ? "待财务复核" : "待成交";
  const periodBody = byId("consultantPeriodBody");
  if (!periodBody) return;
  const periods = [
    ["今日", (lead) => isWithinDays(leadActivityDate(lead), 1)],
    ["近 7 天", (lead) => isWithinDays(leadActivityDate(lead), 7)],
    ["本月", (lead) => isCurrentMonth(leadActivityDate(lead))],
    ["本年", (lead) => isCurrentYear(leadActivityDate(lead))],
  ];
  periodBody.innerHTML = periods.map(([label, predicate]) => {
    const periodLeads = leads.filter(predicate);
    const periodTrial = periodLeads.filter((lead) =>
      ["已预约试听", "试听完成待转化"].includes(lead.status) || isAdmissionEnrolled(lead)
    );
    const periodEnrolled = periodLeads.filter((lead) => isAdmissionEnrolled(lead));
    const periodAmount = periodEnrolled.reduce((sum, lead) => sum + Number(lead.enrolledAmount || 0), 0);
    const periodRefund = periodLeads.filter((lead) => /退费|退款|已退/i.test([lead.status, lead.nextAction, lead.note].join(" "))).length;
    return `
      <tr>
        <td>${label}</td>
        <td>${periodLeads.length}</td>
        <td>${periodTrial.length}</td>
        <td>${periodEnrolled.length}</td>
        <td>${periodAmount.toLocaleString()}</td>
        <td>${percent(periodTrial.length, periodLeads.length)}</td>
        <td>${percent(periodEnrolled.length, periodLeads.length)}</td>
        <td>${percent(periodRefund, periodEnrolled.length || periodLeads.length)}</td>
      </tr>
    `;
  }).join("");
}

function renderReferralRanking() {
  const body = byId("referralRankingBody");
  if (!body) return;
  const map = new Map();
  state.leads.filter(isReferralLead).forEach((lead) => {
    const name = referralNameForLead(lead) || "待补推荐人";
    const row = map.get(name) || {
      referrer: name,
      leads: 0,
      enrolled: 0,
      amount: 0,
      reward: 0,
      students: [],
    };
    row.leads += 1;
    row.students.push(lead.studentName);
    const isEnrolled = Number(lead.enrolledAmount || 0) > 0 || lead.status === "定金 / 已报名";
    if (isEnrolled) {
      row.enrolled += 1;
      row.amount += Number(lead.enrolledAmount || 0);
    }
    row.reward = estimateReferralReward(row.amount, row.enrolled);
    map.set(name, row);
  });
  const rows = [...map.values()].sort((left, right) =>
    right.enrolled - left.enrolled || right.amount - left.amount || right.leads - left.leads
  );
  const totalLeads = rows.reduce((sum, row) => sum + row.leads, 0);
  const totalEnrolled = rows.reduce((sum, row) => sum + row.enrolled, 0);
  const totalAmount = rows.reduce((sum, row) => sum + row.amount, 0);
  const totalReward = rows.reduce((sum, row) => sum + row.reward, 0);
  if (byId("referralPeopleCount")) byId("referralPeopleCount").textContent = String(rows.length);
  if (byId("referralLeadCount")) byId("referralLeadCount").textContent = String(totalLeads);
  if (byId("referralEnrollCount")) byId("referralEnrollCount").textContent = String(totalEnrolled);
  if (byId("referralEnrollMeta")) byId("referralEnrollMeta").textContent = `实收 ${totalAmount.toLocaleString()}`;
  if (byId("referralRewardEstimate")) byId("referralRewardEstimate").textContent = totalReward.toLocaleString();
  body.innerHTML = rows.length
    ? rows.map((row, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${row.referrer}</td>
          <td>${row.leads}<br><span class="hint">${row.students.slice(0, 3).join("、")}${row.students.length > 3 ? "…" : ""}</span></td>
          <td>${row.enrolled}</td>
          <td>${row.amount.toLocaleString()}</td>
          <td>${row.reward.toLocaleString()}</td>
          <td>${row.enrolled ? "待财务复核" : "未成交暂不发放"}</td>
        </tr>
      `).join("")
    : `
        <tr>
          <td colspan="7">当前还没有转介绍数据。录入推荐人后会自动排序。</td>
        </tr>
      `;
}

function addMonthsDate(value, months) {
  const date = parseMaybeDate(value) || new Date();
  date.setMonth(date.getMonth() + Number(months || 0));
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function referralLearningNodesForLead(lead) {
  const enrolledDate = String(lead.enrolledAt || lead.updatedAt || lead.createdAt || "").slice(0, 10) || addDaysDateString(0);
  return [
    { key: "after-enroll", label: "报名后首次汇报", months: 0 },
    { key: "month-1", label: "报名后 1 个月", months: 1 },
    { key: "month-2", label: "报名后 2 个月", months: 2 },
  ].map((node) => ({
    ...node,
    dueDate: addMonthsDate(enrolledDate, node.months)
  }));
}

function referralLearningReportFor(lead, node) {
  const leadId = ensureLeadId(lead).leadId;
  const id = buildAdmissionsId("referral-report", [leadId, node.key]);
  return (state.referralLearningReports || []).find((row) => row.id === id) || {
    id,
    leadId,
    studentName: lead.studentName,
    referrerName: referralNameForLead(lead),
    nodeKey: node.key,
    nodeLabel: node.label,
    dueDate: node.dueDate,
    communication: "",
    learningStatus: "",
    nextReminder: "",
    createdAt: new Date().toISOString()
  };
}

function renderReferralLearningReports() {
  const body = byId("referralLearningReportBody");
  if (!body) return;
  const rows = state.leads
    .filter((lead) => isAdmissionEnrolled(lead) && isReferralLead(lead))
    .flatMap((lead) => referralLearningNodesForLead(lead).map((node) => ({
      lead,
      node,
      report: referralLearningReportFor(lead, node)
    })));
  if (!rows.length) {
    body.innerHTML = `<tr><td colspan="7">当前还没有已报名的转介绍学生。报名登记里填写推荐人后，这里会自动出现三个汇报节点。</td></tr>`;
    return;
  }
  body.innerHTML = rows.map(({ lead, node, report }) => {
    const rowId = referralReportId(report);
    return `
      <tr>
        <td>${escapeHtml(node.label)}</td>
        <td>${escapeHtml(referralNameForLead(lead) || "待补推荐人")}<br><span class="hint">${escapeHtml(lead.studentName || "")}</span></td>
        <td>${escapeHtml(report.dueDate || node.dueDate)}</td>
        <td><textarea data-referral-report-field="communication" data-referral-report-id="${escapeHtml(rowId)}" placeholder="例如：已向推荐家长反馈孩子入班情况">${escapeHtml(report.communication || "")}</textarea></td>
        <td><textarea data-referral-report-field="learningStatus" data-referral-report-id="${escapeHtml(rowId)}" placeholder="例如：课堂状态、知识掌握、作业完成">${escapeHtml(report.learningStatus || "")}</textarea></td>
        <td><input data-referral-report-field="nextReminder" data-referral-report-id="${escapeHtml(rowId)}" value="${escapeHtml(report.nextReminder || "")}" placeholder="下次提醒日期/事项"></td>
        <td><button class="button small secondary" type="button" data-save-referral-report="${escapeHtml(rowId)}" data-student="${escapeHtml(lead.studentName || "")}" data-node="${escapeHtml(node.key)}">保存汇报</button></td>
      </tr>
    `;
  }).join("");
}

function bindReferralLearningReports() {
  byId("referralLearningReportBody")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-save-referral-report]");
    if (!button) return;
    if (!canEditAdmissions()) {
      showToast("当前账号没有招生编辑权限。", "error");
      return;
    }
    const id = button.getAttribute("data-save-referral-report") || "";
    const studentName = button.getAttribute("data-student") || "";
    const lead = state.leads.find((item) => item.studentName === studentName);
    if (!lead) return;
    const nodeKey = button.getAttribute("data-node") || "";
    const node = referralLearningNodesForLead(lead).find((item) => item.key === nodeKey);
    if (!node) return;
    const getValue = (field) => {
      const nodeEl = document.querySelector(`[data-referral-report-id="${CSS.escape(id)}"][data-referral-report-field="${field}"]`);
      return nodeEl?.value?.trim() || "";
    };
    const row = {
      ...referralLearningReportFor(lead, node),
      id,
      communication: getValue("communication"),
      learningStatus: getValue("learningStatus"),
      nextReminder: getValue("nextReminder"),
      updatedAt: new Date().toISOString(),
      updatedBy: getCurrentEmployee()?.name || "未登录"
    };
    state.referralLearningReports = mergeReferralReportRows(row, state.referralLearningReports || []);
    pushFollowup(lead.studentName, `转介绍学情汇报已更新：${node.label}；推荐人 ${referralNameForLead(lead) || "待补"}。`);
    logAudit("转介绍学情汇报", lead.studentName, `${node.label} / ${row.nextReminder || "未填下次提醒"}`);
    renderAll();
    showToast("转介绍学情汇报已保存");
  });
}

function renderReminderStats() {
  const scheduled = state.leads.filter((lead) => lead.status === "已预约试听").length;
  const activityCandidates = state.leads.filter((lead) =>
    Number(lead.enrolledAmount || 0) <= 0 && ["B 中意向", "C 低意向"].includes(lead.intent)
  ).length;
  if (byId("reminderTrialCount")) byId("reminderTrialCount").textContent = String(scheduled);
  if (byId("reminderActivityCount")) byId("reminderActivityCount").textContent = String(activityCandidates);
  if (byId("reminderStrategyLabel")) byId("reminderStrategyLabel").textContent = scheduled || activityCandidates ? "人工确认" : "暂无待发";
}

function renderManagementStats() {
  const total = state.leads.length;
  const hasFollowup = state.leads.filter((lead) => lead.note && lead.note !== "待补首条记录").length;
  const enrolled = state.leads.filter((lead) => isAdmissionEnrolled(lead));
  const referralEnrolled = enrolled.filter((lead) => lead.channel?.includes("转介绍")).length;
  if (byId("adminTotalLeads")) byId("adminTotalLeads").textContent = String(total);
  if (byId("adminFollowupRate")) byId("adminFollowupRate").textContent = percent(hasFollowup, total);
  if (byId("adminReferralRate")) byId("adminReferralRate").textContent = percent(referralEnrolled, enrolled.length);
}

function bindLeadCreate() {
  const button = byId("createLeadButton");
  if (!button) return;
  button.addEventListener("click", () => {
    if (!canEditAdmissions()) {
      setInlineMessage("createLeadMessage", "当前账号没有招生录入权限。", "error");
      return;
    }
    const studentName = byId("leadStudentName").value.trim();
    const parentPhone = byId("leadPhone").value.trim();
    if (!studentName || !parentPhone) {
      setInlineMessage("createLeadMessage", "请填写学生姓名和家长电话。", "error");
      return;
    }
    const channel = normalizeLeadChannelForSelect(byId("leadChannel").value);
    const referrerName = byId("leadReferrer").value.trim();
    const channelOtherNote = byId("leadChannelOther")?.value.trim() || "";
    const sourceValidation = validateLeadSource(channel, referrerName, channelOtherNote);
    if (!sourceValidation.ok) {
      setInlineMessage("createLeadMessage", sourceValidation.message, "error");
      return;
    }
    state.leads.unshift({
      studentName,
      parentPhone,
      grade: byId("leadGrade").value,
      subject: byId("leadSubject").value,
      channel: channel === "其他" && channelOtherNote ? `其他：${channelOtherNote}` : channel,
      channelOtherNote,
      referrerName,
      channelMeta: buildChannelMeta(channel, "", referrerName, channelOtherNote),
      owner: byId("leadOwner").value,
      status: byId("leadStatus").value,
      trial: "未预约",
      intent: "B 中意向",
      inGroup: byId("leadInGroup").value,
      lastFollowup: "刚刚录入",
      note: byId("leadNote").value.trim() || "待补首条记录",
      nextAction: "尽快首联并补下一步动作",
      parentNeed: "",
      studentPainPoint: "",
      objection: "暂无明确异议",
      nextFollowupDate: "",
      trialTeacher: "",
      trialTime: "",
      enrolledAmount: 0,
      createdAt: formatNowStamp(),
      updatedAt: new Date().toISOString(),
    });
    byId("leadStudentName").value = "";
    byId("leadPhone").value = "";
    byId("leadReferrer").value = "";
    if (byId("leadChannelOther")) byId("leadChannelOther").value = "";
    byId("leadNote").value = "";
    state.selectedLeadName = studentName;
    logAudit("新增线索", studentName, `生源来源 ${channel}，负责人 ${byId("leadOwner").value || "待分配"}。`);
    renderAll();
    setInlineMessage("createLeadMessage", `已新增线索：${studentName}`, "success");
    showToast(`已新增线索：${studentName}`);
  });
}

function bindQuickLeadCreate() {
  const button = byId("quickCreateLeadButton");
  if (!button) return;
  button.addEventListener("click", () => {
    const message = byId("quickCreateLeadMessage");
    if (!canEditAdmissions()) {
      setInlineMessage("quickCreateLeadMessage", "当前账号没有招生录入权限。", "error");
      return;
    }
    const studentName = byId("quickLeadStudentName")?.value.trim();
    const parentPhone = byId("quickLeadPhone")?.value.trim();
    if (!studentName || !parentPhone) {
      setInlineMessage("quickCreateLeadMessage", "请先填写学生姓名和家长电话。", "error");
      return;
    }
    const duplicate = state.leads.find((lead) => normalizePhone(lead.parentPhone) && normalizePhone(lead.parentPhone) === normalizePhone(parentPhone));
    if (duplicate) {
      state.selectedLeadName = duplicate.studentName;
      setInlineMessage("quickCreateLeadMessage", `手机号已存在：${duplicate.studentName}`, "error");
      showToast(`手机号已存在，已选中 ${duplicate.studentName}`, "error");
      renderAll();
      return;
    }
    const channel = normalizeLeadChannelForSelect(byId("quickLeadChannel")?.value || "待补来源");
    const sourceDetail = byId("quickLeadSourceDetail")?.value.trim() || "";
    const quickValidation = validateLeadSource(
      channel,
      isReferralChannel(channel) ? sourceDetail : "",
      channel === "其他" ? sourceDetail : ""
    );
    if (!quickValidation.ok) {
      setInlineMessage("quickCreateLeadMessage", quickValidation.message, "error");
      return;
    }
    const owner = byId("quickLeadOwner")?.value || "待分配";
    const note = byId("quickLeadNote")?.value.trim() || "首页快速新增，待补首联记录。";
    const referrerName = isReferralChannel(channel) ? sourceDetail : "";
    const channelOtherNote = channel === "其他" ? sourceDetail : "";
    state.leads.unshift({
      studentName,
      parentPhone,
      grade: byId("quickLeadGrade")?.value || "待补年级",
      subject: "数学",
      channel: channel === "其他" && channelOtherNote ? `其他：${channelOtherNote}` : channel,
      channelMeta: buildChannelMeta(channel, "", referrerName, channelOtherNote),
      channelOtherNote,
      referrerName,
      owner,
      status: "新建未联系",
      trial: "未预约",
      intent: byId("quickLeadIntent")?.value || "B 中意向",
      inGroup: "未进群",
      lastFollowup: "刚刚录入",
      note,
      nextAction: "尽快首联并确认试听时间",
      parentNeed: "",
      studentPainPoint: "",
      objection: "暂无明确异议",
      nextFollowupDate: "",
      trialTeacher: "",
      trialTime: "",
      enrolledAmount: 0,
      createdAt: formatNowStamp(),
      updatedAt: new Date().toISOString(),
    });
    state.selectedLeadName = studentName;
    byId("quickLeadStudentName").value = "";
    byId("quickLeadPhone").value = "";
    if (byId("quickLeadSourceDetail")) byId("quickLeadSourceDetail").value = "";
    byId("quickLeadNote").value = "";
    logAudit("首页新增咨询客户", studentName, `生源来源 ${channel}，负责人 ${owner}。`);
    if (message) message.textContent = `已保存 ${studentName}，现在可以继续约试听、补跟进或报名。`;
    setInlineMessage("quickCreateLeadMessage", `已保存 ${studentName}`, "success");
    showToast(`已保存咨询客户：${studentName}`);
    renderAll();
  });
}

function bindFeedbackSave() {
  const button = byId("saveFeedbackButton");
  if (!button) return;
  button.addEventListener("click", () => {
    if (!canEditAdmissions()) {
      setInlineMessage("saveFeedbackMessage", "当前账号没有招生编辑权限。", "error");
      return;
    }
    const targetName = byId("followupLeadSelect")?.value;
    const feedbackLeadName = (byId("feedbackLeadSelect")?.value || byId("feedbackLeadNameInput")?.value || targetName || "").trim();
    if (!feedbackLeadName) {
      setInlineMessage("saveFeedbackMessage", "请选择或填写要反馈的学生。", "error");
      return;
    }
    const target = state.leads.find(
      (lead) =>
        lead.studentName === feedbackLeadName ||
        (targetName && lead.studentName === targetName)
    );
    if (!target) {
      setInlineMessage("saveFeedbackMessage", "没有找到对应客户，请先新增咨询客户再保存试听反馈。", "error");
      return;
    }
    target.intent = byId("feedbackIntent").value;
    touchLead(target);
    target.lastFollowup = "刚刚回填";
    target.note = byId("feedbackSummary").value.trim() || target.note;
    target.nextAction = `下次跟进：${byId("feedbackNextDate").value}`;
    target.inGroup = byId("detailInGroupSelect")?.value || target.inGroup;
    target.status = "试听完成待转化";
    state.selectedLeadName = target.studentName;
    logAudit("保存试听反馈", target.studentName, `意向改为 ${target.intent}，下次跟进 ${byId("feedbackNextDate").value || "待定"}。`);
    renderAll();
    setInlineMessage("saveFeedbackMessage", `已保存 ${target.studentName} 的试听反馈`, "success");
    showToast("试听反馈已保存");
  });
}

function bindEnrollmentCreate() {
  const button = byId("createEnrollmentButton");
  if (!button) return;

  refreshEnrollmentStartTimeOptions();
  byId("enrollStartTimeSelect")?.addEventListener("change", () => {
    const selected = byId("enrollStartTimeSelect")?.value || "";
    if (selected && byId("enrollStartDate")) byId("enrollStartDate").value = selected;
  });

  byId("enrollStudentName")?.addEventListener("change", () => {
    syncSelectedLead(byId("enrollStudentName").value.trim());
    renderAll();
  });

  button.addEventListener("click", () => {
    if (!canEditAdmissions()) {
      setInlineMessage("createEnrollmentMessage", "当前账号没有招生编辑权限。", "error");
      return;
    }
    const name = byId("enrollStudentName").value.trim();
    const amount = Number(byId("enrollReceived").value || 0);
    if (!name || !amount) {
      setInlineMessage("createEnrollmentMessage", "请填写报名学生和实收金额。", "error");
      return;
    }
    const target = state.leads.find((lead) => lead.studentName === name);
    if (!target) {
      setInlineMessage("createEnrollmentMessage", "没有找到这名学生，请先新增咨询客户。", "error");
      return;
    }
    const nextChannel = resolveEnrollmentChannel() || target.channel;
    const nextChannelForSelect = normalizeLeadChannelForSelect(nextChannel);
    const nextReferrer = byId("enrollReferrer")?.value.trim() || target.referrerName || "";
    const nextOtherNote = nextChannelForSelect === "其他"
      ? (byId("enrollChannelOther")?.value.trim() || target.channelOtherNote || String(nextChannel).replace(/^其他：/, ""))
      : "";
    const sourceValidation = validateLeadSource(nextChannelForSelect, nextReferrer, nextOtherNote);
    if (!sourceValidation.ok) {
      setInlineMessage("createEnrollmentMessage", sourceValidation.message, "error");
      return;
    }
    target.status = "定金 / 已报名";
    touchLead(target);
    target.courseProduct = byId("enrollCourseProduct")?.value || target.courseProduct || "程老师班课";
    target.startDate = resolveEnrollmentStartTime();
    target.channel = nextChannelForSelect === "其他" && nextOtherNote ? `其他：${nextOtherNote}` : nextChannelForSelect;
    target.channelOtherNote = nextOtherNote;
    target.owner = byId("enrollOwner")?.value.trim() || target.owner;
    target.referrerName = nextReferrer;
    target.channelMeta = buildChannelMeta(target.channel, target.channelOwner, target.referrerName, target.channelOtherNote);
    target.enrolledAmount = amount;
    target.enrolledAt = formatNowStamp();
    target.attributionLocked = true;
    target.attributionSnapshot = buildAttributionSnapshot(target);
    target.financeProfile = {
      settledAmount: amount,
      pendingCommission: "待结算",
      referralReward: target.referrerName ? "待判断" : "无",
    };
    target.nextAction = byId("enrollRemark").value.trim() || "已报名";
    target.lastFollowup = "刚刚报名";
    target.note = `报名登记完成 / 课程：${target.courseProduct} / 开课：${target.startDate || "待定"} / 渠道：${target.channel} / 顾问：${target.owner}`;
    pushFollowup(
      target.studentName,
      `已登记报名，课程 ${target.courseProduct}，开课时间 ${target.startDate || "待定"}，实收金额 ${amount}，状态更新为定金 / 已报名。归属链已锁定：${target.attributionSnapshot.channel} / ${target.attributionSnapshot.channelOwner} / ${target.attributionSnapshot.owner}${target.attributionSnapshot.referrerName ? ` / 推荐人 ${target.attributionSnapshot.referrerName}` : ""}。`
    );
    logAudit("登记报名", target.studentName, `实收 ${amount}，锁定归属链 ${formatAttributionSnapshot(target.attributionSnapshot)}。`);
    renderAll();
    const linkedRows = window.JRC_BUSINESS_MODULES?.syncAdmissionsIntoStudentService?.([target]) || [];
    const linkText = linkedRows.length ? "，已同步到学生服务入学交接" : "，学生服务稍后会自动读取";
    setInlineMessage("createEnrollmentMessage", `已登记报名：${name} / 实收 ${amount}${linkText}`, "success");
    showToast(`报名登记已保存，归属链已锁定${linkText}`);
  });
}

function bindFollowupCreate() {
  const button = byId("addFollowupButton");
  if (button) button.addEventListener("click", () => {
    if (!canEditAdmissions()) {
      setInlineMessage("addFollowupMessage", "当前账号没有招生编辑权限。", "error");
      return;
    }
    const leadName = byId("followupLeadSelect").value;
    const text = byId("followupInput").value.trim();
    if (!text) {
      setInlineMessage("addFollowupMessage", "请填写本次沟通记录。", "error");
      return;
    }
    const saved = saveFollowupRecord({
      leadName,
      text,
      method: byId("followupMethodSelect")?.value || "沟通",
      parentNeed: byId("followupNeedInput")?.value.trim() || "",
      painPoint: byId("followupPainInput")?.value.trim() || "",
      objection: byId("followupObjectionSelect")?.value || "暂无明确异议",
      nextDate: byId("followupNextDateInput")?.value || "",
    });
    if (!saved) return;
    byId("followupInput").value = "";
    byId("followupNeedInput").value = "";
    byId("followupPainInput").value = "";
    byId("followupNextDateInput").value = "";
    renderAll();
    setInlineMessage("addFollowupMessage", `已保存 ${leadName} 的跟进记录`, "success");
    showToast("跟进记录已保存");
  });

  byId("followupLeadSelect")?.addEventListener("change", () => {
    syncSelectedLead(byId("followupLeadSelect").value);
    renderAll();
  });

  byId("quickFollowupLeadSelect")?.addEventListener("change", () => {
    syncSelectedLead(byId("quickFollowupLeadSelect").value);
    renderAll();
  });

  byId("quickFollowupButton")?.addEventListener("click", () => {
    if (!canEditAdmissions()) {
      setInlineMessage("quickFollowupMessage", "当前账号没有招生编辑权限。", "error");
      return;
    }
    const saved = saveFollowupRecord({
      leadName: byId("quickFollowupLeadSelect")?.value,
      text: byId("quickFollowupInput")?.value || "",
      method: byId("quickFollowupMethodSelect")?.value || "沟通",
      nextDate: byId("quickFollowupNextDateInput")?.value || "",
    });
    if (!saved) {
      setInlineMessage("quickFollowupMessage", "请选择客户并填写沟通记录。", "error");
      return;
    }
    byId("quickFollowupInput").value = "";
    renderAll();
    setInlineMessage("quickFollowupMessage", "已保存快捷跟进", "success");
    showToast("快捷跟进已保存");
  });
}

function bindRenewalCreate() {
  const button = byId("createRenewalButton");
  if (!button) return;
  button.addEventListener("click", () => {
    if (!canEditAdmissions()) {
      setInlineMessage("createRenewalMessage", "当前账号没有招生编辑权限。", "error");
      return;
    }
    const studentName = byId("renewStudentName").value.trim();
    const amount = Number(byId("renewAmount").value || 0);
    if (!studentName || !amount) {
      setInlineMessage("createRenewalMessage", "请填写学员和实收金额。", "error");
      return;
    }
    const target = state.leads.find((lead) => lead.studentName === studentName);
    if (!target) {
      setInlineMessage("createRenewalMessage", "没有找到这名学员，请先完成报名登记。", "error");
      return;
    }

    const inheritedSnapshot =
      target.attributionLocked && target.attributionSnapshot
        ? target.attributionSnapshot
        : buildAttributionSnapshot(target);

    const renewalRecord = {
      id: `renew-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      type: byId("renewType").value,
      courseName: byId("renewCourseName").value,
      amount,
      attributionSnapshot: inheritedSnapshot,
      remark: byId("renewRemark").value.trim(),
      createdAt: new Date().toISOString(),
    };

    if (!Array.isArray(target.renewalRecords)) {
      target.renewalRecords = [];
    }
    touchLead(target);
    target.renewalRecords.push(renewalRecord);
    target.financeProfile = {
      settledAmount: Number(target.financeProfile?.settledAmount || target.enrolledAmount || 0) + amount,
      pendingCommission: "待结算",
      referralReward: target.referrerName ? "待判断" : "无",
    };

    pushFollowup(
      target.studentName,
      `已登记${renewalRecord.type}，项目：${renewalRecord.courseName}，实收 ${amount}。默认继承归属链：${formatAttributionSnapshot(inheritedSnapshot)}。`
    );
    target.lastFollowup = "刚刚登记续费/扩科";
    target.nextAction = `${renewalRecord.type}已登记，继续按既有归属链结算`;
    logAudit(`登记${renewalRecord.type}`, target.studentName, `${renewalRecord.courseName} / 实收 ${amount} / 继承 ${formatAttributionSnapshot(inheritedSnapshot)}。`);
    renderAll();
    setInlineMessage("createRenewalMessage", `已登记${renewalRecord.type}：${target.studentName}`, "success");
    showToast("续费 / 扩科已保存");
  });
}

function bindBatchImport() {
  const button = byId("importBatchButton");
  if (!button) return;
  const templateButton = byId("copyImportTemplateButton");
  if (templateButton) {
    templateButton.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(importTemplateFields);
        templateButton.textContent = "已复制模板字段";
        window.setTimeout(() => {
          templateButton.textContent = "复制导入模板字段";
        }, 1600);
      } catch {
        const field = byId("importTemplateField");
        if (field) {
          field.value = importTemplateFields.replace(/\t/g, " / ");
          field.select?.();
        }
      }
      });
  }
  byId("resetAdmissionsButton")?.addEventListener("click", () => {
    if (!canEditAdmissions()) return;
    const confirmed = window.confirm("将重新读取云端招生数据，不删除任何云端记录。确认继续吗？");
    if (!confirmed) return;
    cloudStoreReady = false;
    state.leads = [];
    state.followups = [];
    state.auditLogs = [];
    state.importSummary = {
      added: 0,
      duplicates: 0,
      missingOwner: 0,
      missingFields: 0,
      results: [],
    };
    state.selectedLeadName = "";
    localStorage.removeItem(STORAGE_KEY);
    renderAll();
    hydrateCloudState();
  });
  button.addEventListener("click", () => {
    if (!canImportAdmissions()) {
      setInlineMessage("importBatchMessage", "当前账号没有招生导入权限。", "error");
      return;
    }
    const raw = byId("importBatchInput").value.trim();
    const defaultStatus = byId("importDefaultStatus").value;
    const summary = {
      added: 0,
      duplicates: 0,
      missingOwner: 0,
      missingFields: 0,
      results: [],
    };

    if (!raw) {
      summary.results.push(
        createImportResult("空白导入", "未导入", "当前没有可解析的内容。")
      );
      state.importSummary = summary;
      renderAll();
      setInlineMessage("importBatchMessage", "没有可导入内容。", "error");
      return;
    }

    const leadByPhone = new Map(
      state.leads
        .filter((lead) => normalizePhone(lead.parentPhone))
        .map((lead) => [normalizePhone(lead.parentPhone), lead])
    );

    const lines = raw.split(/\n+/).map((line) => line.trim()).filter(Boolean);
    const headerMap = maybeBuildImportHeaderMap(lines);
    const importLines = headerMap ? lines.slice(1) : lines;

    importLines.forEach((line) => {
      const parsed = parseImportLine(line, headerMap);
      const {
        studentName = "",
        grade = "",
        parentPhone = "",
        subject = "数学",
        channel = "",
        referrer = "",
        owner = "",
        note = "",
        status = "",
        intent = "",
        trialTime = "",
        trialTeacher = "",
        inGroup = "",
        parentNeed = "",
        studentPainPoint = "",
        objection = "",
        nextFollowupDate = "",
        nextAction = "",
      } = parsed;

      const normalizedPhone = normalizePhone(parentPhone);
      if (!studentName || !normalizedPhone) {
        summary.missingFields += 1;
        summary.results.push(
          createImportResult(
            studentName || "未命名线索",
            "导入失败",
            "学生姓名或家长电话缺失，无法入库。"
          )
        );
        return;
      }

      if (leadByPhone.has(normalizedPhone)) {
        const existingLead = leadByPhone.get(normalizedPhone);
        const mergeNotes = [];
        const normalizedChannel = normalizeLeadChannelValue(channel);
        if (normalizedChannel && (!existingLead.channel || existingLead.channel === "待补来源")) {
          existingLead.channel = normalizedChannel;
          mergeNotes.push(`补生源来源=${normalizedChannel}`);
        }
        if (referrer && (!existingLead.channelMeta || existingLead.channelMeta === "待补推荐人")) {
          existingLead.referrerName = referrer;
          mergeNotes.push(`补推荐人=${referrer}`);
        }
        if (owner && (!existingLead.owner || existingLead.owner === "待分配")) {
          existingLead.owner = owner;
          mergeNotes.push(`补负责人=${owner}`);
        }
        if (grade && (!existingLead.grade || existingLead.grade === "待补年级")) {
          existingLead.grade = grade;
          mergeNotes.push(`补年级=${grade}`);
        }
        if (note) {
          existingLead.note = note;
          mergeNotes.push("追加首条备注");
        }
        if (status) {
          existingLead.status = status;
          mergeNotes.push(`更新状态=${status}`);
        }
        if (intent) {
          existingLead.intent = intent;
          mergeNotes.push(`更新意向=${intent}`);
        }
        if (trialTime) {
          existingLead.trialTime = normalizeDateTimeLocal(trialTime);
          existingLead.trial = formatTrialDisplay(existingLead.trialTime);
          mergeNotes.push(`补试听时间=${trialTime}`);
        }
        if (trialTeacher) {
          existingLead.trialTeacher = trialTeacher;
          mergeNotes.push(`补试听老师=${trialTeacher}`);
        }
        if (inGroup) {
          existingLead.inGroup = inGroup.includes("已") || inGroup === "是" ? "已进群" : "未进群";
          mergeNotes.push(`更新进群=${existingLead.inGroup}`);
        }
        if (nextAction) {
          existingLead.nextAction = nextAction;
          mergeNotes.push("更新下一步");
        }
        if (parentNeed) {
          existingLead.parentNeed = parentNeed;
          mergeNotes.push("补家长诉求");
        }
        if (studentPainPoint) {
          existingLead.studentPainPoint = studentPainPoint;
          mergeNotes.push("补学生薄弱点");
        }
        if (objection) {
          existingLead.objection = objection;
          mergeNotes.push(`更新异议=${objection}`);
        }
        if (nextFollowupDate) {
          existingLead.nextFollowupDate = nextFollowupDate;
          mergeNotes.push(`补下次跟进=${nextFollowupDate}`);
        }
        existingLead.channelOwner = deriveChannelOwner(existingLead);
        touchLead(existingLead);
        existingLead.channelMeta = buildChannelMeta(
          normalizeLeadChannelValue(existingLead.channel),
          existingLead.channelOwner,
          existingLead.referrerName
        );
        existingLead.lastFollowup = "刚刚合并导入";
        existingLead.nextAction =
          existingLead.owner && existingLead.owner !== "待分配"
            ? "已并入旧线索，继续跟进"
            : "已并入旧线索，仍待分配负责人";
        pushFollowup(
          existingLead.studentName,
          `批量导入检测到重复手机号，已并入原线索。${mergeNotes.length ? `本次补充：${mergeNotes.join("，")}。` : "本次未新增字段，仅提醒复核。"}`
        );
        summary.duplicates += 1;
        summary.results.push(
          createImportResult(
            studentName,
            "重复已并入",
            `手机号 ${parentPhone} 已存在，已并入 ${existingLead.studentName}。${mergeNotes.length ? `补充内容：${mergeNotes.join("，")}。` : "未发现可补字段。"}`
          )
        );
        state.selectedLeadName = existingLead.studentName;
        return;
      }

      const normalizedChannel = normalizeLeadChannelValue(channel);
      const missingMessages = [];
      if (!normalizedChannel || normalizedChannel === "待补来源") missingMessages.push("缺生源来源");
      if (isReferralChannel(normalizedChannel) && !referrer) missingMessages.push("缺推荐人");
      if (!owner) {
        missingMessages.push("缺负责人");
        summary.missingOwner += 1;
      }
      if (!note) {
        missingMessages.push("缺首条备注");
      }
      if (missingMessages.length) {
        summary.missingFields += 1;
      }

      const newLead = {
        studentName,
        parentPhone,
        grade: grade || "待补年级",
        subject: subject || "数学",
        channel: normalizedChannel || "待补来源",
        channelMeta: buildChannelMeta(normalizedChannel || "待补来源", "", referrer),
        channelOwner: "",
        referrerName: referrer,
        owner: owner || "待分配",
        status: status || defaultStatus,
        trial: "未预约",
        intent: intent || "B 中意向",
        inGroup: inGroup ? (inGroup.includes("已") || inGroup === "是" ? "已进群" : "未进群") : "未进群",
        lastFollowup: "刚刚导入",
        note: note || "待补首条记录",
        nextAction: nextAction || (owner ? "导入完成，尽快首联" : "待分配负责人后首联"),
        parentNeed,
        studentPainPoint,
        objection: objection || "暂无明确异议",
        nextFollowupDate,
        trialTeacher: trialTeacher || "",
        trialTime: normalizeDateTimeLocal(trialTime),
        enrolledAmount: 0,
        createdAt: formatNowStamp(),
        updatedAt: new Date().toISOString(),
      };
      if (newLead.trialTime) {
        newLead.trial = formatTrialDisplay(newLead.trialTime);
      }
      state.leads.unshift(newLead);
      leadByPhone.set(normalizedPhone, newLead);
      summary.added += 1;
      summary.results.push(
        createImportResult(
          studentName,
          missingMessages.length ? "已导入待补充" : "导入成功",
          missingMessages.length ? missingMessages.join("；") : "字段完整，已加入线索池。"
        )
      );
      state.selectedLeadName = studentName;
    });

    state.importSummary = summary;
    logAudit("批量导入线索", state.selectedLeadName || "本批线索", `新增 ${summary.added}，重复 ${summary.duplicates}，缺负责人 ${summary.missingOwner}，缺字段 ${summary.missingFields}。`);
    renderAll();
    setInlineMessage("importBatchMessage", `导入完成：新增 ${summary.added}，重复 ${summary.duplicates}，待补 ${summary.missingFields}`, summary.missingFields ? "error" : "success");
    showToast(`导入完成：新增 ${summary.added} 条`);
  });
}

function bindTrialCreate() {
  const button = byId("saveTrialButton");
  if (!button) return;
  button.addEventListener("click", () => {
    if (!canEditAdmissions()) {
      setInlineMessage("saveTrialMessage", "当前账号没有招生编辑权限。", "error");
      return;
    }
    const studentName = byId("trialLeadSelect").value;
    if (!studentName) {
      setInlineMessage("saveTrialMessage", "请选择试听学生。", "error");
      return;
    }
    const target = state.leads.find((lead) => lead.studentName === studentName);
    if (!target) return;
    target.status = "已预约试听";
    touchLead(target);
    target.school = byId("trialSchoolInput")?.value.trim() || target.school || "";
    target.grade = byId("trialGradeInput")?.value || target.grade;
    target.trialClass = byId("trialClassInput")?.value.trim() || target.trialClass || "";
    target.contactPerson = byId("trialContactPersonInput")?.value.trim() || target.contactPerson || "";
    target.wechat = byId("trialWechatInput")?.value.trim() || target.wechat || "";
    target.parentPhone = byId("trialPhoneInput")?.value.trim() || target.parentPhone || "";
    target.followupTarget = byId("trialFollowupTargetInput")?.value.trim() || target.followupTarget || "";
    target.reminderAt = byId("trialReminderInput")?.value || target.reminderAt || "";
    target.trialTeacher = byId("trialTeacherSelect").value;
    target.trialTime = byId("trialTimeInput").value;
    target.trial = formatTrialDisplay(target.trialTime);
    target.nextAction =
      byId("trialRemarkInput").value.trim() || "试听后当天必须回填反馈";
    target.lastFollowup = "刚刚预约试听";
    target.note = `已安排试听：${target.trialTeacher} / ${target.trial}`;
    state.selectedLeadName = target.studentName;
    logAudit("预约试听", target.studentName, `${target.trialTeacher} / ${target.trial}`);
    renderAll();
    setInlineMessage("saveTrialMessage", `已预约：${target.studentName} / ${target.trialTeacher}。已进入待试听，试听完成后再回填反馈。`, "success");
    showToast("试听预约已保存");
  });

  byId("trialLeadSelect")?.addEventListener("change", () => {
    const target = state.leads.find(
      (lead) => lead.studentName === byId("trialLeadSelect").value
    );
    if (!target) return;
    syncSelectedLead(target.studentName);
    if (byId("trialSchoolInput")) byId("trialSchoolInput").value = target.school || "";
    if (byId("trialGradeInput")) byId("trialGradeInput").value = target.grade || byId("trialGradeInput").value;
    if (byId("trialClassInput")) byId("trialClassInput").value = target.trialClass || "";
    if (byId("trialContactPersonInput")) byId("trialContactPersonInput").value = target.contactPerson || "";
    if (byId("trialWechatInput")) byId("trialWechatInput").value = target.wechat || "";
    if (byId("trialPhoneInput")) byId("trialPhoneInput").value = target.parentPhone || "";
    if (byId("trialFollowupTargetInput")) byId("trialFollowupTargetInput").value = target.followupTarget || "";
    if (byId("trialReminderInput")) byId("trialReminderInput").value = target.reminderAt || "";
    renderAll();
  });
}

function bindDetailSave() {
  const button = byId("saveDetailButton");
  if (!button) return;
  button.addEventListener("click", () => {
    if (!canEditAdmissions()) {
      setInlineMessage("saveDetailMessage", "当前账号没有招生编辑权限。", "error");
      return;
    }
    const target = getSelectedLead();
    if (!target) return;
    const beforeSnapshot = formatAttributionSnapshot(target.attributionLocked && target.attributionSnapshot ? target.attributionSnapshot : buildAttributionSnapshot(target));
    const beforeStatus = target.status;
    const beforeOwner = target.owner;
    const beforeIntent = target.intent;
    const nextOwner = byId("detailOwnerSelect").value;
    const nextChannelOwner = byId("detailChannelOwnerSelect").value;
    const nextReferrerName = byId("detailReferrerInput").value.trim();
    const currentReferrerName = target.referrerName || deriveReferrerText(target.channelMeta) || "";
    const attributionChanged =
      beforeOwner !== nextOwner ||
      deriveChannelOwner(target) !== nextChannelOwner ||
      (currentReferrerName === "无" ? "" : currentReferrerName) !== nextReferrerName;
    if (target.attributionLocked && attributionChanged) {
      setInlineMessage("saveDetailMessage", "这名学生报名后归属链已锁定。需要先点“解锁归属链”，系统会留痕。", "error");
      renderLeadDetail();
      return;
    }
    target.owner = nextOwner;
    touchLead(target);
    target.status = byId("detailStatusSelect").value;
    target.intent = byId("detailIntentSelect").value;
    target.inGroup = byId("detailInGroupSelect").value;
    target.channelOwner = nextChannelOwner;
    target.referrerName = nextReferrerName;
    target.channelMeta = buildChannelMeta(target.channel, target.channelOwner, target.referrerName, target.channelOtherNote);
    target.nextAction = byId("detailNextActionInput").value.trim() || target.nextAction;
    target.parentNeed = byId("detailNeedInput").value.trim();
    target.studentPainPoint = byId("detailPainInput").value.trim();
    target.objection = byId("detailObjectionSelect").value;
    target.nextFollowupDate = byId("detailNextFollowupDateInput").value;
    target.note = byId("detailNoteInput").value.trim() || target.note;
    target.lastFollowup = "刚刚修改";
    const changedParts = [];
    if (beforeStatus !== target.status) changedParts.push(`状态：${beforeStatus} → ${target.status}`);
    if (beforeOwner !== target.owner) changedParts.push(`负责人：${beforeOwner} → ${target.owner}`);
    if (beforeIntent !== target.intent) changedParts.push(`意向：${beforeIntent} → ${target.intent}`);
    if (changedParts.length) {
      pushFollowup(target.studentName, `线索详情已更新：${changedParts.join("；")}。下一步：${target.nextAction}`);
    }
    logAudit("修改线索详情", target.studentName, `状态 ${target.status}，负责人 ${target.owner}，当前归属链 ${beforeSnapshot}。`);
    renderAll();
    setInlineMessage("saveDetailMessage", `已保存 ${target.studentName} 的修改`, "success");
    showToast("线索详情已保存");
  });
}

function bindAttributionUnlock() {
  const button = byId("unlockAttributionButton");
  if (!button) return;
  button.addEventListener("click", () => {
    if (!canEditAdmissions()) {
      setInlineMessage("saveDetailMessage", "当前账号没有招生编辑权限。", "error");
      return;
    }
    const target = getSelectedLead();
    if (!target || !target.attributionLocked) {
      setInlineMessage("saveDetailMessage", "当前线索没有锁定归属链。", "error");
      return;
    }
    const before = formatAttributionSnapshot(target.attributionSnapshot || buildAttributionSnapshot(target));
    if (!window.confirm(`确定解锁 ${target.studentName} 的归属链吗？\n原归属：${before}\n解锁后修改会记录在跟进和操作日志里。`)) return;
    target.attributionLocked = false;
    touchLead(target);
    target.attributionUnlockLog = `${formatNowStamp()} ${getOperatorLabel()} 解锁，原归属：${before}`;
    target.lastFollowup = "刚刚解锁归属链";
    pushFollowup(target.studentName, `归属链已解锁。原归属：${before}。后续修改需保存当前线索修改。`);
    logAudit("解锁归属链", target.studentName, before);
    renderAll();
    setInlineMessage("saveDetailMessage", "归属链已解锁，可以修改后保存。", "success");
    showToast("归属链已解锁并留痕");
  });
}

function bindNavigation() {
  const navItems = Array.from(document.querySelectorAll(".nav-item[data-nav-target]"));
  const sections = Array.from(document.querySelectorAll("[data-section-group]"));

  const applyView = (target) => {
    const nextTarget = navItems.some((item) => item.getAttribute("data-nav-target") === target)
      ? target
      : "dashboard";
    state.activeView = nextTarget;
    navItems.forEach((nav) => {
      nav.classList.toggle("active", nav.getAttribute("data-nav-target") === nextTarget);
    });
    sections.forEach((section) => {
      const groups = (section.getAttribute("data-section-group") || "").split(" ");
      section.classList.toggle("hidden-section", !groups.includes(nextTarget));
    });
    persistState();
  };
  activeViewApplier = applyView;

  navItems.forEach((item) => {
    item.addEventListener("click", () => {
      applyView(item.getAttribute("data-nav-target"));
    });
  });

  document.querySelectorAll("[data-jump-view]").forEach((node) => {
    node.addEventListener("click", (event) => {
      event.preventDefault();
      applyView(node.getAttribute("data-jump-view"));
      const href = node.getAttribute("href") || "";
      const targetNode = href.startsWith("#") ? document.querySelector(href) : null;
      if (targetNode) {
        targetNode.scrollIntoView({ behavior: "smooth", block: "center" });
      } else {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    });
  });

  applyView(state.activeView || "dashboard");
}

function bindLeadActions() {
  document.querySelectorAll("[data-owner-select]").forEach((select) => {
    select.onchange = () => {
      const studentName = select.getAttribute("data-owner-select");
      const target = state.leads.find((lead) => lead.studentName === studentName);
      if (!target) return;
      if (!canEditAdmissions()) return;
      target.owner = select.value;
      touchLead(target);
      target.lastFollowup = "刚刚重分配";
      logAudit("调整负责人", target.studentName, `改为 ${select.value}。`);
      syncSelectedLead(target.studentName);
      renderAll();
    };
  });

  document.querySelectorAll("[data-action='advance-status']").forEach((button) => {
    button.onclick = () => {
      const studentName = button.getAttribute("data-student");
      const target = state.leads.find((lead) => lead.studentName === studentName);
      if (!target) return;
      if (!canEditAdmissions()) return;
      const previousStatus = target.status;
      if (target.status === "新建未联系") target.status = "已沟通待邀约";
      else if (target.status === "已沟通待邀约") target.status = "持续跟进中";
      else if (target.status === "试听完成待转化") target.status = "持续跟进中";
      touchLead(target);
      target.lastFollowup = "刚刚推进";
      target.nextAction = "继续跟进并补下一步动作";
      pushFollowup(
        target.studentName,
        `状态推进：${previousStatus} → ${target.status}。系统提醒：状态变化后需要补充具体沟通内容和下一步动作。`
      );
      logAudit("推进线索状态", target.studentName, `推进后状态 ${target.status}。`);
      syncSelectedLead(target.studentName);
      renderAll();
    };
  });

  document.querySelectorAll("[data-action='assign-trial']").forEach((button) => {
    button.onclick = () => {
      const studentName = button.getAttribute("data-student");
      const target = state.leads.find((lead) => lead.studentName === studentName);
      if (!target) return;
      syncSelectedLead(target.studentName);
      renderAll();
      switchAdmissionView("trials", "#trialLeadSelect");
      const activeTrialLead = byId("trialLeadSelect");
      if (activeTrialLead) {
        activeTrialLead.value = target.studentName;
        activeTrialLead.dispatchEvent(new Event("change"));
      }
    };
  });

  document.querySelectorAll("[data-action='complete-trial']").forEach((button) => {
    button.onclick = () => {
      const studentName = button.getAttribute("data-student");
      const target = state.leads.find((lead) => lead.studentName === studentName);
      if (!target) return;
      if (!canEditAdmissions()) return;
      target.status = "试听完成待转化";
      touchLead(target);
      target.trial = "已试听";
      target.nextAction = "48 小时内给报名方案";
      target.lastFollowup = "刚刚完成试听";
      pushFollowup(
        target.studentName,
        "已标记试听完成，进入试听完成待转化。下一步必须补试听反馈、家长异议、意向等级和报名方案。"
      );
      logAudit("完成试听", target.studentName, "已转入试听完成待转化。");
      syncSelectedLead(target.studentName);
      renderAll();
      switchAdmissionView("trials", "#feedbackLeadSelect");
    };
  });

  document.querySelectorAll("[data-action='mark-shelved']").forEach((button) => {
    button.onclick = () => {
      const studentName = button.getAttribute("data-student");
      const target = state.leads.find((lead) => lead.studentName === studentName);
      if (!target) return;
      if (!canEditAdmissions()) return;
      const nextDate = target.nextFollowupDate || addDaysDateString(30);
      target.status = "搁置待回访";
      touchLead(target);
      target.nextFollowupDate = nextDate;
      target.nextAction = `搁置待回访：${nextDate}`;
      target.lastFollowup = "刚刚搁置";
      pushFollowup(target.studentName, `已搁置待回访，建议 ${nextDate} 前后重新联系家长。`);
      logAudit("搁置待回访", target.studentName, `下次回访 ${nextDate}。`);
      syncSelectedLead(target.studentName);
      renderAll();
      showToast(`${target.studentName} 已进入搁置待回访`);
    };
  });

  document.querySelectorAll("[data-action='enroll-lead']").forEach((button) => {
    button.onclick = () => {
      const studentName = button.getAttribute("data-student");
      const target = state.leads.find((lead) => lead.studentName === studentName);
      if (!target) return;
      syncSelectedLead(target.studentName);
      renderAll();
      const enrollInput = byId("enrollStudentName");
      if (enrollInput) {
        enrollInput.value = target.studentName;
        enrollInput.dispatchEvent(new Event("change"));
      }
      switchAdmissionView("enrollment", "#enrollStudentName");
    };
  });

  document.querySelectorAll("[data-action='reassign-owner']").forEach((button) => {
    button.onclick = () => {
      const studentName = button.getAttribute("data-student");
      const target = state.leads.find((lead) => lead.studentName === studentName);
      if (!target) return;
      syncSelectedLead(target.studentName);
      renderAll();
      switchAdmissionView("leads", "#leadDetailPanel");
    };
  });

  document.querySelectorAll("[data-action='view-detail']").forEach((button) => {
    button.onclick = () => {
      const studentName = button.getAttribute("data-student");
      syncSelectedLead(studentName);
      renderAll();
      switchAdmissionView("leads", "#leadDetailPanel");
    };
  });

  document.querySelectorAll("[data-action='public-reassign']").forEach((button) => {
    button.onclick = () => {
      const studentName = button.getAttribute("data-student");
      const target = state.leads.find((lead) => lead.studentName === studentName);
      if (!target) return;
      if (!canEditAdmissions()) return;
      const ownerSelect = document.querySelector(
        `[data-public-owner-select="${studentName}"]`
      );
      target.owner = ownerSelect?.value || ownerOptions[0];
      touchLead(target);
      target.nextAction = "已重新分配，尽快首联";
      target.lastFollowup = "刚刚重分配";
      pushFollowup(target.studentName, `公海线索已重新分配给 ${target.owner}，需要尽快首联。`);
      logAudit("公海线索重分配", target.studentName, `改为 ${target.owner}。`);
      syncSelectedLead(target.studentName);
      renderAll();
    };
  });
}

function renderOperatorContext() {
  const employee = getCurrentEmployee();
  const operatorHint = byId("operatorHint");
  const permissionNotice = byId("permissionNotice");
  const operatorName = byId("operatorName");
  const operatorMeta = byId("operatorMeta");
  const operatorPermissionSummary = byId("operatorPermissionSummary");

  if (employee) {
    const financeSummary = canViewAdmissionFinance() ? "可查看财务口径" : "不可查看财务口径";
    const editSummary = canEditAdmissions() ? "当前账号可录入和修改招生数据。" : "当前账号为只读，只能查看，不能修改招生数据。";
    if (operatorHint) {
      operatorHint.textContent = `${employee.name}｜${employee.role}｜${editSummary}`;
    }
    if (operatorName) operatorName.textContent = employee.name;
    if (operatorMeta) operatorMeta.textContent = `${employee.role}｜用户名 ${employee.username}`;
    if (operatorPermissionSummary) {
      operatorPermissionSummary.textContent = `招生编辑：${canEditAdmissions() ? "已开放" : "未开放"}｜导入：${canImportAdmissions() ? "已开放" : "未开放"}｜${financeSummary}`;
    }
    if (permissionNotice) {
      permissionNotice.hidden = canEditAdmissions();
      permissionNotice.textContent = "当前登录账号没有招生编辑权限。你现在可以查看流程和数据，但不会允许录入、导入、重分配或修改。";
    }
    return;
  }

  if (operatorHint) operatorHint.textContent = "当前没有识别到登录员工信息。";
  if (operatorName) operatorName.textContent = "未识别";
  if (operatorMeta) operatorMeta.textContent = "请先从统一工作台登录";
  if (operatorPermissionSummary) operatorPermissionSummary.textContent = "暂未加载权限";
  if (permissionNotice) {
    permissionNotice.hidden = false;
    permissionNotice.textContent = "当前页面未识别登录信息，默认按只读处理。";
  }
}

function renderAuditLogs() {
  const box = byId("auditLogList");
  if (!box) return;
  const logs = Array.isArray(state.auditLogs) ? state.auditLogs.slice(0, 8) : [];
  box.innerHTML = logs.length
    ? logs
        .map(
          (item) => `
            <div class="audit-item">
              <strong>${item.action}｜${item.studentName}</strong>
              <p>${item.time}｜${item.operator}<br>${item.detail}</p>
            </div>
          `
        )
        .join("")
    : `
      <div class="audit-item">
        <strong>暂无操作记录</strong>
        <p>这里记录谁修改了线索、试听、报名、续费、导入和归属链。</p>
      </div>
    `;
}

function applyPermissionState() {
  const editable = canEditAdmissions();
  const importable = canImportAdmissions();
  const editSelectors = [
    '[id^="lead"]',
    '[id^="detail"]',
    '[id^="trial"]',
    '[id^="feedback"]',
    '[id^="enroll"]',
    '[id^="renew"]',
    '[id^="followup"]',
    '#createLeadButton',
    '#saveFeedbackButton',
    '#createEnrollmentButton',
    '#addFollowupButton',
    '#createRenewalButton',
    '#saveTrialButton',
    '#saveDetailButton',
    '#followupMethodSelect',
    '#followupNextDateInput',
    '#followupNeedInput',
    '#followupPainInput',
    '#followupObjectionSelect',
    '#quickFollowupLeadSelect',
    '#quickFollowupMethodSelect',
    '#quickFollowupNextDateInput',
    '#quickFollowupInput',
    '#quickFollowupButton',
    '#quickLeadStudentName',
    '#quickLeadGrade',
    '#quickLeadPhone',
    '#quickLeadChannel',
    '#quickLeadOwner',
    '#quickLeadIntent',
    '#quickLeadNote',
    '#quickCreateLeadButton'
  ];
  document.querySelectorAll(editSelectors.join(",")).forEach((node) => {
    if (!["INPUT", "SELECT", "TEXTAREA", "BUTTON"].includes(node.tagName)) return;
    if (["leadSearchInput", "leadOwnerFilter", "leadChannelFilter", "leadIntentFilter"].includes(node.id)) return;
    if (["admissionsHelpQuestion", "askAdmissionsHelpButton"].includes(node.id)) return;
    if (node.id === "detailAttributionLock" || node.id === "renewStudentName" || node.id === "renewAttributionPreview" || node.id === "enrollAttributionPreview") {
      node.disabled = true;
      return;
    }
    node.disabled = !editable;
  });

  const importNodes = document.querySelectorAll("#importBatchInput, #importDefaultStatus, #importBatchButton, #copyImportTemplateButton");
  importNodes.forEach((node) => {
    node.disabled = !importable;
  });
  const exportButtons = [byId("exportFilteredLeadsButton"), byId("exportAllLeadsButton")].filter(Boolean);
  exportButtons.forEach((exportButton) => {
    const exportable = canExportAdmissions();
    exportButton.disabled = !exportable;
    exportButton.title = exportable ? "导出 Excel/CSV" : "当前账号没有招生导出权限";
  });
}

function bindLeadFilters() {
  const mappings = [
    ["filterAllButton", "all"],
    ["filterNewButton", "new"],
    ["filterTrialButton", "trial"],
    ["filterEnrolledButton", "enrolled"],
  ];
  mappings.forEach(([id, value]) => {
    const button = byId(id);
    if (!button) return;
    button.addEventListener("click", () => {
      state.activeLeadFilter = value;
      state.funnelStage = "";
      renderLeadTable();
    });
  });

  const filterBindings = [
    ["leadSearchInput", "leadSearchQuery"],
    ["leadOwnerFilter", "leadOwnerFilter"],
    ["leadChannelFilter", "leadChannelFilter"],
    ["leadIntentFilter", "leadIntentFilter"],
  ];
  filterBindings.forEach(([id, key]) => {
    const node = byId(id);
    if (!node) return;
    const eventName = node.tagName === "INPUT" ? "input" : "change";
    node.addEventListener(eventName, () => {
      state[key] = node.value;
      state.funnelStage = "";
      renderLeadTable();
    });
  });

  byId("funnelActionList")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-funnel-action]");
    if (!button) return;
    applyFunnelAction(button.getAttribute("data-funnel-action") || "");
  });

  const exportButton = byId("exportFilteredLeadsButton");
  if (exportButton) {
    exportButton.addEventListener("click", () => {
      if (!canExportAdmissions()) return;
      exportFilteredLeads();
      renderAuditLogs();
    });
  }
  const exportAllButton = byId("exportAllLeadsButton");
  if (exportAllButton) {
    exportAllButton.addEventListener("click", () => {
      if (!canExportAdmissions()) return;
      exportAllLeads();
      renderAuditLogs();
    });
  }
  byId("feedbackLeadSelect")?.addEventListener("change", () => {
    const manualInput = byId("feedbackLeadNameInput");
    if (manualInput) manualInput.value = byId("feedbackLeadSelect")?.value || "";
  });
}

function bindAdmissionsHelp() {
  document.querySelectorAll("[data-admissions-help-question]").forEach((button) => {
    button.addEventListener("click", () => {
      const question = button.getAttribute("data-admissions-help-question") || button.textContent || "";
      const input = byId("admissionsHelpQuestion");
      if (input) input.value = question;
      answerAdmissionsHelp(question);
    });
  });
  const askButton = byId("askAdmissionsHelpButton");
  if (askButton) {
    askButton.addEventListener("click", () => {
      answerAdmissionsHelp(byId("admissionsHelpQuestion")?.value || "");
    });
  }
  const questionInput = byId("admissionsHelpQuestion");
  if (questionInput) {
    questionInput.addEventListener("keydown", (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        answerAdmissionsHelp(questionInput.value);
      }
    });
  }
}

function renderAll() {
  persistState();
  renderOperatorContext();
  renderLeadFilterControls();
  renderAdmissionTasks();
  renderLeadTable();
  renderTrialTable();
  renderSopTasks();
  renderFollowups();
  renderPublicPool();
  renderFollowupLeadOptions();
  renderQuickFollowupDefaults();
  renderFeedbackLeadOptions();
  renderEnrollmentLeadOptions();
  renderTrialLeadOptions();
  renderLeadDetail();
  renderImportSummary();
  renderPendingLeadFixes();
  renderStudentArchive();
  renderMetrics();
  renderSimplePipelineBoard();
  renderDormantStats();
  renderChannelRoi();
  renderConsultantStats();
  renderReferralRanking();
  renderReferralLearningReports();
  renderReminderStats();
  renderManagementStats();
  renderAuditLogs();
  applyPermissionState();
}

bindLeadCreate();
bindQuickLeadCreate();
bindFeedbackSave();
bindEnrollmentCreate();
bindFollowupCreate();
bindRenewalCreate();
bindBatchImport();
bindTrialCreate();
bindDetailSave();
bindAttributionUnlock();
bindNavigation();
bindLeadFilters();
bindAdmissionsHelp();
bindReferralLearningReports();
renderAll();
hydrateCloudState();
