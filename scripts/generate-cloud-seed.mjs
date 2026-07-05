import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const root = process.cwd();
const authPath = path.join(root, "portal", "auth.js");
const outputPath = path.join(root, "deploy", "aliyun", "seed-employees.sql");
const authSource = fs.readFileSync(authPath, "utf8");

const prefix = authSource.slice(0, authSource.indexOf("function jrcExpandGranularPermissions"));
const context = {};
vm.runInNewContext(`${prefix}
globalThis.__seed = {
  employees: JRC_EMPLOYEES,
  rolePermissions: JRC_ROLE_PERMISSIONS,
  permissionOptions: JRC_PERMISSION_OPTIONS,
  superAdmins: JRC_SUPER_ADMIN_USERNAMES,
  financeAdmins: JRC_FINANCE_ADMIN_USERNAMES,
  paikeAdmins: JRC_PAIKE_ADMIN_USERNAMES,
  knowledgeAdmins: JRC_KNOWLEDGE_ADMIN_USERNAMES,
  suggestionAdmins: JRC_SUGGESTION_ADMIN_USERNAMES,
  admissionsAdmins: JRC_ADMISSIONS_ADMIN_USERNAMES,
  curriculumAdmins: JRC_CURRICULUM_ADMIN_USERNAMES,
  teachingQualityAdmins: JRC_TEACHING_QUALITY_ADMIN_USERNAMES,
  videoOpsAdmins: JRC_VIDEO_OPS_ADMIN_USERNAMES
};`, context);

const seed = context.__seed;

function sql(value) {
  if (value === null || value === undefined || value === "") return "null";
  return `'${String(value).replace(/'/g, "''")}'`;
}

function sqlDate(value) {
  return value ? `${sql(value)}::date` : "null";
}

function numberFromPercent(value) {
  if (!value) return null;
  const text = String(value).replace("%", "").trim();
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

function metadataSql(employee) {
  const pairs = [
    "'initialPasswordPolicy'",
    sql(employee.password || "10281028"),
    "'source'",
    sql("portal/auth.js")
  ];
  if (employee.commissionRate && numberFromPercent(employee.commissionRate) === null) {
    pairs.push("'settlementRule'", sql(employee.commissionRate));
  }
  return `jsonb_build_object(${pairs.join(", ")})`;
}

function moduleFromPermission(permissionKey) {
  return String(permissionKey || "").split(".")[0] || "portal";
}

function actionFromPermission(permissionKey) {
  return String(permissionKey || "").split(".").slice(1).join(".") || "access";
}

function normalizePermissions(permissions) {
  return Array.from(new Set((Array.isArray(permissions) ? permissions : [])
    .map((key) => String(key || "").trim())
    .filter(Boolean))).sort();
}

function permissionsForRole(role) {
  const permissions = new Set(seed.rolePermissions[role] || []);
  if (role === "学管") {
    [
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
      "campus.edit"
    ].forEach((key) => permissions.add(key));
  }
  if (role === "授课老师") {
    [
      "studentService.access",
      "curriculum.access",
      "curriculum.create",
      "curriculum.update",
      "curriculum.import",
      "curriculum.export",
      "campus.access"
    ].forEach((key) => permissions.add(key));
  }
  return normalizePermissions(Array.from(permissions));
}

function permissionsForEmployee(employee) {
  const permissions = new Set(seed.rolePermissions[employee.role] || []);
  const username = employee.username;
  ["portal.access", "ai.access", "paike.access", "suggestions.access"].forEach((key) => permissions.add(key));

  if (employee.role !== "授课老师") permissions.add("knowledge.access");
  if (employee.role === "授课老师") {
    permissions.add("studentService.access");
    permissions.add("curriculum.access");
  }
  if (employee.role === "试用期老师") {
    [
      "knowledge.access",
      "teachingQuality.access",
      "studentService.access",
      "curriculum.access",
      "campus.access"
    ].forEach((key) => permissions.add(key));
  }
  if (employee.role === "试用期学管") {
    [
      "knowledge.access",
      "admissions.access",
      "teachingQuality.access",
      "studentService.access",
      "curriculum.access",
      "campus.access"
    ].forEach((key) => permissions.add(key));
  }
  if (employee.role === "学管") {
    [
      "admissions.access",
      "admissions.edit",
      "admissions.import",
      "teachingQuality.access",
      "teachingQuality.edit",
      "studentService.access",
      "studentService.edit",
      "curriculum.access",
      "campus.access",
      "campus.edit"
    ].forEach((key) => permissions.add(key));
  }
  if (seed.superAdmins.includes(username)) {
    seed.permissionOptions.forEach(([key]) => permissions.add(key));
  }
  if (seed.paikeAdmins.includes(username)) {
    permissions.add("paike.access");
    permissions.add("paike.edit");
  }
  if (seed.knowledgeAdmins.includes(username)) {
    permissions.add("knowledge.access");
    permissions.add("knowledge.edit");
  }
  if (seed.suggestionAdmins.includes(username)) {
    permissions.add("suggestions.access");
    permissions.add("suggestions.edit");
  }
  if (seed.admissionsAdmins.includes(username)) {
    ["admissions.access", "admissions.edit", "admissions.import", "admissions.finance"].forEach((key) => permissions.add(key));
  }
  if (seed.financeAdmins.includes(username)) {
    permissions.add("finance.access");
    permissions.add("finance.edit");
  }
  if (seed.curriculumAdmins.includes(username)) {
    [
      "curriculum.access",
      "curriculum.edit",
      "curriculum.create",
      "curriculum.update",
      "curriculum.delete",
      "curriculum.import",
      "curriculum.export",
      "curriculum.reset"
    ].forEach((key) => permissions.add(key));
  }
  if (seed.teachingQualityAdmins.includes(username)) {
    permissions.add("teachingQuality.access");
    permissions.add("teachingQuality.edit");
  }
  if (seed.videoOpsAdmins.includes(username)) {
    permissions.add("videoOps.access");
    permissions.add("videoOps.edit");
  }
  (employee.permissions || []).forEach((key) => permissions.add(key));
  return Array.from(permissions).sort();
}

const allPermissionKeys = new Map(seed.permissionOptions.map(([key, label]) => [key, label]));
Object.values(seed.rolePermissions).flat().forEach((key) => {
  if (!allPermissionKeys.has(key)) allPermissionKeys.set(key, key);
});
seed.employees.forEach((employee) => {
  permissionsForEmployee(employee).forEach((key) => {
    if (!allPermissionKeys.has(key)) allPermissionKeys.set(key, key);
  });
});

const lines = [];
lines.push("-- 匠人程云数据库员工和权限初始化数据");
lines.push("-- 由 scripts/generate-cloud-seed.mjs 从 portal/auth.js 生成。");
lines.push("-- 执行前请先执行 database/cloud-schema-v1.sql。");
lines.push("");
lines.push("begin;");
lines.push("");
lines.push("insert into permission_catalog (permission_key, module_key, action_key, display_name, description)");
lines.push("values");
lines.push(Array.from(allPermissionKeys.entries()).map(([key, label]) => {
  return `  (${sql(key)}, ${sql(moduleFromPermission(key))}, ${sql(actionFromPermission(key))}, ${sql(label)}, ${sql("系统权限")})`;
}).join(",\n"));
lines.push("on conflict (permission_key) do update set");
lines.push("  module_key = excluded.module_key,");
lines.push("  action_key = excluded.action_key,");
lines.push("  display_name = excluded.display_name,");
lines.push("  description = excluded.description;");
lines.push("");

lines.push("delete from role_permission_defaults;");
lines.push("");
lines.push("insert into role_permission_defaults (role, permission_key)");
lines.push("values");
const rolePermissionRows = [];
Object.entries(seed.rolePermissions).forEach(([role, permissions]) => {
  permissionsForRole(role).forEach((permissionKey) => {
    rolePermissionRows.push(`  (${sql(role)}, ${sql(permissionKey)})`);
  });
});
lines.push(rolePermissionRows.join(",\n"));
lines.push("on conflict (role, permission_key) do nothing;");
lines.push("");

lines.push("insert into employees (name, username, password_hash, role, phone, wechat, subject, scope, hire_date, regular_date, commission_rate, status, metadata)");
lines.push("values");
lines.push(seed.employees.map((employee) => {
  const commission = numberFromPercent(employee.commissionRate);
  return `  (${sql(employee.name)}, ${sql(employee.username)}, crypt(${sql(employee.password || "10281028")}, gen_salt('bf')), ${sql(employee.role)}, ${sql(employee.phone)}, ${sql(employee.wechat)}, ${sql(employee.subject)}, ${sql(employee.scope)}, ${sqlDate(employee.hireDate)}, ${sqlDate(employee.regularDate)}, ${commission === null ? "null" : commission}, 'active', ${metadataSql(employee)})`;
}).join(",\n"));
lines.push("on conflict (username) do update set");
lines.push("  name = excluded.name,");
lines.push("  password_hash = excluded.password_hash,");
lines.push("  role = excluded.role,");
lines.push("  phone = excluded.phone,");
lines.push("  wechat = excluded.wechat,");
lines.push("  subject = excluded.subject,");
lines.push("  scope = excluded.scope,");
lines.push("  hire_date = excluded.hire_date,");
lines.push("  regular_date = excluded.regular_date,");
lines.push("  commission_rate = excluded.commission_rate,");
lines.push("  status = excluded.status,");
lines.push("  metadata = employees.metadata || excluded.metadata,");
lines.push("  updated_at = now();");
lines.push("");

lines.push("delete from employee_permissions;");
lines.push("");
lines.push("insert into employee_permissions (employee_id, permission_key, note)");
lines.push("select employees.id, permissions.permission_key, 'initial cloud seed'");
lines.push("from employees");
lines.push("join (values");
const permissionRows = [];
seed.employees.forEach((employee) => {
  permissionsForEmployee(employee).forEach((permissionKey) => {
    permissionRows.push(`  (${sql(employee.username)}, ${sql(permissionKey)})`);
  });
});
lines.push(permissionRows.join(",\n"));
lines.push(") as permissions(username, permission_key) on permissions.username = employees.username");
lines.push("on conflict (employee_id, permission_key) do nothing;");
lines.push("");

lines.push("insert into cloud_migration_runs (migration_key, phase, status, started_at, finished_at, summary)");
lines.push("values ('seed-employees-v1', 'phase-1-foundation', 'finished', now(), now(), 'Seeded employees and permissions from portal/auth.js')");
lines.push("on conflict (migration_key) do update set");
lines.push("  status = excluded.status,");
lines.push("  finished_at = now(),");
lines.push("  summary = excluded.summary;");
lines.push("");
lines.push("commit;");

fs.writeFileSync(outputPath, `${lines.join("\n")}\n`);
console.log(`Generated ${outputPath}`);
