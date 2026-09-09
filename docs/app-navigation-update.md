# APP 导航调整 · 2026-09-09

- 底部顺序：工作台、拜访、待办、日历、统计，各自独立高亮；组织、人脉保留侧边菜单入口。桌面侧栏不变。
- APP 侧边抽屉由 min(320px,86vw) 收窄为 min(264px,76vw)，移除背景模糊、减轻阴影；220ms transform/opacity 开关动画，退出结束后再卸载并恢复焦点。支持返回、Esc、外部点击、关闭按钮和路由选择；尊重减少动态效果设置。
- 用户明确要求通知先不动，已撤销本轮临时提示改动。正式服务器 GET /api/v1/notifications 返回 404，未部署通知后端或数据库迁移，现有报错仍待后续发布处理。
- npm run verify：53 项通过；新增 app-navigation.cjs 在 360/390/980 验证导航顺序、高亮、宽度、退出生命周期、所有关闭路径、减少动态效果。phase5-browser.cjs 六尺寸回归通过，WebView 99 媒体查询产物检查通过。
- 0.2.4 / versionCode 6 已同签名覆盖用户手机并启动，无卸载、无业务数据修改。真机回读底部顺序正确、菜单宽度 264px、无 backdrop blur，打开定位与关闭卸载正常。
- APK：.preparation/app-auth/department-steward-0.2.4-intranet.apk；4,291,350 字节；SHA256 DA70BE09848CB66F96E780A65BFC6EB4A7E97BA6D067C445BE41FD1AE053559F。地址/签名/包名/版本校验通过。仅本机预览，未更新正式下载页、服务器或 Git 提交。
