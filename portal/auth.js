const JRC_AUTH_STORAGE_KEY = "jrc-portal-auth-session";
const JRC_EMPLOYEE_DIRECTORY_STORAGE_KEY = "jrc-employee-directory-extra";
const JRC_DATA_FOUNDATION_RESET_KEY = "jrc-data-foundation-reset-20260622a";
const JRC_TEMP_AUTO_LOGIN_USERNAME = "";
const JRC_INITIAL_PASSWORD = "10281028";
const JRC_LEGACY_BUSINESS_DATA_KEYS = [
  "advice-system-stage-prototype",
  "jrc-finance-ledger-v1",
  "jrc-teaching-quality-system-v2-demo",
  "jrc-student-service-v2",
  "jrc-curriculum-products-v2",
  "jrc-hr-training-tasks-v2",
  "jrc-campus-operations-v2",
  "jrc-video-ops-monitor-v1",
  "jrc-suggestion-management-v2",
  "jrc-business-audit-log-v1",
  "jrc-last-local-backup-export",
  "jrc-cloud-sync-pending-v1"
];
const JRC_DATA_CONTRACTS = {
  employee: {
    owner: "校区运营与人事系统",
    feeds: ["排课系统", "财务系统", "教学质量系统", "招生管理系统"],
    keyFields: ["teacherName", "username", "role", "hireDate", "commissionRate"]
  },
  schedule: {
    owner: "排课系统",
    feeds: ["财务系统", "教学质量系统", "学生服务系统"],
    keyFields: ["courseDate", "startTime", "endTime", "teacherName", "studentName", "className", "roomName", "hours"]
  },
  finance: {
    owner: "财务系统",
    feeds: ["经营看板", "校区运营与人事系统"],
    keyFields: ["period", "teacherName", "hours", "commissionRate", "qualityCoefficient", "expenseAmount", "profitShare"]
  },
  teachingQuality: {
    owner: "教学质量系统",
    feeds: ["财务系统", "排课系统", "招生管理系统"],
    keyFields: ["period", "teacherName", "score", "grade", "performanceCoefficient", "ticketStatus"]
  },
  admissions: {
    owner: "招生管理系统",
    feeds: ["排课系统", "学生服务系统", "财务系统"],
    keyFields: ["studentName", "parentPhone", "channel", "owner", "trialTeacher", "enrolledAmount"]
  },
  attendance: {
    owner: "学生服务系统",
    feeds: ["财务系统", "学生服务系统", "家长沟通"],
    keyFields: ["date", "teacherName", "studentName", "className", "attendanceStatus", "exitScore", "followupStatus"]
  },
  aiAssistant: {
    owner: "课堂反馈AI助手",
    feeds: ["学生服务系统"],
    keyFields: ["mode", "target", "studentName", "teacherName", "createdBy", "archiveTarget", "createdAt"]
  },
  siteFeedback: {
    owner: "全站反馈问题",
    feeds: ["建议与任务协同系统", "模块负责人任务", "管理员整改台账"],
    keyFields: ["feedbackId", "userName", "system", "type", "severity", "status", "taskId", "resolution"]
  },
  videoOps: {
    owner: "短视频系统",
    feeds: ["招生管理系统", "经营看板", "校区运营"],
    keyFields: ["platform", "accountName", "videoId", "title", "capturedAt", "views", "likes", "leads", "platformAdvice"]
  }
};
const JRC_QUALITY_COEFFICIENTS = { S: 1.1, A: 1, B: 0.9, C: 0.8 };
const JRC_FINANCE_EXCLUDED_TEACHERS = ["程志豪", "海滢滢", "姚老师"];
const JRC_CURRICULUM_GRADE_EXPERTS = {
  lishu: { grades: ["一年级", "二年级", "三年级"], subject: "数学" },
  wushuiqin: { grades: ["四年级"], subject: "数学" },
  panyungui: { grades: ["五年级"], subject: "数学" },
  zhaoxuan: { grades: ["一年级", "二年级", "三年级", "四年级", "五年级", "六年级"] },
  yeyuanze: { grades: ["初一"], subject: "数学" },
  wujianyong: { grades: ["初一"], subject: "数学" },
  zhengjiayi: { grades: ["初二"], subject: "数学" },
  caodeshun: { grades: ["初二"], subject: "数学" },
  liudajun: { grades: ["初一", "初二", "初三"] },
  zhuyongle: { grades: ["初一"], subject: "科学" }
};
if (typeof window !== "undefined") {
  window.JRC_CURRICULUM_GRADE_EXPERTS = JRC_CURRICULUM_GRADE_EXPERTS;
}
const JRC_DATA_LINK_RULES = [
  {
    id: "schedule-to-finance",
    from: "排课系统",
    to: "财务系统",
    rule: "按老师、月份汇总已排课/已上课课时，进入课时费、补课提成和分红基础数据。",
    status: "foundation"
  },
  {
    id: "quality-to-finance",
    from: "教学质量系统",
    to: "财务系统",
    rule: "教学质量内部等级结果转成财务核算系数，参与课时奖金和教学质量奖励核算。",
    status: "foundation"
  },
  {
    id: "admissions-to-schedule",
    from: "招生管理系统",
    to: "排课系统",
    rule: "已预约试听线索自动形成试听排课候选；已报名线索转入正式班级排课候选。",
    status: "foundation"
  },
  {
    id: "admissions-to-student-service",
    from: "招生管理系统",
    to: "学生服务系统",
    rule: "已报名学生自动形成学生档案、家长沟通和入学交接待办。",
    status: "foundation"
  },
  {
    id: "admissions-to-finance",
    from: "招生管理系统",
    to: "财务系统",
    rule: "实收金额、渠道、招生顾问、试听老师、转介绍人进入收入归因和提成结算草表；程志豪、海滢滢、姚老师名下学生单独核算，不进入财务系统自动结算。",
    status: "foundation"
  },
  {
    id: "attendance-to-student-service",
    from: "点名出门测",
    to: "学生服务系统",
    rule: "每节课点名、缺席处理和出门测成绩自动沉淀到学生服务台账，供学管追踪补课、视频课、销课和家长沟通。",
    status: "foundation"
  },
  {
    id: "attendance-to-finance",
    from: "点名出门测",
    to: "财务系统",
    rule: "有效到课、迟到和出门测修正后的到课人次进入课时费与课销候选；缺席未处理不直接进入正式结算。",
    status: "foundation"
  },
  {
    id: "ai-feedback-to-student-service",
    from: "课堂反馈AI助手",
    to: "学生服务系统",
    rule: "老师语音或文字课堂反馈经 AI 整理后，必须由老师确认归档，再进入学生服务系统，供学管查看、复制和复盘。",
    status: "foundation"
  },
  {
    id: "feedback-to-task",
    from: "全站反馈问题",
    to: "建议与任务协同系统",
    rule: "老师提交的问题先进入反馈台账；需要执行的由管理员转为任务，负责人提交完成反馈，提出人复核是否真正解决。",
    status: "foundation"
  }
];
const JRC_ROLE_PERMISSIONS = {
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

const JRC_EMPLOYEES = [
  {
    name: "周珊",
    username: "zhoushan",
    password: "10281028",
    role: "学管",
    phone: "15212968215",
    wechat: "Azs-20210113",
    scope: "1-9",
    hireDate: "2025-09-01",
    regularDate: "2025-10-01",
    subject: ""
  },
  {
    name: "高芳燕",
    username: "gaofangyan",
    password: "10281028",
    role: "学管",
    phone: "17879352353",
    wechat: "jiujiujiujiumii",
    scope: "小课1-9",
    hireDate: "2025-09-11",
    regularDate: "2025-10-11",
    subject: ""
  },
  {
    name: "颜雨涵",
    username: "yanyuhan",
    password: "10281028",
    role: "学管",
    phone: "18892619946",
    wechat: "18892619946",
    scope: "1-4年级",
    hireDate: "2023-07-14",
    regularDate: "2023-07-14",
    subject: ""
  },
  {
    name: "徐嘉丽",
    username: "xujiali",
    password: "10281028",
    role: "学管",
    phone: "18379947202",
    wechat: "Pluto--Sco-20L",
    scope: "5-6年级",
    hireDate: "2026-03-16",
    regularDate: "2026-04-16",
    subject: ""
  },
  {
    name: "程志豪",
    username: "chengzhihao",
    password: "10281028",
    role: "管理员",
    phone: "15888003051",
    wechat: "jrc-math",
    scope: "1-9年级",
    hireDate: "2016-06-20",
    regularDate: "2016-07-20",
    subject: "数学",
    commissionRate: "100%"
  },
  {
    name: "陈雨晴",
    username: "chenyuqing",
    password: "10281028",
    role: "财务",
    phone: "15259085997",
    wechat: "YQZH5208598",
    scope: "1-9",
    hireDate: "2020-10-02",
    regularDate: "2020-11-02",
    subject: ""
  },
  {
    name: "海滢滢",
    username: "haiyingying",
    password: "10281028",
    role: "授课老师",
    phone: "18758400721",
    wechat: "cathy125805",
    scope: "3-8年级",
    hireDate: "2021-03-20",
    regularDate: "2021-04-20",
    subject: "科学",
    commissionRate: "50%"
  },
  {
    name: "姚老师",
    username: "yaolaoshi",
    password: "10281028",
    role: "授课老师",
    phone: "",
    wechat: "",
    scope: "外聘老师",
    hireDate: "",
    regularDate: "",
    subject: "数学",
    commissionRate: "单独按实到人数结算"
  },
  {
    name: "叶源泽",
    username: "yeyuanze",
    password: "10281028",
    role: "授课老师",
    phone: "13738807822",
    wechat: "YYZ-May-19",
    scope: "初一（七年级）",
    hireDate: "2025-05-09",
    regularDate: "2025-06-09",
    subject: "数学",
    commissionRate: "23%"
  },
  {
    name: "李舒",
    username: "lishu",
    password: "10281028",
    role: "授课老师",
    phone: "19155389323",
    wechat: "19155389323",
    scope: "一年级、二年级、三年级",
    hireDate: "2025-07-05",
    regularDate: "2025-08-05",
    subject: "数学",
    commissionRate: "20%"
  },
  {
    name: "刘大君",
    username: "liudajun",
    password: "10281028",
    role: "授课老师",
    phone: "15639466839",
    wechat: "15639466839",
    scope: "初中部教研主任（初一至初三）",
    hireDate: "2024-01-20",
    regularDate: "2024-01-20",
    subject: "数学",
    commissionRate: "33.33%"
  },
  {
    name: "吴水琴",
    username: "wushuiqin",
    password: "10281028",
    role: "授课老师",
    phone: "18056627068",
    wechat: "fmkkii555",
    scope: "四年级",
    hireDate: "2026-05-16",
    regularDate: "2026-06-16",
    subject: "数学",
    commissionRate: "20%"
  },
  {
    name: "朱永乐",
    username: "zhuyongle",
    password: "10281028",
    role: "授课老师",
    phone: "15205843546",
    wechat: "L2577593964",
    scope: "初一科学（七年级）",
    hireDate: "2025-12-12",
    regularDate: "2026-06-12",
    subject: "科学",
    commissionRate: "20%"
  },
  {
    name: "郑嘉艺",
    username: "zhengjiayi",
    password: "10281028",
    role: "授课老师",
    phone: "15968088762",
    wechat: "Joyee-yiyi",
    scope: "初二（八年级）",
    hireDate: "2025-12-22",
    regularDate: "2026-01-22",
    subject: "数学",
    commissionRate: "20%"
  },
  {
    name: "赵萱",
    username: "zhaoxuan",
    password: "10281028",
    role: "授课老师",
    phone: "15938462313",
    wechat: "zx15938462313",
    scope: "小学部教研主任（一至六年级）",
    hireDate: "2025-09-08",
    regularDate: "2025-10-08",
    subject: "数学",
    commissionRate: "20%"
  },
  {
    name: "曹德顺",
    username: "caodeshun",
    password: "10281028",
    role: "授课老师",
    phone: "18003276656",
    wechat: "cds030418",
    scope: "初二（八年级）",
    hireDate: "2026-04-23",
    regularDate: "2026-05-23",
    subject: "数学",
    commissionRate: "20%"
  },
  {
    name: "潘云贵",
    username: "panyungui",
    password: "10281028",
    role: "授课老师",
    phone: "13114114478",
    wechat: "UNomnipotentyouth",
    scope: "五年级",
    hireDate: "2026-04-22",
    regularDate: "2026-05-22",
    subject: "数学",
    commissionRate: "20%"
  },
  {
    name: "吴建勇",
    username: "wujianyong",
    password: "10281028",
    role: "授课老师",
    phone: "17816636255",
    wechat: "-Woey1228",
    scope: "初一（七年级）",
    hireDate: "2026-05-20",
    regularDate: "2026-06-20",
    subject: "数学",
    commissionRate: "20%"
  }
];

const JRC_SUPER_ADMIN_USERNAMES = ["chengzhihao", "czh", "chenyuqing", "haiyingying"];
const JRC_SUPER_ADMIN_NAMES = ["程志豪", "陈雨晴", "海滢滢"];
const JRC_FINANCE_ADMIN_USERNAMES = ["chenyuqing", "liudajun", "chengzhihao"];
const JRC_PAIKE_ADMIN_USERNAMES = ["zhoushan", "chenyuqing", "chengzhihao"];
const JRC_KNOWLEDGE_ADMIN_USERNAMES = ["yanyuhan", "gaofangyan", "chengzhihao"];
const JRC_ROLE_DIRECTORY_STORAGE_KEY = "jrc-hr-role-directory-v1";
const JRC_ROLE_DIRECTORY_KNOWLEDGE_MEMBER_NAMES = ["颜雨涵", "高芳燕", "周珊", "李舒", "刘大君", "叶源泽", "赵萱", "郑嘉艺", "陈雨晴"];
const JRC_SUGGESTION_ADMIN_USERNAMES = ["yeyuanze", "zhaoxuan", "chengzhihao"];
const JRC_ADMISSIONS_ADMIN_USERNAMES = ["chenyuqing", "chengzhihao", "yanyuhan", "gaofangyan"];
const JRC_CURRICULUM_ADMIN_USERNAMES = ["zhaoxuan", "chengzhihao"];
const JRC_TEACHING_QUALITY_ADMIN_USERNAMES = ["zhengjiayi", "chengzhihao"];
const JRC_STUDENT_SERVICE_ADMIN_USERNAMES = ["yanyuhan", "zhoushan", "gaofangyan", "chengzhihao"];
const JRC_VIDEO_OPS_ADMIN_USERNAMES = ["chengzhihao", "gaofangyan", "chenyuqing"];
const JRC_VIDEO_OPS_ADMIN_NAMES = ["程志豪", "高芳燕", "高方燕", "陈雨晴"];
const JRC_DEPARTED_EMPLOYEE_USERNAMES = new Set(["zhangyan", "hejianjun"]);
const JRC_GRANULAR_MODULES = [
  ["studentService", "学生服务"],
  ["curriculum", "教研课程"],
  ["hr", "人事管理"],
  ["campus", "校区运营"]
];
const JRC_GRANULAR_ACTIONS = [
  ["create", "新增"],
  ["update", "修改"],
  ["delete", "删除"],
  ["import", "导入"],
  ["export", "导出"],
  ["reset", "清空"]
];
const JRC_PERMISSION_OPTIONS = [
  ["ai.access", "课堂反馈AI助手进入"],
  ["paike.access", "排课查看"],
  ["paike.edit", "排课修改"],
  ["knowledge.access", "学管知识库进入"],
  ["knowledge.edit", "学管知识库管理"],
  ["suggestions.access", "建议系统进入"],
  ["suggestions.edit", "建议系统管理"],
  ["admissions.access", "招生进入"],
  ["admissions.edit", "招生录入修改"],
  ["admissions.import", "招生批量导入"],
  ["admissions.export", "招生数据导出"],
  ["admissions.finance", "招生财务归因"],
  ["teachingQuality.access", "教学质量查看"],
  ["teachingQuality.edit", "教学质量管理"],
  ["studentService.access", "学生服务进入"],
  ["studentService.edit", "学生服务管理"],
  ...JRC_GRANULAR_ACTIONS.map(([action, label]) => [`studentService.${action}`, `学生服务${label}`]),
  ["curriculum.access", "教研课程进入"],
  ["curriculum.edit", "教研课程管理"],
  ...JRC_GRANULAR_ACTIONS.map(([action, label]) => [`curriculum.${action}`, `教研课程${label}`]),
  ["hr.access", "人事管理进入"],
  ["hr.edit", "人事管理"],
  ...JRC_GRANULAR_ACTIONS.map(([action, label]) => [`hr.${action}`, `人事管理${label}`]),
  ["campus.access", "校区运营进入"],
  ["campus.edit", "校区运营管理"],
  ...JRC_GRANULAR_ACTIONS.map(([action, label]) => [`campus.${action}`, `校区运营${label}`]),
  ["videoOps.access", "短视频运营进入"],
  ["videoOps.edit", "短视频运营管理"],
  ["finance.access", "财务进入"],
  ["finance.edit", "财务修改"],
  ["admin.access", "系统管理"]
];

function jrcExpandGranularPermissions(permissions) {
  JRC_GRANULAR_MODULES.forEach(([moduleKey]) => {
    if (!permissions.has(`${moduleKey}.edit`)) return;
    JRC_GRANULAR_ACTIONS.forEach(([action]) => permissions.add(`${moduleKey}.${action}`));
  });
}

function jrcSafeStorageGet(key) {
  try {
    return window.localStorage?.getItem(key) || null;
  } catch {
    return null;
  }
}

function jrcSafeStorageSet(key, value) {
  try {
    window.localStorage?.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function jrcSafeStorageRemove(key) {
  try {
    window.localStorage?.removeItem(key);
  } catch {
    // Ignore storage failures; cookie fallback still handles login state.
  }
}

function jrcReadRoleDirectoryRows() {
  try {
    const parsed = JSON.parse(jrcSafeStorageGet(JRC_ROLE_DIRECTORY_STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function jrcRoleDirectoryMemberNames() {
  const names = new Set(JRC_ROLE_DIRECTORY_KNOWLEDGE_MEMBER_NAMES.map(jrcNormalizeName).filter(Boolean));
  jrcReadRoleDirectoryRows().forEach((row) => {
    const values = Array.isArray(row?.members)
      ? row.members
      : String(row?.membersText || row?.employee || "").split(/[、,，/]+/);
    values.map(jrcNormalizeName).filter(Boolean).forEach((name) => names.add(name));
  });
  return names;
}

function jrcReadCookie(name) {
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

function jrcWriteCookie(name, value, maxAgeSeconds = 7 * 24 * 60 * 60) {
  try {
    document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; path=/; max-age=${maxAgeSeconds}; SameSite=Lax`;
    return true;
  } catch {
    return false;
  }
}

function jrcClearCookie(name) {
  try {
    document.cookie = `${encodeURIComponent(name)}=; path=/; max-age=0; SameSite=Lax`;
  } catch {
    // Ignore cookie failures.
  }
}

function jrcReadCustomEmployees() {
  try {
    const parsed = JSON.parse(jrcSafeStorageGet(JRC_EMPLOYEE_DIRECTORY_STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function jrcWriteCustomEmployees(employees) {
  jrcSafeStorageSet(JRC_EMPLOYEE_DIRECTORY_STORAGE_KEY, JSON.stringify(employees));
}

function jrcGetAllEmployees() {
  const byUsername = new Map();
  const putEmployee = (employee) => {
    if (!employee || typeof employee !== "object") return;
    const username = String(employee.username || "").trim().toLowerCase();
    if (!username) return;
    const existing = byUsername.get(username) || {};
    byUsername.set(username, {
      ...existing,
      ...employee,
      username,
      password: employee.password || existing.password || JRC_INITIAL_PASSWORD
    });
  };
  JRC_EMPLOYEES.forEach(putEmployee);
  jrcReadCustomEmployees().forEach(putEmployee);
  return [...byUsername.values()].filter((employee) => {
    const username = String(employee.username || "").trim().toLowerCase();
    const statusText = [
      employee.status,
      employee.employmentStatus,
      employee.workStatus,
      employee.employeeStatus,
      employee.accountStatus
    ].filter(Boolean).join(" ");
    return !JRC_DEPARTED_EMPLOYEE_USERNAMES.has(username) && !/离职|停用|禁用|已离开|departed|inactive|disabled/i.test(statusText);
  });
}

function jrcSyncCustomEmployeesToCloud(employees) {
  if (!window.JRC_CLOUD?.writeModuleData) return;
  window.JRC_CLOUD.writeModuleData(JRC_EMPLOYEE_DIRECTORY_STORAGE_KEY, "employeeDirectory", Array.isArray(employees) ? employees : [], { replaceMode: "replace" }).catch((error) => {
    console.warn("Failed to sync employee directory", error);
  });
}

async function jrcSyncEmployeeAccountToCloud(employee, options = {}) {
  if (!window.JRC_CLOUD?.upsertEmployee) return { ok: false, skipped: true, reason: "cloud-upsert-unavailable" };
  try {
    return await window.JRC_CLOUD.upsertEmployee(employee, {
      resetPassword: Boolean(options.resetPassword)
    });
  } catch (error) {
    console.warn("Failed to sync employee account", error);
    return { ok: false, error: String(error?.message || error) };
  }
}

async function jrcHydrateCustomEmployeesFromCloud() {
  if (!window.JRC_CLOUD?.readModuleData) return;
  try {
    const result = await window.JRC_CLOUD.readModuleData(JRC_EMPLOYEE_DIRECTORY_STORAGE_KEY);
    const remoteRows = Array.isArray(result?.data?.payload) ? result.data.payload : [];
    if (!remoteRows.length) return;
    const map = new Map();
    [...jrcReadCustomEmployees(), ...remoteRows].forEach((employee) => {
      const username = String(employee?.username || "").trim().toLowerCase();
      if (username) map.set(username, { ...(map.get(username) || {}), ...employee, username });
    });
    jrcWriteCustomEmployees([...map.values()]);
    window.JRC_EMPLOYEES = jrcGetAllEmployees();
    const currentEmployee = jrcResolveCurrentEmployee();
    jrcEnsureEmployeeSummary();
    jrcRenderEmployeeDirectory(currentEmployee);
    jrcBindEmployeeDirectoryToggle();
    jrcBindEmployeeDirectoryFilters();
    jrcBindEmployeeAddForm(currentEmployee);
  } catch (error) {
    console.warn("Failed to hydrate employee directory", error);
  }
}

function jrcReadSession() {
  try {
    const raw = jrcSafeStorageGet(JRC_AUTH_STORAGE_KEY) || decodeURIComponent(jrcReadCookie(JRC_AUTH_STORAGE_KEY) || "");
    return JSON.parse(raw || "null") || window.JRC_IN_MEMORY_SESSION || null;
  } catch {
    return window.JRC_IN_MEMORY_SESSION || null;
  }
}

function jrcWriteSession(employee, extras = {}) {
  const session = {
    username: employee.username,
    name: employee.name,
    role: employee.role,
    phone: employee.phone || "",
    wechat: employee.wechat || "",
    subject: employee.subject || "",
    scope: employee.scope || "",
    permissions: Array.isArray(employee.permissions) ? employee.permissions : [],
    loginAt: new Date().toISOString(),
    cloudApiToken: extras.cloudApiToken || "",
    cloudTokenExpiresAt: extras.cloudTokenExpiresAt || null,
    cloudLoginAt: extras.cloudApiToken ? new Date().toISOString() : "",
    mustChangePassword: Boolean(extras.mustChangePassword)
  };
  const serialized = JSON.stringify(session);
  const stored = jrcSafeStorageSet(JRC_AUTH_STORAGE_KEY, serialized);
  const cookieStored = jrcWriteCookie(JRC_AUTH_STORAGE_KEY, serialized);
  window.JRC_IN_MEMORY_SESSION = session;
  if (!stored && !cookieStored) {
    throw new Error("浏览器禁止保存登录状态，请换 Safari/Chrome 或关闭无痕模式。");
  }
  return session;
}

function jrcClearSession() {
  jrcSafeStorageRemove(JRC_AUTH_STORAGE_KEY);
  jrcClearCookie(JRC_AUTH_STORAGE_KEY);
}

function jrcResetLegacyBusinessDataOnce() {
  try {
    if (jrcSafeStorageGet(JRC_DATA_FOUNDATION_RESET_KEY)) return;
    const removedKeys = [];
    JRC_LEGACY_BUSINESS_DATA_KEYS.forEach((key) => {
      if (jrcSafeStorageGet(key) === null) return;
      jrcSafeStorageRemove(key);
      removedKeys.push(key);
    });
    jrcSafeStorageSet(JRC_DATA_FOUNDATION_RESET_KEY, JSON.stringify({
      resetAt: new Date().toISOString(),
      reason: "统一门户进入云端数据底座前，清理早期业务数据；保留员工账号、登录状态和权限。",
      removedKeys
    }));
  } catch {
    // Storage cleanup must never block employee login.
  }
}

function jrcReadJsonStore(key, fallback) {
  try {
    const parsed = JSON.parse(jrcSafeStorageGet(key) || "null");
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function jrcMonthFromDate(value) {
  const text = String(value || "").trim();
  const match = text.match(/(\d{4})[-/.年](\d{1,2})/);
  if (!match) return "";
  return `${match[1]}-${String(match[2]).padStart(2, "0")}`;
}

function jrcToNumber(value) {
  const num = Number(String(value ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(num) ? num : 0;
}

function jrcTimeToMinutes(value) {
  const match = String(value || "").match(/(\d{1,2}):(\d{2})/);
  if (!match) return 0;
  return Number(match[1]) * 60 + Number(match[2]);
}

function jrcEstimateHours(row) {
  const direct = jrcToNumber(row.hours || row.classHours || row.lessonHours || row.settlementHours);
  if (direct > 0) return direct;
  const start = jrcTimeToMinutes(row.startTime || row.start || row.beginTime);
  const end = jrcTimeToMinutes(row.endTime || row.end || row.finishTime);
  return start && end && end > start ? Math.round(((end - start) / 60) * 100) / 100 : 0;
}

function jrcCollectScheduleRows() {
  const regular = jrcReadJsonStore("paike-june-system-v1", {});
  const holiday = jrcReadJsonStore("paike-system-prototype-v1", {});
  const preimport = window.JRC_PREIMPORT_BUNDLE || null;
  const rows = [];
  (Array.isArray(regular.scheduleEntries) ? regular.scheduleEntries : []).forEach((entry) => {
    rows.push({
      source: "平时课排课",
      teacherName: String(entry.teacherName || "").trim(),
      studentName: String(entry.studentName || entry.className || "").trim(),
      className: String(entry.className || "").trim(),
      date: entry.courseDate || entry.date,
      period: jrcMonthFromDate(entry.courseDate || entry.date),
      roomName: entry.classroomName || entry.roomName || "",
      hours: jrcEstimateHours(entry),
      status: entry.scheduleStatus || entry.confirmationStatus || ""
    });
  });
  (Array.isArray(holiday.settlementLines) ? holiday.settlementLines : []).forEach((line) => {
    rows.push({
      source: "暑假课结算行",
      teacherName: String(line.teacherName || "").trim(),
      studentName: String(line.studentName || line.className || "").trim(),
      className: String(line.className || "").trim(),
      date: line.courseDate || line.date || line.settlementDate || "",
      period: jrcMonthFromDate(line.courseDate || line.date || line.settlementDate) || String(line.period || ""),
      roomName: line.roomName || "",
      hours: jrcEstimateHours(line),
      status: line.status || ""
    });
  });
  (Array.isArray(preimport?.scheduleSessions) ? preimport.scheduleSessions : []).forEach((session) => {
    const students = Array.isArray(session.studentNames) && session.studentNames.length ? session.studentNames : [session.className || ""];
    students.forEach((studentName) => {
      rows.push({
        source: "Excel已上传排课",
        teacherName: String(session.teacherName || "").trim(),
        studentName: String(studentName || "").trim(),
        className: String(session.lessonTypeRaw || "").trim(),
        date: session.date || "",
        period: session.period || jrcMonthFromDate(session.date),
        roomName: "",
        hours: jrcToNumber(session.hours),
        status: session.status || "待对账",
        importConfidence: session.importConfidence || "已上传",
        sourceId: session.sourceId || ""
      });
    });
  });
  return rows.filter((row) => row.teacherName);
}

function jrcCollectPreimportFinanceRows() {
  const preimport = window.JRC_PREIMPORT_BUNDLE || window.JRC_PREIMPORT_SUMMARY || null;
  if (!preimport) {
    return {
      summary: null,
      expenses: [],
      salaryAttendance: [],
      issues: [],
      teacherMonthPrecheck: []
    };
  }
  return {
    summary: preimport.summary || null,
    expenses: Array.isArray(preimport.expenseRows) ? preimport.expenseRows : [],
    salaryAttendance: Array.isArray(preimport.salaryAttendance) ? preimport.salaryAttendance : [],
    issues: Array.isArray(preimport.reconciliationIssues) ? preimport.reconciliationIssues : [],
    teacherMonthPrecheck: Array.isArray(preimport.teacherMonthPrecheck) ? preimport.teacherMonthPrecheck : []
  };
}

function jrcBuildDerivedTeacherMonthPrecheck(scheduleRows, preimportFinance) {
  const teacherMonth = new Map();

  function ensureMonth(teacherName, period) {
    const key = `${teacherName || "未匹配老师"}|${period || "待定月份"}`;
    if (!teacherMonth.has(key)) {
      teacherMonth.set(key, {
        teacherName: teacherName || "未匹配老师",
        period: period || "待定月份",
        scheduleStudentSessions: 0,
        scheduleHours: 0,
        salaryMarkers: 0,
        matchedMarkers: 0,
        scheduleOnly: 0,
        salaryOnly: 0,
        highPriorityDifferences: 0
      });
    }
    return teacherMonth.get(key);
  }

  scheduleRows
    .filter((row) => row.source === "Excel已上传排课")
    .forEach((row) => {
      const month = ensureMonth(row.teacherName, row.period);
      month.scheduleStudentSessions += 1;
      month.scheduleHours += jrcToNumber(row.hours);
    });

  (preimportFinance.salaryAttendance || []).forEach((row) => {
    const teacherName = String(row.teacherName || row.teacher || "").trim();
    const period = row.period || jrcMonthFromDate(row.date) || "";
    if (!teacherName) return;
    const month = ensureMonth(teacherName, period);
    month.salaryMarkers += 1;
  });

  teacherMonth.forEach((row) => {
    row.matchedMarkers = Math.min(row.scheduleStudentSessions, row.salaryMarkers);
    row.scheduleOnly = Math.max(0, row.scheduleStudentSessions - row.salaryMarkers);
    row.salaryOnly = Math.max(0, row.salaryMarkers - row.scheduleStudentSessions);
    row.highPriorityDifferences = row.scheduleOnly + row.salaryOnly;
    row.scheduleHours = Math.round(row.scheduleHours * 100) / 100;
  });

  return Array.from(teacherMonth.values()).sort((left, right) => {
    return (
      String(left.period || "").localeCompare(String(right.period || "")) ||
      String(left.teacherName || "").localeCompare(String(right.teacherName || ""), "zh-CN")
    );
  });
}

function jrcCollectAdmissionsRows() {
  const state = jrcReadJsonStore("advice-system-stage-prototype", {});
  const leads = Array.isArray(state.leads) ? state.leads : [];
  return leads.map((lead) => ({
    studentName: String(lead.studentName || "").trim(),
    parentPhone: String(lead.parentPhone || "").trim(),
    status: String(lead.status || "").trim(),
    owner: String(lead.owner || "").trim(),
    trialTeacher: String(lead.trialTeacher || "").trim(),
    trialTime: lead.trialTime || lead.trial || "",
    period: jrcMonthFromDate(lead.trialTime || lead.trial || lead.createdAt),
    channel: String(lead.channel || "").trim(),
    referrerName: String(lead.referrerName || "").trim(),
    enrolledAmount: jrcToNumber(lead.enrolledAmount)
  }));
}

function jrcCollectTeachingQualityRows() {
  const state = jrcReadJsonStore("jrc-teaching-quality-system-v2-demo", {});
  const names = new Set();
  (Array.isArray(state.inspections) ? state.inspections : []).forEach((row) => row.teacher && names.add(row.teacher));
  (Array.isArray(state.studentSurveys) ? state.studentSurveys : []).forEach((row) => row.teacher && names.add(row.teacher));
  (Array.isArray(state.parentSurveys) ? state.parentSurveys : []).forEach((row) => row.teacher && names.add(row.teacher));
  (Array.isArray(state.objectiveMetrics) ? state.objectiveMetrics : []).forEach((row) => row.teacher && names.add(row.teacher));

  function avg(values) {
    const valid = values.map(Number).filter((value) => Number.isFinite(value));
    return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : 82;
  }
  function inspectionScore(record) {
    return avg(Array.isArray(record.scores) ? record.scores : []);
  }
  function objectiveScore(metrics = {}) {
    return Math.max(0, Math.min(100, Math.round(
      78 +
      Math.max(0, Number(metrics.renewalRate || 0) - 70) * 0.25 +
      Math.max(0, Number(metrics.trialConversionRate || 0) - 35) * 0.18 +
      Number(metrics.referrals || 0) * 2.5 +
      Math.min(8, Number(metrics.feedbackRecords || 0) * 0.35) -
      Number(metrics.complaints || 0) * 8 -
      Number(metrics.lateRecords || 0) * 4 -
      Number(metrics.missedHomework || 0) * 3 -
      Number(metrics.missedMakeup || 0) * 4
    )));
  }

  return Array.from(names).filter(Boolean).map((teacherName) => {
    const inspection = avg((state.inspections || []).filter((row) => row.teacher === teacherName).map(inspectionScore));
    const studentSurvey = avg((state.studentSurveys || []).filter((row) => row.teacher === teacherName).map((row) => row.score));
    const parentSurvey = avg((state.parentSurveys || []).filter((row) => row.teacher === teacherName).map((row) => row.score));
    const objective = objectiveScore((state.objectiveMetrics || []).find((row) => row.teacher === teacherName));
    const total = Math.round((inspection * 0.35 + studentSurvey * 0.20 + parentSurvey * 0.35 + objective * 0.10) * 10) / 10;
    const grade = total >= 90 ? "S" : total >= 80 ? "A" : total >= 70 ? "B" : "C";
    return { teacherName, total, grade, coefficient: JRC_QUALITY_COEFFICIENTS[grade] };
  });
}

function jrcDeriveSystemLinks() {
  const schedules = jrcCollectScheduleRows();
  const admissions = jrcCollectAdmissionsRows();
  const quality = jrcCollectTeachingQualityRows();
  const preimportFinance = jrcCollectPreimportFinanceRows();
  const effectiveTeacherMonthPrecheck = jrcBuildDerivedTeacherMonthPrecheck(schedules, preimportFinance);
  const employees = jrcGetAllEmployees();
  const qualityByTeacher = new Map(quality.map((row) => [row.teacherName, row]));
  const employeeByName = new Map(employees.map((employee) => [employee.name, employee]));
  const teacherMonth = new Map();

  function ensureTeacherMonth(teacherName, period) {
    const key = `${teacherName || "未匹配老师"}|${period || "待定月份"}`;
    if (!teacherMonth.has(key)) {
      const employee = employeeByName.get(teacherName) || {};
      const qualityRow = qualityByTeacher.get(teacherName) || {};
      const financeExcluded = JRC_FINANCE_EXCLUDED_TEACHERS.includes(teacherName);
      teacherMonth.set(key, {
        teacherName: teacherName || "未匹配老师",
        period: period || "待定月份",
        financeExcluded,
        financeScope: financeExcluded ? "单独核算，不进入财务系统" : "进入财务系统结算草表",
        scheduledHours: 0,
        preimportStudentSessions: 0,
        preimportIssueCount: 0,
        preimportHighIssueCount: 0,
        salaryMarkerCount: 0,
        matchedSalaryMarkerCount: 0,
        trialCount: 0,
        enrolledAmount: 0,
        commissionRate: employee.commissionRate || "",
        qualityGrade: qualityRow.grade || "",
        qualityCoefficient: qualityRow.coefficient || 1
      });
    }
    return teacherMonth.get(key);
  }

  schedules.forEach((row) => {
    const month = ensureTeacherMonth(row.teacherName, row.period);
    month.scheduledHours += row.hours;
    if (row.source === "Excel已上传排课") month.preimportStudentSessions += 1;
  });
  effectiveTeacherMonthPrecheck.forEach((precheck) => {
    const month = ensureTeacherMonth(precheck.teacherName, precheck.period);
    month.preimportStudentSessions = Math.max(month.preimportStudentSessions, jrcToNumber(precheck.scheduleStudentSessions));
    month.preimportIssueCount = Math.max(month.preimportIssueCount, jrcToNumber(precheck.scheduleOnly) + jrcToNumber(precheck.salaryOnly));
    month.preimportHighIssueCount = Math.max(month.preimportHighIssueCount, jrcToNumber(precheck.highPriorityDifferences));
    month.salaryMarkerCount = Math.max(month.salaryMarkerCount, jrcToNumber(precheck.salaryMarkers));
    month.matchedSalaryMarkerCount = Math.max(month.matchedSalaryMarkerCount, jrcToNumber(precheck.matchedMarkers));
  });
  admissions.forEach((lead) => {
    if (lead.trialTeacher) {
      const row = ensureTeacherMonth(lead.trialTeacher, lead.period);
      row.trialCount += lead.status.includes("试听") || lead.status.includes("报名") ? 1 : 0;
      row.enrolledAmount += lead.enrolledAmount;
    }
  });

  return {
    generatedAt: new Date().toISOString(),
    contracts: JSON.parse(JSON.stringify(JRC_DATA_CONTRACTS)),
    rules: JSON.parse(JSON.stringify(JRC_DATA_LINK_RULES)),
    counts: {
      scheduleRows: schedules.length,
      admissionsRows: admissions.length,
      teachingQualityTeachers: quality.length,
      employees: employees.length
      ,
      preimportScheduleSessions: preimportFinance.summary?.scheduleSessionCount || 0,
      preimportSalaryMarkers: preimportFinance.salaryAttendance?.length || preimportFinance.summary?.salaryAttendanceCount || 0,
      preimportExpenseRows: preimportFinance.summary?.expenseRowCount || 0,
      preimportHighIssues: effectiveTeacherMonthPrecheck.reduce((sum, row) => sum + jrcToNumber(row.highPriorityDifferences), 0)
    },
    teacherMonthRows: Array.from(teacherMonth.values()).map((row) => ({
      ...row,
      scheduledHours: Math.round(row.scheduledHours * 100) / 100,
      financeBasis: row.financeExcluded
        ? "程志豪、海滢滢、姚老师名下学生单独核算：可进入招生和学生服务，不进入财务系统自动结算。"
        : `${row.scheduledHours ? `课时 ${Math.round(row.scheduledHours * 100) / 100}` : "暂无课时"}；${row.preimportStudentSessions ? `Excel已上传 ${row.preimportStudentSessions} 人次，待核 ${row.preimportIssueCount} 条` : "暂无Excel上传"}；教学系数 ${row.qualityCoefficient || 1}；招生实收 ${row.enrolledAmount || 0}`
    })),
    pendingLinks: {
      trialScheduleCandidates: admissions.filter((lead) => lead.status === "已预约试听"),
      enrolledStudentCandidates: admissions.filter((lead) => lead.status === "定金 / 已报名" || lead.enrolledAmount > 0),
      financeAttributionCandidates: admissions.filter((lead) => lead.enrolledAmount > 0 && lead.requiresFinance !== false && !["程老师班课", "科学班课"].includes(String(lead.courseProduct || "").trim())),
      preimportScheduleSessions: schedules.filter((row) => row.source === "Excel已上传排课"),
      preimportFinanceExpenses: preimportFinance.expenses,
      preimportReconciliationIssues: preimportFinance.issues
    },
    preimport: {
      ...preimportFinance,
      teacherMonthPrecheck: effectiveTeacherMonthPrecheck
    }
  };
}

function jrcExposeDataFoundation() {
  window.JRC_DATA_FOUNDATION = {
    resetKey: JRC_DATA_FOUNDATION_RESET_KEY,
    legacyBusinessDataKeys: [...JRC_LEGACY_BUSINESS_DATA_KEYS],
    linkRules: JSON.parse(JSON.stringify(JRC_DATA_LINK_RULES)),
    contracts: JSON.parse(JSON.stringify(JRC_DATA_CONTRACTS)),
    deriveSystemLinks: jrcDeriveSystemLinks,
    readResetState() {
      try {
        return JSON.parse(localStorage.getItem(JRC_DATA_FOUNDATION_RESET_KEY) || "null");
      } catch {
        return null;
      }
    }
  };
}

function jrcNormalizeUsername(username) {
  return String(username || "").trim().toLowerCase();
}

function jrcNormalizeName(name) {
  return String(name || "").trim();
}

function jrcIsSuperAdmin(subject) {
  if (!subject) return false;
  const username = jrcNormalizeUsername(typeof subject === "string" ? subject : subject.username);
  const name = jrcNormalizeName(typeof subject === "string" ? "" : subject.name);
  return JRC_SUPER_ADMIN_USERNAMES.includes(username) || JRC_SUPER_ADMIN_NAMES.includes(name);
}

function jrcFindEmployeeByUsername(username) {
  const normalizedUsername = jrcNormalizeUsername(username);
  return jrcGetAllEmployees().find((employee) => employee.username === normalizedUsername);
}

function jrcResolveCurrentEmployee() {
  const session = jrcReadSession();
  if (!session?.username) return null;
  const username = jrcNormalizeUsername(session.username);
  if (JRC_DEPARTED_EMPLOYEE_USERNAMES.has(username)) return null;
  const employee = jrcFindEmployeeByUsername(username);
  if (employee) return employee;
  return {
    username,
    name: session.name || username,
    role: session.role || "授课老师",
    phone: session.phone || "",
    wechat: session.wechat || "",
    subject: session.subject || "",
    scope: session.scope || "",
    permissions: Array.isArray(session.permissions) ? session.permissions : []
  };
}

function jrcGetPermissions(subject) {
  if (!subject) return [];
  if (typeof subject === "string") {
    return JRC_ROLE_PERMISSIONS[subject] || [];
  }

  const permissions = new Set(JRC_ROLE_PERMISSIONS[subject.role] || []);
  const username = jrcNormalizeUsername(subject.username);

  if (!username) return Array.from(permissions);

  permissions.add("portal.access");
  permissions.add("paike.access");
  permissions.add("suggestions.access");
  permissions.add("campus.access");

  if (subject.role === "学管") {
    permissions.add("knowledge.access");
  }

  if (jrcRoleDirectoryMemberNames().has(jrcNormalizeName(subject.name))) {
    permissions.add("knowledge.access");
  }

  if (subject.role === "授课老师") {
    permissions.add("studentService.access");
    permissions.add("curriculum.access");
    permissions.add("curriculum.create");
    permissions.add("curriculum.update");
    permissions.add("curriculum.import");
    permissions.add("curriculum.export");
    permissions.add("campus.access");
  }

  if (subject.role === "学管") {
    permissions.add("admissions.access");
    permissions.add("admissions.edit");
    permissions.add("admissions.import");
    permissions.add("admissions.export");
    permissions.add("teachingQuality.access");
    permissions.add("teachingQuality.edit");
    permissions.add("studentService.access");
    permissions.add("studentService.edit");
    permissions.add("curriculum.access");
    permissions.add("curriculum.create");
    permissions.add("curriculum.update");
    permissions.add("curriculum.import");
    permissions.add("curriculum.export");
    permissions.add("campus.access");
    permissions.add("campus.edit");
  }

  if (jrcIsSuperAdmin(subject)) {
    [
      "portal.access",
      "paike.access",
      "paike.edit",
      "knowledge.access",
      "knowledge.edit",
      "suggestions.access",
      "suggestions.edit",
      "admissions.access",
      "admissions.edit",
      "admissions.import",
      "admissions.export",
      "admissions.finance",
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
      "finance.access",
      "finance.edit",
      "admin.access"
    ].forEach((permission) => permissions.add(permission));
  }

  if (JRC_PAIKE_ADMIN_USERNAMES.includes(username)) {
    permissions.add("paike.access");
    permissions.add("paike.edit");
  }
  if (JRC_KNOWLEDGE_ADMIN_USERNAMES.includes(username)) {
    permissions.add("knowledge.access");
    permissions.add("knowledge.edit");
  }
  if (JRC_SUGGESTION_ADMIN_USERNAMES.includes(username)) {
    permissions.add("suggestions.access");
    permissions.add("suggestions.edit");
  }
  if (JRC_ADMISSIONS_ADMIN_USERNAMES.includes(username)) {
    permissions.add("admissions.access");
    permissions.add("admissions.edit");
    permissions.add("admissions.import");
    permissions.add("admissions.export");
    permissions.add("admissions.finance");
  }
  if (JRC_FINANCE_ADMIN_USERNAMES.includes(username)) {
    permissions.add("finance.access");
    permissions.add("finance.edit");
  }
  if (JRC_CURRICULUM_ADMIN_USERNAMES.includes(username)) {
    permissions.add("curriculum.access");
    permissions.add("curriculum.edit");
  }
  if (JRC_TEACHING_QUALITY_ADMIN_USERNAMES.includes(username)) {
    permissions.add("teachingQuality.access");
    permissions.add("teachingQuality.edit");
  }
  if (JRC_STUDENT_SERVICE_ADMIN_USERNAMES.includes(username)) {
    permissions.add("studentService.access");
    permissions.add("studentService.edit");
  }
  if (JRC_VIDEO_OPS_ADMIN_USERNAMES.includes(username) || JRC_VIDEO_OPS_ADMIN_NAMES.includes(jrcNormalizeName(subject.name))) {
    permissions.add("videoOps.access");
    permissions.add("videoOps.edit");
  }
  (subject.permissions || []).forEach((permission) => permissions.add(permission));
  jrcExpandGranularPermissions(permissions);

  return Array.from(permissions);
}

function jrcHasPermission(permissionKey, employee = jrcResolveCurrentEmployee()) {
  if (!employee) return false;
  return jrcGetPermissions(employee).includes(permissionKey);
}

function jrcGetPermissionHint(permissionKey, employee = jrcResolveCurrentEmployee()) {
  const role = employee?.role || "当前岗位";
  const hints = {
    "knowledge.access": "学管知识库系统主要给学管、管理员和相关培训人员使用。",
    "finance.access": "财务系统只给财务和总管理员使用，避免收入、成本和分红数据被误改。",
    "admissions.access": "招生管理系统主要给学管和招生相关管理员使用。",
    "hr.access": "人事管理涉及员工档案和权限，仅总管理员使用。",
    "campus.access": "校区运营已开放查看；修改值班和校区事务仅限程志豪、陈雨晴。",
    "videoOps.access": "短视频系统主要给管理员、学管和运营负责人使用。",
    "paike.edit": "排课修改权限只给排课管理员开放，其他老师可以查看课表。",
    "admin.access": "该入口仅总管理员可用。"
  };
  return hints[permissionKey] || `${role}账号未开通此入口。需要开通时，由管理员在校区运营与人事系统里调整权限。`;
}

function jrcGetRoleSummary(employee = jrcResolveCurrentEmployee()) {
  if (!employee) return "";
  const permissions = jrcGetPermissions(employee);
  const summaries = [];
  if (permissions.includes("paike.access")) summaries.push("排课");
  if (permissions.includes("admissions.access")) summaries.push("招生");
  if (permissions.includes("teachingQuality.access")) summaries.push("教学质量");
  if (permissions.includes("studentService.access")) summaries.push("学生服务");
  if (permissions.includes("curriculum.access")) summaries.push("教研课程");
  if (permissions.includes("hr.access")) summaries.push("人事管理");
  if (permissions.includes("campus.access")) summaries.push("校区运营");
  if (permissions.includes("finance.access")) summaries.push("财务");
  if (permissions.includes("knowledge.access")) summaries.push("学管知识库");
  if (permissions.includes("suggestions.access")) summaries.push("建议");
  if (permissions.includes("videoOps.access")) summaries.push("短视频运营");
  return summaries.join(" / ") || "仅登录访问";
}

function jrcCanManageEmployees(employee = jrcResolveCurrentEmployee()) {
  return jrcIsSuperAdmin(employee);
}

function jrcShowPasswordChangeDialog(currentEmployee) {
  document.querySelector(".jrc-password-overlay")?.remove();
  const overlay = document.createElement("div");
  overlay.className = "jrc-password-overlay";
  overlay.innerHTML = `
    <div class="jrc-password-dialog" role="dialog" aria-modal="true" aria-labelledby="jrcPasswordTitle">
      <div class="jrc-password-dialog__head">
        <div>
          <p>Account Security</p>
          <h2 id="jrcPasswordTitle">修改登录密码</h2>
        </div>
        <button type="button" class="jrc-password-close" aria-label="关闭">×</button>
      </div>
      <form id="jrcPasswordChangeForm" class="jrc-password-form">
        <label>
          当前账号
          <input value="${currentEmployee.name}（${currentEmployee.username}）" disabled>
        </label>
        <label>
          旧密码
          <input id="jrcCurrentPasswordInput" type="password" autocomplete="current-password" placeholder="请输入旧密码">
        </label>
        <label>
          新密码
          <input id="jrcNewPasswordInput" type="password" autocomplete="new-password" placeholder="至少 8 位">
        </label>
        <label>
          确认新密码
          <input id="jrcConfirmPasswordInput" type="password" autocomplete="new-password" placeholder="再输入一次">
        </label>
        <div id="jrcPasswordMessage" class="jrc-password-message"></div>
        <div class="jrc-password-actions">
          <button type="button" class="jrc-password-secondary">取消</button>
          <button type="submit" class="jrc-password-primary">保存新密码</button>
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) close();
  });
  overlay.querySelector(".jrc-password-close")?.addEventListener("click", close);
  overlay.querySelector(".jrc-password-secondary")?.addEventListener("click", close);
  overlay.querySelector("#jrcPasswordChangeForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const message = overlay.querySelector("#jrcPasswordMessage");
    const submitButton = overlay.querySelector(".jrc-password-primary");
    const currentPassword = overlay.querySelector("#jrcCurrentPasswordInput")?.value || "";
    const newPassword = overlay.querySelector("#jrcNewPasswordInput")?.value || "";
    const confirmPassword = overlay.querySelector("#jrcConfirmPasswordInput")?.value || "";
    const setMessage = (text, good = false) => {
      if (!message) return;
      message.textContent = text;
      message.classList.toggle("jrc-password-message--success", good);
    };

    if (!currentPassword || !newPassword || !confirmPassword) {
      setMessage("请把旧密码和新密码填写完整。");
      return;
    }
    if (newPassword.length < 8) {
      setMessage("新密码至少 8 位。");
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage("两次输入的新密码不一致。");
      return;
    }
    if (!window.JRC_CLOUD?.changePassword) {
      setMessage("云端接口未加载，暂时不能修改密码。");
      return;
    }

    try {
      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = "正在保存...";
      }
      const result = await window.JRC_CLOUD.changePassword(currentPassword, newPassword);
      if (!result.ok || !result.data?.ok) {
        setMessage(result.data?.message || "修改失败，请确认旧密码是否正确。");
        return;
      }
      jrcWriteSession(result.data.employee || currentEmployee, {
        cloudApiToken: result.data.token || jrcReadSession()?.cloudApiToken || "",
        cloudTokenExpiresAt: result.data.expiresAt || null,
        mustChangePassword: false
      });
      window.JRC_CURRENT_EMPLOYEE = result.data.employee || currentEmployee;
      setMessage("密码已修改，下次请使用新密码登录。", true);
      setTimeout(close, 900);
    } catch (error) {
      setMessage(`修改失败：${String(error?.message || error)}`);
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = "保存新密码";
      }
    }
  });
}

function jrcEnsureTopbar(currentEmployee) {
  const session = jrcReadSession() || {};
  const topbar = document.createElement("div");
  topbar.className = "jrc-auth-bar";
  topbar.innerHTML = `
    <div class="jrc-auth-bar__inner">
      <div>
        <strong>${currentEmployee.name}</strong>
        <span>${currentEmployee.role} · ${currentEmployee.username} · 已开放：${jrcGetRoleSummary(currentEmployee)}</span>
      </div>
      <div class="jrc-auth-bar__actions">
        <button type="button" id="jrcChangePasswordButton">修改密码</button>
        <button type="button" id="jrcLogoutButton">退出登录</button>
      </div>
    </div>
    ${session.mustChangePassword ? `
      <div class="jrc-password-reminder">
        <strong>请尽快修改初始密码</strong>
        <span>当前账号仍在使用统一初始密码。为避免其他人误登，请点击右侧修改。</span>
        <button type="button" id="jrcPasswordReminderButton">立即修改密码</button>
      </div>
    ` : ""}
  `;
  document.body.prepend(topbar);
  const openPasswordDialog = () => {
    jrcShowPasswordChangeDialog(currentEmployee);
  };
  document.getElementById("jrcChangePasswordButton")?.addEventListener("click", openPasswordDialog);
  document.getElementById("jrcPasswordReminderButton")?.addEventListener("click", openPasswordDialog);
  document.getElementById("jrcLogoutButton")?.addEventListener("click", () => {
    jrcClearSession();
    window.location.reload();
  });
}

function jrcEnsureEmployeeSummary() {
  const holder = document.querySelector("[data-employee-summary]");
  if (!holder) return;
  const employeeCount = jrcGetAllEmployees().length;

  if (!document.querySelector("[data-employee-directory]")) {
    const panel = document.createElement("div");
    panel.className = "auth-note";
    panel.hidden = true;
    panel.setAttribute("data-employee-directory", "");
    holder.insertAdjacentElement("afterend", panel);
  }

  holder.innerHTML = `
    <div class="jrc-employee-summary__head">
      <strong>当前已录入 ${employeeCount} 名员工账号</strong>
      <button type="button" class="jrc-employee-directory-toggle" data-employee-directory-toggle>在职员工名单</button>
    </div>
  `;
}

function jrcRenderEmployeeDirectory(currentEmployee = jrcResolveCurrentEmployee()) {
  const holder = document.querySelector("[data-employee-directory]");
  if (!holder) return;

  const allEmployees = jrcGetAllEmployees();
  const rows = allEmployees.map((employee) => {
    const tags = [
      employee.role || "",
      employee.subject || employee.scope || "",
      employee.commissionRate ? `提成 ${employee.commissionRate}` : "",
      employee.permissions?.length ? `自定义权限 ${employee.permissions.length} 项` : ""
    ].filter(Boolean);

    return `
      <article class="jrc-employee-card" data-employee-name="${[employee.name, employee.username, employee.phone, employee.wechat, employee.subject, employee.scope].filter(Boolean).join(" ").toLowerCase()}" data-employee-role="${(employee.role || "").toLowerCase()}">
        <div class="jrc-employee-card__head">
          <div>
            <strong>${employee.name}</strong>
            <span>@${employee.username}</span>
          </div>
          <div class="jrc-employee-card__tags">
            ${tags.map((tag) => `<span>${tag}</span>`).join("")}
          </div>
        </div>
        <dl class="jrc-employee-card__meta">
          <div><dt>手机号</dt><dd>${employee.phone || "-"}</dd></div>
          <div><dt>微信号</dt><dd>${employee.wechat || "-"}</dd></div>
          <div><dt>负责范围</dt><dd>${employee.scope || "-"}</dd></div>
          <div><dt>入职日期</dt><dd>${employee.hireDate || "-"}</dd></div>
          <div><dt>转正日期</dt><dd>${employee.regularDate || "-"}</dd></div>
        </dl>
        ${jrcCanManageEmployees(currentEmployee) ? `
          <div class="jrc-employee-card__actions">
            <button type="button" class="jrc-employee-edit-button" data-employee-edit="${employee.username}">编辑资料</button>
          </div>
        ` : ""}
      </article>
    `;
  }).join("");

  holder.innerHTML = `
    <div class="jrc-employee-directory__head">
      <strong>在职员工名单</strong>
      <span>${jrcCanManageEmployees(currentEmployee) ? "可新增和维护员工账号。" : "员工基础信息。"}</span>
    </div>
    <div class="jrc-employee-directory__tools">
      <input type="search" class="jrc-employee-search" data-employee-search placeholder="搜索姓名 / 拼音 / 手机 / 微信">
      <select class="jrc-employee-filter" data-employee-role-filter>
        <option value="">全部岗位</option>
        <option value="管理员">管理员</option>
        <option value="学管">学管</option>
        <option value="试用期学管">试用期学管</option>
        <option value="财务">财务</option>
        <option value="授课老师">授课老师</option>
        <option value="试用期老师">试用期老师</option>
      </select>
    </div>
    <div class="jrc-employee-grid">${rows}</div>
    <div class="jrc-employee-directory__footer">
      ${jrcCanManageEmployees(currentEmployee) ? `
        <button type="button" class="jrc-employee-add-placeholder" data-employee-add-toggle>新增员工</button>
        <span>可新增员工，也可点员工卡片里的“编辑资料”补全已有员工信息。</span>
      ` : `
        <button type="button" class="jrc-employee-add-placeholder">新增员工入口（仅管理员）</button>
        <span>后面正式接管理员录入后，这里会直接新增员工姓名、岗位、手机号、权限和初始账号。</span>
      `}
    </div>
    ${jrcCanManageEmployees(currentEmployee) ? `
      <form class="jrc-employee-form" data-employee-form hidden>
        <div class="jrc-employee-form__grid">
          <label><span>老师姓名</span><input name="name" required></label>
          <label><span>用户名拼音</span><input name="username" required></label>
          <label><span>岗位</span>
            <select name="role">
              <option value="学管">学管</option>
              <option value="试用期学管">试用期学管</option>
              <option value="财务">财务</option>
              <option value="授课老师">授课老师</option>
              <option value="试用期老师">试用期老师</option>
              <option value="管理员">管理员</option>
            </select>
          </label>
          <label><span>手机号</span><input name="phone"></label>
          <label><span>微信号</span><input name="wechat"></label>
          <label><span>负责范围</span><input name="scope"></label>
          <label><span>任教学科</span><input name="subject"></label>
          <label><span>入职日期</span><input name="hireDate" placeholder="2026-06-21"></label>
          <label><span>转正日期</span><input name="regularDate" placeholder="2026-07-21"></label>
          <label><span>提成比例</span><input name="commissionRate" placeholder="20%"></label>
        </div>
        <div class="jrc-employee-permission-box">
          <div class="jrc-employee-permission-box__head">
            <strong>系统权限</strong>
            <span>岗位会自动带基础权限；这里可以给新员工额外开放系统或修改能力。</span>
          </div>
          <div class="jrc-employee-permission-grid">
            ${JRC_PERMISSION_OPTIONS.map(([key, label]) => `
              <label>
                <input type="checkbox" name="permissions" value="${key}">
                <span>${label}</span>
              </label>
            `).join("")}
          </div>
        </div>
        <div class="jrc-employee-form__actions">
          <button type="submit" class="jrc-employee-form__submit" data-employee-form-submit>保存新增员工</button>
          <span data-employee-form-message>保存后自动使用统一初始密码 10281028。</span>
        </div>
      </form>
    ` : ""}
  `;
}

function jrcBindEmployeeDirectoryToggle() {
  const button = document.querySelector("[data-employee-directory-toggle]");
  const panel = document.querySelector("[data-employee-directory]");
  if (!button || !panel) return;

  button.setAttribute("aria-expanded", "false");
  button.addEventListener("click", () => {
    const expanded = button.getAttribute("aria-expanded") === "true";
    const nextExpanded = !expanded;
    panel.hidden = !nextExpanded;
    button.setAttribute("aria-expanded", String(nextExpanded));
    button.textContent = nextExpanded ? "收起名单" : "全员名单";
  });
}

function jrcBindEmployeeDirectoryFilters() {
  const panel = document.querySelector("[data-employee-directory]");
  const search = document.querySelector("[data-employee-search]");
  const roleFilter = document.querySelector("[data-employee-role-filter]");
  if (!panel || !search || !roleFilter) return;

  const applyFilter = () => {
    const keyword = search.value.trim().toLowerCase();
    const role = roleFilter.value.trim().toLowerCase();

    panel.querySelectorAll(".jrc-employee-card").forEach((card) => {
      const haystack = card.getAttribute("data-employee-name") || "";
      const cardRole = card.getAttribute("data-employee-role") || "";
      const matchKeyword = !keyword || haystack.includes(keyword);
      const matchRole = !role || cardRole === role;
      card.hidden = !(matchKeyword && matchRole);
    });
  };

  search.addEventListener("input", applyFilter);
  roleFilter.addEventListener("change", applyFilter);
}

function jrcBindEmployeeAddForm(currentEmployee = jrcResolveCurrentEmployee()) {
  if (!jrcCanManageEmployees(currentEmployee)) return;

  const toggle = document.querySelector("[data-employee-add-toggle]");
  const form = document.querySelector("[data-employee-form]");
  const message = document.querySelector("[data-employee-form-message]");
  const submitButton = document.querySelector("[data-employee-form-submit]");
  if (!toggle || !form || !message) return;

  const setFormMode = (employee = null) => {
    const editing = Boolean(employee?.username);
    form.dataset.editingUsername = editing ? String(employee.username || "").trim().toLowerCase() : "";
    form.removeAttribute("hidden");
    toggle.textContent = "收起员工表单";
    if (submitButton) submitButton.textContent = editing ? "保存员工资料" : "保存新增员工";
    message.textContent = editing ? `正在编辑 ${employee.name || employee.username}，保存后会按用户名覆盖补全资料。` : "保存后自动使用统一初始密码 10281028。";
    if (!editing) {
      form.reset();
      form.querySelector("[name='username']")?.removeAttribute("readonly");
      return;
    }
    const fields = ["name", "username", "role", "phone", "wechat", "scope", "subject", "hireDate", "regularDate", "commissionRate"];
    fields.forEach((field) => {
      const input = form.querySelector(`[name='${field}']`);
      if (input) input.value = employee[field] || "";
    });
    form.querySelector("[name='username']")?.setAttribute("readonly", "readonly");
    const permissions = Array.isArray(employee.permissions) ? employee.permissions : [];
    form.querySelectorAll("[name='permissions']").forEach((input) => {
      input.checked = permissions.includes(input.value);
    });
    form.scrollIntoView({ block: "center", behavior: "smooth" });
  };

  toggle.addEventListener("click", () => {
    const hidden = form.hasAttribute("hidden");
    if (hidden) {
      setFormMode(null);
    } else {
      form.setAttribute("hidden", "");
      form.dataset.editingUsername = "";
      toggle.textContent = "新增员工";
    }
  });

  document.querySelectorAll("[data-employee-edit]").forEach((button) => {
    button.addEventListener("click", () => {
      const username = String(button.getAttribute("data-employee-edit") || "").trim().toLowerCase();
      const employee = jrcGetAllEmployees().find((item) => String(item.username || "").trim().toLowerCase() === username);
      if (employee) setFormMode(employee);
    });
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const editingUsername = String(form.dataset.editingUsername || "").trim().toLowerCase();
    const username = editingUsername || String(formData.get("username") || "").trim().toLowerCase();
    const name = String(formData.get("name") || "").trim();

    if (!name || !username) {
      message.textContent = "老师姓名和用户名拼音必须填写。";
      return;
    }
    if (!editingUsername && jrcFindEmployeeByUsername(username)) {
      message.textContent = "这个用户名已经存在，请换一个拼音。";
      return;
    }

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = "正在保存...";
    }
    const customEmployees = jrcReadCustomEmployees();
    const permissions = formData.getAll("permissions").map((permission) => String(permission).trim()).filter(Boolean);
    const existing = jrcFindEmployeeByUsername(username) || {};
    const row = {
      ...existing,
      name,
      username,
      password: existing.password || JRC_INITIAL_PASSWORD,
      role: String(formData.get("role") || "授课老师").trim(),
      phone: String(formData.get("phone") || "").trim(),
      wechat: String(formData.get("wechat") || "").trim(),
      scope: String(formData.get("scope") || "").trim(),
      hireDate: String(formData.get("hireDate") || "").trim(),
      regularDate: String(formData.get("regularDate") || "").trim(),
      subject: String(formData.get("subject") || "").trim(),
      commissionRate: String(formData.get("commissionRate") || "").trim(),
      permissions
    };
    const index = customEmployees.findIndex((employee) => String(employee.username || "").trim().toLowerCase() === username);
    if (index >= 0) customEmployees[index] = { ...customEmployees[index], ...row };
    else customEmployees.push(row);
    jrcWriteCustomEmployees(customEmployees);
    jrcSyncCustomEmployeesToCloud(customEmployees);
    const cloudResult = await jrcSyncEmployeeAccountToCloud(row, { resetPassword: !editingUsername });
    window.JRC_EMPLOYEES = jrcGetAllEmployees();
    const cloudMessage = cloudResult?.ok
      ? "云端登录账号已同步。"
      : cloudResult?.skipped
        ? "云端账号接口未启用，已先保存到员工名单。"
        : "员工名单已保存，但云端登录账号同步失败，请稍后再保存一次。";
    message.textContent = editingUsername ? `已保存 ${name} 的员工资料。${cloudMessage}` : `已新增 ${name}，初始密码 10281028。${cloudMessage}`;
    form.reset();
    form.dataset.editingUsername = "";
    jrcEnsureEmployeeSummary();
    jrcRenderEmployeeDirectory(currentEmployee);
    jrcBindEmployeeDirectoryToggle();
    jrcBindEmployeeDirectoryFilters();
    jrcBindEmployeeAddForm(currentEmployee);
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = "保存新增员工";
    }
  });
}

function jrcMarkEmployeeDeparted(employeeName, options = {}) {
  const name = String(employeeName || "").trim();
  if (!name) return { ok: false, message: "未提供员工姓名。" };
  const allEmployees = [
    ...JRC_EMPLOYEES,
    ...jrcReadCustomEmployees()
  ];
  const target = allEmployees.find((employee) => String(employee.name || "").trim() === name);
  if (!target) return { ok: false, message: `没有找到 ${name} 的员工档案。` };
  const username = String(target.username || "").trim().toLowerCase();
  const customEmployees = jrcReadCustomEmployees();
  const index = customEmployees.findIndex((employee) => String(employee.username || "").trim().toLowerCase() === username);
  const row = {
    ...target,
    ...(index >= 0 ? customEmployees[index] : {}),
    username,
    employmentStatus: "departed",
    status: "离职",
    accountStatus: "disabled",
    departedAt: options.departedAt || new Date().toISOString(),
    departedReason: options.reason || "人事离职事项保存",
    permissions: []
  };
  if (index >= 0) customEmployees[index] = row;
  else customEmployees.push(row);
  jrcWriteCustomEmployees(customEmployees);
  jrcSyncCustomEmployeesToCloud(customEmployees);
  window.JRC_EMPLOYEES = jrcGetAllEmployees();
  const currentEmployee = jrcResolveCurrentEmployee();
  jrcEnsureEmployeeSummary();
  jrcRenderEmployeeDirectory(currentEmployee);
  jrcBindEmployeeDirectoryToggle();
  jrcBindEmployeeDirectoryFilters();
  jrcBindEmployeeAddForm(currentEmployee);
  window.dispatchEvent(new CustomEvent("jrc-employee-directory-updated", { detail: { action: "departed", employee: row } }));
  return { ok: true, employee: row, message: `${name} 已从在职员工名单移出，并标记为离职。` };
}

async function jrcUpsertEmployeeFromHr(row = {}, options = {}) {
  const name = String(row.name || row.employee || "").trim();
  if (!name) return { ok: false, message: "员工姓名不能为空。" };
  const phone = String(row.phone || "").trim();
  const role = String(row.role || "授课老师").trim() || "授课老师";
  const baseUsername = String(row.username || phone || name).trim().toLowerCase().replace(/\s+/g, "");
  const username = baseUsername || `${Date.now()}`;
  const customEmployees = jrcReadCustomEmployees();
  const customIndexByUsername = customEmployees.findIndex((employee) => String(employee.username || "").trim().toLowerCase() === username);
  const customIndexByIdentity = customEmployees.findIndex((employee) => {
    const sameName = String(employee.name || "").trim() === name;
    const samePhone = phone && String(employee.phone || "").trim() === phone;
    return sameName || samePhone;
  });
  const customIndex = customIndexByUsername >= 0 ? customIndexByUsername : customIndexByIdentity;
  const existing = jrcFindEmployeeByUsername(username)
    || (customIndex >= 0 ? customEmployees[customIndex] : null)
    || jrcGetAllEmployees().find((employee) => {
      const sameName = String(employee.name || "").trim() === name;
      const samePhone = phone && String(employee.phone || "").trim() === phone;
      return sameName || samePhone;
    })
    || {};
  const payload = {
    ...existing,
    name,
    username,
    password: existing.password || JRC_INITIAL_PASSWORD,
    role,
    phone,
    wechat: String(row.wechat || existing.wechat || "").trim(),
    scope: String(row.scope || existing.scope || "").trim(),
    subject: String(row.subject || existing.subject || "").trim(),
    hireDate: String(row.hireDate || existing.hireDate || "").trim(),
    regularDate: String(row.regularDate || existing.regularDate || "").trim(),
    commissionRate: String(row.commissionRate || existing.commissionRate || "").trim(),
    employmentStatus: "active",
    status: "在职",
    accountStatus: "active",
    permissions: Array.isArray(row.permissions) ? row.permissions : []
  };
  if (customIndex >= 0) customEmployees[customIndex] = { ...customEmployees[customIndex], ...payload };
  else customEmployees.push(payload);
  jrcWriteCustomEmployees(customEmployees);
  jrcSyncCustomEmployeesToCloud(customEmployees);
  const cloudResult = await jrcSyncEmployeeAccountToCloud(payload, { resetPassword: options.resetPassword !== false && !existing.username });
  window.JRC_EMPLOYEES = jrcGetAllEmployees();
  const currentEmployee = jrcResolveCurrentEmployee();
  jrcEnsureEmployeeSummary();
  jrcRenderEmployeeDirectory(currentEmployee);
  jrcBindEmployeeDirectoryToggle();
  jrcBindEmployeeDirectoryFilters();
  jrcBindEmployeeAddForm(currentEmployee);
  window.dispatchEvent(new CustomEvent("jrc-employee-directory-updated", { detail: { action: "upsert", employee: payload } }));
  return {
    ok: true,
    employee: payload,
    cloudResult,
    message: `${name} 已加入全员名单，登录账号 ${username}，初始密码 ${JRC_INITIAL_PASSWORD}。`
  };
}

function jrcApplyPermissionDecorations(currentEmployee) {
  document.querySelectorAll("[data-requires-permission]").forEach((node) => {
    const permission = node.getAttribute("data-requires-permission");
    if (!permission) return;
    const allowed = jrcHasPermission(permission, currentEmployee);
    if (allowed) return;

    const isLink = node.tagName === "A";
    node.classList.add("jrc-locked");
    node.setAttribute("aria-disabled", "true");
    node.setAttribute("title", jrcGetPermissionHint(permission, currentEmployee));
    if (isLink) {
      node.setAttribute("data-jrc-href", node.getAttribute("href") || "");
      node.setAttribute("href", "javascript:void(0)");
    } else if ("disabled" in node) {
      node.disabled = true;
    }
  });

  document.querySelectorAll("[data-requires-permission-card]").forEach((node) => {
    const permission = node.getAttribute("data-requires-permission-card");
    if (!permission) return;
    const allowed = jrcHasPermission(permission, currentEmployee);
    node.hidden = !allowed;
    node.setAttribute("aria-hidden", allowed ? "false" : "true");
    if (!allowed) return;
    node.classList.remove("jrc-card-locked");
    node.querySelectorAll(":scope > .jrc-card-lock-note").forEach((note) => note.remove());
  });

  document.querySelectorAll("[data-role-greeting]").forEach((node) => {
    node.textContent = `${currentEmployee.name}｜${currentEmployee.role}｜当前开放：${jrcGetRoleSummary(currentEmployee)}`;
  });
}

function jrcEnforcePagePermission(currentEmployee) {
  const requiredPermission =
    document.body?.getAttribute("data-page-permission") ||
    document.documentElement?.getAttribute("data-page-permission");
  if (!requiredPermission) return true;
  if (jrcHasPermission(requiredPermission, currentEmployee)) return true;

  const main = document.querySelector("main");
  if (main) {
    main.style.display = "none";
  }

  const blocker = document.createElement("div");
  blocker.className = "jrc-page-block";
  blocker.innerHTML = `
    <div class="jrc-page-block__card">
      <p class="jrc-page-block__eyebrow">Access Restricted</p>
      <h2>当前账号未开通此系统</h2>
      <p>${jrcGetPermissionHint(requiredPermission, currentEmployee)}你已经成功登录，可以先返回工作台使用已开放的系统入口。</p>
      <div class="jrc-page-block__actions">
        <a href="/jrcedu/portal/index.html">返回统一工作台</a>
      </div>
    </div>
  `;
  document.body.appendChild(blocker);
  return false;
}

function jrcInjectStyles() {
  const style = document.createElement("style");
  style.textContent = `
    .jrc-auth-bar {
      position: sticky;
      top: 0;
      z-index: 40;
      backdrop-filter: blur(10px);
      background: rgba(15, 23, 42, 0.86);
      color: #fff;
      border-bottom: 1px solid rgba(255,255,255,0.12);
    }
    .jrc-auth-bar__inner {
      width: min(1380px, calc(100vw - 28px));
      margin: 0 auto;
      min-height: 52px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 0 4px;
      font-size: 13px;
    }
    .jrc-auth-bar__inner strong {
      display: block;
      font-size: 14px;
    }
    .jrc-auth-bar__inner span {
      color: rgba(255,255,255,0.76);
    }
    .jrc-auth-bar__actions {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }
    .jrc-auth-bar button {
      min-height: 34px;
      padding: 0 14px;
      border-radius: 999px;
      border: 1px solid rgba(255,255,255,0.18);
      background: rgba(255,255,255,0.1);
      color: #fff;
      cursor: pointer;
      font: inherit;
    }
    .jrc-password-reminder {
      width: min(1380px, calc(100vw - 28px));
      margin: 0 auto;
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 4px 10px;
      color: rgba(255,255,255,0.86);
      font-size: 12px;
      line-height: 1.45;
      border-top: 1px solid rgba(255,255,255,0.08);
    }
    .jrc-password-reminder strong {
      color: #fff;
      white-space: nowrap;
    }
    .jrc-password-reminder span {
      flex: 1;
      min-width: 0;
    }
    .jrc-password-reminder button {
      min-height: 32px;
      padding: 0 12px;
      border-radius: 999px;
      border: 0;
      background: #fff;
      color: #0f766e;
      cursor: pointer;
      font: inherit;
      font-weight: 800;
      white-space: nowrap;
    }
    .jrc-password-overlay {
      position: fixed;
      inset: 0;
      z-index: 100;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 18px;
      background: rgba(15,23,42,0.56);
      backdrop-filter: blur(8px);
    }
    .jrc-password-dialog {
      width: min(460px, 100%);
      border-radius: 22px;
      background: #fff;
      color: #172132;
      box-shadow: 0 24px 70px rgba(15,23,42,0.22);
      padding: 22px;
    }
    .jrc-password-dialog__head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 14px;
    }
    .jrc-password-dialog__head p,
    .jrc-password-dialog__head h2 {
      margin: 0;
    }
    .jrc-password-dialog__head p {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #0d9488;
      font-weight: 800;
      margin-bottom: 6px;
    }
    .jrc-password-dialog__head h2 {
      font-size: 22px;
    }
    .jrc-password-close {
      width: 34px;
      min-height: 34px;
      border-radius: 999px;
      border: 1px solid rgba(23,33,50,0.10);
      background: #f8fafc;
      color: #334155;
      cursor: pointer;
      font-size: 22px;
      line-height: 1;
    }
    .jrc-password-form {
      display: grid;
      gap: 12px;
    }
    .jrc-password-form label {
      display: grid;
      gap: 6px;
      color: #637083;
      font-size: 13px;
    }
    .jrc-password-form input {
      width: 100%;
      min-height: 44px;
      border: 1px solid rgba(23,33,50,0.12);
      border-radius: 12px;
      padding: 0 12px;
      color: #172132;
      background: #fff;
      font: inherit;
    }
    .jrc-password-form input:disabled {
      background: #f8fafc;
      color: #64748b;
    }
    .jrc-password-message {
      min-height: 22px;
      color: #b91c1c;
      font-size: 13px;
      line-height: 1.5;
    }
    .jrc-password-message--success {
      color: #0f766e;
    }
    .jrc-password-actions {
      display: flex;
      gap: 10px;
      justify-content: flex-end;
      flex-wrap: wrap;
    }
    .jrc-password-actions button {
      min-height: 40px;
      padding: 0 16px;
      border-radius: 999px;
      cursor: pointer;
      font: inherit;
    }
    .jrc-password-primary {
      border: 0;
      background: linear-gradient(135deg, #0d9488 0%, #0f766e 100%);
      color: #fff;
    }
    .jrc-password-primary:disabled {
      opacity: 0.62;
      cursor: wait;
    }
    .jrc-password-secondary {
      border: 1px solid rgba(23,33,50,0.12);
      background: #fff;
      color: #172132;
    }
    @media (max-width: 760px) {
      .jrc-password-reminder {
        align-items: stretch;
        flex-direction: column;
      }
      .jrc-password-reminder button {
        width: 100%;
        min-height: 40px;
      }
    }
    .jrc-login-overlay {
      position: fixed;
      inset: 0;
      z-index: 90;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      background: rgba(15, 23, 42, 0.58);
      backdrop-filter: blur(8px);
    }
    body.jrc-auth-required > :not(.jrc-login-overlay) {
      pointer-events: none;
      user-select: none;
      filter: blur(1.5px);
    }
    .jrc-login-card {
      width: min(520px, 100%);
      background: rgba(255,255,255,0.98);
      color: #172132;
      border-radius: 24px;
      box-shadow: 0 24px 60px rgba(15, 23, 42, 0.28);
      padding: 28px;
    }
    .jrc-login-card h2,
    .jrc-login-card p {
      margin: 0;
    }
    .jrc-login-card p {
      color: #5b6778;
      line-height: 1.7;
    }
    .jrc-login-fields {
      display: grid;
      gap: 14px;
      margin-top: 18px;
    }
    .jrc-login-fields label {
      display: grid;
      gap: 6px;
      font-size: 14px;
      color: #172132;
    }
    .jrc-login-fields input {
      width: 100%;
      min-height: 44px;
      border-radius: 14px;
      border: 1px solid rgba(23, 33, 50, 0.14);
      padding: 0 14px;
      font: inherit;
    }
    .jrc-login-submit {
      margin-top: 18px;
      width: 100%;
      min-height: 46px;
      border: 0;
      border-radius: 999px;
      background: linear-gradient(135deg, #0d9488 0%, #0f766e 100%);
      color: #fff;
      font: inherit;
      cursor: pointer;
    }
    .jrc-login-error {
      min-height: 20px;
      margin-top: 10px;
      color: #b91c1c;
      font-size: 13px;
    }
    .jrc-login-error--success {
      color: #0f766e;
    }
    .jrc-login-submit:disabled {
      cursor: progress;
      opacity: 0.72;
    }
    .jrc-login-tools {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      margin-top: 12px;
      flex-wrap: wrap;
    }
    .jrc-login-tools button {
      min-height: 34px;
      padding: 0 12px;
      border-radius: 999px;
      border: 1px solid rgba(13, 148, 136, 0.22);
      background: rgba(13, 148, 136, 0.08);
      color: #0f766e;
      cursor: pointer;
      font: inherit;
      font-size: 13px;
    }
    .jrc-login-diagnostics {
      width: 100%;
      color: #64748b;
      font-size: 12px;
      line-height: 1.6;
      white-space: pre-wrap;
    }
    [data-employee-summary] {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .jrc-employee-summary__head,
    .jrc-employee-directory__head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
    }
    .jrc-employee-directory-toggle {
      min-height: 36px;
      padding: 0 14px;
      border-radius: 999px;
      border: 1px solid rgba(13, 148, 136, 0.18);
      background: rgba(255,255,255,0.82);
      color: #0f766e;
      font: inherit;
      cursor: pointer;
    }
    .jrc-employee-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
      margin-top: 14px;
    }
    .jrc-employee-directory__tools {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 180px;
      gap: 10px;
      margin-top: 14px;
    }
    .jrc-employee-search,
    .jrc-employee-filter {
      width: 100%;
      min-height: 40px;
      border-radius: 12px;
      border: 1px solid rgba(15, 23, 42, 0.1);
      background: rgba(255,255,255,0.92);
      color: #172132;
      padding: 0 12px;
      font: inherit;
    }
    .jrc-employee-card {
      padding: 14px;
      border-radius: 16px;
      background: rgba(255,255,255,0.82);
      border: 1px solid rgba(15, 23, 42, 0.08);
    }
    .jrc-employee-card__head {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      align-items: flex-start;
      flex-wrap: wrap;
    }
    .jrc-employee-card__head strong,
    .jrc-employee-card__head span {
      display: block;
    }
    .jrc-employee-card__head span {
      margin-top: 4px;
      color: #64748b;
      font-size: 13px;
    }
    .jrc-employee-card__tags {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .jrc-employee-card__tags span {
      display: inline-flex;
      align-items: center;
      min-height: 26px;
      padding: 0 10px;
      border-radius: 999px;
      background: rgba(13, 148, 136, 0.08);
      color: #0f766e;
      font-size: 12px;
    }
    .jrc-employee-card__meta {
      margin: 12px 0 0;
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px 12px;
    }
    .jrc-employee-card__meta div {
      min-width: 0;
    }
    .jrc-employee-card__meta dt {
      color: #64748b;
      font-size: 12px;
    }
    .jrc-employee-card__meta dd {
      margin: 4px 0 0;
      color: #172132;
      word-break: break-all;
    }
    .jrc-employee-card__actions {
      display: flex;
      justify-content: flex-end;
      margin-top: 12px;
    }
    .jrc-employee-edit-button {
      min-height: 34px;
      padding: 0 12px;
      border-radius: 999px;
      border: 1px solid rgba(13, 148, 136, 0.2);
      background: rgba(13, 148, 136, 0.08);
      color: #0f766e;
      font: inherit;
      font-size: 12px;
      cursor: pointer;
    }
    .jrc-employee-directory__footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
      margin-top: 14px;
    }
    .jrc-employee-add-placeholder {
      min-height: 38px;
      padding: 0 14px;
      border-radius: 999px;
      border: 1px dashed rgba(13, 148, 136, 0.35);
      background: rgba(255,255,255,0.84);
      color: #0f766e;
      font: inherit;
      cursor: default;
    }
    .jrc-employee-directory__footer span {
      color: #64748b;
      font-size: 13px;
    }
    .jrc-employee-form {
      margin-top: 14px;
      padding: 16px;
      border-radius: 16px;
      background: rgba(255,255,255,0.9);
      border: 1px solid rgba(15, 23, 42, 0.08);
    }
    .jrc-employee-form__grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px 12px;
    }
    .jrc-employee-form label {
      display: grid;
      gap: 6px;
      min-width: 0;
    }
    .jrc-employee-form label span {
      color: #64748b;
      font-size: 12px;
      font-weight: 600;
    }
    .jrc-employee-form input,
    .jrc-employee-form select {
      width: 100%;
      min-height: 40px;
      border-radius: 12px;
      border: 1px solid rgba(15, 23, 42, 0.1);
      background: #fff;
      color: #172132;
      padding: 0 12px;
      font: inherit;
    }
    .jrc-employee-form input[readonly] {
      background: rgba(241, 245, 249, 0.9);
      color: #64748b;
    }
    .jrc-employee-form__actions {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
      margin-top: 14px;
    }
    .jrc-employee-form__submit {
      min-height: 40px;
      padding: 0 16px;
      border-radius: 999px;
      border: 0;
      background: linear-gradient(135deg, #0d9488 0%, #0f766e 100%);
      color: #fff;
      font: inherit;
      cursor: pointer;
    }
    .jrc-employee-form__actions span {
      color: #64748b;
      font-size: 13px;
    }
    .jrc-employee-permission-box {
      margin-top: 14px;
      padding-top: 14px;
      border-top: 1px solid rgba(15, 23, 42, 0.08);
    }
    .jrc-employee-permission-box__head {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
      margin-bottom: 10px;
    }
    .jrc-employee-permission-box__head strong {
      color: #172132;
    }
    .jrc-employee-permission-box__head span {
      color: #64748b;
      font-size: 13px;
    }
    .jrc-employee-permission-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 8px;
    }
    .jrc-employee-permission-grid label {
      display: flex;
      align-items: center;
      gap: 8px;
      min-height: 34px;
      padding: 0 10px;
      border-radius: 10px;
      background: rgba(248, 250, 252, 0.9);
      border: 1px solid rgba(15, 23, 42, 0.08);
      color: #172132;
      font-size: 13px;
    }
    .jrc-employee-permission-grid input {
      width: auto;
      min-height: 0;
      padding: 0;
    }
    @media (max-width: 900px) {
      .jrc-employee-directory__tools,
      .jrc-employee-grid,
      .jrc-employee-card__meta,
      .jrc-employee-form__grid,
      .jrc-employee-permission-grid {
        grid-template-columns: 1fr;
      }
    }
    .jrc-locked {
      opacity: 0.55;
      cursor: not-allowed !important;
      pointer-events: none;
    }
    .jrc-card-locked {
      position: relative;
    }
    .jrc-card-lock-note {
      margin-top: 14px;
      display: inline-flex;
      align-items: center;
      min-height: 30px;
      padding: 0 12px;
      border-radius: 999px;
      font-size: 12px;
      background: rgba(15, 23, 42, 0.08);
      color: #475569;
    }
    .jrc-page-block {
      min-height: calc(100vh - 52px);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      background: linear-gradient(180deg, #f8fafc 0%, #eef2f7 100%);
    }
    .jrc-page-block__card {
      width: min(560px, 100%);
      background: rgba(255,255,255,0.98);
      border-radius: 24px;
      box-shadow: 0 24px 60px rgba(15, 23, 42, 0.14);
      padding: 28px;
      color: #172132;
    }
    .jrc-page-block__eyebrow {
      margin: 0 0 10px;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #0d9488;
      font-weight: 700;
    }
    .jrc-page-block__card h2,
    .jrc-page-block__card p {
      margin: 0;
    }
    .jrc-page-block__card p {
      margin-top: 12px;
      color: #5b6778;
      line-height: 1.7;
    }
    .jrc-page-block__actions {
      margin-top: 18px;
    }
    .jrc-page-block__actions a {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 44px;
      padding: 0 18px;
      border-radius: 999px;
      background: linear-gradient(135deg, #0d9488 0%, #0f766e 100%);
      color: #fff;
      text-decoration: none;
    }
  `;
  document.head.appendChild(style);
}

function jrcShowLoginOverlay() {
  document.body.classList.add("jrc-auth-required");
  let loginSubmitting = false;

  async function jrcRunLoginDiagnostics(event) {
    if (event?.preventDefault) event.preventDefault();
    const box = document.getElementById("jrcLoginDiagnostics");
    const button = document.getElementById("jrcLoginDiagnosticsButton");
    if (!box) return false;
    if (button) {
      button.disabled = true;
      button.textContent = "正在检测...";
    }
    const lines = [];
    const storageKey = "jrc-login-diagnostic";
    const storageOk = jrcSafeStorageSet(storageKey, "ok") && jrcSafeStorageGet(storageKey) === "ok";
    jrcSafeStorageRemove(storageKey);
    const cookieOk = jrcWriteCookie(storageKey, "ok", 60) && decodeURIComponent(jrcReadCookie(storageKey) || "") === "ok";
    jrcClearCookie(storageKey);
    lines.push(`浏览器保存登录状态：${storageOk || cookieOk ? "正常" : "受限"}`);
    lines.push(`云接口脚本：${window.JRC_CLOUD?.login ? "已加载" : "未加载"}`);
    try {
      const result = window.JRC_CLOUD?.login
        ? await window.JRC_CLOUD.login("chengzhihao", "10281028")
        : { ok: false, error: "云接口脚本未加载" };
      lines.push(`云端登录接口：${result.ok ? "正常" : `异常 ${result.status || result.error || ""}`}`);
    } catch (error) {
      lines.push(`云端登录接口：异常 ${String(error?.message || error)}`);
    }
    lines.push(`当前页面：${location.href}`);
    box.textContent = lines.join("\n");
    if (button) {
      button.disabled = false;
      button.textContent = "检测登录环境";
    }
    return false;
  }
  window.jrcRunLoginDiagnostics = jrcRunLoginDiagnostics;

  async function jrcHandleLoginSubmit(event) {
    if (event?.preventDefault) event.preventDefault();
    const username = document.getElementById("jrcUsernameInput")?.value.trim().toLowerCase() || "";
    const password = document.getElementById("jrcPasswordInput")?.value.trim() || "";
    const errorBox = document.getElementById("jrcLoginError");
    const submitButton = document.getElementById("jrcLoginSubmitButton");
    if (errorBox) {
      errorBox.textContent = "";
      errorBox.classList.remove("jrc-login-error--success");
    }
    if (!username || !password) {
      if (errorBox) errorBox.textContent = "请填写用户名和密码。用户名一般使用姓名拼音。";
      return false;
    }
    if (loginSubmitting) return false;
    loginSubmitting = true;
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = "正在登录...";
    }

    try {
      const cloudResult = window.JRC_CLOUD?.login ? await window.JRC_CLOUD.login(username, password) : null;
      if (cloudResult?.ok && cloudResult.data?.employee && cloudResult.data?.token) {
        const localEmployee = jrcFindEmployeeByUsername(username);
        jrcWriteSession(localEmployee || cloudResult.data.employee, {
          cloudApiToken: cloudResult.data.token,
          cloudTokenExpiresAt: cloudResult.data.expiresAt || null,
          mustChangePassword: Boolean(cloudResult.data.mustChangePassword ?? (password === JRC_INITIAL_PASSWORD))
        });
        document.body.classList.remove("jrc-auth-required");
        window.location.href = "/jrcedu/portal/index.html?login=ok";
        return false;
      }
      if (cloudResult && !cloudResult.skipped && !cloudResult.ok) {
        if (errorBox) errorBox.textContent = cloudResult.status === 401
          ? "用户名或密码不正确，请用新密码登录。"
          : "云端登录暂时不可用，请稍后重试。";
        return false;
      }

      const employee = jrcFindEmployeeByUsername(username);
      if (!employee || employee.password !== password) {
        if (errorBox) errorBox.textContent = cloudResult?.status === 401
          ? "用户名或密码不正确，请用员工姓名拼音登录。"
          : "用户名或密码不正确，或云端登录当前不可用。";
        return false;
      }

      if (errorBox) {
        errorBox.textContent = "登录成功，正在进入工作台...";
        errorBox.classList.add("jrc-login-error--success");
      }
      jrcWriteSession(employee, { mustChangePassword: password === JRC_INITIAL_PASSWORD });
      document.body.classList.remove("jrc-auth-required");
      window.location.href = "/jrcedu/portal/index.html?login=ok";
      return false;
    } catch (error) {
      console.error(error);
      const message = String(error?.message || error || "未知错误");
      if (errorBox) errorBox.textContent = `登录过程出错：${message}`;
      return false;
    } finally {
      loginSubmitting = false;
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = "登录进入工作台";
      }
    }
  }
  window.jrcHandleLoginSubmit = jrcHandleLoginSubmit;

  const overlay = document.createElement("div");
  overlay.className = "jrc-login-overlay";
  overlay.innerHTML = `
    <div class="jrc-login-card">
      <p style="font-size:12px; letter-spacing:0.08em; text-transform:uppercase; color:#0d9488; font-weight:700;">JRC Employee Login</p>
      <h2 style="margin-top:8px;">先登录，再进入系统</h2>
      <p style="margin-top:12px;">请输入管理员分配的员工账号和密码。用户名一般使用姓名拼音。</p>
      <form id="jrcLoginForm" class="jrc-login-fields">
        <label>
          用户名
          <input id="jrcUsernameInput" autocomplete="username" placeholder="例如：zhoushan">
        </label>
        <label>
          密码
          <input id="jrcPasswordInput" type="password" autocomplete="current-password" placeholder="请输入密码">
        </label>
        <button class="jrc-login-submit" id="jrcLoginSubmitButton" type="submit" onclick="return window.jrcHandleLoginSubmit(event)">登录进入工作台</button>
      </form>
      <div id="jrcLoginError" class="jrc-login-error"></div>
      <div class="jrc-login-tools">
        <button id="jrcLoginDiagnosticsButton" type="button" onclick="return window.jrcRunLoginDiagnostics(event)">检测登录环境</button>
        <div id="jrcLoginDiagnostics" class="jrc-login-diagnostics"></div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const form = document.getElementById("jrcLoginForm");
  const button = document.getElementById("jrcLoginSubmitButton");
  if (form) {
    form.onsubmit = window.jrcHandleLoginSubmit;
    form.addEventListener("submit", window.jrcHandleLoginSubmit);
  }
  if (button) {
    button.onclick = window.jrcHandleLoginSubmit;
    button.addEventListener("click", window.jrcHandleLoginSubmit);
  }
  document.getElementById("jrcLoginDiagnosticsButton")?.addEventListener("click", window.jrcRunLoginDiagnostics);
}

function jrcBootstrapAuth() {
  jrcResetLegacyBusinessDataOnce();
  jrcExposeDataFoundation();
  jrcInjectStyles();
  jrcEnsureEmployeeSummary();
  window.JRC_EMPLOYEES = jrcGetAllEmployees();
  window.JRC_ROLE_PERMISSIONS = JRC_ROLE_PERMISSIONS;
  window.jrcHasPermission = jrcHasPermission;
  window.JRC_MARK_EMPLOYEE_DEPARTED = jrcMarkEmployeeDeparted;
  window.JRC_UPSERT_EMPLOYEE_FROM_HR = jrcUpsertEmployeeFromHr;
  const currentEmployee = jrcResolveCurrentEmployee();
  jrcRenderEmployeeDirectory(currentEmployee);
  jrcBindEmployeeDirectoryToggle();
  jrcBindEmployeeDirectoryFilters();
  jrcBindEmployeeAddForm(currentEmployee);
  jrcHydrateCustomEmployeesFromCloud();
  if (!currentEmployee) {
    const fallbackEmployee = jrcFindEmployeeByUsername(JRC_TEMP_AUTO_LOGIN_USERNAME);
    if (fallbackEmployee) {
      jrcWriteSession(fallbackEmployee, { temporaryAutoLogin: true });
      window.location.reload();
      return;
    }
    jrcShowLoginOverlay();
    return;
  }
  jrcEnsureTopbar(currentEmployee);
  window.JRC_CURRENT_EMPLOYEE = currentEmployee;
  jrcApplyPermissionDecorations(currentEmployee);
  jrcEnforcePagePermission(currentEmployee);

  document.querySelectorAll("[data-open-admissions-direct]").forEach((node) => {
    node.setAttribute("href", "/jrcedu/advice-system/index.html");
  });
}

jrcBootstrapAuth();
