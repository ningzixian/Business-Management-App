# 内网部署运行手册

## 不可跨越的隔离边界

- 应用根目录：`D:\BusinessManagementApp`
- Compose 项目名：`business-management`
- Web 端口：`8088`
- 禁止修改 `D:\CPDataSystem`、`D:\projects\13.Fangfu\BR-Digit` 及其容器、卷、网络和数据库。
- 禁止执行全局 `docker system prune`、`docker volume prune` 或 `docker network prune`。
- 所有 Compose 命令都从 `D:\BusinessManagementApp\app` 执行，并同时带 `--project-name business-management --env-file ..\.env -f compose.yaml`。

## 部署前检查

1. 记录所有现有容器的名称、镜像、运行状态、健康状态和端口。
2. 记录 `cp-data-system-frontend`、`cp-data-system-backend`、`postgis-prod`、`mysql-prod` 的健康状态。
3. 确认 `8088` 未被占用，D 盘空间充足，Docker 引擎可用。
4. 确认目标目录解析后位于 `D:\BusinessManagementApp`。
5. 创建 `app`、`data\postgres`、`data\minio`、`backups`、`releases`，不得复用任何现有业务目录。
6. Docker Desktop 当前约有 3.8 GiB 可用内存；MinIO 单节点上限为 1.25 GiB，启动前应确认检测业务实际内存占用没有明显异常。
7. 明确设置 `SELF_REGISTRATION_ENABLED`。当前纯内网试用可设为 `true`；迁往公网前必须关闭，或先实现邀请码/统一身份认证。

## 首次启动

在部署根目录 `D:\BusinessManagementApp` 生成 `.env`，并将文件 ACL 限制为部署管理员和 SYSTEM。进入源码目录后，先校验配置，再串行构建镜像和分阶段启动：

```powershell
Set-Location D:\BusinessManagementApp\app
docker compose --project-name business-management --env-file ..\.env -f compose.yaml config --quiet
docker compose --project-name business-management --env-file ..\.env -f compose.yaml build api
docker compose --project-name business-management --env-file ..\.env -f compose.yaml build web
docker compose --project-name business-management --env-file ..\.env -f compose.yaml build storage-backup
docker compose --project-name business-management --env-file ..\.env -f compose.yaml up -d db storage
docker compose --project-name business-management --env-file ..\.env -f compose.yaml up -d api
docker compose --project-name business-management --env-file ..\.env -f compose.yaml up -d db-backup storage-backup
docker compose --project-name business-management --env-file ..\.env -f compose.yaml up -d web
docker compose --project-name business-management --env-file ..\.env -f compose.yaml ps
```

启动后验证：

- `http://192.168.0.253:8088/healthz` 返回 `ok`。
- `/api/v1/health/ready` 返回 `status: ready`。
- 使用初始管理员登录，组织库、人脉库、拜访和待办均能读取。
- 注册一个临时成员账号，确认其角色固定为 `member`，随后由管理员停用该账号。
- 管理员账号页能新增、启停、调整角色和重置密码；普通成员只能修改自己的密码。
- 修改密码或调整角色后，变更前签发的访问令牌不能继续访问接口。
- 使用事务验证一个联系人可关联第二个组织并回滚，不向正式数据留下测试主数据。
- 上传、下载并校验一个小附件，随后通过接口删除。
- 数据库和附件备份目录出现首份备份。
- 再次核对四个现场检测业务容器的状态与端口，必须与部署前一致。

## 仅停止或回滚本项目

停止服务时只操作明确的 Compose 项目：

```powershell
Set-Location D:\BusinessManagementApp\app
docker compose --project-name business-management --env-file ..\.env -f compose.yaml down
```

`down` 不添加 `--volumes`，数据保留在独立的 D 盘目录。回滚应用代码或镜像前先做数据库备份；数据库迁移默认只向前执行，不自动降级。

## 备份与恢复

- 数据库：每天生成 PostgreSQL custom-format dump 与 SHA-256 校验文件，默认保留 30 天。
- 附件：每天生成一个独立对象快照目录，默认保留 30 天。
- 恢复必须先部署到临时数据库或临时对象存储中验证，禁止直接覆盖生产数据。
- 建议每月至少做一次抽样恢复演练，并记录备份时间、校验值和恢复结果。
