# 商务活动管理 / 部门小管家

部门商务活动管理应用，采用稳健企业蓝视觉风格：

- Web 端产品名：**商务活动管理**
- Android / iOS 产品名：**部门小管家**
- 当前版本：`v0.2.0`（双库协作基础版）

## v0.2.0 已实现

- 甲方组织库与人脉库作为两套独立主数据界面
- 一个 PostgreSQL 数据库中的独立组织表、联系人表和多对多任职关系表
- 拜访、待办分别关联多个组织和多个联系人
- 外部事项至少关联组织或联系人；部门内部待办可作为明确例外
- 事项保存关系快照，人员后续调职不会改写历史记录
- NestJS API、JWT 登录、刷新令牌轮换、四级角色权限和审计日志
- 用户名密码自助注册；注册账号固定为部门成员，生产环境可通过开关关闭
- 个人修改密码及管理员账号管理：新增、启停、角色调整、密码重置
- 密码、角色或状态变化后立即使旧访问令牌和刷新令牌失效
- MinIO 兼容对象存储的附件上传、下载和删除接口
- Web / Mobile 独立视图，手机端分别提供组织库、人脉库入口
- 前端、API、PostgreSQL、附件存储、数据库备份和附件备份独立容器

## 本地开发

仅预览界面和演示数据：

```bash
npm install
npm run dev:demo
```

连接真实服务时，先准备 PostgreSQL 与 MinIO，再分别运行：

```bash
npm install --prefix server
npm run dev:api
npm run dev
```

服务端环境变量说明见 [.env.server.example](./.env.server.example)。Vite 开发服务器会将 `/api` 代理到 `http://127.0.0.1:3000`。

内网自助注册由 `SELF_REGISTRATION_ENABLED` 控制，注册账号归入 `REGISTRATION_DEPARTMENT_CODE` 指定的部门并固定授予 `member` 角色。迁移公网前应关闭自助注册，或升级为邀请码/统一身份认证。

完整验证：

```bash
npm run verify
```

## 移动端

项目采用“共享业务逻辑 + Web / Mobile 独立视图”，使用 Capacitor 输出 Android 和 iOS 工程。将 `.env.mobile.example` 复制为 `.env.mobile.local` 并填写内网服务地址，然后执行：

```bash
npm run mobile:sync
npm run mobile:android
npm run mobile:ios
```

Android 可在 Windows 上构建和模拟。iOS 工程可以在 Windows 上维护，但最终模拟、签名和打包必须在安装 Xcode 的 macOS 设备上完成。

v0.2.0 内网阶段允许移动端 WebView 访问 HTTP 内网服务；迁移公网前必须启用 HTTPS，并移除 Android 明文流量和 iOS ATS 临时放行配置。

## Docker Compose 部署

部署前复制 `.env.server.example` 为 `.env`，使用随机强密码替换所有占位值，并创建数据与备份目录。所有操作都应明确指定本项目，避免误操作服务器上的其他业务：

```bash
docker compose --project-name business-management --env-file .env -f compose.yaml config
docker compose --project-name business-management --env-file .env -f compose.yaml build
docker compose --project-name business-management --env-file .env -f compose.yaml up -d
docker compose --project-name business-management --env-file .env -f compose.yaml ps
```

默认只发布 `8088` 端口。API、数据库和附件存储没有宿主机端口；数据网络标记为 `internal`。详细步骤与回滚边界见 [部署运行手册](./docs/deployment-runbook.md)。

## 代码结构

```text
src/                    React Web / Mobile 共享业务层与独立界面
server/src/             NestJS 模块化 API
server/migrations/      PostgreSQL 版本化迁移
deployment/nginx/       Web 网关与 API 反向代理
deployment/backup/      数据库及附件定时备份
compose.yaml            business-management 独立服务组
android/                Capacitor Android 工程
ios/                    Capacitor iOS 工程
```

架构和数据边界详见 [v0.2.0 架构说明](./docs/v0.2.0-architecture.md)。
最终构建、部署、恢复演练和隔离结果见 [v0.2.0 验收记录](./docs/v0.2.0-acceptance.md)。
