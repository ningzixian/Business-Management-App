# v0.2.7 内网发布记录

发布时间：2026-09-10 09:03:01 +08:00。

## 发布内容

- 修复 Android WebView 中表单打开后自动滚到底部的问题。
- 新建及维护表单改用明确的移动端纵向滚动区域，可从底部上拉回顶部。
- 弹窗初始焦点改为无滚动聚焦弹窗容器，避免 WebView 自动追踪控件。
- Web 前端同步相同修复；API、数据库、对象存储和现场检测业务未更新。

## Android

- 版本：0.2.7，versionCode 9。
- 下载页：http://192.168.0.253:8088/downloads/
- APK：`/downloads/department-steward-0.2.7.apk`
- 文件大小：4,296,658 字节。
- SHA-256：`CFA80D811CF50E9AABCAE1F2D0A7BB04E778F36F993D944CB4F12F171DE388E4`。
- 签名证书 SHA-256：`5bebd725bbbec6ae0887ca23afb461bc1d0edac42edcaa30ba02ec6d118c08d2`，与旧版一致，可覆盖安装。

## 部署与验证

- 发布目录：`D:\BusinessManagementApp\releases\web-mobile-scroll-20260910-090102`。
- Web 静态入口：`/assets/index-EsesQkq2.js`。
- 仅重建并替换 `business-management-web-1`；API 未重启。
- 其他商务容器和检测业务容器在切换前后身份、镜像、启动时间、重启次数及端口一致。
- 线上 API readiness 为 `ready`。
- 线上 APK 下载后的长度及 SHA-256 与发布清单一致。
- 360px、1440px 线上登录页及下载页冒烟测试通过，无脚本错误或横向溢出。
- 390×844 合成移动视口的新建及管理表单滚动回归通过。

本次未执行 Git add、commit 或 push。
