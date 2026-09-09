# 第六阶段完成记录

日期：2026-09-09。范围：I22 安卓更新可靠性、I23 服务地址配置与内网可达性，同时补验原生附件保存和系统返回键。

结论：按用户同意的“独立安卓模拟器代替当前真机调试、公司内网 HTTP、暂不启用 HTTPS”范围完成。六阶段累计 23 项代码修复完成，不代表已正式发布或所有真机验收完成。正式商务及检测业务未变更。

## 改动

- 前端/API 地址、原生更新地址、Android 明文开关统一由构建配置生成；拒绝带凭据、非法路径及公网 HTTP 地址。
- 登录和设置增加无需发送账号凭据的 readiness 网络检查，以及原生手动更新入口。
- 更新包下载后验证大小、SHA256、包名、版本和旧版签名。提供进度、取消、失败重试、安装授权及安卓系统安装确认，不静默安装或卸载旧版。
- 修复实际模拟器发现的 WebView mixed-content 阻断：公司服务仍是 HTTP，保留原有 APP 内部 https://localhost 来源，避免改变旧版 localStorage 来源。
- 手机构建不嵌入旧 APK；APP 清理仅限自身旧静态缓存，不删除会话/草稿。Web 静态缓存排除 API、APK 和更新元数据。
- 发布脚本增加包地址、签名、大小及哈希预检，拒绝模拟器测试地址。未执行正式发布。

## 已执行验证

- `npm run verify` 全部通过：Web/API 构建、28 项后端测试、25 项客户端测试，共 53 项。
- `UpdatePolicyCheck` Java 校验用例通过：地址、版本、下载路径、大小、哈希、截断拒绝。
- 独立 AVD `Business_QA_API_34` / Android 14 / emulator-5580；未使用检测业务 AVD。QA APK 指向本机合成服务 10.0.2.2:18190，不向公司系统写入测试业务。
- 旧版 versionCode 3 → 同签名 QA 4 覆盖后，本地数据标记和草稿原值保留；安卓系统安装器实际完成 QA 4 → 5；后续同签名 QA 6/7 覆盖用于最终 WebView 和缓存修复验证。
- 原生更新的服务不可用提示/恢复重试、错误 SHA256、下载截断、不同签名拒绝、取消下载、暂不安装、安装授权拒绝及系统安装取消均已通过。服务故障模拟为 HTTP 503，不能等同于物理 Wi-Fi 断开测试。
- 原生附件：系统文件选择器取消、大于 1 MB 的中文文本保存及字节对比、错误校验和拒绝通过。
- 2026-09-09 系统 Back 键实际触发：脏表单取消关闭保留输入、确认放弃关闭表单、再次返回工作台通过。测试修正为定位手机加号按钮的 aria-label，而不是桌面文字；不是应用按钮失效。
- 最终 Web 资源六尺寸 390/720/721/980/981/1440 回归通过：导航、无横向溢出、焦点、关闭/返回、跨断点保留输入、通知持久化/错误/隔离/跳转；页面错误 0。额外 390/980/981/1440 嵌套弹窗、上传忙碌保护、日历/统计/设置布局通过。
- 本机到正式 HTTP readiness 及 https://localhost 来源的 CORS 检查通过；没有正式登录或业务写入。
- 本地原生证据位于 `.preparation/phase6-native/`（XML 和 workbench.png）；测试脚本位于 tests/native-*.cjs、tests/phase6-native-*.cjs。脚本里的合成数据不是正式业务记录。

## 最终内网安装包

- 路径：`.preparation/phase6-apks/department-steward-0.2.2-intranet.apk`。
- APP：部门小管家；applicationId：com.company.departmentsteward；版本：0.2.2 / versionCode 4。
- 服务：http://192.168.0.253:8088；大小：4,289,370 字节。
- SHA256：95808EC2AAA5254EB5715BBB951F099EB810B688A3721B23313C48B749599746。
- 签名证书 SHA256：5bebd725bbbec6ae0887ca23afb461bc1d0edac42edcaa30ba02ec6d118c08d2，与旧版相同。
- Gradle assembleDebug 成功；最终 artifact 检查通过（签名、包名、versionCode、实际服务地址、无嵌套 APK、HTTP WebView 配置）。原生功能测试使用相同源码 QA 配置包；最终内网包是构建和静态产物校验，不冒充正式业务端到端验收。
- 禁止分发该目录下其他 QA 包及早期 candidate-intranet.apk。正式下载页仍为 0.2.1 / versionCode 3，未替换。

## 独立部署与隔离

- 仅 QA Web 更新，API 保持第五阶段；服务器测试地址依然仅绑定 127.0.0.1:18088，项目 business-management-test，测试数据/网络/卷独立。
- 已确认服务器最终 Web 资源与本机一致：index-DbGJ1Il7.js、index-CLACT5f9.css；服务器 main.tsx 与 sw.js 的 SHA256 均与本地一致。
- 第六阶段首次 QA 回滚快照：D:\BusinessManagementAppTesting\rollback\20260908-204930；数据库备份 SHA256：5E3C07A1AB6B1771E34AC37DD6911E8B6C6F375E92CA2FC23B4A91A70C12FCC8。随后最终 Web 更新仍仅限 QA。
- 2026-09-09T13:33:19.2415778+08:00 隔离核验通过：正式商务/检测容器 ID、镜像、启动/重启及端口与准备阶段基线一致；7 份备份哈希一致；测试网络内部隔离、loopback 绑定正确；Web 200，测试及正式 API ready。
- 服务器核验记录：D:\BusinessManagementAppTesting\preparation-verification.json。本轮没有 Git 暂存、提交、推送及正式下载发布。

## 后续门槛（不伪记完成）

- 有设备后补做厂商 ROM、真实 Wi-Fi/VPN 断开恢复、拨号/地图跳转和真机升级兼容性；此前 Office 实机验收仍待安排。
- 正式发布需单独确认、备份及上线冒烟；目前只是独立环境验收完成。
- 按用户决定暂不启用 HTTPS。HTTP 不加密密码、令牌及业务内容；仅用于受控内网，公网 HTTPS 和访问准入单独安排。

## 2026-09-09 USB 真机补验（进行中）

- 用户连接 Android 13 / ANY_AN00 手机并接入公司 VPN，USB 调试已授权。初始没有安装本应用，故本次不能记为旧版覆盖升级。
- 已重新校验上述最终 APK，首次安装 0.2.2 / versionCode 4 成功，并打开应用。
- 手机 shell 及应用自身 WebView 分别请求公司 HTTP readiness，均为 HTTP 200 / ready；实际 WebView 请求验证了 VPN、HTTP 与 CORS 联通，没有使用 USB 网络反向代理。
- 未登录、未新增或修改正式业务数据。待用户自行登录后继续业务交互；真机旧版覆盖、VPN 断开恢复等仍未验收，不因连通性通过而自动勾选。
