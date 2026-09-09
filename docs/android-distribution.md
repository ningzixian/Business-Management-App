# 安卓内网分发

- 下载页： http://192.168.0.253:8088/downloads/
- 最新版本元数据： `/downloads/android.json`
- 当前为沿用原调试签名的内测包。后续更新必须保持 applicationId 和签名一致，递增 versionCode。请妥善保管签名文件；更换正式签名前应规划迁移。
- 2026-09-09 正式下载已更新为 0.2.5 / versionCode 7，校验值、备份和验收见 release-20260909.md。0.2.2–0.2.4 均为此前本机预览；不要分发 .preparation 内的旧候选包。
- 0.2.1 使用旧下载页流程；首次升级至 0.2.2 通过旧流程或手动同签名覆盖，不卸载旧版。0.2.2 启动或回前台自动检查（最短一分钟），登录/设置网络诊断提供手动检查。自动检查失败不打扰，手动失败明确提示重试。
- 0.2.2 有新版时确认下载至私有缓存，校验大小、SHA256、包名、版本及签名，再交给安卓系统确认安装；可以取消下载/安装，不支持静默安装或断点续传。未知来源未授权时不会安装。
- 地址统一来自 `.env.mobile.local` 的 `VITE_API_BASE_URL=http://192.168.0.253:8088/api/v1`；构建环境变量优先。依次执行 `npm run build:mobile`、`npx cap sync android`，在 android 目录执行 `gradlew.bat assembleDebug`。前端和原生读取生成配置，不再修改 MainActivity BASE。
- APP 内部 `https://localhost` 是本地页面来源，不是公司服务器 HTTPS；保留它以延续旧版数据存储来源。内网 HTTP 构建启用所需的 WebView mixed-content 兼容。手机包不捆绑旧 APK，不注册 service worker；仅清理自身旧静态缓存，不清除会话和草稿。
- 正式发布须另行确认。更新 Gradle 版本并生成同签名 APK，先运行 `deployment/verify-android-artifact.ps1 -ApkPath <包路径> -ExpectedOrigin http://192.168.0.253:8088 -ExpectedVersionCode <版本号>`；验证签名、实际地址、版本、无嵌套 APK 及 WebView 配置。
- 校验后放入 public/downloads，更新 android.json 的版本、相对路径、字节数和 SHA256，再执行 deployment/publish-downloads.ps1，传入 Credential 和 ExpectedServiceOrigin。不得分发 QA 测试包或早期 candidate-intranet.apk；凭据不存入脚本或 Git。
- 用户决定暂不启用 HTTPS，当前 HTTP 仅限可信公司内网：密码、令牌和业务内容不加密，哈希及同签名校验不能替代 HTTPS 的传输保护。公网部署前另行完成 HTTPS 和访问准入验收。
- 每次发布需用目标真机验证旧版覆盖、账号/草稿保留、提示/取消、Wi-Fi/VPN 断开恢复及授权流程；模拟器通过不等于厂商 ROM 兼容性全部通过。
