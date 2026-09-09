# 独立修复测试环境

当前状态：2026-09-08 已在 D:\BusinessManagementAppTesting\source\deployment\test 启动，合成账号已导入，准备冒烟通过。禁止用正式 compose 覆盖此配置。详细证据见 docs/repair-preparation-status.md。

固定项目 business-management-test；独立 qa-postgres/qa-minio 命名卷；只有 127.0.0.1:18088 发布；接口/数据库/附件仅在 internal 的 qa 网络；Web 额外加入项目专属 entry 网桥用于本机端口映射。无正式网络或正式数据挂载，无真实客户数据，无正式凭据。不得操作检测业务容器。

启动前必须核对服务器空闲资源（运行限制合计约 1.9 GiB，构建另需余量）、18088 端口未占用、同名项目不存在或由本任务拥有。首次部署应放到独立目录 D:\BusinessManagementAppTesting\source，不覆盖 D:\BusinessManagementApp\app，不重建正式镜像标签。

在测试主机此目录依次运行：

```powershell
./initialize-credentials.ps1
docker compose --project-name business-management-test --env-file .env -f compose.yaml config --quiet
docker compose --project-name business-management-test --env-file .env -f compose.yaml build
docker compose --project-name business-management-test --env-file .env -f compose.yaml up -d
docker compose --project-name business-management-test --env-file .env -f compose.yaml exec -T api node /app/test-seed.cjs
docker compose --project-name business-management-test --env-file .env -f compose.yaml ps
```

以上是首次安装步骤，现有环境不应重新初始化凭据或重复建立源码目录。等待 api 健康再运行 seed。凭据随机生成，只写测试主机被 Git 忽略并限制 ACL 的 .env，不复制生产 .env。不要在工具输出或文档中输出凭据。

准备冒烟命令：`docker compose --project-name business-management-test --env-file .env -f compose.yaml exec -T api node /app/test-verify.cjs`。七账号验证遵循原有限流，每次登录间隔 13 秒；不得为加速测试禁用限流。

账号预设：admin、manager、两个普通成员、readonly、跨部门 member、空数据部门 member。数据为 TEST 前缀的三级组织、不同父节点同名部门、105 组织、他人私有人脉、多任职、4 状态待办和关联私有人脉的事项。seed 以数据库名和用户双重限制、事务和标记实现防误跑与不覆盖；无法替代连接目标检查。日期边界和危险 CSV 文本应在各阶段单独用例中增加。

只限测试服务器本机浏览器访问 http://127.0.0.1:18088；不得直接扩大到全网监听。手机或开发电脑访问需后续明确配置受限访问，不使用带正式登录态的浏览器会话。测试与生产共享物理主机，因此资源余量不足时不启动，需要另选测试主机。

停止用该项目的 `docker compose ... stop`，保留测试卷；本准备阶段不运行 down -v、prune 或删除数据。
