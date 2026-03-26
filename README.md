# Mastodon Feed Listener

一个用于监控 Mastodon 用户 Feed 的浏览器插件，支持登录认证和发布功能。

## 功能特性

### 核心功能

- **多实例支持**：支持监控任意 Mastodon 实例上的用户
- **多种通知方式**：
  - 浏览器原生通知
  - API Webhook 通知
  - SMTP 邮件通知
- **实时监控**：自动定期检查被监控用户的最新帖子

### v2.0 新增功能

- **OAuth2 登录**：支持通过 Mastodon 实例进行 OAuth2 认证登录
- **退出登录**：支持安全退出并撤销访问令牌
- **发布 Feed**：登录后可直接通过插件发布嘟文
  - 支持设置可见性（公开/不公开列表/仅关注者/私信）
  - 支持添加内容警告 (CW)
  - 支持 Ctrl/Cmd + Enter 快捷发布

## 技术栈

- **TypeScript** - 类型安全的 JavaScript 超集
- **Webpack** - 模块打包工具
- **Mastodon API** - REST API 和 OAuth2 认证
- **Chrome Extension API**：
  - `chrome.storage.local` - 本地存储
  - `chrome.alarms` - 定时任务
  - `chrome.notifications` - 浏览器通知
  - `chrome.identity` - OAuth2 认证

## 目录结构

```
mastodon-feed-listener/
├── src/
│   ├── background/
│   │   └── service-worker.ts    # 后台服务脚本
│   ├── popup/
│   │   ├── popup.html           # 设置界面
│   │   └── popup.ts             # 设置界面逻辑
│   ├── styles/
│   │   └── popup.css            # 样式文件
│   ├── types/
│   │   └── index.ts             # TypeScript 类型定义
│   ├── utils/
│   │   ├── api.ts               # Mastodon API 封装
│   │   ├── oauth.ts             # OAuth2 认证逻辑
│   │   └── storage.ts           # 存储工具
│   └── manifest.json            # 插件配置文件
├── icons/
│   └── icon.svg                 # 插件图标
├── dist/                        # 构建输出目录
├── package.json
├── tsconfig.json
├── webpack.config.js
├── FEATURES.md                  # 功能详细文档
└── README.md
```

## 安装使用

### 前置要求

- Node.js 18+
- npm 或 yarn

### 安装步骤

1. 克隆或下载项目

2. 进入项目目录并安装依赖：
   ```bash
   cd mastodon-feed-listener
   npm install
   ```

3. 构建项目：
   ```bash
   npm run build
   ```

4. 在 Chrome 浏览器中加载插件：
   - 打开 `chrome://extensions/`
   - 开启右上角的「开发者模式」
   - 点击「加载已解压的扩展程序」
   - 选择项目的 `dist` 目录

## 使用指南

### 登录 Mastodon

1. 点击浏览器工具栏中的插件图标
2. 在「登录 Mastodon」区域输入实例地址（如 `mastodon.social`）
3. 点击「登录」按钮
4. 在弹出的授权页面中确认授权
5. 授权成功后返回插件，显示用户信息

### 发布 Feed

1. 登录后，在「发布新 Feed」区域输入内容
2. 选择可见性（默认为公开）
3. 可选：勾选「添加内容警告」并输入警告文本
4. 点击「发布」按钮或按 `Ctrl/Cmd + Enter`

### 监控用户

1. 在「监控设置」区域填写：
   - **Mastodon 实例**：如 `mastodon.social`
   - **用户名**：目标用户的用户名（不带 @ 符号）
2. 点击「添加监控」按钮
3. 在「已监控用户」列表中管理监控项

### 配置通知

在「通知设置」区域选择通知方式：

#### 浏览器通知
- 勾选「启用通知」
- 选择「浏览器通知」

#### API 通知 (Webhook)
- 选择「API 通知」
- 填写 Webhook 地址和 API Key

#### SMTP 邮件通知
- 选择「SMTP 邮件通知」
- 配置 SMTP 服务器信息

## 开发命令

```bash
# 安装依赖
npm install

# 开发模式（监听文件变化自动构建）
npm run dev

# 生产构建
npm run build

# 类型检查
npm run typecheck
```

## API 参考

本插件基于 Mastodon REST API，主要使用以下接口：

### OAuth2 认证

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/v1/apps` | POST | 创建 OAuth 应用 |
| `/oauth/authorize` | GET | 获取授权码 |
| `/oauth/token` | POST | 获取/刷新访问令牌 |
| `/oauth/revoke` | POST | 撤销令牌 |

### 账户相关

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/v1/accounts/verify_credentials` | GET | 验证凭证 |
| `/api/v1/accounts/lookup` | GET | 查找用户 |
| `/api/v1/accounts/:id/statuses` | GET | 获取用户嘟文 |

### 状态发布

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/v1/statuses` | POST | 发布嘟文 |

详细 API 文档请参考：[Mastodon API 文档](https://docs.joinmastodon.org/client/)

## 权限说明

本插件请求以下权限：

| 权限 | 说明 |
|------|------|
| `storage` | 存储监控配置和登录凭证 |
| `alarms` | 设置定时检查任务 |
| `notifications` | 发送浏览器通知 |
| `identity` | OAuth2 认证 |
| `host_permissions` | 访问 Mastodon 实例 API |

## 注意事项

1. **令牌安全**：访问令牌存储在浏览器本地，不会上传到任何服务器
2. **实例兼容**：支持所有标准 Mastodon 实例
3. **字符限制**：大多数实例限制 500 字符，部分实例可能不同
4. **浏览器要求**：需要保持浏览器运行以执行后台任务

## 更新日志

### v2.0.0
- 新增 OAuth2 登录/退出功能
- 新增发布 Feed 功能
- 支持 CW（内容警告）
- 支持设置嘟文可见性
- 项目迁移到 TypeScript
- 优化 UI 界面

### v1.0.0
- 基础监控功能
- 多实例支持
- 多种通知方式

## 许可证

MIT License

## 相关链接

- [Mastodon 官网](https://joinmastodon.org/)
- [Mastodon API 文档](https://docs.joinmastodon.org/client/)
- [Mastodon GitHub](https://github.com/mastodon/mastodon)
