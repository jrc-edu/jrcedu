(function () {
  const admissionsKey = "advice-system-stage-prototype";
  const auditKey = "jrc-business-audit-log-v1";
  const suggestionsKey = "jrc-suggestion-management-v2";
  const siteFeedbackKey = "jrc-site-feedback-v1";
  const paikeRegularKey = "paike-june-system-v1";
  const paikePreimportKey = "jrc-paike-finance-preimport-2026-06-22";
  const attendanceKey = "jrc-class-attendance-v1";
  const studentServiceKey = "jrc-student-service-v2";
  const financeKey = "jrc-finance-ledger-v1";
  const specialDelegatedTeachers = ["程志豪", "海滢滢", "姚老师"];
  const studentServiceFallbackOwner = { name: "高芳燕", username: "gaofangyan" };
  const primarySchoolServiceOwner = { name: "颜雨涵", username: "yanyuhan" };
  const juniorSchoolServiceOwner = { name: "高芳燕", username: "gaofangyan" };
  const moduleOwnerTasks = [
    {
      key: "admissions",
      system: "招生管理系统",
      owner: "颜雨涵",
      ownerUsername: "yanyuhan",
      href: "/jrcedu/advice-system/index.html",
      guide: "使用逻辑：新线索录入 → 跟进记录 → 预约试听 → 试听反馈 → 报名建档 → 归属链锁定 → 导出和看板统计。\n试用重点：检查新增、搜索、筛选、导出 Excel、试听反馈、报名归属解锁、转介绍排序、顾问日周月年统计是否顺手。\n联动重点：报名数据要能进入学生服务和财务候选，试听课要能进入教学质量和家长反馈采集。"
    },
    {
      key: "finance",
      system: "财务系统",
      owner: "刘大君",
      ownerUsername: "liudajun",
      href: "./finance.html",
      guide: "新版试用方法：我们刚把财务系统改成“每位老师一张工资单”的方式。进入财务系统后，先选择月份，再看上方老师工资单卡片；点任意老师卡片，会直接打开该老师工资明细。\n试用重点：1. 刘老师先按 5 月、6 月分别试；2. 逐个点击老师工资单卡片，确认是否能看懂明细条数、应发金额、是否缺产值总表；3. 进入某位老师工资明细后，重点核对上课次数、单次提成、上课日期/第几次、应发小计；4. 再看小课产值总表里的老师姓名是否能一键跳到明细；5. 手机/iPad 上点老师卡片、横向滑动表格、导出当前老师工资单是否顺手。\n监管口径：系统仍是和人工 Excel 并行核对版，不直接作为最终发薪依据。现在重点不是追求一次算准，而是判断页面是否像原工资表一样好用、能不能快速发现差异。\n反馈要求：如果数字不对，请写清楚月份、老师、Excel 原值、系统显示值和所在位置；如果看不懂，请写清楚是哪张卡片、哪列、哪个按钮不清楚。"
    },
    {
      key: "curriculum",
      system: "教研与课程产品系统",
      owner: "赵萱",
      ownerUsername: "zhaoxuan",
      href: "./curriculum-products.html",
      guide: "使用逻辑：按年级权限进入 → 选择年级/体系/课次/资料类型 → 批量上传课件、PDF、Word、图片 → 搜索下载 → 重复资料自动更新版本。\n试用重点：检查一到六年级资料权限、批量上传、去重、版本更新、下载和手机/iPad 操作是否顺手。\n联动重点：资料要逐步沉淀成标准课件库，方便老师备课、打印、复用和新老师培训。"
    },
    {
      key: "paike",
      system: "排课系统",
      owner: "周珊",
      ownerUsername: "zhoushan",
      href: "./paike.html",
      guide: "新版试用方法：我们刚把排课系统改成“每位老师一张月课表”的方式。进入排课系统后，先选月份，再看上方老师课表卡片；点任意老师卡片，会直接打开该老师整月课表。\n试用重点：1. 周老师先按 6 月、暑假月份分别试；2. 逐个点击老师课表卡片，确认课程数、学生/班级数、未写教室数是否有参考价值；3. 打开某位老师后，按横向日期、纵向时间段核对课表是否接近原 Excel；4. 空格显示“可排”是否清楚；5. 当天老师空档表和教室使用表是否能帮助判断还能不能排新课；6. 手机/iPad 上点老师卡片、横向滑动课表、导出当前课表是否顺手。\n监管口径：排课是点名、课销、老师课时费、教学质量问卷的基础数据源。现在重点是让排课负责人能像看原 Excel 一样按老师核对课表，并能发现缺教室、缺课、时间错、老师错。\n反馈要求：如果数据不对，请写清楚月份、老师、日期、时间段、学生/班级、原 Excel 应该是什么、系统现在显示什么；如果不好用，请写清楚卡在哪个入口或哪张表。"
    },
    {
      key: "student-service",
      system: "学生与家长服务系统",
      owner: "高芳燕",
      ownerUsername: "gaofangyan",
      href: "./student-service.html",
      guide: "使用逻辑：学生档案 → 点名签到 → 出门测成绩 → 缺席追踪 → 课后反馈 → 家长沟通 → 续费风险。\n试用重点：检查 iPad 点名勾选、缺席处理、出门测录分、AI 课堂反馈归档、已归档反馈查看是否顺手。\n联动重点：点名影响老师课时费和家长课销；出门测和课堂反馈要进入学管沟通依据。"
    },
    {
      key: "suggestions",
      system: "建议与任务协同系统",
      owner: "叶源泽",
      ownerUsername: "yeyuanze",
      href: "./suggestions.html",
      guide: "使用逻辑：员工提交问题/建议 → 大家支持点赞 → 管理员派任务 → 负责人提交完成反馈 → 提出人复核是否解决。\n试用重点：检查建议列表是否清楚、派任务负责人下拉是否好用、完成反馈是否能闭环、提出人是否能看到整改状态。\n联动重点：这里是全站优化入口，所有模块问题都应该能沉淀、分派、完成、复核。"
    },
    {
      key: "knowledge",
      system: "学管知识库系统",
      owner: "程志豪",
      ownerUsername: "chengzhihao",
      href: "./knowledge.html",
      guide: "使用逻辑：输入关键词 → 查询标准答案/制度/话术 → 查看来源 → 用于学管培训和家长沟通。\n试用重点：检查搜索结果是否能回答学管常见问题，知识点是否准确，入口名称是否不会让授课老师误解。\n联动重点：后续可承接学管培训、标准话术、制度答疑和新人考试。"
    },
    {
      key: "hr",
      system: "校区运营与人事系统",
      owner: "陈雨晴",
      ownerUsername: "chenyuqing",
      href: "./hr-training.html",
      guide: "使用逻辑：校区运营 → 岗位宣传栏 → 人事管理。校区运营现在分为公告公示类和工作流程类，主要展示值班表、卫生值日表、学管排班表、招聘情况、校区通知以及招聘、面试、试用淘汰、入职离职等流程。岗位宣传栏给全员查看负责人、岗位名称和职责说明，程志豪和陈雨晴可拖动调整展示顺序；人事管理维护员工档案、岗位权限、入职转正、培训记录和提成档位。\n试用重点：检查老师是否能清楚找到公告公示和工作流程，普通老师是否只查看，管理员是否能粘贴文字、导入表格并维护展示内容。\n联动重点：人事权限会影响每个人能看到哪些系统、能新增/编辑/导出哪些数据；校区运营只做公共展示，不做审批和任务闭环。"
    },
    {
      key: "ai",
      system: "课堂反馈AI助手",
      owner: "李舒",
      ownerUsername: "lishu",
      href: "./ai-assistant.html",
      guide: "使用逻辑：老师文字/语音输入课堂情况 → 选择学生和课次 → AI 整理成课堂反馈草稿 → 老师精修确认 → 归档学生服务。\n试用重点：重点试课堂反馈模板、多学生拆分、草稿库 50 条、已归档反馈查看、复制家长文案、串名拦截和失败提示是否清楚。\n联动重点：课堂反馈AI助手不是直接替老师发消息，而是把老师口述整理成可编辑草稿，再归档到学生服务。"
    },
    {
      key: "teaching-quality",
      system: "教学质量系统",
      owner: "郑嘉艺",
      ownerUsername: "zhengjiayi",
      href: "./teaching-quality.html",
      guide: "使用逻辑：抽样巡课 → 学生/家长问卷 → 老师个人趋势 → 整改工单 → 复查闭环。\n试用重点：检查老师端是否只看本人趋势和建议，不公开排名；管理端是否能看整改、问卷和质控数据。\n联动重点：教学质量结果用于帮助改进和绩效候选，不适合公开排名刺激老师。"
    }
  ];
  const systemStores = [
    { key: "paike-summer-import-review-v1", label: "排课待确认", href: "./paike.html", type: "array" },
    { key: "advice-system-stage-prototype", label: "招生线索", href: "/jrcedu/advice-system/index.html", type: "admissions" },
    { key: "jrc-finance-ledger-v1", label: "财务系统", href: "./finance.html", type: "finance" },
    { key: "jrc-teaching-quality-system-v2-demo", label: "教学质量", href: "./teaching-quality.html", type: "teachingQuality" },
    { key: "jrc-student-service-v2", label: "学生服务", href: "./student-service.html", type: "array" },
    { key: "jrc-curriculum-products-v2", label: "教研课程", href: "./curriculum-products.html", type: "array" },
    { key: "jrc-hr-training-tasks-v2", label: "人事管理", href: "./hr-training.html", type: "array" },
    { key: "jrc-campus-operations-v2", label: "校区运营", href: "./campus-operations.html", type: "array" },
    { key: "jrc-suggestion-management-v2", label: "建议系统", href: "./suggestions.html", type: "array" }
  ];
  const cloudBusinessStores = [
    { key: "advice-system-stage-prototype", label: "招生管理", risk: "可录入跟进" },
    { key: "jrc-finance-ledger-v1", label: "财务系统", risk: "需财务复核" },
    { key: "jrc-student-service-v2", label: "学生服务", risk: "需和点名核对" },
    { key: "jrc-teaching-quality-system-v2-demo", label: "教学质量", risk: "按真实采集记录统计" },
    { key: "jrc-suggestion-management-v2", label: "建议系统", risk: "持续收集" },
    { key: "jrc-hr-training-tasks-v2", label: "人事管理", risk: "账号权限已接入" },
    { key: "jrc-campus-operations-v2", label: "校区运营", risk: "可先查看" },
    { key: "jrc-curriculum-products-v2", label: "教研课程", risk: "资料待补" }
  ];
  const linkEventKey = "jrc-system-link-events-v1";
  let adminDiagnosticsLoaded = false;
  let adminDiagnosticsLoading = false;

  function $(id) {
    return document.getElementById(id);
  }

  function safeParse(raw, fallback) {
    try {
      return JSON.parse(raw || "null") ?? fallback;
    } catch {
      return fallback;
    }
  }

  function readAdmissions() {
    const state = safeParse(localStorage.getItem(admissionsKey), {});
    const leads = Array.isArray(state.leads) ? state.leads : [];
    const pending = leads.filter((lead) => {
      if (!lead) return false;
      if (!lead.owner || lead.owner === "待分配") return true;
      if (!lead.channel || lead.channel === "待补来源") return true;
      if (!lead.note || lead.note === "待补首条记录") return true;
      if (lead.status === "新建未联系") return true;
      if (lead.status === "试听完成待转化") return true;
      if ((lead.intent || "").startsWith("A") && Number(lead.enrolledAmount || 0) <= 0) return true;
      return false;
    });
    return { leads, pending };
  }

  function currentEmployee() {
    return window.JRC_CURRENT_EMPLOYEE || null;
  }

  function hasPermission(permission) {
    if (typeof window.jrcHasPermission !== "function") return true;
    return window.jrcHasPermission(permission, currentEmployee());
  }

  function isAdminLike() {
    return hasPermission("admin.access");
  }

  function roleTone() {
    const employee = currentEmployee();
    const role = employee?.role || "员工";
    if (isAdminLike()) {
      return {
        title: "总览工作台",
        badge: "全局管理",
        intro: "这里放全校区今天最该先看的事项：数据状态、待办和核对重点。",
        welcome: `${employee?.name || "管理员"}，今天先看全局有没有漏项；老师们具体工作不需要都看这些管理数据。`
      };
    }
    if (role === "学管") {
      return {
        title: "学管工作台",
        badge: "学生与家长",
        intro: "这里优先放招生跟进、学生服务、教学质量和家长沟通相关事项。",
        welcome: `${employee?.name || "学管老师"}，今天重点看家长有没有要跟、学生服务有没有要补、试听反馈有没有漏。`
      };
    }
    if (role === "财务") {
      return {
        title: "财务工作台",
        badge: "结算核对",
        intro: "这里优先放财务数据和需要结算核对的事项。",
        welcome: `${employee?.name || "财务老师"}，今天先看财务系统里的收入、支出和结算口径是否需要补录。`
      };
    }
    if (role === "授课老师") {
      return {
        title: "老师工作台",
        badge: "上课与反馈",
        intro: "这里会尽量只放和上课、课表、建议反馈有关的事项。",
        welcome: `${employee?.name || "老师"}，这里不放复杂管理报表；主要看课表入口、教学质量反馈和建议系统。`
      };
    }
    return {
      title: "今日工作台",
      badge: "我的事项",
      intro: "这里会根据岗位显示今天和你有关的提醒。",
      welcome: `${employee?.name || "你好"}，先看这里，再进入对应系统处理。`
    };
  }

  function getSystemOrder() {
    const employee = currentEmployee();
    const role = employee?.role || "";
    if (isAdminLike()) {
      return ["ai", "paike", "admissions", "finance", "teachingQuality", "studentService", "hr", "suggestions", "knowledge", "curriculum", "campus"];
    }
    if (role === "学管") {
      return ["ai", "admissions", "studentService", "teachingQuality", "paike", "knowledge", "campus", "suggestions", "curriculum", "finance", "hr"];
    }
    if (role === "财务") {
      return ["ai", "finance", "paike", "suggestions", "admissions", "teachingQuality", "studentService", "hr", "knowledge", "curriculum", "campus"];
    }
    if (role === "授课老师") {
      return ["ai", "paike", "campus", "teachingQuality", "studentService", "curriculum", "suggestions", "knowledge", "admissions", "finance", "hr"];
    }
    return ["ai", "paike", "knowledge", "suggestions", "finance", "admissions", "teachingQuality", "studentService", "curriculum", "hr", "campus"];
  }

  function reorderSystemCards() {
    const cards = Array.from(document.querySelectorAll("[data-system-card]"));
    if (cards.length === 0) return;
    const holder = cards[0].parentElement;
    const order = getSystemOrder();
    cards
      .sort((a, b) => {
        const aKey = a.getAttribute("data-system-card") || "";
        const bKey = b.getAttribute("data-system-card") || "";
        const aAllowed = hasPermission(a.getAttribute("data-requires-permission-card") || "");
        const bAllowed = hasPermission(b.getAttribute("data-requires-permission-card") || "");
        if (aAllowed !== bAllowed) return aAllowed ? -1 : 1;
        const aIndex = order.includes(aKey) ? order.indexOf(aKey) : 999;
        const bIndex = order.includes(bKey) ? order.indexOf(bKey) : 999;
        return aIndex - bIndex;
      })
      .forEach((card) => holder.appendChild(card));
  }

  function readAuditCount() {
    const rows = safeParse(localStorage.getItem(auditKey), []);
    return Array.isArray(rows) ? rows.length : 0;
  }

  function readStore(key, fallback = null) {
    return safeParse(localStorage.getItem(key), fallback);
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function countStoreRows(config) {
    const data = readStore(config.key, null);
    if (data === null) return 0;
    if (Array.isArray(data)) return data.length;
    if (config.type === "admissions") {
      return Array.isArray(data.leads) ? data.leads.length : 0;
    }
    if (config.type === "finance") {
      return Object.keys(data.periods || {}).length + (data.expenses || []).length;
    }
    if (config.type === "teachingQuality") {
      return (data.teachers || []).length + (data.tickets || []).length + (data.inspections || []).length;
    }
    if (typeof data === "object") return Object.keys(data).length;
    return 0;
  }

  function getTeachingQualityOpenTickets() {
    const data = readStore("jrc-teaching-quality-system-v2-demo", {});
    const tickets = Array.isArray(data.tickets) ? data.tickets : [];
    return tickets.filter((ticket) => !String(ticket.status || "").includes("已闭环"));
  }

  function getPaikeReviewCount() {
    const rows = readStore("paike-summer-import-review-v1", []);
    return Array.isArray(rows) ? rows.length : 0;
  }

  function dateKey(value) {
    const text = String(value || "").trim();
    const match = text.match(/(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})/);
    if (match) return `${match[1]}-${String(match[2]).padStart(2, "0")}-${String(match[3]).padStart(2, "0")}`;
    return text.slice(0, 10);
  }

  function todayKey() {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  function employeeUsernameByName(name) {
    const target = normalizePersonName(name);
    if (!target) return "";
    const employees = Array.isArray(window.JRC_EMPLOYEES) ? window.JRC_EMPLOYEES : [];
    const employee = employees.find((item) => normalizePersonName(item?.name) === target);
    return String(employee?.username || "").trim().toLowerCase();
  }

  function gradeNumberFromText(...values) {
    const text = values.map((value) => String(value || "")).join(" ");
    const direct = text.match(/([1-9])\s*(?:年级|年|级)/);
    if (direct) return Number(direct[1]);
    const chineseMap = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
    const chinese = text.match(/([一二三四五六七八九])\s*(?:年级|年|级)/);
    if (chinese) return chineseMap[chinese[1]] || 0;
    if (/初一|七年级/.test(text)) return 7;
    if (/初二|八年级/.test(text)) return 8;
    if (/初三|九年级/.test(text)) return 9;
    return 0;
  }

  function delegatedAcademicOwner(teacherName, context = {}) {
    const teacher = normalizePersonName(teacherName);
    if (!specialDelegatedTeachers.includes(teacher)) return null;
    if (teacher === "海滢滢" || teacher === "姚老师") return studentServiceFallbackOwner;
    const grade = gradeNumberFromText(context.grade, context.className, context.studentName, context.courseName, context.content, context.sample);
    if (grade >= 1 && grade <= 6) return primarySchoolServiceOwner;
    if (grade >= 7 && grade <= 9) return juniorSchoolServiceOwner;
    return juniorSchoolServiceOwner;
  }

  function resolveAcademicFlowOwner(teacherName, context = {}) {
    const delegated = delegatedAcademicOwner(teacherName, context);
    if (delegated) return delegated;
    return {
      name: teacherName || studentServiceFallbackOwner.name,
      username: employeeUsernameByName(teacherName) || ""
    };
  }

  function normalizeScheduleRowsFromRegular(data) {
    const entries = Array.isArray(data?.scheduleEntries) ? data.scheduleEntries : [];
    return entries.map((entry, index) => ({
      id: entry.id || `regular-${index}`,
      source: "正式排课",
      date: dateKey(entry.courseDate || entry.date || ""),
      teacherName: String(entry.teacherName || entry.teacher || "").trim(),
      className: String(entry.className || entry.courseName || "排课课程").trim(),
      studentName: String(entry.studentName || entry.className || "").trim(),
      startTime: String(entry.startTime || "").trim(),
      endTime: String(entry.endTime || "").trim(),
      roomName: String(entry.classroomName || entry.roomName || "").trim()
    })).filter((row) => row.date && row.teacherName && (row.studentName || row.className));
  }

  function normalizeScheduleRowsFromPreimport(bundle) {
    const rows = [];
    (Array.isArray(bundle?.scheduleSessions) ? bundle.scheduleSessions : []).forEach((session, index) => {
      const names = Array.isArray(session.studentNames) && session.studentNames.length ? session.studentNames : [session.className || session.lessonTypeRaw || "排课课程"];
      names.forEach((studentName, nameIndex) => {
        rows.push({
          id: session.sourceId || `preimport-${index}-${nameIndex}`,
          source: "Excel排课",
          date: dateKey(session.date || ""),
          teacherName: String(session.teacherName || "").trim(),
          className: String(session.lessonTypeRaw || session.className || "排课课程").trim(),
          studentName: String(studentName || "").trim(),
          startTime: String(session.startTime || "").trim(),
          endTime: String(session.endTime || "").trim(),
          roomName: String(session.roomName || session.classroomName || "").trim()
        });
      });
    });
    return rows.filter((row) => row.date && row.teacherName && (row.studentName || row.className));
  }

  function mergeScheduleRows(...groups) {
    const map = new Map();
    groups.flat().forEach((row) => {
      if (!row || typeof row !== "object") return;
      const key = compactLinkKey(row.date, row.teacherName, row.startTime, row.endTime, row.className, row.studentName);
      if (!key) return;
      const existing = map.get(key);
      if (!existing || existing.source === "Excel排课") map.set(key, { ...existing, ...row });
    });
    return [...map.values()].sort((left, right) => (
      String(left.date || "").localeCompare(String(right.date || "")) ||
      String(left.startTime || "").localeCompare(String(right.startTime || "")) ||
      String(left.teacherName || "").localeCompare(String(right.teacherName || ""), "zh-CN")
    ));
  }

  function sessionRows(session) {
    return Array.isArray(session?.rows) ? session.rows : [];
  }

  function isAttendanceHandled(row) {
    return isEffectiveAttendance(row) || row?.followupHandled === true || row?.followupStatus === "已处理";
  }

  function needsAttendanceResolution(row) {
    return !isAttendanceHandled(row) || row?.followup === "待联系家长";
  }

  function enrolledLeadRows(admissionsState) {
    const leads = Array.isArray(admissionsState?.leads) ? admissionsState.leads : [];
    return leads.filter((lead) => lead?.status === "定金 / 已报名" || Number(lead?.enrolledAmount || 0) > 0);
  }

  function admissionLeadRequiresPaike(lead) {
    if (!lead) return false;
    if (lead.requiresPaike === false) return false;
    if (["程老师班课", "科学班课"].includes(String(lead.courseProduct || "").trim())) return false;
    return true;
  }

  function scheduleStudentNameSet(scheduleRows) {
    const names = new Set();
    (Array.isArray(scheduleRows) ? scheduleRows : []).forEach((row) => {
      const name = normalizePersonName(row.studentName || row.student || row.className);
      if (name && !/排课课程|小班课|一对一|科学|数学/.test(name)) names.add(name);
    });
    return names;
  }

  function buildOperationalTasks({ admissionsState, scheduleRows, attendanceSessions }) {
    const today = todayKey();
    const enrolled = enrolledLeadRows(admissionsState);
    const scheduleNames = scheduleStudentNameSet(scheduleRows);
    const unscheduledLeads = enrolled.filter((lead) => {
      const name = normalizePersonName(lead.studentName);
      return name && admissionLeadRequiresPaike(lead) && !scheduleNames.has(name);
    });
    const todayScheduleRows = scheduleRows.filter((row) => row.date === today);
    const attendanceKeys = new Set((Array.isArray(attendanceSessions) ? attendanceSessions : []).map(attendanceSessionKey).filter(Boolean));
    const notAttendanceToday = todayScheduleRows.filter((row) => {
      const sessionKey = compactLinkKey(row.date, row.teacherName, row.className);
      return sessionKey && !attendanceKeys.has(sessionKey);
    });
    const teacherTodayGroups = new Map();
    notAttendanceToday.forEach((row) => {
      const teacher = row.teacherName || "未填老师";
      if (!teacherTodayGroups.has(teacher)) teacherTodayGroups.set(teacher, []);
      teacherTodayGroups.get(teacher).push(row);
    });
    const unresolvedRows = [];
    (Array.isArray(attendanceSessions) ? attendanceSessions : []).forEach((session) => {
      sessionRows(session).forEach((row) => {
        if (needsAttendanceResolution(row)) unresolvedRows.push({ session, row });
      });
    });
    const tasks = [];
    if (unscheduledLeads.length) {
      tasks.push({
        id: "flow-admissions-to-paike",
        entryType: "task",
        title: `【数据闭环】${unscheduledLeads.length} 名报名学生待排课`,
        category: "排课闭环",
        impact: "high",
        content: `招生系统里有 ${unscheduledLeads.length} 名已报名/有实收学生，还没有在排课系统里匹配到正式排课。请排课负责人按学生、年级、试听老师和报名课程安排正式课程。\n\n样例：${unscheduledLeads.slice(0, 8).map((lead) => `${lead.studentName || "-"}｜${lead.grade || "-"}｜${lead.trialTeacher || lead.owner || "待安排"}`).join("；")}`,
        author: "系统联动",
        authorUsername: "",
        anonymous: false,
        createdAt: today,
        updatedAt: new Date().toISOString(),
        status: "assigned",
        owner: "周珊",
        ownerUsername: "zhoushan",
        dueDate: today,
        verifier: "程志豪",
        taskId: "task-flow-admissions-to-paike",
        taskStandard: "已报名学生必须形成排课安排；确实暂不排课的，需要在招生或学生服务里说明原因。",
        subtasks: [
          "1. 打开招生系统筛选“定金 / 已报名”。",
          "2. 对照排课系统老师月课表，确认学生是否已有正式课。",
          "3. 未排课的学生安排老师、日期、时间、教室。",
          "4. 暂不排课的学生写清原因，避免学生服务和财务误判。"
        ].join("\n"),
        completionReport: "",
        decision: "招生报名后自动生成排课待办，防止报名学生没有进入正式上课流程。",
        systemFlowTask: true,
        flowKey: "admissions-to-paike",
        moduleHref: "./paike.html"
      });
    }
    teacherTodayGroups.forEach((rows, teacher) => {
      const ownerGroups = new Map();
      rows.forEach((row) => {
        const owner = resolveAcademicFlowOwner(teacher, {
          grade: row.grade,
          className: row.className,
          studentName: row.studentName,
          courseName: row.courseName,
          content: `${row.className || ""} ${row.studentName || ""} ${row.courseName || ""}`
        });
        const key = owner.username || owner.name || "unassigned";
        if (!ownerGroups.has(key)) ownerGroups.set(key, { owner, rows: [] });
        ownerGroups.get(key).rows.push(row);
      });
      ownerGroups.forEach(({ owner, rows: ownerRows }) => {
        const delegated = normalizePersonName(owner.name) !== normalizePersonName(teacher);
        const ownerKey = owner.username || normalizePersonName(owner.name);
        tasks.push({
          id: `flow-today-attendance-${employeeUsernameByName(teacher) || normalizePersonName(teacher)}-${ownerKey}`,
          entryType: "task",
          title: `【今日点名】${teacher} 今天 ${ownerRows.length} 条排课待点名`,
          category: "点名闭环",
          impact: "high",
          content: `今天 ${today} 已有排课，但系统还没检测到对应点名记录。${delegated ? `该老师教务流程由${owner.name}主要管理，请学管确认点名或转授课老师补充。` : "请老师课前或课中进入学生服务系统完成点名；如果课程取消或调课，请让排课负责人同步修改。"}\n\n课程样例：${ownerRows.slice(0, 8).map((row) => `${row.startTime || "-"} ${row.className || row.studentName || "-"} ${row.roomName ? `｜${row.roomName}` : ""}`).join("；")}`,
          author: "系统联动",
          authorUsername: "",
          anonymous: false,
          createdAt: today,
          updatedAt: new Date().toISOString(),
          status: "assigned",
          owner: owner.name,
          ownerUsername: owner.username,
          dueDate: today,
          verifier: "高芳燕",
          taskId: `task-flow-today-attendance-${employeeUsernameByName(teacher) || normalizePersonName(teacher)}-${ownerKey}`,
          taskStandard: "当天课程必须保存点名；未到、请假、迟到、出门测修正都要有明确记录。",
          subtasks: [
            "1. 打开学生与家长服务系统。",
            "2. 选择对应课程系统、日期、时间、老师和班级。",
            "3. 逐个点名，不默认全到。",
            "4. 保存本节点名，缺勤学生继续补处理口径。"
          ].join("\n"),
          completionReport: "",
          decision: "排课生成当天点名任务，防止老师忘记点名，影响课销和课时费。",
          systemFlowTask: true,
          flowKey: "schedule-to-attendance",
          flowTeacher: teacher,
          delegatedAcademicOwner: delegated,
          moduleHref: "./student-service.html"
        });
      });
    });
    if (unresolvedRows.length) {
      const exceptionGroups = new Map();
      unresolvedRows.forEach(({ session, row }) => {
        const delegated = delegatedAcademicOwner(session.teacher, {
          grade: session.grade,
          className: session.className || session.courseName,
          studentName: row.studentName || row.student,
          content: `${session.className || ""} ${session.courseName || ""} ${row.studentName || row.student || ""}`
        });
        const owner = delegated || studentServiceFallbackOwner;
        const key = owner.username || owner.name;
        if (!exceptionGroups.has(key)) exceptionGroups.set(key, { owner, rows: [] });
        exceptionGroups.get(key).rows.push({ session, row });
      });
      exceptionGroups.forEach(({ owner, rows }) => {
        tasks.push({
          id: `flow-attendance-exceptions-${owner.username || normalizePersonName(owner.name)}`,
          entryType: "task",
          title: `【缺勤闭环】${rows.length} 人次点名异常待处理`,
          category: "课销闭环",
          impact: "high",
          content: `点名系统里还有 ${rows.length} 人次未点名、缺勤、请假或待联系家长。财务系统会把这些人次作为暂缓项，不直接进入正式课时费/课销确认。\n\n样例：${rows.slice(0, 8).map(({ session, row }) => `${session.date || "-"}｜${session.teacher || "-"}｜${row.studentName || row.student || "-"}｜${row.status || "未点名"}`).join("；")}`,
          author: "系统联动",
          authorUsername: "",
          anonymous: false,
          createdAt: today,
          updatedAt: new Date().toISOString(),
          status: "assigned",
          owner: owner.name,
          ownerUsername: owner.username,
          dueDate: "",
          verifier: "程志豪",
          taskId: `task-flow-attendance-exceptions-${owner.username || normalizePersonName(owner.name)}`,
          taskStandard: "每个未到/异常学生都必须落实处理口径：不销课、正常销课、线下补课、视频补课、录播核销、请假顺延或待联系家长。",
          subtasks: [
            "1. 打开学生服务系统的缺勤异常处理。",
            "2. 按日期、时间、老师、班级筛选。",
            "3. 给每个学生选择处理方式并保存。",
            "4. 再回财务系统确认暂缓项是否下降。"
          ].join("\n"),
          completionReport: "",
          decision: "缺勤异常未闭环前不进入正式课销和普通财务结算。",
          systemFlowTask: true,
          flowKey: "attendance-exception-to-finance-hold",
          moduleHref: "./student-service.html"
        });
      });
    }
    return tasks;
  }

  function getDataStatus(config) {
    const hasData = localStorage.getItem(config.key) !== null;
    const count = countStoreRows(config);
    if (!hasData) {
      return { label: "待录入", className: "status-warn", detail: "当前账号还没有读取到本系统业务数据。" };
    }
    if (config.type === "teachingQuality") {
      return { label: "采集中", className: "status-warn", detail: `当前 ${count} 条记录，按真实巡课、问卷和整改数据统计。` };
    }
    return { label: "已读取", className: "status-ok", detail: `当前账号读取到 ${count} 条/类记录，云端状态见下方落地状态。` };
  }

  function getEmployeeState() {
    const employees = Array.isArray(window.JRC_EMPLOYEES) ? window.JRC_EMPLOYEES : [];
    const custom = safeParse(localStorage.getItem("jrc-employee-directory-extra"), []);
    const all = [...employees, ...(Array.isArray(custom) ? custom : [])];
    const missing = all.filter((employee) => !employee.phone || !employee.wechat || !employee.hireDate);
    return { total: all.length, missing: missing.length };
  }

  function todoItem(level, title, detail, href, actionText) {
    return todoItemHtml(level, title, `<p>${escapeHtml(detail)}</p>`, href, actionText);
  }

  function todoItemHtml(level, title, detailHtml, href, actionText) {
    const className = level === "紧急" ? "status-danger" : level === "提醒" ? "status-warn" : "status-ok";
    return `
      <div class="workbench-item">
        <span class="badge ${className}">${escapeHtml(level)}</span>
        <div>
          <strong>${escapeHtml(title)}</strong>
          ${detailHtml}
        </div>
        <a class="text-link" href="${escapeHtml(href)}">${escapeHtml(actionText)}</a>
      </div>
    `;
  }

  function taskDetailText(task, dueText) {
    if (!task?.moduleOwnerTask) return `${taskStatusText(task.status)}｜负责人 ${task.owner || "未分配"}｜${dueText}`;
    return [
      `负责人：${task.owner || "未分配"}｜${dueText}`,
      task.content || "",
      task.taskStandard ? `完成标准：${task.taskStandard}` : "",
      task.subtasks ? `试用步骤：\n${task.subtasks}` : ""
    ].filter(Boolean).join("\n\n");
  }

  function splitGuideSections(text) {
    const knownLabels = ["使用逻辑", "试用重点", "当前口径", "联动重点", "反馈要求", "试用闭环"];
    return String(text || "")
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const match = line.match(/^([^：:]{2,8})[：:](.*)$/);
        if (!match || !knownLabels.includes(match[1])) {
          return { label: "说明", value: line };
        }
        return { label: match[1], value: match[2].trim() };
      });
  }

  function guideValueHtml(label, value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    if (label === "使用逻辑" && raw.includes("→")) {
      const steps = raw.split("→").map((item) => item.trim()).filter(Boolean);
      return `<ol class="task-guide-steps">${steps.map((step) => `<li>${escapeHtml(step)}</li>`).join("")}</ol>`;
    }
    const numberedParts = raw
      .replace(/\s*(\d+\.)\s*/g, "\n$1 ")
      .split(/\n+/)
      .map((item) => item.trim())
      .filter(Boolean);
    if (numberedParts.length > 1 && numberedParts.some((item) => /^\d+\./.test(item))) {
      return `<ul class="task-guide-list">${numberedParts.map((item) => `<li>${escapeHtml(item.replace(/^\d+\.\s*/, ""))}</li>`).join("")}</ul>`;
    }
    const parts = raw.split(/；|;|\n/).map((item) => item.trim()).filter(Boolean);
    if (parts.length > 1) {
      return `<ul class="task-guide-list">${parts.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
    }
    return `<p>${escapeHtml(raw)}</p>`;
  }

  function moduleTaskDetailHtml(task, dueText) {
    const sections = [
      { label: "负责人", value: `${task.owner || "未分配"}｜${dueText}` },
      { label: "负责模块", value: task.moduleSystem || String(task.title || "").replace(/^【模块负责人】/, "").replace(/试用监管$/, "") }
    ];
    splitGuideSections(task.moduleGuide || task.content).forEach((section) => {
      sections.push(section);
    });
    if (task.taskStandard) sections.push({ label: "完成标准", value: task.taskStandard });
    if (task.subtasks) sections.push({ label: "试用步骤", value: task.subtasks });

    return `
      <div class="task-guide-card">
        ${sections.filter((section) => section.value).map((section) => `
          <section class="task-guide-block">
            <span>${escapeHtml(section.label)}</span>
            ${guideValueHtml(section.label, section.value)}
          </section>
        `).join("")}
        <div class="task-guide-actions">
          <a class="task-guide-button" href="${escapeHtml(task.moduleHref || "./suggestions.html")}">打开负责系统</a>
          <a class="task-guide-button secondary" href="./suggestions.html">提交/查看反馈</a>
        </div>
      </div>
    `;
  }

  function feedbackReviewTaskDetailHtml(task) {
    const rows = Array.isArray(task.feedbackReviewRows) ? task.feedbackReviewRows : [];
    const previewRows = rows.slice(0, 5);
    return `
      <div class="task-guide-card">
        <section class="task-guide-block">
          <span>复核方法</span>
          <p>请回到对应系统重新测试。已经解决的，到“我的反馈问题”里点“确认已解决”；仍有问题的，点“仍有问题”并补充页面、设备、操作步骤和截图。</p>
        </section>
        ${previewRows.map((row) => `
          <section class="task-guide-block">
            <span>${escapeHtml(`第${row.seq}条｜${row.system}｜${row.status}`)}</span>
            <p><strong>处理说明：</strong>${escapeHtml(row.resolution)}</p>
            <p><strong>请复核：</strong>${escapeHtml(row.action)}</p>
          </section>
        `).join("")}
        ${rows.length > previewRows.length ? `<section class="task-guide-block"><span>还有 ${escapeHtml(rows.length - previewRows.length)} 条</span><p>进入“我的反馈问题”查看并逐条确认。</p></section>` : ""}
        <div class="task-guide-actions">
          <a class="task-guide-button" href="./trial-feedback.html?filter=mine-review">打开我的反馈问题</a>
        </div>
      </div>
    `;
  }

  function systemFlowTaskDetailHtml(task, dueText) {
    const sections = [
      { label: "处理人", value: `${task.owner || "未分配"}｜${dueText}` },
      { label: "断点说明", value: task.content || "" },
      { label: "完成标准", value: task.taskStandard || "" },
      { label: "处理步骤", value: task.subtasks || "" }
    ].filter((section) => section.value);
    return `
      <div class="task-guide-card">
        ${sections.map((section) => `
          <section class="task-guide-block">
            <span>${escapeHtml(section.label)}</span>
            ${guideValueHtml(section.label, section.value)}
          </section>
        `).join("")}
        <div class="task-guide-actions">
          <a class="task-guide-button" href="${escapeHtml(task.moduleHref || "./suggestions.html")}">打开处理页面</a>
          <a class="task-guide-button secondary" href="./suggestions.html">查看任务台账</a>
        </div>
      </div>
    `;
  }

  function isOpenTask(item) {
    return ["assigned", "doing"].includes(item?.status);
  }

  function taskDueLevel(item) {
    if (!item?.dueDate || ["launched", "review", "paused"].includes(item.status)) return "正常";
    const due = new Date(`${item.dueDate}T00:00:00`);
    const now = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00");
    const diffDays = Math.ceil((due - now) / 86400000);
    if (diffDays < 0) return "紧急";
    if (diffDays <= 1) return "提醒";
    return "正常";
  }

  function taskStatusText(status) {
    return {
      assigned: "已转任务",
      doing: "执行中",
      review: "已完成",
      launched: "已完成",
      paused: "暂缓"
    }[status] || "待处理";
  }

  function buildModuleOwnerTask(task) {
    const date = "2026-06-26";
    return {
      id: `module-owner-${task.key}`,
      entryType: "task",
      title: `【模块负责人】${task.system}试用监管`,
      category: "技术工具",
      impact: "high",
      content: `责任人：${task.owner}\n负责模块：${task.system}\n\n${task.guide}\n\n试用闭环：发现问题请直接点右下角“反馈问题”；管理员处理后，要在“我的反馈问题”里复核，已解决就确认，没解决就继续补充反馈。`,
      author: "系统分派",
      authorUsername: "",
      anonymous: false,
      createdAt: date,
      status: "assigned",
      owner: task.owner,
      ownerUsername: task.ownerUsername,
      dueDate: "",
      verifier: "程志豪",
      taskId: `task-module-owner-${task.key}`,
      taskStandard: `把${task.system}试到“老师能理解、能操作、能发现问题、能闭环整改”的程度。`,
      subtasks: [
        `1. 先按使用逻辑完整走一遍${task.system}。`,
        "2. 记录看不懂、不顺手、数据不对、手机/iPad不好点的地方。",
        "3. 把问题通过右下角“反馈问题”提交，不要只在群里口头说。",
        "4. 管理员处理后，在“我的反馈问题”里复核是否真的解决。",
        "5. 仍有问题就继续反馈，直到模块能稳定落地。"
      ].join("\n"),
      completionReport: "",
      rewardLevel: "none",
      rewardAmount: "",
      rewardReason: "",
      rewardStatus: "none",
      votes: 0,
      votedBy: [],
      liked: false,
      decision: `${task.owner}负责${task.system}试用监管、问题整理和整改复核。`,
      comments: [{ author: "系统", text: "模块负责人任务已自动分派。", time: date }],
      moduleOwnerTask: true,
      moduleKey: task.key,
      moduleSystem: task.system,
      moduleGuide: task.guide,
      moduleHref: task.href
    };
  }

  function mergeModuleOwnerTasks(rows) {
    const list = Array.isArray(rows) ? [...rows] : [];
    let changed = false;
    const byId = new Map(list.map((item) => [String(item?.id || ""), item]));
    moduleOwnerTasks.forEach((task) => {
      const seed = buildModuleOwnerTask(task);
      const current = byId.get(seed.id);
      if (!current) {
        list.unshift(seed);
        changed = true;
        return;
      }
      const updated = {
        ...current,
        title: seed.title,
        category: seed.category,
        impact: seed.impact,
        content: seed.content,
        owner: seed.owner,
        ownerUsername: seed.ownerUsername,
        verifier: seed.verifier,
        taskId: current.taskId || seed.taskId,
        taskStandard: seed.taskStandard,
        subtasks: seed.subtasks,
        decision: seed.decision,
        moduleOwnerTask: true,
        moduleKey: seed.moduleKey,
        moduleSystem: seed.moduleSystem,
        moduleGuide: seed.moduleGuide,
        moduleHref: seed.moduleHref,
        entryType: "task",
        status: ["review", "launched", "paused"].includes(current.status) ? current.status : (current.status || seed.status)
      };
      if (JSON.stringify(updated) !== JSON.stringify(current)) {
        Object.assign(current, updated);
        changed = true;
      }
    });
    return { rows: list, changed };
  }

  function buildFeedbackReviewTask(group) {
    const rows = Array.isArray(group?.rows) ? group.rows : [];
    const total = rows.length;
    const date = "2026-06-27";
    return {
      id: `feedback-review-${group.username || group.teacher}`,
      entryType: "task",
      title: `【反馈复核】${group.teacher}试用问题复核`,
      category: "技术工具",
      impact: "high",
      content: `责任人：${group.teacher}\n复核范围：${total} 条本人提交的试用反馈\n\n复核方法：请回到对应系统重新测试。已经解决的，到“我的反馈问题”里点“确认已解决”；仍有问题的，点“仍有问题”并补充页面、设备、操作步骤和截图。`,
      author: "系统分派",
      authorUsername: "",
      anonymous: false,
      createdAt: date,
      status: "assigned",
      owner: group.teacher,
      ownerUsername: group.username || "",
      dueDate: "",
      verifier: "程志豪",
      taskId: `task-feedback-review-${group.username || group.teacher}`,
      taskStandard: "逐条复核自己提交的试用反馈，已解决就本人确认闭环；仍有问题就继续补充反馈，不再让已解决问题反复进入下轮台账。",
      subtasks: [
        "1. 打开主页“我的反馈”，先看待我复核的条目。",
        "2. 按任务里的复核动作回到对应模块重新测试。",
        "3. 已经解决的，在“我的反馈问题”里点“确认已解决”。",
        "4. 仍有问题的，点“仍有问题”，补充设备、账号、页面、操作步骤和截图。",
        "5. 已确认解决的反馈，下次导出待整改台账时不再反复处理。"
      ].join("\n"),
      completionReport: "",
      rewardLevel: "none",
      rewardAmount: "",
      rewardReason: "",
      rewardStatus: "none",
      votes: 0,
      votedBy: [],
      liked: false,
      decision: `${group.teacher}需要复核自己提交的 ${total} 条试用反馈。`,
      comments: [{ author: "系统", text: "试用反馈复核任务已自动生成。", time: date }],
      feedbackReviewTask: true,
      feedbackReviewCount: total,
      feedbackReviewRows: rows.map(({ row, plan }) => ({
        seq: plan.seq,
        feedbackId: row?.id || "",
        system: row?.system || plan.system,
        status: plan.status,
        resolution: plan.resolution,
        action: plan.action,
        content: row?.content || ""
      }))
    };
  }

  function mergeFeedbackReviewTasks(rows, feedbackRows) {
    const planner = window.JRC_FEEDBACK_REVIEW_PLAN;
    if (!planner?.groupRowsByReviewer) return { rows: Array.isArray(rows) ? rows : [], changed: false };
    const list = Array.isArray(rows) ? [...rows] : [];
    let changed = false;
    const byId = new Map(list.map((item) => [String(item?.id || ""), item]));
    const groups = planner.groupRowsByReviewer(feedbackRows);
    groups.forEach((group) => {
      if (!group.rows.length) return;
      const seed = buildFeedbackReviewTask(group);
      const current = byId.get(seed.id);
      if (!current) {
        list.unshift(seed);
        changed = true;
        return;
      }
      const updated = {
        ...current,
        title: seed.title,
        category: seed.category,
        impact: seed.impact,
        content: seed.content,
        owner: seed.owner,
        ownerUsername: seed.ownerUsername,
        verifier: seed.verifier,
        taskId: current.taskId || seed.taskId,
        taskStandard: seed.taskStandard,
        subtasks: seed.subtasks,
        decision: seed.decision,
        entryType: "task",
        feedbackReviewTask: true,
        feedbackReviewCount: seed.feedbackReviewCount,
        feedbackReviewRows: seed.feedbackReviewRows,
        status: ["review", "launched", "paused"].includes(current.status) ? current.status : (current.status || seed.status)
      };
      if (JSON.stringify(updated) !== JSON.stringify(current)) {
        Object.assign(current, updated);
        changed = true;
      }
    });
    return { rows: list, changed };
  }

  async function buildSystemFlowTasks() {
    const [admissionsState, paikeRegular, paikePreimport, attendanceSessions] = await Promise.all([
      readLinkedStore(admissionsKey, {}),
      readLinkedStore(paikeRegularKey, {}),
      readLinkedStore(paikePreimportKey, {}),
      readLinkedStore(attendanceKey, [])
    ]);
    const preimportBundle = mergeLinkedStoreValue(window.JRC_PREIMPORT_BUNDLE || window.JRC_PREIMPORT_SUMMARY || {}, paikePreimport || {});
    const scheduleRows = mergeScheduleRows(
      normalizeScheduleRowsFromRegular(paikeRegular),
      normalizeScheduleRowsFromPreimport(preimportBundle)
    );
    return buildOperationalTasks({
      admissionsState,
      scheduleRows,
      attendanceSessions: Array.isArray(attendanceSessions) ? attendanceSessions : []
    });
  }

  function mergeSystemFlowTasks(rows, flowTasks) {
    const list = Array.isArray(rows) ? [...rows] : [];
    let changed = false;
    const seeds = Array.isArray(flowTasks) ? flowTasks : [];
    const liveIds = new Set(seeds.map((task) => String(task.id || task.taskId || "").trim()).filter(Boolean));
    const byId = new Map(list.map((item) => [String(item?.id || item?.taskId || ""), item]));

    seeds.forEach((seed) => {
      const current = byId.get(seed.id);
      if (!current) {
        list.unshift(seed);
        changed = true;
        return;
      }
      const updated = {
        ...current,
        ...seed,
        status: current.status === "doing" ? "doing" : seed.status,
        completionReport: current.completionReport || "",
        comments: Array.isArray(current.comments) && current.comments.length ? current.comments : seed.comments || []
      };
      if (JSON.stringify(updated) !== JSON.stringify(current)) {
        Object.assign(current, updated);
        changed = true;
      }
    });

    list.forEach((item) => {
      if (!item?.systemFlowTask) return;
      const id = String(item.id || item.taskId || "").trim();
      if (liveIds.has(id)) return;
      if (!["assigned", "doing"].includes(item.status)) return;
      item.status = "review";
      item.updatedAt = new Date().toISOString();
      item.completionReport = item.completionReport || "系统已检测到该数据断点暂时消失，任务自动转为已完成待复核。";
      item.comments = Array.isArray(item.comments) ? item.comments : [];
      item.comments.push({ author: "系统联动", text: "数据断点已消失，自动关闭首页待办。", time: new Date().toISOString().slice(0, 10) });
      changed = true;
    });

    return { rows: list, changed };
  }

  function mergeTaskRows(...groups) {
    const map = new Map();
    groups.flat().forEach((row) => {
      if (!row || typeof row !== "object") return;
      const id = String(row.id || row.taskId || "").trim();
      if (!id) return;
      const existing = map.get(id) || {};
      const incomingTime = Date.parse(row.updatedAt || row.createdAt || row.time || "") || 0;
      const existingTime = Date.parse(existing.updatedAt || existing.createdAt || existing.time || "") || 0;
      map.set(id, incomingTime >= existingTime ? { ...existing, ...row, id } : { ...row, ...existing, id });
    });
    return [...map.values()].sort((left, right) => String(right.updatedAt || right.createdAt || "").localeCompare(String(left.updatedAt || left.createdAt || "")));
  }

  function taskRelatedToCurrentUser(item) {
    const employee = currentEmployee();
    const name = employee?.name || "";
    const username = String(employee?.username || "").trim().toLowerCase();
    if (!name && !username) return false;
    return String(item.owner || "") === name || String(item.ownerUsername || "").trim().toLowerCase() === username;
  }

  function isOperationalFlowTask(item) {
    return Boolean(item?.systemFlowTask || String(item?.id || "").startsWith("flow-") || String(item?.flowKey || ""));
  }

  function isFeedbackReviewTask(item) {
    return Boolean(item?.feedbackReviewTask || String(item?.id || "").startsWith("feedback-review-"));
  }

  function isFeedbackExecutionTask(item) {
    return Boolean(item?.sourceFeedbackId || String(item?.id || "").startsWith("t-feedback-"));
  }

  function isHumanSuggestionTask(item) {
    return !item?.moduleOwnerTask && !isOperationalFlowTask(item) && !isFeedbackReviewTask(item);
  }

  function suggestionTaskHref(task) {
    const id = encodeURIComponent(task.id || task.taskId || "");
    return id ? `./suggestions.html?task=${id}` : "./suggestions.html";
  }

  function feedbackHref(row) {
    const id = encodeURIComponent(row?.id || "");
    return id ? `./trial-feedback.html?feedback=${id}` : "./trial-feedback.html";
  }

  function feedbackRelatedToCurrentUser(item) {
    const employee = currentEmployee();
    const name = String(employee?.name || "").trim();
    const username = String(employee?.username || "").trim().toLowerCase();
    if (!name && !username) return false;
    return String(item?.userName || item?.name || "").trim() === name ||
      String(item?.username || "").trim().toLowerCase() === username;
  }

  function feedbackRowTime(row) {
    const notes = Array.isArray(row?.reviewNotes) ? row.reviewNotes : [];
    const noteTime = notes.map((note) => Date.parse(note?.time || "") || 0).reduce((max, value) => Math.max(max, value), 0);
    return Math.max(
      Date.parse(row?.updatedAt || "") || 0,
      Date.parse(row?.processedAt || "") || 0,
      Date.parse(row?.confirmedAt || "") || 0,
      Date.parse(row?.reopenedAt || "") || 0,
      Date.parse(row?.createdAt || "") || 0,
      noteTime
    );
  }

  function mergeFeedbackRows(...groups) {
    const map = new Map();
    groups.flat().forEach((row) => {
      if (!row || typeof row !== "object") return;
      const id = String(row.id || "").trim();
      if (!id) return;
      const existing = map.get(id);
      if (!existing || feedbackRowTime(row) >= feedbackRowTime(existing)) {
        map.set(id, { ...existing, ...row, id });
      } else {
        map.set(id, { ...row, ...existing, id });
      }
    });
    return [...map.values()]
      .sort((left, right) => feedbackRowTime(right) - feedbackRowTime(left))
      .slice(0, 300);
  }

  function feedbackProgressText(row) {
    const notes = Array.isArray(row?.reviewNotes) ? row.reviewNotes : [];
    const latestNote = notes[notes.length - 1];
    if (siteFeedbackIsClosed(row)) return latestNote?.text || "你已确认解决。";
    if (siteFeedbackNeedsReview(row)) return row?.resolution || latestNote?.text || "已整改，等待你复核是否真正解决。";
    if ((row?.status || "") === "已转任务") return row?.resolution || latestNote?.text || "已转为任务，等待负责人提交完成反馈。";
    return row?.resolution || latestNote?.text || "已提交，等待管理员处理。";
  }

  async function readSiteFeedbackRows() {
    let rows = readStore(siteFeedbackKey, []);
    if (window.JRC_CLOUD?.readModuleData) {
      try {
        const result = await window.JRC_CLOUD.readModuleData(siteFeedbackKey);
        const remoteRows = Array.isArray(result?.data?.payload) ? result.data.payload : [];
        rows = mergeFeedbackRows(remoteRows, rows);
        localStorage.setItem(siteFeedbackKey, JSON.stringify(rows));
      } catch (error) {
        console.warn("Failed to read site feedback", error);
      }
    }
    rows = Array.isArray(rows) ? rows : [];
    const planned = applyFeedbackReviewPlanToRows(rows);
    if (planned.changed) {
      rows = planned.rows;
      localStorage.setItem(siteFeedbackKey, JSON.stringify(rows));
      syncSiteFeedbackRowsToCloud(rows);
    }
    return rows;
  }

  function applyFeedbackReviewPlanToRows(rows) {
    const planner = window.JRC_FEEDBACK_REVIEW_PLAN;
    if (!planner?.findReviewPlan) return { rows: Array.isArray(rows) ? rows : [], changed: false };
    const usedSeqs = new Set();
    let changed = false;
    const nextRows = (Array.isArray(rows) ? rows : []).map((row) => {
      const next = { ...(row || {}) };
      const plan = planner.findReviewPlan(next, usedSeqs);
      if (!plan) return next;
      usedSeqs.add(plan.seq);
      next.reviewPlanSeq = plan.seq;
      next.reviewPlanStatus = plan.status;
      next.reviewAction = plan.action;
      if (!planner.shouldFeedbackEnterReview(next.status)) return next;
      const nextResolution = `${plan.resolution}\n请复核：${plan.action}`;
      if (next.status !== "已整改待复核" || next.resolution !== nextResolution) {
        next.status = "已整改待复核";
        next.resolution = nextResolution;
        next.processedAt = next.processedAt || new Date().toISOString();
        next.processedBy = next.processedBy || "系统复核清单";
        next.updatedAt = new Date().toISOString();
        next.reviewNotes = Array.isArray(next.reviewNotes) ? next.reviewNotes : [];
        const noteText = `复核清单：${plan.status}。${plan.resolution} 请复核：${plan.action}`;
        if (!next.reviewNotes.some((note) => note.text === noteText)) {
          next.reviewNotes.push({ author: "系统复核清单", text: noteText, time: new Date().toISOString().slice(0, 10) });
        }
        changed = true;
      }
      return next;
    });
    return { rows: nextRows, changed };
  }

  function syncSiteFeedbackRowsToCloud(rows) {
    if (!window.JRC_CLOUD?.writeModuleData) return;
    window.JRC_CLOUD.writeModuleData(siteFeedbackKey, "siteFeedback", rows).catch((error) => {
      console.warn("Failed to sync site feedback review plan", error);
    });
  }

  async function syncSuggestionTasksToCloud(rows) {
    if (!window.JRC_CLOUD?.writeModuleData) return;
    let nextRows = Array.isArray(rows) ? rows : [];
    if (window.JRC_CLOUD?.readModuleData) {
      try {
        const result = await window.JRC_CLOUD.readModuleData(suggestionsKey);
        const remoteRows = Array.isArray(result?.data?.payload) ? result.data.payload : [];
        nextRows = mergeTaskRows(remoteRows, nextRows);
      } catch (error) {
        console.warn("Failed to re-read suggestion tasks before sync", error);
      }
    }
    localStorage.setItem(suggestionsKey, JSON.stringify(nextRows));
    window.JRC_CLOUD.writeModuleData(suggestionsKey, "suggestions", nextRows, { replaceMode: "replace" }).catch((error) => {
      console.warn("Failed to sync module owner tasks", error);
    });
  }

  async function readSuggestionTasks() {
    let rows = readStore(suggestionsKey, []);
    let flowRows = [];
    if (window.JRC_CLOUD?.readModuleData) {
      try {
        const result = await window.JRC_CLOUD.readModuleData(suggestionsKey);
        if (result?.ok && result.data?.found && Array.isArray(result.data.payload)) {
          rows = mergeTaskRows(result.data.payload, rows);
          localStorage.setItem(suggestionsKey, JSON.stringify(rows));
        }
      } catch (error) {
        console.warn("Failed to read cloud suggestion tasks", error);
      }
    }
    rows = (Array.isArray(rows) ? rows : []).filter((row) => !isOperationalFlowTask(row));
    flowRows = await buildSystemFlowTasks();
    return mergeTaskRows(Array.isArray(rows) ? rows : [], flowRows);
  }

  async function renderMyTasks() {
    const holder = $("portalMyTaskList");
    const flowHolder = $("portalMyFlowList");
    if (!holder) return;
    if (!hasPermission("suggestions.access")) {
      holder.innerHTML = todoItem("正常", "当前账号未开通任务入口", "需要使用任务协同时，由管理员在校区运营与人事系统里开通建议任务权限。", "./index.html", "返回工作台");
      if (flowHolder) flowHolder.innerHTML = todoItem("正常", "当前账号暂无流程提醒入口", "流程提醒会按责任人分派；需要权限时由管理员开通。", "./index.html", "返回工作台");
      return;
    }
    const rows = await readSuggestionTasks();
    const myOpenRows = rows
      .filter((item) => isOpenTask(item) && taskRelatedToCurrentUser(item));
    const tasks = myOpenRows
      .filter(isHumanSuggestionTask)
      .sort((left, right) => {
        const levelRank = { "紧急": 0, "提醒": 1, "正常": 2 };
        const levelDiff = levelRank[taskDueLevel(left)] - levelRank[taskDueLevel(right)];
        if (levelDiff !== 0) return levelDiff;
        return String(left.dueDate || "9999-12-31").localeCompare(String(right.dueDate || "9999-12-31"));
      });
    const flowTasks = myOpenRows
      .filter(isOperationalFlowTask)
      .sort((left, right) => {
        const levelRank = { "紧急": 0, "提醒": 1, "正常": 2 };
        const levelDiff = levelRank[taskDueLevel(left)] - levelRank[taskDueLevel(right)];
        if (levelDiff !== 0) return levelDiff;
        return String(left.dueDate || "9999-12-31").localeCompare(String(right.dueDate || "9999-12-31"));
      });
    if ($("portalMyTaskBadge")) $("portalMyTaskBadge").textContent = String(tasks.length);
    if ($("portalMyFlowBadge")) $("portalMyFlowBadge").textContent = String(flowTasks.length);
    holder.innerHTML = tasks.length ? tasks.slice(0, 6).map((task) => {
      const level = taskDueLevel(task);
      const dueText = task.dueDate ? `截止 ${task.dueDate}` : "未设截止时间";
      const title = `${level === "紧急" ? "逾期：" : ""}${task.title || "未命名任务"}`;
      const href = task.moduleOwnerTask && task.moduleHref ? task.moduleHref : suggestionTaskHref(task);
      const actionText = task.moduleOwnerTask ? "打开系统" : isFeedbackExecutionTask(task) ? "处理反馈任务" : "处理任务";
      if (task.moduleOwnerTask) {
        return todoItemHtml(level, title, moduleTaskDetailHtml(task, dueText), href, actionText);
      }
      const detail = taskDetailText(task, dueText);
      return todoItem(level, title, detail, href, actionText);
    }).join("") : todoItem(
      "正常",
      "暂无建议任务",
      "别人派给你的建议任务、模块试用监管会显示在这里。",
      "./suggestions.html",
      "进入建议任务"
    );
    if (flowHolder) {
      flowHolder.innerHTML = flowTasks.length ? flowTasks.slice(0, 5).map((task) => {
        const level = taskDueLevel(task);
        const dueText = task.dueDate ? `截止 ${task.dueDate}` : "未设截止时间";
        const title = `${level === "紧急" ? "逾期：" : ""}${task.title || "未命名流程提醒"}`;
        const href = task.moduleHref || "./index.html";
        return todoItemHtml(level, title, systemFlowTaskDetailHtml(task, dueText), href, "去处理");
      }).join("") : todoItem(
        "正常",
        "暂无流程提醒",
        "今日点名、缺勤闭环、报名未排课等会按责任人显示在这里。",
        "./student-service.html",
        "进入学生服务"
      );
    }
  }

  async function renderMyFeedback() {
    const listHolder = $("portalMyFeedbackList");
    const statsHolder = $("portalMyFeedbackStats");
    if (!listHolder) return;
    const rows = await readSiteFeedbackRows();
    const mine = rows.filter(feedbackRelatedToCurrentUser);
    const needReview = mine.filter((row) => !siteFeedbackIsClosed(row) && siteFeedbackNeedsReview(row));
    const reopened = mine.filter((row) => (row?.status || "") === "继续反馈" || siteFeedbackHasLaterReopen(row));
    const closed = mine.filter(siteFeedbackIsClosed);
    const badgeText = needReview.length ? `${needReview.length} 待复核` : "入口";
    if ($("portalMyFeedbackBadge")) $("portalMyFeedbackBadge").textContent = badgeText;
    if (statsHolder) {
      statsHolder.innerHTML = `
        <div class="workbench-kpi-card"><span>待复核</span><strong>${escapeHtml(needReview.length)}</strong></div>
        <div class="workbench-kpi-card"><span>仍有问题</span><strong>${escapeHtml(reopened.length)}</strong></div>
        <div class="workbench-kpi-card"><span>已解决</span><strong>${escapeHtml(closed.length)}</strong></div>
      `;
    }
    const level = needReview.length ? "待办" : reopened.length ? "关注" : "正常";
    const title = needReview.length
      ? `你有 ${needReview.length} 条反馈已整改，等待复核`
      : reopened.length
        ? `你有 ${reopened.length} 条反馈仍在继续处理`
        : "试用反馈统一进专项台账";
    const detail = needReview.length
      ? "请进入试用反馈整改台账，重新测试自己提出的问题；已解决就点确认已解决，仍有问题就补充说明。"
      : "主页只保留轻量提醒。进入后点“只看自己”，可查看提交数量、处理进展、待复核和已解决记录。";
    listHolder.innerHTML = todoItem(level, title, detail, "./trial-feedback.html?filter=mine-review", needReview.length ? "去复核" : "进入台账");
  }

  function setRoleCopy() {
    const tone = roleTone();
    if ($("portalTodayTitle")) $("portalTodayTitle").textContent = tone.title;
    if ($("portalRoleBadge")) $("portalRoleBadge").textContent = tone.badge;
    if ($("portalTodayIntro")) $("portalTodayIntro").textContent = tone.intro;
    if ($("portalRoleWelcome")) $("portalRoleWelcome").textContent = tone.welcome;
  }

  function quickEntriesForRole() {
    const employee = currentEmployee();
    const role = String(employee?.role || "");
    const profileText = [role, employee?.subject, employee?.scope].filter(Boolean).join(" ");
    if (isAdminLike()) {
      return [
        ["课堂反馈AI", "快速整理课堂反馈草稿", "./ai-assistant.html", "ai.access"],
        ["反馈整改", "看待复核、仍有问题和本轮待处理", "./trial-feedback.html", "suggestions.access"],
        ["财务月结", "按老师工资单核对月结", "./finance.html", "finance.access"],
        ["学生服务", "点名、课消、反馈归档", "./student-service.html", "studentService.access"],
        ["短视频系统", "账号巡检、视频诊断和周报", "./video-ops.html", "videoOps.access"]
      ];
    }
    if (role.includes("财务")) {
      return [
        ["老师工资单", "按月份和老师核对本月结算", "./finance.html", "finance.access"],
        ["只看待对账", "快速进入财务待核明细", "./finance.html#financeTeacherDetailSection", "finance.access"],
        ["我的反馈", "复核自己提出的问题", "./trial-feedback.html", "suggestions.access"],
        ["课堂反馈AI", "查看课堂反馈草稿和归档", "./ai-assistant.html", "ai.access"]
      ];
    }
    if (role.includes("学管")) {
      return [
        ["学生服务", "点名、缺勤、家长沟通", "./student-service.html", "studentService.access"],
        ["招生跟进", "线索、试听、报名交接", "/jrcedu/advice-system/index.html", "admissions.access"],
        ["短视频系统", "查看账号数据和拍摄建议", "./video-ops.html", "videoOps.access"],
        ["课堂反馈AI", "整理老师课堂反馈草稿", "./ai-assistant.html", "ai.access"],
        ["我的反馈", "查看问题处理进展", "./trial-feedback.html", "suggestions.access"]
      ];
    }
    if (profileText.includes("授课") || profileText.includes("教师") || profileText.includes("老师")) {
      return [
        ["课堂反馈AI", "下课后快速整理家长反馈", "./ai-assistant.html", "ai.access"],
        ["我的课表", "查看排课和上课安排", "./paike.html", "paike.access"],
        ["学生服务", "点名、出门测、历史反馈", "./student-service.html", "studentService.access"],
        ["教研资料", "查课件、讲义和授课大纲", "./curriculum-products.html", "curriculum.access"]
      ];
    }
    return [
      ["课堂反馈AI", "整理课堂反馈草稿", "./ai-assistant.html", "ai.access"],
      ["我的任务", "查看建议任务和反馈复核", "./suggestions.html", "suggestions.access"],
      ["学生服务", "查看学生与家长服务", "./student-service.html", "studentService.access"],
      ["排课系统", "查看课程安排", "./paike.html", "paike.access"]
    ];
  }

  function renderQuickEntries() {
    const holder = $("portalQuickEntries");
    if (!holder) return;
    const rows = quickEntriesForRole().filter(([, , , permission]) => !permission || hasPermission(permission));
    holder.innerHTML = rows.length ? rows.map(([title, note, href]) => `
      <a class="quick-entry-card" href="${escapeHtml(href)}">
        <strong>${escapeHtml(title)}</strong>
        <span>${escapeHtml(note)}</span>
      </a>
    `).join("") : `
      <a class="quick-entry-card" href="./suggestions.html">
        <strong>进入任务系统</strong>
        <span>当前账号暂无常用入口，请联系管理员确认权限。</span>
      </a>
    `;
  }

  function setManagementVisibility() {
    const visible = isAdminLike();
    const diagnostics = $("portalAdminDiagnostics");
    const localDataCard = $("portalLocalDataCard");
    const dataStateSection = $("portalDataStateSection");
    const cloudReadinessSection = $("portalCloudReadinessSection");
    const dataContractSection = $("portalDataContractSection");
    if (diagnostics) diagnostics.hidden = !visible;
    [localDataCard, dataStateSection, cloudReadinessSection, dataContractSection].forEach((node) => {
      if (node && diagnostics?.contains(node)) node.hidden = false;
      else if (node) node.hidden = !visible;
    });
  }

  function bindAdminDiagnosticsToggle() {
    const diagnostics = $("portalAdminDiagnostics");
    if (!diagnostics) return;
    document.querySelectorAll("[data-open-admin-diagnostics]").forEach((node) => {
      node.addEventListener("click", () => {
        diagnostics.open = true;
        renderAdminDiagnosticsOnce(true);
      });
    });
    diagnostics.addEventListener("toggle", () => {
      if (diagnostics.open) renderAdminDiagnosticsOnce(true);
    });
  }

  async function renderAdminDiagnosticsOnce(force = false) {
    if (!isAdminLike()) return;
    const diagnostics = $("portalAdminDiagnostics");
    if (!force && !diagnostics?.open) return;
    if (adminDiagnosticsLoaded || adminDiagnosticsLoading) return;
    adminDiagnosticsLoading = true;
    try {
      renderDataStates();
      renderDataFlows();
      await Promise.allSettled([
        renderCloudReadiness(),
        renderLinkHealth()
      ]);
      adminDiagnosticsLoaded = true;
    } finally {
      adminDiagnosticsLoading = false;
    }
  }

  function renderPortalDashboard() {
    setRoleCopy();
    renderQuickEntries();
    setManagementVisibility();
    bindAdminDiagnosticsToggle();
    reorderSystemCards();
    const { leads, pending } = readAdmissions();
    const auditCount = readAuditCount();
    const employeeState = getEmployeeState();
    const paikeReviewCount = getPaikeReviewCount();
    const qualityOpenTickets = getTeachingQualityOpenTickets();

    if ($("portalAdmissionsCount")) $("portalAdmissionsCount").textContent = String(leads.length);
    if ($("portalAdmissionsTodoCount")) $("portalAdmissionsTodoCount").textContent = String(pending.length);
    if ($("portalAuditCount")) $("portalAuditCount").textContent = String(auditCount);

    const todos = [];
    if (hasPermission("admissions.access") && pending.length > 0) {
      todos.push(todoItem(
        "紧急",
        `招生系统有 ${pending.length} 条待处理线索`,
        "包含待分配、缺字段、新建未联系、试听后待转化或 A 类高意向未报名线索。",
        "/jrcedu/advice-system/index.html",
        "处理招生"
      ));
    }

    if (hasPermission("paike.access") && paikeReviewCount > 0) {
      todos.push(todoItem(
        "紧急",
        `排课系统有 ${paikeReviewCount} 条待确认项`,
        "老师 Excel 导入后留下的疑问、缺教室、命名不一致或待排课老师拍板事项，需要优先清理。",
        "./paike.html",
        "处理排课"
      ));
    }

    if (hasPermission("teachingQuality.access") && qualityOpenTickets.length > 0) {
      todos.push(todoItem(
        "提醒",
        `教学质量有 ${qualityOpenTickets.length} 条未闭环整改`,
        "请按真实巡课、问卷和教务复查结果处理整改闭环。",
        "./teaching-quality.html",
        "看教学质量"
      ));
    }

    if (hasPermission("hr.access") && employeeState.missing > 0) {
      todos.push(todoItem(
        "提醒",
        `员工资料还有 ${employeeState.missing} 人待补齐`,
        "优先补手机号、微信号、入职日期、岗位和权限，后面会影响登录、财务和人事统计。",
        "./hr-training.html",
        "人事管理"
      ));
    }

    if (todos.length === 0) {
      todos.push(todoItem(
        "正常",
        "今天没有必须处理的系统断点",
        "先看“我的任务”和“我的反馈”；日常工作从下面对应系统进入。管理员诊断区只在排查异常时打开。",
        "./suggestions.html",
        "查看任务"
      ));
    }

    const holder = $("portalTodoList");
    if (holder) holder.innerHTML = todos.join("");
    renderMyTasks();
    renderMyFeedback();

    if ($("portalAdminDiagnostics")?.open) {
      renderAdminDiagnosticsOnce(true);
    }
  }

  function renderDataStates() {
    const holder = $("portalDataStateList");
    if (!holder) return;
    holder.innerHTML = systemStores.map((config) => {
      const status = getDataStatus(config);
      return `
        <a class="data-state-card" href="${config.href}" style="text-decoration:none;">
          <strong>${config.label}</strong>
          <span class="badge ${status.className}">${status.label}</span>
          <p>${status.detail}</p>
        </a>
      `;
    }).join("");
  }

  function readinessCard(title, label, className, detail) {
    return `
      <div class="cloud-readiness-card">
        <strong>${escapeHtml(title)}</strong>
        <span class="badge ${className}">${escapeHtml(label)}</span>
        <p>${escapeHtml(detail)}</p>
      </div>
    `;
  }

  function countCloudPayload(payload) {
    if (Array.isArray(payload)) return payload.length;
    if (!payload || typeof payload !== "object") return 0;
    if (Array.isArray(payload.leads)) return payload.leads.length;
    if (payload.periods || payload.expenses) return Object.keys(payload.periods || {}).length + (payload.expenses || []).length;
    if (Array.isArray(payload.tickets) || Array.isArray(payload.inspections)) return (payload.tickets || []).length + (payload.inspections || []).length;
    return Object.keys(payload).length;
  }

  function normalizeCloudStorePayload(payload) {
    if (!payload || typeof payload !== "object") return payload;
    if (payload.parsedValue && typeof payload.parsedValue === "object") return payload.parsedValue;
    if (typeof payload.rawValue === "string") {
      try {
        return JSON.parse(payload.rawValue);
      } catch {
        return payload;
      }
    }
    return payload;
  }

  function linkedRowTime(row) {
    const value = String(row?.updatedAt || row?.createdAt || row?.at || row?.time || row?.date || row?.courseDate || "").trim();
    const parsed = Date.parse(value.replace(/\./g, "/").replace(" ", "T"));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function linkedRowKey(row) {
    if (!row || typeof row !== "object") return "";
    const explicit = [
      row.archiveKey,
      row.id,
      row.rowId,
      row.taskId,
      row.leadId,
      row.followupId,
      row.auditId,
      row.sourceFeedbackId,
      row.fileStorageKey
    ].map((value) => String(value || "").trim()).find(Boolean);
    if (explicit) return explicit;
    const sourceDraftId = String(row.sourceDraftId || "").trim();
    if (sourceDraftId) return `draft:${sourceDraftId}`;
    return [
      row.student || row.studentName || row.name,
      row.teacher || row.teacherName || row.owner,
      row.className || row.courseName || row.title,
      row.date || row.courseDate || row.sourceDate,
      row.lessonSeason,
      row.lessonNumber,
      row.createdAt || row.at
    ].map((value) => String(value || "").trim().replace(/\s+/g, "")).filter(Boolean).join("|");
  }

  function mergeLinkedRows(...groups) {
    const map = new Map();
    groups.flat().forEach((row) => {
      if (!row || typeof row !== "object") return;
      const key = linkedRowKey(row);
      if (!key) return;
      const existing = map.get(key);
      if (!existing) {
        map.set(key, { ...row });
        return;
      }
      const incomingIsNewer = linkedRowTime(row) >= linkedRowTime(existing);
      map.set(key, incomingIsNewer ? { ...existing, ...row } : { ...row, ...existing });
    });
    return [...map.values()].sort((left, right) => String(right.updatedAt || right.createdAt || right.at || "").localeCompare(String(left.updatedAt || left.createdAt || left.at || "")));
  }

  function mergeLinkedObjects(localValue, remoteValue) {
    const localObject = localValue && typeof localValue === "object" && !Array.isArray(localValue) ? localValue : {};
    const remoteObject = remoteValue && typeof remoteValue === "object" && !Array.isArray(remoteValue) ? remoteValue : {};
    const result = { ...localObject, ...remoteObject };
    new Set([...Object.keys(localObject), ...Object.keys(remoteObject)]).forEach((key) => {
      const localPart = localObject[key];
      const remotePart = remoteObject[key];
      if (Array.isArray(localPart) || Array.isArray(remotePart)) {
        result[key] = mergeLinkedRows(
          Array.isArray(localPart) ? localPart : [],
          Array.isArray(remotePart) ? remotePart : []
        );
        return;
      }
      if (localPart && remotePart && typeof localPart === "object" && typeof remotePart === "object") {
        result[key] = mergeLinkedObjects(localPart, remotePart);
      }
    });
    return result;
  }

  function mergeLinkedStoreValue(localValue, remoteValue) {
    if (Array.isArray(localValue) || Array.isArray(remoteValue)) {
      return mergeLinkedRows(Array.isArray(localValue) ? localValue : [], Array.isArray(remoteValue) ? remoteValue : []);
    }
    if (localValue && remoteValue && typeof localValue === "object" && typeof remoteValue === "object") {
      return mergeLinkedObjects(localValue, remoteValue);
    }
    return remoteValue ?? localValue;
  }

  async function readLinkedStore(key, fallback) {
    let value = readStore(key, fallback);
    if (window.JRC_CLOUD?.readModuleData) {
      try {
        const result = await window.JRC_CLOUD.readModuleData(key);
        if (result?.ok && result.data?.found) {
          const remoteValue = normalizeCloudStorePayload(result.data.payload);
          value = mergeLinkedStoreValue(value, remoteValue);
          localStorage.setItem(key, JSON.stringify(value));
        }
      } catch (error) {
        console.warn("Failed to read linked store", key, error);
      }
    }
    return value ?? fallback;
  }

  function normalizeLinkPart(value) {
    return String(value || "").trim().replace(/\s+/g, "").replace(/[，,、;；]+/g, "+");
  }

  function compactLinkKey(...values) {
    return values.map(normalizeLinkPart).filter(Boolean).join("|");
  }

  function attendanceSessionKey(session) {
    return compactLinkKey(
      session?.date,
      session?.teacher,
      session?.className
    );
  }

  function attendanceStudentKey(session, row) {
    return compactLinkKey(
      session?.date,
      session?.teacher,
      session?.className,
      row?.studentName || row?.student
    );
  }

  function scheduleStudentKey(row) {
    return compactLinkKey(
      row?.date || row?.courseDate,
      row?.teacherName || row?.teacher,
      row?.className,
      row?.studentName || row?.student
    );
  }

  function studentServiceAttendanceKey(row) {
    return compactLinkKey(
      row?.sourceDate || row?.date || row?.createdAt,
      row?.teacher || row?.teacherName,
      row?.className || row?.courseName,
      row?.student || row?.studentName || row?.name
    );
  }

  function normalizePersonName(value) {
    return String(value || "").trim().replace(/\s+/g, "");
  }

  function studentServiceNameSet(rows) {
    const names = new Set();
    (Array.isArray(rows) ? rows : []).forEach((row) => {
      const student = normalizePersonName(row?.student || row?.studentName || row?.name);
      if (student) names.add(student);
    });
    return names;
  }

  function siteFeedbackTimelineEntries(row) {
    const notes = Array.isArray(row?.reviewNotes) ? row.reviewNotes : [];
    return notes.map((note) => String(note?.text || ""));
  }

  function siteFeedbackHasConfirmedSolved(row) {
    return (row?.status || "") === "已确认解决" ||
      siteFeedbackTimelineEntries(row).some((text) => /确认解决|已解决|提交人已确认解决/.test(text));
  }

  function siteFeedbackHasLaterReopen(row) {
    if ((row?.status || "") === "继续反馈") return true;
    const notes = siteFeedbackTimelineEntries(row);
    const lastSolvedIndex = notes.reduce((latest, text, index) => (
      /确认解决|已解决|提交人已确认解决/.test(text) ? index : latest
    ), -1);
    return lastSolvedIndex >= 0 && notes.slice(lastSolvedIndex + 1).some((text) => /仍有问题|继续反馈|未解决|还有问题/.test(text));
  }

  function siteFeedbackIsClosed(row) {
    return siteFeedbackHasConfirmedSolved(row) && !siteFeedbackHasLaterReopen(row);
  }

  function siteFeedbackNeedsReview(row) {
    return ["已整改待复核", "已处理"].includes(row?.status || "");
  }

  function isEffectiveAttendance(row) {
    return ["到课", "迟到"].includes(row?.status) || String(row?.exitScore ?? "").trim() !== "";
  }

  function linkHealthCard(title, label, className, detail, href, actionText = "查看") {
    return `
      <a class="data-state-card" href="${escapeHtml(href || "./index.html")}" style="text-decoration:none;">
        <strong>${escapeHtml(title)}</strong>
        <span class="badge ${className}">${escapeHtml(label)}</span>
        <p>${escapeHtml(detail)}</p>
        <p style="color:#bc582e;font-weight:800;">${escapeHtml(actionText)}</p>
      </a>
    `;
  }

  function linkHealthActionCard(actions) {
    const list = (Array.isArray(actions) ? actions : []).filter(Boolean).slice(0, 5);
    return `
      <div class="data-state-card link-health-priority">
        <strong>下一步优先处理</strong>
        <span class="badge ${list.length ? "status-warn" : "status-ok"}">${list.length ? `${list.length} 项` : "暂无断点"}</span>
        ${list.length
          ? `<ol class="link-action-list">${list.map((item) => {
              if (typeof item === "string") return `<li>${escapeHtml(item)}</li>`;
              return `<li><strong>${escapeHtml(item.owner || "负责人待定")}｜${escapeHtml(item.system || "相关系统")}</strong><br>${escapeHtml(item.text || "")}${item.href ? `<br><a class="text-link" href="${escapeHtml(item.href)}">${escapeHtml(item.actionText || "去处理")}</a>` : ""}</li>`;
            }).join("")}</ol>`
          : "<p>当前关键链路没有明显断点。后续继续让老师用真实数据录入、归档、点名和反馈，系统会自动继续体检。</p>"}
      </div>
    `;
  }

  function formatLinkEventTime(value) {
    const raw = String(value || "");
    if (!raw) return "-";
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) return raw.replace("T", " ").slice(0, 16);
    return date.toLocaleString("zh-CN", { hour12: false }).slice(0, 16);
  }

  function latestLinkEventCard(events) {
    const eventMap = new Map();
    (Array.isArray(events) ? events : [])
      .filter((row) => row && typeof row === "object")
      .forEach((row) => {
        const key = String(row.fingerprint || [
          row.source,
          row.target,
          row.action,
          row.count,
          (Array.isArray(row.samples) ? row.samples : []).join("|")
        ].join("::"));
        const existing = eventMap.get(key);
        if (!existing || String(row.at || "").localeCompare(String(existing.at || "")) > 0) eventMap.set(key, row);
      });
    const rows = [...eventMap.values()]
      .sort((left, right) => String(right.at || "").localeCompare(String(left.at || "")))
      .slice(0, 5);
    return `
      <div class="data-state-card link-health-priority">
        <strong>最近自动联动</strong>
        <span class="badge ${rows.length ? "status-ok" : "status-warn"}">${rows.length ? `${rows.length} 条` : "暂无记录"}</span>
        ${rows.length ? rows.map((row) => `
          <p><strong style="font-size:12px;">${escapeHtml(row.source || "-")} → ${escapeHtml(row.target || "-")}</strong><br>${escapeHtml(row.action || "自动联动")}：${escapeHtml(row.count || 0)} 条${Array.isArray(row.samples) && row.samples.length ? `；${escapeHtml(row.samples.join("、"))}` : ""}<br>${escapeHtml(row.operatorName || "-")}｜${escapeHtml(formatLinkEventTime(row.at))}</p>
        `).join("") : "<p>后续点名沉淀学生服务、招生报名转学生档案、AI课堂反馈归档后，这里会显示最近联动。</p>"}
      </div>
    `;
  }

  function sampleList(rows, formatter, limit = 3) {
    const list = (Array.isArray(rows) ? rows : []).slice(0, limit).map(formatter).filter(Boolean);
    return list.length ? ` 样例：${list.join("；")}` : "";
  }

  async function renderCloudReadiness() {
    const holder = $("portalCloudReadinessList");
    if (!holder) return;
    const cloudEnabled = Boolean(window.JRC_CLOUD?.isEnabled?.());
    holder.innerHTML = [
      readinessCard("网站前端", "已上云", "status-ok", "正式网址运行在阿里云香港服务器，通过 www.jrcwork.cn 访问。"),
      readinessCard("后端 API", cloudEnabled ? "已接入" : "待登录", cloudEnabled ? "登录、权限、模块数据接口已接入 /api。" : "当前页面还没有检测到云接口登录状态，请重新登录后查看。"),
      readinessCard("员工账号权限", "已接入", "status-ok", "员工登录、岗位权限和总管理员入口已经走统一体系。"),
      readinessCard("业务模块数据", "检测中", "status-warn", "正在读取招生、财务、学生服务、教学质量等模块云端记录。"),
      readinessCard("历史 Excel 原表", "待导入核对", "status-warn", "排课、课时费、财务和分红原表需要逐批导入并与人工表核对。")
    ].join("");
    if (!cloudEnabled || !window.JRC_CLOUD?.readModuleData) return;

    const results = await Promise.all(cloudBusinessStores.map(async (store) => {
      try {
        const result = await window.JRC_CLOUD.readModuleData(store.key);
        const found = Boolean(result.ok && result.data?.found);
        const count = found ? countCloudPayload(result.data.payload) : 0;
        return { ...store, found, count };
      } catch {
        return { ...store, found: false, count: 0, failed: true };
      }
    }));
    const foundCount = results.filter((item) => item.found).length;
    const totalCount = results.reduce((sum, item) => sum + item.count, 0);
    const moduleSummary = foundCount
      ? `已检测到 ${foundCount}/${results.length} 个模块有云端记录，共 ${totalCount} 条/类数据。`
      : "当前还没有检测到业务模块云端记录，老师录入后会逐步出现。";
    const moduleClass = foundCount ? "status-ok" : "status-warn";
    const moduleLabel = foundCount ? "部分已入云" : "待录入";
    const moduleDetails = results
      .map((item) => `${item.label}${item.found ? ` ${item.count}` : " 0"}`)
      .join("；");

    holder.innerHTML = [
      readinessCard("网站前端", "已上云", "status-ok", "正式网址运行在阿里云香港服务器，通过 www.jrcwork.cn 访问。"),
      readinessCard("后端 API", "已接入", "status-ok", "登录、权限、模块数据接口已接入 /api，并由云端鉴权保护。"),
      readinessCard("员工账号权限", "已接入", "status-ok", "员工登录、岗位权限和总管理员入口已经走统一体系。"),
      readinessCard("业务模块数据", moduleLabel, moduleClass, `${moduleSummary} ${moduleDetails}`),
      readinessCard("历史 Excel 原表", "待导入核对", "status-warn", "排课、课时费、财务和分红原表需要逐批导入；涉及钱和课销的数据不直接自动认定为正式结果。")
    ].join("");
  }

  function renderDataFlows() {
    const holder = $("portalDataFlowList");
    if (!holder) return;
    const foundation = window.JRC_DATA_FOUNDATION;
    if (!foundation?.deriveSystemLinks) {
      holder.innerHTML = `<div class="data-state-card"><strong>联动层未加载</strong><span class="badge status-warn">待检查</span><p>请刷新页面，或检查统一登录脚本是否加载成功。</p></div>`;
      return;
    }
    const derived = foundation.deriveSystemLinks();
    const countCards = [
      ["排课课次", derived.counts.scheduleRows],
      ["招生线索", derived.counts.admissionsRows],
      ["质量档案", derived.counts.teachingQualityTeachers],
      ["员工主数据", derived.counts.employees]
    ].map(([label, count]) => `
      <div class="data-state-card">
        <strong>${escapeHtml(label)}</strong>
        <span class="badge ${count > 0 ? "status-ok" : "status-warn"}">${escapeHtml(count)}</span>
        <p>${count > 0 ? "已进入底层联动统计。" : "等待重新导入真实数据后参与联动。"}</p>
      </div>
    `).join("");
    const flowCards = (derived.rules || []).map((rule) => `
      <div class="data-state-card">
        <strong>${escapeHtml(rule.from)} → ${escapeHtml(rule.to)}</strong>
        <span class="badge status-ok">规则已建</span>
        <p>${escapeHtml(rule.rule)}</p>
      </div>
    `).join("");
    const financePreview = (derived.teacherMonthRows || []).slice(0, 4).map((row) => `
      <div class="data-state-card">
        <strong>${escapeHtml(row.teacherName)}｜${escapeHtml(row.period)}</strong>
        <span class="badge status-ok">财务结算草表</span>
        <p>${escapeHtml(row.financeBasis)}${row.commissionRate ? `；提成 ${escapeHtml(row.commissionRate)}` : ""}</p>
      </div>
    `).join("");
    holder.innerHTML = countCards + flowCards + (financePreview || `
      <div class="data-state-card">
        <strong>财务结算草表</strong>
        <span class="badge status-warn">待导入</span>
        <p>重新导入真实排课、教学质量和招生数据后，这里会按老师和月份形成课时、教学系数、招生实收的联动草表。</p>
      </div>
    `);
  }

  async function renderLinkHealth() {
    const holder = $("portalLinkHealthList");
    if (!holder) return;
    holder.innerHTML = `
      <div class="data-state-card">
        <strong>正在自检</strong>
        <span class="badge status-warn">读取中</span>
        <p>正在检查排课、点名、学生服务和财务之间的数据流转。</p>
      </div>
    `;
    const foundation = window.JRC_DATA_FOUNDATION;
    const derived = foundation?.deriveSystemLinks?.() || { scheduleRows: [], counts: {} };
    const [paikeRegular, paikePreimport, attendanceSessions, studentRows, financeState, admissionsState, qualityState, feedbackRows, aiDraftRows, suggestionRows, linkEvents] = await Promise.all([
      readLinkedStore(paikeRegularKey, {}),
      readLinkedStore(paikePreimportKey, {}),
      readLinkedStore(attendanceKey, []),
      readLinkedStore(studentServiceKey, []),
      readLinkedStore(financeKey, {}),
      readLinkedStore("advice-system-stage-prototype", {}),
      readLinkedStore("jrc-teaching-quality-system-v2-demo", {}),
      readLinkedStore("jrc-site-feedback-v1", []),
      readLinkedStore("jrc-ai-assistant-drafts-v1", []),
      readLinkedStore("jrc-suggestion-management-v2", []),
      readLinkedStore(linkEventKey, [])
    ]);
    const regularEntries = Array.isArray(paikeRegular?.scheduleEntries) ? paikeRegular.scheduleEntries : [];
    const preimportBundle = mergeLinkedStoreValue(window.JRC_PREIMPORT_BUNDLE || window.JRC_PREIMPORT_SUMMARY || {}, paikePreimport || {});
    const scheduleRows = mergeScheduleRows(
      Array.isArray(derived.scheduleRows) && derived.scheduleRows.length ? derived.scheduleRows : [],
      normalizeScheduleRowsFromRegular({ scheduleEntries: regularEntries }),
      normalizeScheduleRowsFromPreimport(preimportBundle)
    );
    const sessions = Array.isArray(attendanceSessions) ? attendanceSessions : [];
    const studentServiceRows = Array.isArray(studentRows) ? studentRows : [];
    const attendanceStudentKeys = new Set(
      sessions.flatMap((session) => (Array.isArray(session.rows) ? session.rows : [])
        .map((row) => attendanceStudentKey(session, row)))
        .filter(Boolean)
    );
    const scheduleStudentKeys = new Set(scheduleRows.map(scheduleStudentKey).filter(Boolean));
    const serviceLinkedKeys = new Set(
      studentServiceRows
        .filter((row) => row.sourceModule === "attendance" || row.sourceSessionId)
        .map(studentServiceAttendanceKey)
        .filter(Boolean)
    );
    const attendanceSessionKeys = new Set(sessions.map(attendanceSessionKey).filter(Boolean));
    const unresolvedCount = sessions.reduce((sum, session) => sum + (Array.isArray(session.rows) ? session.rows : [])
      .filter((row) => !isEffectiveAttendance(row) || row.followup === "待联系家长").length, 0);
    const effectiveCount = sessions.reduce((sum, session) => sum + (Array.isArray(session.rows) ? session.rows : [])
      .filter(isEffectiveAttendance).length, 0);
    const scheduleWithoutAttendance = [...scheduleStudentKeys].filter((key) => key && !attendanceStudentKeys.has(key)).length;
    const scheduleWithoutAttendanceSamples = scheduleRows.filter((row) => {
      const key = scheduleStudentKey(row);
      return key && !attendanceStudentKeys.has(key);
    }).slice(0, 3);
    const attendanceWithoutService = [...attendanceStudentKeys].filter((key) => key && !serviceLinkedKeys.has(key)).length;
    const attendanceWithoutServiceSamples = sessions.flatMap((session) => (Array.isArray(session.rows) ? session.rows : []).map((row) => ({ session, row })))
      .filter(({ session, row }) => {
        const key = attendanceStudentKey(session, row);
        return key && !serviceLinkedKeys.has(key);
      })
      .slice(0, 3);
    const financePeriods = financeState?.periods && typeof financeState.periods === "object" ? Object.keys(financeState.periods).length : 0;
    const hasFinanceAttendance = sessions.length > 0;
    const leads = Array.isArray(admissionsState?.leads) ? admissionsState.leads : [];
    const enrolledLeads = leads.filter((lead) => lead.status === "定金 / 已报名" || Number(lead.enrolledAmount || 0) > 0);
    const trialLeads = leads.filter((lead) => String(lead.status || "").includes("试听") || lead.trialTeacher || lead.trialTime);
    const serviceNames = studentServiceNameSet(studentServiceRows);
    const enrolledWithoutService = enrolledLeads.filter((lead) => {
      const name = normalizePersonName(lead.studentName);
      return name && !serviceNames.has(name);
    });
    const enrolledWithoutServiceCount = enrolledWithoutService.length;
    const aiDrafts = Array.isArray(aiDraftRows) ? aiDraftRows : [];
    const aiClassFeedbackDrafts = aiDrafts.filter((row) => {
      const modeText = `${row?.mode || ""} ${row?.modeLabel || ""} ${row?.title || ""}`;
      return /classFeedback|feedback|课后反馈|课堂反馈/.test(modeText);
    });
    const aiArchivedRows = studentServiceRows.filter((row) => row.sourceModule === "aiAssistant" || row.parentMessage);
    const feedbackList = Array.isArray(feedbackRows) ? feedbackRows : [];
    const openFeedback = feedbackList.filter((row) => !siteFeedbackIsClosed(row));
    const feedbackTasks = Array.isArray(suggestionRows) ? suggestionRows.filter((row) => row.sourceFeedbackId || String(row.id || "").startsWith("t-feedback-")) : [];
    const qualityTeachers = new Set();
    (Array.isArray(qualityState?.inspections) ? qualityState.inspections : []).forEach((row) => row.teacher && qualityTeachers.add(row.teacher));
    (Array.isArray(qualityState?.studentSurveys) ? qualityState.studentSurveys : []).forEach((row) => row.teacher && qualityTeachers.add(row.teacher));
    (Array.isArray(qualityState?.parentSurveys) ? qualityState.parentSurveys : []).forEach((row) => row.teacher && qualityTeachers.add(row.teacher));
    (Array.isArray(qualityState?.objectiveMetrics) ? qualityState.objectiveMetrics : []).forEach((row) => row.teacher && qualityTeachers.add(row.teacher));
    const teachingTeacherNames = new Set(scheduleRows.map((row) => row.teacherName || row.teacher).filter(Boolean));
    const qualityMissingTeachers = [...teachingTeacherNames].filter((name) => !qualityTeachers.has(name)).length;
    const qualityMissingTeacherSamples = [...teachingTeacherNames].filter((name) => !qualityTeachers.has(name)).slice(0, 3);
    const passedChecks = [
      scheduleRows.length > 0 && scheduleWithoutAttendance === 0,
      sessions.length > 0 && unresolvedCount === 0,
      hasFinanceAttendance && effectiveCount > 0,
      financePeriods > 0,
      enrolledLeads.length > 0 && enrolledWithoutServiceCount === 0,
      aiClassFeedbackDrafts.length > 0 && aiArchivedRows.length > 0,
      feedbackList.length > 0 && openFeedback.length === 0,
      qualityTeachers.size > 0 && qualityMissingTeachers === 0
    ].filter(Boolean).length;
    const totalChecks = 8;
    const warningChecks = totalChecks - passedChecks;
    const priorityActions = [];
    if (!scheduleRows.length) {
      priorityActions.push({
        owner: "周珊",
        system: "排课系统",
        text: "先确认六月/暑假排课明细是否已导入。排课为空会影响点名、财务和教学质量。",
        href: "./paike.html",
        actionText: "打开排课系统"
      });
    } else if (scheduleWithoutAttendance) {
      priorityActions.push({
        owner: "高芳燕",
        system: "学生与家长服务系统",
        text: `补齐约 ${scheduleWithoutAttendance} 人次点名，优先处理排课已存在但未点名的课程。`,
        href: "./student-service.html",
        actionText: "打开点名"
      });
    }
    if (sessions.length && unresolvedCount) {
      priorityActions.push({
        owner: "高芳燕",
        system: "学生与家长服务系统",
        text: `点名里还有约 ${unresolvedCount} 人次缺席、请假或待联系家长，需要落实补课、视频课或不销课口径。`,
        href: "./student-service.html",
        actionText: "处理缺席追踪"
      });
    }
    if (enrolledWithoutServiceCount) {
      priorityActions.push({
        owner: "颜雨涵 / 高芳燕",
        system: "招生管理 / 学生服务",
        text: `招生已报名学生还有约 ${enrolledWithoutServiceCount} 人未建学生服务档案，先补档案再排服务流程。`,
        href: "./student-service.html",
        actionText: "查看学生档案"
      });
    }
    if (aiClassFeedbackDrafts.length && !aiArchivedRows.length) {
      priorityActions.push({
        owner: "李舒",
        system: "课堂反馈AI助手",
        text: "AI 课堂反馈已有草稿但还没有归档到学生服务，提醒老师整理后点“归档学生服务”。",
        href: "./ai-assistant.html",
        actionText: "打开课堂反馈AI"
      });
    }
    if (openFeedback.length) {
      priorityActions.push({
        owner: "叶源泽",
        system: "试用反馈整改系统",
        text: `全站还有 ${openFeedback.length} 条反馈未闭环，先判断是否转任务，再让提出人复核。`,
        href: "./trial-feedback.html",
        actionText: "看反馈台账"
      });
    }
    if (qualityMissingTeachers) {
      priorityActions.push({
        owner: "郑嘉艺",
        system: "教学质量系统",
        text: `排课涉及老师中约 ${qualityMissingTeachers} 位缺教学质量记录，后续补巡课、问卷或整改数据。`,
        href: "./teaching-quality.html",
        actionText: "打开教学质量"
      });
    }

    const cards = [
      linkHealthActionCard(priorityActions),
      latestLinkEventCard(linkEvents),
      linkHealthCard(
        "链路体检总览",
        warningChecks ? `${warningChecks} 项待处理` : "全部通过",
        warningChecks ? "status-warn" : "status-ok",
        `本次自检覆盖 ${totalChecks} 条关键链路：${passedChecks} 条正常，${warningChecks} 条需要继续补数据或处理断点。下面每张卡会显示断点数量和样例。`,
        "./suggestions.html",
        "看整改"
      ),
      linkHealthCard(
        "排课 → 点名",
        scheduleRows.length ? (scheduleWithoutAttendance ? "有待点名" : "已覆盖") : "待导入",
        scheduleRows.length && !scheduleWithoutAttendance ? "status-ok" : "status-warn",
        scheduleRows.length
          ? `排课明细 ${scheduleRows.length} 人次；仍有约 ${scheduleWithoutAttendance} 人次未形成点名记录。${sampleList(scheduleWithoutAttendanceSamples, (row) => `${row.date || "-"} ${row.teacherName || row.teacher || "-"} ${row.studentName || row.className || "-"}`)}`
          : "还没有读取到排课明细，需先导入或维护排课。",
        "./paike.html",
        "看排课"
      ),
      linkHealthCard(
        "点名 → 学生服务 / 课销",
        sessions.length ? (unresolvedCount ? "有待追踪" : "已闭环") : "待点名",
        sessions.length && !unresolvedCount ? "status-ok" : "status-warn",
        sessions.length
          ? `已保存点名 ${sessions.length} 节 / ${attendanceStudentKeys.size} 人次；有效到课 ${effectiveCount} 人次，待追踪 ${unresolvedCount} 人次；已沉淀学生服务 ${Math.max(0, attendanceStudentKeys.size - attendanceWithoutService)} 人次。${sampleList(attendanceWithoutServiceSamples, ({ session, row }) => `${session.date || "-"} ${session.teacher || "-"} ${row.studentName || row.student || "-"}`)}`
          : "还没有点名记录。老师保存点名后，会进入学生服务、课销和课时费核对链路。",
        "./student-service.html",
        "看学生服务"
      ),
      linkHealthCard(
        "点名 → 财务",
        hasFinanceAttendance && effectiveCount ? "已接入" : "待点名",
        hasFinanceAttendance && effectiveCount ? "status-ok" : "status-warn",
        hasFinanceAttendance
          ? `财务可读取 ${sessions.length} 节点名，当前有效到课 ${effectiveCount} 人次，待追踪 ${unresolvedCount} 人次；最终仍需财务复核。`
          : "财务等待学生服务系统保存点名后生成结算草表。",
        "./finance.html#attendanceFinanceSection",
        "看财务"
      ),
      linkHealthCard(
        "财务月结",
        financePeriods ? "已有草表" : "待录入",
        financePeriods ? "status-ok" : "status-warn",
        financePeriods
          ? `财务系统已有 ${financePeriods} 个月份草表；点名结算仍需财务复核后确认。`
          : "还没有月结草表，先用点名和原 Excel 对照，确认后再补月结数据。",
        "./finance.html",
        "看月结"
      ),
      linkHealthCard(
        "招生 → 学生服务",
        enrolledLeads.length ? (enrolledWithoutServiceCount ? "待建档" : "已建档") : "待报名",
        enrolledLeads.length && !enrolledWithoutServiceCount ? "status-ok" : "status-warn",
        enrolledLeads.length
          ? `招生已报名/有实收 ${enrolledLeads.length} 人；约 ${enrolledWithoutServiceCount} 人还没在学生服务台账里形成档案。${sampleList(enrolledWithoutService, (lead) => `${lead.studentName || "-"} ${lead.owner || lead.trialTeacher || ""}`)}`
          : `当前招生线索 ${leads.length} 条，试听候选 ${trialLeads.length} 条；报名后应进入学生服务。`,
        "./student-service.html",
        "看学生档案"
      ),
      linkHealthCard(
        "AI课堂反馈 → 学生服务",
        aiClassFeedbackDrafts.length ? (aiArchivedRows.length ? "有归档" : "待归档") : "待使用",
        aiArchivedRows.length ? "status-ok" : "status-warn",
        aiClassFeedbackDrafts.length
          ? `AI课堂反馈草稿 ${aiClassFeedbackDrafts.length} 条；学生服务已归档 ${aiArchivedRows.length} 条。老师整理后要点“归档学生服务”。`
          : "还没有检测到 AI 课堂反馈草稿；老师开始用 AI 后，这里会检查是否归档到学生服务。",
        "./ai-assistant.html",
        "看课堂反馈AI"
      ),
      linkHealthCard(
        "反馈问题 → 任务闭环",
        feedbackList.length ? (openFeedback.length ? "有待处理" : "已闭环") : "待反馈",
        feedbackList.length && !openFeedback.length ? "status-ok" : "status-warn",
        feedbackList.length
          ? `全站反馈 ${feedbackList.length} 条；待处理/继续反馈 ${openFeedback.length} 条；已转任务 ${feedbackTasks.length} 条。${sampleList(openFeedback, (row) => `${row.userName || "未登录"}：${row.type || "反馈"}`)}`
          : "老师提交反馈后，应由管理员判断是否转任务、处理并让提出人复核。",
        "./suggestions.html",
        "看反馈"
      ),
      linkHealthCard(
        "教学质量 → 财务候选",
        qualityTeachers.size ? (qualityMissingTeachers ? "部分缺质控" : "已采集") : "待采集",
        qualityTeachers.size && !qualityMissingTeachers ? "status-ok" : "status-warn",
        qualityTeachers.size
          ? `教学质量已有 ${qualityTeachers.size} 位老师数据；排课涉及老师中约 ${qualityMissingTeachers} 位还没有质控记录。${qualityMissingTeacherSamples.length ? ` 样例：${qualityMissingTeacherSamples.join("、")}` : ""} 财务只使用内部候选，不公开排名。`
          : "教学质量数据还在采集中；后续会作为财务绩效候选，需要权限隔离。",
        "./teaching-quality.html",
        "看教学质量"
      )
    ];
    holder.innerHTML = cards.join("");
  }

  document.addEventListener("DOMContentLoaded", renderPortalDashboard);
})();
