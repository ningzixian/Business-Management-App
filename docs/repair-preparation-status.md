# 修复准备阶段记录

日期：2026-09-08。状态：准备阶段完成。13:52 的服务器最终核验通过；已备份、已建立独立测试环境及账号、已完成准备冒烟和隔离检查。尚未开始第一阶段业务修复，未提交 Git，未更新正式服务或 APK。

## 已确认的版本基线

| 对象 | 结果 | 验证范围 |
| --- | --- | --- |
| Git | main，768bf94b1be169ab15dec3354b726b2830128e1d | 未创建提交、未暂存、未切分支 |
| 本地 Web/API | 0.2.0 / 0.2.0 | package.json |
| 在线 API | 0.2.0，database/storage ready | 本轮 HTTP 健康接口 200 |
| 在线安卓清单 | 0.2.1，versionCode 3，4,263,671 字节 | 本轮 android.json |
| 本地发布 APK | SHA256 6AAA12A061FB36527E32D9FF495098E164859A63AA7CC2607BEE4AC8C68F34D5 | 本地文件哈希与在线清单一致；本轮未重新下载远程 APK |
| 正式运行镜像 | Web ed86ce58a31b；API 5d5e47bcb0d0 | 本轮 WinRM 核对，已保存运行镜像及部署源码，完整哈希见服务器备份 manifest.json |

## 本地快照

目录：`.preparation/20260908-125202/`（已被 Git 忽略）。

- source-baseline.zip：195 个文件，包含当时的跟踪及未跟踪源码。
- SHA256：6BF9B236FB09C2ACFBAA70520C16F25B138C207C47968BFC98C419D1E8D89238。
- files.json：各源码文件哈希；git-status.txt、git-diff.patch：未发布变更记录。
- baseline.json：版本和快照摘要；单独保留当前发布 APK。
- 已重新检查压缩包哈希及条目数。
- 不包含 node_modules、生产凭据、签名密钥或数据库。这是源码与 APK 备份，不是生产数据备份。
- 该快照早于本轮后续创建的测试环境文件；这些文件留在当前工作区，后续确认基线时可再次运行快照脚本。

## 未发布改动分组

1. 之前已做的密码/通知/页面按钮和安卓下载更新相关修改，仍未统一提交；其中部分已部署，不能把工作区 diff 全部等同于未部署。
2. 本地组织改名、层级树、重挂、003 迁移、分页加载和层级测试，未部署到正式服务或 APK。
3. 本轮仅增加准备脚本、独立测试配置、测试数据脚本与验收记录；未修复 I01–I23 的业务代码。

## 测试环境准备

文件位于 deployment/test，已部署到服务器独立目录 D:\BusinessManagementAppTesting\source\deployment\test：

- compose.yaml：独立 business-management-test 项目、qa-postgres/qa-minio 卷；数据网络 qa 为 internal，Web 额外接入独立 entry 网桥进行本机映射；无正式网络或正式数据挂载。
- 只绑定服务器本机 127.0.0.1:18088，不扩大内网/公网访问。
- 独立凭据初始化脚本，不复制生产 .env，不输出密码。
- seed.cjs：预设七个测试账号、三部门、105 个组织、多级与同名组织、私有人脉、多任职、不同状态待办及关联事项；均为合成数据。
- README.md：明确启动前资源、端口、项目归属检查和启动方法。
- JS/PowerShell 语法检查、YAML 静态断言、服务器 Compose 构建、启动、种子数据导入和实际 HTTP 冒烟均已通过。
- 随机凭据已写入测试服务器受限 .env；四个测试容器健康，七个测试账号已创建并通过登录/退出验证。凭据未复制到本地或输出到会话。

运行限制合计约 1.9 GiB；最终检查时四个测试服务实际内存合计约 346 MiB。共享物理主机仍需持续留意资源，后续压测必须另行评估，不能保证无资源竞争。已使用 D:\BusinessManagementAppTesting\source，未覆盖生产目录。

## 已执行检查

- npm run verify：Web 类型检查、Web 生产构建、API 构建和 17 项测试全部通过。
- 测试种子 JS、凭据初始化 PowerShell 语法检查通过。
- 测试 Compose 的项目、端口、网络、卷、数据库和关闭生产种子等静态断言通过。
- git diff --check 通过；存在 Windows 换行提示，不是检查失败。
- 23 项问题完整验收清单见 repair-acceptance-checklist.md，均未标记修复或发布。

## 首次暂停时的远程待办

1. 只读核对服务器资源、端口、商务挂载、镜像 ID、源码与已部署版本差异，并记录检测服务状态基线。
2. 在商务独立备份目录生成当前数据库逻辑备份、附件快照及校验记录；检查备份文件可读。凭据只留服务器受限目录。
3. 保存已部署商务源码与配置、镜像引用和 APK；不修改现有容器。
4. 若资源足够，在独立目录启动 business-management-test，校验网络/卷不与正式系统重叠。
5. 导入合成数据，验证七账号登录、数据库/附件健康及 105 条组织分页。
6. 对比正式与检测服务状态，确认没有变更；补充证据后才将准备阶段标记完成。

首次执行权限审核超时，未启动远程操作；用户随后明确允许继续。本节保留首次暂停时的待办，续办结果如下，当前不再阻塞。

## 用户授权后的续办记录

以下记录覆盖上文首次暂停时的状态，保留原记录用于追溯。

- WinRM 已成功连接。Windows 总内存约 15.9 GiB，检查时空闲约 6.3 GiB；Docker 内存上限约 3.82 GiB，运行容器当时合计约 1.5 GiB。测试端口 18088 初始未占用，测试目录和项目初始不存在。
- 正式 Web 镜像 ed86ce58a31b，API 镜像 5d5e47bcb0d0；正式与检测容器身份、启动时间、重启次数和端口已记录。
- 备份完成：D:\BusinessManagementApp\backups\preparation\20260908-132500。
- 数据库 66,105 字节，容器内导出 SHA256 为 DB3694B71B97C6749EF2AB93C74DF032F9147CBE89F5C8DB445043D7E164ED77；pg_restore --list 可读取。
- 当前附件快照为空，另有 deployed-source.zip、business-runtime-images.tar、受限 production.env 和 manifest.json。目录仅授予管理员组和 SYSTEM 权限，未扩大正式目录权限。
- 备份前后八个正式/检测容器的身份、镜像、启动时间、重启次数、端口对比无变化。
- 前两次不完整尝试目录 20260908-131300 / 20260908-131600 保留，不用作有效备份；原因分别为容器无法写入受限目录、Docker cp 无法读取 tmpfs。最终采用二进制安全传输保留权限限制。
- 测试源码快照为 .preparation/20260908-133331/source-baseline.zip，203 个文件，完整 SHA256 见该目录 baseline.json；上传后进行了同哈希校验。
- D:\BusinessManagementAppTesting\source 已创建，测试随机凭据已在受限 .env 中生成。API/Web 镜像均构建通过，四个测试容器健康。
- 初始完全 internal 网络无法在该 Docker 环境发布本机端口。仅调整测试 Web 加入专属 entry 网桥，保持 api/db/storage 只在 internal 的 qa 网络；本机端口恢复。此为上传基线后的测试配置改动，不是正式系统改动。

## 最终验收结果

- 七个账号 qa_admin、qa_manager、qa_member_a、qa_member_b、qa_readonly、qa_foreign、qa_empty 登录/退出均通过；未调整或绕过原有登录限流。
- 同部门账号接口返回 105 个组织，第二页 5 条；跨部门和空数据部门返回 0 条。仅验证基础分页和部门范围，不等于 I01 私有人脉授权已修复或并发分页已验收。
- 合成数据包含三级组织、不同父节点下同名部门、一个私有人脉及两项任职、四种状态待办、一个关联事项；无正式客户数据。
- 测试附件桶 qa-attachments 直接写入、读取比对通过；已删除本次临时探针对象。不是事项附件完整 UI 验收。
- 测试页面 http://127.0.0.1:18088/ 在服务器本机返回 200，测试与正式 API health/ready 均 ready。
- 7 个备份文件重新计算哈希与清单一致；数据库传输后哈希与容器导出哈希一致。已验证目录可读及 pg_restore 列表可读；本轮未把正式数据库恢复进测试环境。
- 核验测试命名卷、只读脚本挂载、数据网络 internal 和仅本机 Web 端口，无正式网络和卷混用。
- 八个正式/检测容器与备份前基线对比无身份、镜像、启动时间、重启次数或端口变化；正式与检测前后端仍健康。
- 服务器证据：D:\BusinessManagementAppTesting\preparation-verification.json；备份证据：备份目录内 manifest.json、containers-before.txt、containers-after.txt。

## 交接

测试入口仅服务器本机可访问，不是开发电脑上的 localhost；没有开放 18088 给内网或公网。测试环境保留运行供下一阶段使用，restart=no，不自动随 Docker 重启。若需关闭，使用测试项目 stop，保留命名卷；禁止全局 prune 或对正式项目执行 down。

23 项问题状态仍保持待修复。本阶段没有功能扩展、生产数据库迁移、正式发布或 APK 更新。
