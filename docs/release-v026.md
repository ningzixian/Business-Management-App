# v0.2.6 内网发布记录

## 2026-09-09 登录页 Web 补丁

16:50:40 完成仅 Web 发布，目录 `D:\BusinessManagementApp\releases\web-login-20260909-164850`。左侧标题及三个功能卡片上移，移除登录页“检查网络与服务”，保留原有文案和样式。

Web 镜像 `business-management-web:login-20260909-164850`，manifest list `sha256:a25793efa30d45ba35e3b7887188f7f363b48fa544fed17cf34e68d35502d1a4`；静态入口 `/assets/index-Qk0_lnMs.js`。旧 Web 镜像保留为 `:pre-login-20260909-164850`，同目录有 rollback.yaml。

仅替换 Web 容器；API、数据库、存储、检测业务及其余运行容器的身份/启动时间/端口未变，Android 版本与包哈希未变。新 Web 健康且 API readiness 为 ready。首次准备时因 Windows 默认编码读取中文 JSON 失败，修正 UTF-8 后重试成功，失败发生在切换前。

## 原 v0.2.6 发布

发布时间：2026-09-09 16:21:31 +08:00。

## 发布内容

- Web / API：组织、人脉、待办维护，任职管理、记录删除与版本冲突保护。
- Android：0.2.6 / versionCode 8；公司内网 HTTP 服务地址不变。
- Web：`http://192.168.0.253:8088/`
- 下载：`http://192.168.0.253:8088/downloads/`
- APK：`/downloads/department-steward-0.2.6.apk`，4,296,330 字节。
- SHA-256：`EFC4C069FF72D617B6EC9D148359A4DA6AD206DA653CD379D156DE7FF06AD376`。
- 签名证书 SHA-256：`5bebd725bbbec6ae0887ca23afb461bc1d0edac42edcaa30ba02ec6d118c08d2`，与 0.2.5 相同，可覆盖安装。保留现有调试签名兼容链，没有更换签名。
- Web/API 的 package.json 和部分基础版标签仍为 0.2.0；本次发布由独立镜像标签及 Android 版本标识，未将基础部署标签改为新的项目名。

## 镜像与回滚

发布目录：`D:\BusinessManagementApp\releases\release-20260909-160355`。

- API：`business-management-api:release-20260909-160355`，manifest list `sha256:a2ae7e90330512844b3ebd691813ab42f85591b34b8f7eb9b1312ae873bc689b`。
- Web：`business-management-web:release-20260909-160355`，manifest list `sha256:637b5e9e66955c491090932ad52278830e0ec2b75bbe233ca6a1fb4b741ba609`。
- 回滚镜像：同名服务 `:pre-20260909-160355`，本次发布目录的 `pre.yaml`。
- 仅用 `up --no-deps --no-build` 替换商务 API、Web。未重启数据库、对象存储、备份或检测服务。
- 运行时依赖沿用已核对 package-lock 哈希的 QA baseline；本次没有依赖升级。
- 正式源码目录与标准 `:0.2.0` 镜像别名同步到本次发布，Compose 和 .env 未改动。

## 备份与隔离证据

- 备份目录：`D:\BusinessManagementApp\backups\preparation\20260909-160355`；7 个文件的清单哈希验证通过。
- 数据库备份：73,030 字节，SHA-256 `48AC3923511EF042B6D86275E5EFB038A67DE01ADDF9036CD2D22E1DDDBEC191`。
- 成功恢复至新演练库 `business_releasecheck_20260909_160355`，迁移记录 5 条；未覆盖正式库。
- 恢复命令第一次因远程引号问题产生的空临时库 `FROM` 已确认无公共表并删除；不含业务数据。
- 活动附件为零，唯一附件元数据状态为 deleted，因此附件快照为空。
- 发布目录内保留 `data-before.json`、`data-after.json`、`protected-before.txt`、`protected-after.txt`、`published.json`、`qa-passed.txt`、下载校验 APK。
- 12 个受保护容器在正式切换期间身份、镜像、启动时间、重启次数与端口未变；检测容器还与准备阶段基线进行了额外核对。

## 验证

- 57 项本机自动测试通过；Web/API 构建通过。
- 正式包验证：包名、code8、目标地址、混合内容设置、旧版签名、无嵌套 APK 均通过。
- QA `verify-v026.cjs`、`verify-phase3.cjs`、`verify-phase4.cjs` 全部通过；只使用隔离数据库和测试桶。
- 正式健康与下载内容校验通过。数据库数量保持 users=2、organizations=8、contacts=8、business_items=14、attachments=1。
- 正式站点 360/1440 宽度登录页和下载页浏览器冒烟通过，无页面脚本错误或横向溢出，下载链接指向 0.2.6。
- 正式 API 的 Android If-Match CORS 预检通过；初始管理员密码登录返回 401，未改密码、未继续尝试。正式用户需以自己的当前密码登录。
- 未向真实手机安装；用户打开旧版 APP 后自行确认更新。iOS 未打包。
- 本轮未执行 Git add、commit 或 push。

## 准备阶段问题

产物打包第一次被根 .dockerignore 排除 dist，补充了 Dockerfile 专用 ignore 文件后重建成功；测试脚本经 WinRM 传输的 UTF-8 编码及待办测试数据缺截止时间已修正。均在正式切换前处理，没有以失败结果放行发布。

真实账号的登录后 UI、完整原生手机回归、已删除组织下任职历史维护边界未全部验证，不能将本次发布描述为所有场景验收完成。
