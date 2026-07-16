# 阿里云云数据库落地清单

更新时间：2026-06-21

## 结论

正式长期使用建议走阿里云，不再把 Supabase 作为正式方向。

2026-06-22 实际落地调整：考虑到内地备案和教培行业审核不确定性，第一阶段先使用阿里云中国香港轻量服务器。数据库不单独购买 RDS，先在同一台服务器内运行 PostgreSQL，20 人左右试用成本更低、部署更快；后续数据量和并发上来后，再迁移到独立 RDS。

当前阶段目标不是一次性把所有业务数据都迁上云，而是先把通用底座跑起来：

- 员工账号
- 权限
- 操作日志
- 整站备份记录
- 系统配置

排课、财务、招生、学生档案等业务数据后面逐步迁移。老师使用方式先不大改。

## 推荐购买方案

### 第一阶段推荐配置

- 地域：中国香港
- 云服务器：轻量应用服务器或 ECS，2 核 4G 起步
- 系统镜像：Ubuntu 22.04
- 数据库：第一阶段先用服务器内置 PostgreSQL
- 后端接口：Node.js API，Nginx 反向代理到 `/api`
- 附件/备份：先放服务器目录，正式大量使用后再接 OSS

### 月费用预估

- 省钱试用：约 50-100 元/月
- 推荐起步：约 100-200 元/月
- 稳定正式：后续如拆分 RDS/OSS，再按实际数据量升级

建议先按轻量服务器起步，真实跑 1-2 个月后再看账单、访问量和数据增长调规格。

## 已准备的一键部署脚本

服务器能 SSH 连接后，在服务器上执行：

```bash
sudo bash /opt/jrcedu/deploy/aliyun/install-on-ecs.sh
```

脚本会自动安装：

- PostgreSQL
- Node.js 20
- Nginx
- 云端 API systemd 服务
- 员工账号、权限、操作日志等第一阶段数据库表

部署完成后的临时访问地址：

- `http://8.218.84.228/jrcedu/portal/index.html`
- `http://8.218.84.228/api/health`

## 购买时建议参数

### RDS PostgreSQL

- 数据库类型：PostgreSQL
- 计费：Serverless 或按量付费
- 地域：与后端接口同地域
- 网络：专有网络 VPC
- 白名单：先只允许后端服务器/函数访问，不要全网开放数据库
- 数据库名：`jrcedu`
- 应用账号：`jrcedu_app`
- 管理账号：由阿里云控制台生成并妥善保存

### 后端接口

两种方案都可以：

1. 函数计算 FC：省维护，适合接口不复杂的第一阶段。
2. 轻量应用服务器：更直观，后面如果接口越来越多，也方便部署 Node/Express。

第一阶段我建议先用函数计算；如果阿里云控制台配置起来不顺，就切轻量应用服务器。

### OSS

- Bucket 名建议：`jrcedu-prod-backups`
- 用途：整站备份 JSON、Excel 上传文件、后续合同/图片附件
- 权限：私有

## 你需要提供给我的信息

购买完成后，不要把密码发到微信群。可以在 Codex 当前对话里临时给我，或者你在电脑上填到 `.env` 文件。

需要这些：

- RDS 内网地址 / 外网地址
- 数据库端口
- 数据库名
- 数据库用户名
- 数据库密码
- 后端接口部署方式：函数计算 或 轻量应用服务器
- OSS Bucket 名和地域

## 数据以后怎么上传

接云数据库后，不是每改一次系统就手工上传一次数据。

正确模式是：

1. 老师在网页里新增/修改/保存。
2. 系统自动写入云数据库。
3. 其他电脑刷新后看到同一份数据。
4. Excel 只作为批量导入、历史校对、阶段性对账工具。

在完全迁云之前，会有一个过渡期：

- 现有浏览器数据仍保留。
- 管理员每天仍导出整站备份。
- 每个模块迁到云端后，就不再依赖手工上传。

## 第一阶段部署顺序

1. 购买 RDS PostgreSQL。
2. 执行 `database/cloud-schema-v1.sql`。
3. 执行 `deploy/aliyun/seed-employees.sql`。
4. 部署后端 API。
5. 在前端配置 API 地址。
6. 安装教研课程资料每日备份：`sudo bash deploy/aliyun/install-curriculum-backup-cron.sh`。
7. 测试登录、权限、操作日志、备份登记。
8. 连续试用 3-5 天。
9. 再迁移排课/招生/财务等业务数据。

## 教研课程资料备份

老师上传到教研与课程产品系统的文件，主文件保存在 `/opt/jrcedu-uploads/curriculum`。

当前采用三层保护：

- 上传文件按年级、课程体系、月份分目录保存。
- 每次上传生成唯一版本文件和 `.metadata.json`，不覆盖旧文件。
- 服务器每天 03:10 自动打包到 `/opt/jrcedu-backups/curriculum`，默认保留 90 天。

校长电脑可运行 `scripts/install-mac-curriculum-sync.sh`，在桌面生成 `标准化课件标准化系统` 文件夹，并每 30 分钟从服务器同步一次新增资料。自动同步需要这台 Mac 可以 SSH 登录服务器；建议后续配置 SSH 密钥，避免定时任务等待输入密码。

## 数据库备份

安装脚本会在每天 03:35 生成 PostgreSQL 自定义格式备份，默认保留 30 天：

- 备份目录：`/opt/jrcedu-backups/database`
- 校验：每份备份生成 SHA-256，并用 `pg_restore --list` 验证可读取。
- 日志：`/var/log/jrcedu-database-backup.log`
- 手动安装或重装：`sudo bash deploy/aliyun/install-database-backup-cron.sh`

## 每日系统巡检

每天 07:50 自动检查 API 服务、数据库接口和 DeepSeek 调用，并将无密钥的结果写入管理员诊断区：

- 状态文件：`/opt/jrcedu-runtime/health.json`
- 日志：`/var/log/jrcedu-system-health.log`
- 手动安装或重装：`sudo bash deploy/aliyun/install-system-health-cron.sh`

## 买云前仍可继续做的准备

- 按 `docs/data-field-standards.md` 统一字段。
- 用 `docs/templates/` 里的模板对照老师 Excel。
- 先不要强迫老师立刻全部改表，但每次新表导入后，把高频不规范写法沉淀到规范里。
- 后面业务数据迁云时，优先迁已经符合模板的数据。
