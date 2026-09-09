# APP 登录页改造 · 2026-09-09

底部断层修复：真实 Chrome 99 WebView 不支持 100dvh，登录背景仅高 626.53px，视口为 766px，露出 body 灰底。增加先 100vh 后 100dvh 的渐进兼容声明；表单区域弹性占满剩余高度，底部网络提示自然靠下，短屏可滚动。五尺寸测试通过；同签名安装 `.preparation/app-auth/department-steward-0.2.4-full-height.apk` 后真机视口/登录背景均 766px，横向宽度均 360px。该包 SHA256 CC9E6C1D74C1E5CA0897DE06BBA59BD69E350AF74502D724E1073617ED88BE4A，仍未发布服务器。

最新调整：品牌名称及说明改为图标右侧，登录模式移除欢迎文案；登录页“连接帮助与版本更新”入口移除。保留原生 MainActivity.onResume → VerifiedUpdater.resumed → check(false) 自动更新检查（最短一分钟间隔、无需登录、无新版本/网络失败不弹窗），设置页原有入口未改。服务器版本元数据尚未正式更新，不能据此声称新版已在服务器发布。五尺寸登录测试及构建通过；本机最新预览包为 `.preparation/app-auth/department-steward-0.2.4-auto-update.apk`。

- APP / 小屏使用独立部门小管家品牌头、无桌面卡片的纵向表单、56px 输入区域和 54px 主按钮，企业蓝延续既有风格。桌面保留双栏登录布局。
- 登录/注册共用原有认证逻辑；增加密码显隐、空用户名提示、提交期间禁止切换模式、可访问错误信息；网络诊断/更新收纳到底部帮助，默认折叠。
- 使用 safe-area 和自然页面滚动适应窄屏、短屏和键盘占用空间，不用固定定位遮挡提交入口。
- npm run verify 的 53 项通过。最终可访问标签微调后重新构建通过；tests/app-auth-browser.cjs 验证 360x800、390x844、390x450、980x800、1440x900，登录错误保留、显隐、注册密码不一致拦截、无横向溢出通过。短视口测试不是实体键盘全流程验收。
- 安卓版本 0.2.3 / versionCode 5；APK 为 `.preparation/app-auth/department-steward-0.2.3-intranet.apk`，4,291,130 字节，SHA256 F1A718502748A1C63E644DED62B36F4FC20BE8951DCB527F0BAEDB7621DF8D21。
- 签名、包名、版本、内网 HTTP 地址、无嵌套包等产物校验通过；已在用户 Android 13 手机同签名覆盖 0.2.2，未卸载或清理数据。设备回读版本 0.2.3，WebView 确认 APP 登录布局启用且无横向溢出。
- 没有登录账号或写入正式业务；没有更新公司服务器、正式下载页或 Git 提交。0.2.2 第六阶段记录为历史产物，本次预览使用 0.2.3。

## 真机 WebView 兼容修复

- 用户登录后发现外层仍呈桌面样式。实测手机 WebView 为 Chrome 99：传统 max-width 查询返回 true，但编译后的媒体范围语法 `(width <= 980px)` 返回 false。React 已加载 mobile-page，CSS 却仍显示桌面侧栏并隐藏底部导航；旧模拟器及现代桌面浏览器没有暴露这个兼容问题。
- vite.config.ts 明确设置 JS/CSS 目标 chrome99，产物回到传统媒体查询语法；新增 tests/webview-css-compat.cjs，检查编译产物，避免只检查源码导致漏测。
- 最新本地预览包为 `.preparation/app-auth/department-steward-0.2.3-webview99.apk`，4,291,691 字节，SHA256 A5592423C3CA1517BE0365FC14774C56BDBD20BD8EB9B972F66C7D9CD9BA9D65。仍属未发布的 0.2.3 / versionCode 5 预览迭代；包含输入框蓝色外轮廓/光圈移除修复。此前同版本包不应作为最终发布产物。
- 已同签名覆盖用户手机，保留登录状态；实测 sidebar=none、底部导航=grid、主页面=mobile-dashboard-page，clientWidth/scrollWidth/innerWidth 均为 360（修复前横向溢出至 629）。没有触碰用户业务数据或服务器部署。
