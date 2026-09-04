# 商务活动管理 / 部门小管家

稳健企业蓝风格的部门商务活动管理原型：

- Web 端产品名：商务活动管理
- Android / iOS / PWA 产品名：部门小管家
- 当前阶段：响应式前端原型，数据保存在浏览器 `localStorage`

## 本地运行

```bash
npm install
npm run dev
```

生产构建：

```bash
npm run build
```

## 移动端

项目使用 Capacitor 共享 Web 端业务代码：

```bash
npm run mobile:sync
npm run mobile:android
npm run mobile:ios
```

Windows 可以生成并维护 iOS 工程，但最终签名和打包必须在安装 Xcode 的 macOS 设备上完成。

发布前需将 `capacitor.config.ts` 中的 `appId` 替换为公司的正式反向域名标识。

## 当前原型功能

- 工作台数据概览、拜访计划、待办和部门动态
- 客户、拜访、待办、日历、统计和设置页面
- 新建拜访、新建待办、添加客户
- 拜访详情抽屉、待办完成状态切换、全局搜索和通知面板
- 桌面导航、移动端底部导航和 PWA 安装信息

下一阶段需接入真实 API、数据库、统一认证、文件存储、审计日志及消息提醒。

